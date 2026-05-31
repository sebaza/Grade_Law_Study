import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/auth/user-profile";
import { getPrisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const sessionRequestSchema = z.object({
  mode: z.enum(["random", "by_subject", "by_professor", "by_difficulty", "review", "weak_questions", "unpracticed"]).default("random"),
  limit: z.number().int().min(1).max(30).default(10),
  filters: z.object({
    area: z.string().optional(),
    professor: z.string().optional(),
    difficulty: z.enum(["low", "medium", "high"]).optional(),
  }).default({}),
});

function shuffle<T>(items: T[]) {
  return items
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

export async function POST(request: Request) {
  const parsed = sessionRequestSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "No autenticado", mode: "real" }, { status: 401 });
  }

  await ensureUserProfile(data.user);

  const db = getPrisma();
  const { filters, limit, mode } = parsed.data;
  const take = mode === "random" ? Math.min(limit * 5, 80) : limit;

  const questions = await db.question.findMany({
    where: {
      isActive: true,
      area: filters.area ? { name: filters.area } : undefined,
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
      states: mode === "review"
        ? { some: { userId: data.user.id, status: "needs_review" } }
        : mode === "weak_questions"
          ? { some: { userId: data.user.id, averageScore: { lt: 60 }, attemptCount: { gt: 0 } } }
          : mode === "unpracticed"
            ? { none: { userId: data.user.id } }
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
    take,
  });

  const selected = (mode === "random" ? shuffle(questions).slice(0, limit) : questions).slice(0, limit);

  const session = await db.practiceSession.create({
    data: {
      userId: data.user.id,
      mode,
      filters,
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

  const [areas, professors] = await Promise.all([
    db.lawArea.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    db.professor.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  return NextResponse.json({
    mode: "real",
    sessionId: session.id,
    count: selected.length,
    facets: {
      areas: areas.map((area) => area.name),
      professors: professors.map((professor) => professor.name),
      difficulties: ["low", "medium", "high"],
    },
    questions: selected.map((question) => ({
      id: question.id,
      sourceReference: question.sourceReference,
      statement: question.statement,
      areaName: question.area.name,
      subjectName: question.subject?.name ?? "Sin materia",
      subsubjectName: question.subsubject?.name ?? "Sin submateria",
      professorName: question.professors.map((link) => link.professor.name).join(", ") || "Sin profesor",
      difficulty: question.difficulty,
      estimatedProbability: Number(question.estimatedProbability),
      priorityScore: Number(question.priorityScore),
      questionType: question.questionType ?? "general",
      keyPointCount: question._count.keyPoints,
      status: question.states[0]?.status ?? "pending",
      isExcluded: question.states[0]?.isExcluded ?? false,
      attemptCount: question.states[0]?.attemptCount ?? 0,
      bestScore: Number(question.states[0]?.bestScore ?? 0),
    })),
  });
}
