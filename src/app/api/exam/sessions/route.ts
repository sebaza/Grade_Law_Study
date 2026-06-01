import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/auth/user-profile";
import { getPrisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const examSessionRequestSchema = z.object({
  limit: z.number().int().min(1).max(12).default(3),
  perQuestionSeconds: z.number().int().min(60).max(900).default(900),
  strategy: z.enum(["balanced", "priority", "weak"]).default("balanced"),
  filters: z
    .object({
      difficulty: z.enum(["low", "medium", "high"]).optional(),
      professor: z.string().optional(),
    })
    .default({}),
});

function pickBalancedByArea<T extends { areaId: string }>(questions: T[], limit: number) {
  const byArea = new Map<string, T[]>();

  for (const question of questions) {
    const group = byArea.get(question.areaId) ?? [];
    group.push(question);
    byArea.set(question.areaId, group);
  }

  const selected: T[] = [];

  for (const group of byArea.values()) {
    if (selected.length >= limit) break;
    const question = group.shift();
    if (question) selected.push(question);
  }

  for (const question of questions) {
    if (selected.length >= limit) break;
    if (!selected.some((selectedQuestion) => selectedQuestion === question)) {
      selected.push(question);
    }
  }

  return selected.slice(0, limit);
}

export async function POST(request: Request) {
  const parsed = examSessionRequestSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  await ensureUserProfile(data.user);

  const db = getPrisma();
  const { filters, limit, perQuestionSeconds, strategy } = parsed.data;
  const candidateLimit = Math.min(limit * 8, 120);

  const candidates = await db.question.findMany({
    where: {
      isActive: true,
      difficulty: filters.difficulty,
      professors: filters.professor ? { some: { professor: { name: filters.professor } } } : undefined,
      NOT: {
        states: {
          some: {
            userId: data.user.id,
            isExcluded: true,
          },
        },
      },
      states:
        strategy === "weak"
          ? { some: { userId: data.user.id, averageScore: { lt: 65 }, attemptCount: { gt: 0 } } }
          : undefined,
    },
    include: {
      area: true,
      subject: true,
      subsubject: true,
      professors: { include: { professor: true } },
      states: { where: { userId: data.user.id }, take: 1 },
      _count: { select: { keyPoints: true } },
    },
    orderBy: [{ priorityScore: "desc" }, { estimatedProbability: "desc" }],
    take: candidateLimit,
  });

  const selected = strategy === "balanced" ? pickBalancedByArea(candidates, limit) : candidates.slice(0, limit);

  if (selected.length === 0) {
    return NextResponse.json(
      { error: "No hay preguntas disponibles para iniciar el simulacro con esos filtros." },
      { status: 404 },
    );
  }

  const session = await db.practiceSession.create({
    data: {
      userId: data.user.id,
      mode: "random",
      filters: {
        examMode: true,
        strategy,
        perQuestionSeconds,
        difficulty: filters.difficulty ?? null,
        professor: filters.professor ?? null,
      },
      totalQuestions: selected.length,
    },
  });

  for (const question of selected) {
    await db.studentQuestionState.upsert({
      where: {
        userId_questionId: {
          userId: data.user.id,
          questionId: question.id,
        },
      },
      create: {
        userId: data.user.id,
        questionId: question.id,
        status: "in_practice",
      },
      update: question.states[0]?.status === "pending" ? { status: "in_practice" } : {},
    });
  }

  const [professors] = await Promise.all([
    db.professor.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  return NextResponse.json({
    sessionId: session.id,
    mode: "exam",
    config: {
      limit: selected.length,
      perQuestionSeconds,
      totalSeconds: selected.length * perQuestionSeconds,
      strategy,
    },
    facets: {
      professors: professors.map((professor) => professor.name),
      difficulties: ["low", "medium", "high"],
    },
    questions: selected.map((question) => ({
      id: question.id,
      statement: question.statement,
      areaName: question.area.name,
      subjectName: question.subject?.name ?? "Sin materia",
      subsubjectName: question.subsubject?.name ?? "Sin submateria",
      professorName: question.professors.map((link) => link.professor.name).join(", ") || "Sin profesor",
      difficulty: question.difficulty,
      estimatedProbability: Number(question.estimatedProbability),
      priorityScore: Number(question.priorityScore),
      keyPointCount: question._count.keyPoints,
      attemptCount: question.states[0]?.attemptCount ?? 0,
      bestScore: Number(question.states[0]?.bestScore ?? 0),
    })),
  });
}
