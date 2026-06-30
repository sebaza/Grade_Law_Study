import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const difficultyValues = new Set(["low", "medium", "high"]);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export async function GET(request: Request) {
  const db = getPrisma();
  const { searchParams } = new URL(request.url);

  const page = clamp(Number(searchParams.get("page") ?? 1) || 1, 1, 10_000);
  const limit = clamp(Number(searchParams.get("limit") ?? 20) || 20, 1, 50);
  const q = searchParams.get("q")?.trim() || undefined;
  const area = searchParams.get("area")?.trim() || undefined;
  const areaId = searchParams.get("areaId")?.trim() || undefined;
  const subject = searchParams.get("subject")?.trim() || undefined;
  const subjectId = searchParams.get("subjectId")?.trim() || undefined;
  const subsubject = searchParams.get("subsubject")?.trim() || undefined;
  const professor = searchParams.get("professor")?.trim() || undefined;
  const professorId = searchParams.get("professorId")?.trim() || undefined;
  const rawDifficulty = searchParams.get("difficulty")?.trim() || undefined;
  const difficulty = rawDifficulty && difficultyValues.has(rawDifficulty) ? rawDifficulty : undefined;
  const questionType = searchParams.get("questionType")?.trim() || undefined;

  const where = {
    isActive: true,
    areaId,
    area: area ? { name: area } : undefined,
    subjectId,
    subject: subject ? { name: subject } : undefined,
    subsubject: subsubject ? { name: subsubject } : undefined,
    difficulty: difficulty as "low" | "medium" | "high" | undefined,
    questionType,
    statement: q ? { contains: q, mode: "insensitive" as const } : undefined,
    professors: professorId
      ? { some: { professorId } }
      : professor
        ? { some: { professor: { name: professor } } }
        : undefined,
  };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;

  // Keep these reads sequential: the deployed/local Prisma pool is configured with connection_limit=1.
  // Parallel facet reads can starve the pool and make the public bank hang under P2024 timeouts.
  const total = await db.question.count({ where });
  const questions = await db.question.findMany({
    where,
    include: {
      area: true,
      subject: true,
      subsubject: true,
      professors: { include: { professor: true } },
      _count: { select: { keyPoints: true, attempts: true } },
    },
    orderBy: [{ priorityScore: "desc" }, { estimatedProbability: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * limit,
    take: limit,
  });
  const areas = await db.lawArea.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const subjects = await db.subject.findMany({ orderBy: [{ area: { name: "asc" } }, { name: "asc" }], select: { id: true, areaId: true, name: true } });
  const subsubjects = await db.subsubject.findMany({ orderBy: [{ subject: { name: "asc" } }, { name: "asc" }], select: { id: true, subjectId: true, name: true } });
  const professors = await db.professor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const questionTypes = await db.question.findMany({
    where: { isActive: true, questionType: { not: null } },
    distinct: ["questionType"],
    orderBy: { questionType: "asc" },
    select: { questionType: true },
  });

  const questionIds = questions.map((question) => question.id);
  const states = userId && questionIds.length > 0
    ? await db.studentQuestionState.findMany({
        where: { userId, questionId: { in: questionIds } },
        select: {
          questionId: true,
          status: true,
          isFavorite: true,
          isExcluded: true,
          attemptCount: true,
          bestScore: true,
          averageScore: true,
        },
      })
    : [];
  const stateByQuestionId = new Map(states.map((state) => [state.questionId, state]));

  return NextResponse.json({
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
    facets: {
      areas,
      subjects,
      subsubjects,
      professors,
      difficulties: ["low", "medium", "high"],
      questionTypes: questionTypes
        .map((question) => question.questionType)
        .filter((value): value is string => Boolean(value)),
    },
    questions: questions.map((question) => {
      const state = stateByQuestionId.get(question.id);

      return {
        id: question.id,
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
        globalAttemptCount: question._count.attempts,
        status: state?.status ?? "pending",
        isFavorite: state?.isFavorite ?? false,
        isExcluded: state?.isExcluded ?? false,
        attemptCount: state?.attemptCount ?? 0,
        bestScore: Number(state?.bestScore ?? 0),
        averageScore: Number(state?.averageScore ?? 0),
      };
    }),
  });
}
