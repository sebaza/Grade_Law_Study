import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/auth/user-profile";
import { getPrisma } from "@/lib/db/prisma";
import { getCachedBaseQuestions, getCachedFacets } from "@/lib/practice/server-cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const sessionRequestSchema = z.object({
  mode: z.enum(["random", "by_subject", "by_professor", "by_difficulty", "review", "weak_questions", "unpracticed"]).default("random"),
  limit: z.number().int().min(1).max(30).default(10),
  filters: z.object({
    area: z.string().optional(),
    subject: z.string().optional(),
    subsubject: z.string().optional(),
    professor: z.string().optional(),
    difficulty: z.enum(["low", "medium", "high"]).optional(),
    questionType: z.string().optional(),
    questionId: z.string().uuid().optional(),
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

  // Cached: base questions shared across all users (no user state, 5-min cache).
  // A direct question retry bypasses the broad pool so old/high-priority limits never hide it.
  const [baseQuestions, facets] = await Promise.all([
    filters.questionId
      ? db.question.findMany({
          where: { id: filters.questionId, isActive: true },
          include: {
            area: true,
            subject: true,
            subsubject: true,
            professors: { include: { professor: true } },
            _count: { select: { keyPoints: true } },
          },
          take: 1,
        }).then((questions) => questions.map((q) => ({
          id: q.id,
          sourceReference: q.sourceReference,
          statement: q.statement,
          areaName: q.area.name,
          subjectName: q.subject?.name ?? "Sin materia",
          subsubjectName: q.subsubject?.name ?? "Sin submateria",
          professorNames: q.professors.map((link) => link.professor.name),
          difficulty: q.difficulty,
          estimatedProbability: Number(q.estimatedProbability),
          priorityScore: Number(q.priorityScore),
          questionType: q.questionType ?? "general",
          keyPointCount: q._count.keyPoints,
        })))
      : getCachedBaseQuestions(
          filters.area ?? "",
          filters.professor ?? "",
          filters.difficulty ?? "",
          filters.subject ?? "",
          filters.subsubject ?? "",
          filters.questionType ?? "",
        ),
    getCachedFacets(),
  ]);

  // Dynamic: lightweight user-state lookup for these question IDs only
  const questionIds = baseQuestions.map((q) => q.id);
  const userStates = await db.studentQuestionState.findMany({
    where: { userId: data.user.id, questionId: { in: questionIds } },
    select: {
      questionId: true,
      status: true,
      isExcluded: true,
      attemptCount: true,
      bestScore: true,
      averageScore: true,
    },
  });
  const stateByQuestionId = new Map(userStates.map((s) => [s.questionId, s]));

  // Filter and apply mode-specific rules in memory (no extra DB round-trip)
  let eligible = baseQuestions.filter((q) => !stateByQuestionId.get(q.id)?.isExcluded);

  if (mode === "review") {
    eligible = eligible.filter((q) => stateByQuestionId.get(q.id)?.status === "needs_review");
  } else if (mode === "weak_questions") {
    eligible = eligible.filter((q) => {
      const s = stateByQuestionId.get(q.id);
      return s && Number(s.averageScore) < 60 && s.attemptCount > 0;
    });
  } else if (mode === "unpracticed") {
    eligible = eligible.filter((q) => !stateByQuestionId.has(q.id));
  }

  const pool = filters.questionId ? eligible : mode === "random" ? shuffle(eligible) : eligible;
  const selected = pool.slice(0, filters.questionId ? 1 : limit);

  const session = await db.practiceSession.create({
    data: {
      userId: data.user.id,
      mode,
      filters,
      totalQuestions: selected.length,
    },
  });

  await Promise.all(
    selected.map((question) => {
      const currentStatus = stateByQuestionId.get(question.id)?.status;
      return db.studentQuestionState.upsert({
        where: { userId_questionId: { userId: data.user.id, questionId: question.id } },
        create: { userId: data.user.id, questionId: question.id, status: "in_practice" },
        update: currentStatus === "pending" ? { status: "in_practice" } : {},
      });
    }),
  );

  return NextResponse.json({
    mode: "real",
    sessionId: session.id,
    count: selected.length,
    facets: {
      areas: facets.areas,
      subjects: facets.subjects,
      subsubjects: facets.subsubjects,
      professors: facets.professors,
      difficulties: ["low", "medium", "high"],
      questionTypes: facets.questionTypes,
    },
    questions: selected.map((q) => {
      const state = stateByQuestionId.get(q.id);
      return {
        id: q.id,
        sourceReference: q.sourceReference,
        statement: q.statement,
        areaName: q.areaName,
        subjectName: q.subjectName,
        subsubjectName: q.subsubjectName,
        professorName: q.professorNames.join(", ") || "Sin profesor",
        difficulty: q.difficulty,
        estimatedProbability: q.estimatedProbability,
        priorityScore: q.priorityScore,
        questionType: q.questionType,
        keyPointCount: q.keyPointCount,
        status: state?.status ?? "pending",
        isExcluded: state?.isExcluded ?? false,
        attemptCount: state?.attemptCount ?? 0,
        bestScore: Number(state?.bestScore ?? 0),
      };
    }),
  });
}
