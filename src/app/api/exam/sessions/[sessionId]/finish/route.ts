import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/auth/user-profile";
import { getPrisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value ?? 0);
}

function buildVerdict(averageScore: number, answeredCount: number, totalQuestions: number, lowestScore: number) {
  if (answeredCount < totalQuestions) {
    return {
      status: "incomplete",
      label: "Simulacro incompleto",
      recommendation: "Terminá todas las preguntas antes de tomar este resultado como diagnóstico.",
    };
  }

  if (averageScore >= 70 && lowestScore >= 50) {
    return {
      status: "competent",
      label: "Competente",
      recommendation: "Buen resultado. Ahora repetí el simulacro con preguntas de mayor dificultad o profesores críticos.",
    };
  }

  return {
    status: "needs_practice",
    label: "Necesita refuerzo",
    recommendation: "No es fracaso; es diagnóstico. Repasá los puntos omitidos y repetí las preguntas con menor puntaje.",
  };
}

type StoredExamQuestion = {
  id: string;
  sectionIndex?: number;
  sectionQuestionNumber?: number;
  sectionTitle?: string;
  focusSubsubjectName?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readStoredExamQuestions(filters: unknown): StoredExamQuestion[] {
  if (!isObject(filters) || !Array.isArray(filters.selectedQuestions)) return [];

  return filters.selectedQuestions.flatMap((item): StoredExamQuestion[] => {
    if (!isObject(item) || typeof item.id !== "string") return [];

    return [
      {
        id: item.id,
        sectionIndex: typeof item.sectionIndex === "number" ? item.sectionIndex : undefined,
        sectionQuestionNumber:
          typeof item.sectionQuestionNumber === "number" ? item.sectionQuestionNumber : undefined,
        sectionTitle: typeof item.sectionTitle === "string" ? item.sectionTitle : undefined,
        focusSubsubjectName:
          typeof item.focusSubsubjectName === "string" ? item.focusSubsubjectName : undefined,
      },
    ];
  });
}

export async function POST(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  await ensureUserProfile(data.user);

  const db = getPrisma();
  const session = await db.practiceSession.findFirst({
    where: {
      id: sessionId,
      userId: data.user.id,
    },
    include: {
      attempts: {
        orderBy: { createdAt: "asc" },
        include: {
          question: {
            include: {
              area: true,
              subject: true,
              subsubject: true,
              expectedAnswers: { where: { isActive: true }, take: 1 },
              professors: { include: { professor: true } },
            },
          },
          feedback: true,
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Simulacro no encontrado" }, { status: 404 });
  }

  const answeredCount = session.attempts.length;
  const scores = session.attempts.map((attempt) => toNumber(attempt.score));
  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  const averageScore = answeredCount > 0 ? Math.round(totalScore / answeredCount) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
  const totalTimeSeconds = session.attempts.reduce((sum, attempt) => sum + (attempt.timeSeconds ?? 0), 0);
  const storedQuestions = readStoredExamQuestions(session.filters);
  const attemptByQuestionId = new Map(session.attempts.map((attempt) => [attempt.questionId, attempt]));
  const storedQuestionIds = storedQuestions.map((question) => question.id);
  const plannedQuestions =
    storedQuestionIds.length > 0
      ? await db.question.findMany({
          where: { id: { in: storedQuestionIds } },
          include: {
            area: true,
            subject: true,
            subsubject: true,
            expectedAnswers: { where: { isActive: true }, take: 1 },
            professors: { include: { professor: true } },
          },
        })
      : [];
  const plannedQuestionById = new Map(plannedQuestions.map((question) => [question.id, question]));
  const reviewPlan =
    storedQuestions.length > 0
      ? storedQuestions
      : session.attempts.map((attempt, index) => ({
          id: attempt.questionId,
          sectionIndex: undefined,
          sectionQuestionNumber: index + 1,
          sectionTitle: attempt.question.area.name,
          focusSubsubjectName: attempt.question.subsubject?.name ?? undefined,
        }));

  await db.practiceSession.updateMany({
    where: {
      id: sessionId,
      userId: data.user.id,
    },
    data: {
      finishedAt: new Date(),
      averageScore,
      totalTimeSeconds,
    },
  });

  return NextResponse.json({
    sessionId,
    totalQuestions: session.totalQuestions,
    answeredCount,
    averageScore,
    lowestScore,
    totalTimeSeconds,
    verdict: buildVerdict(averageScore, answeredCount, session.totalQuestions, lowestScore),
    questions: reviewPlan.flatMap((plannedQuestion) => {
      const attempt = attemptByQuestionId.get(plannedQuestion.id);
      const question = plannedQuestionById.get(plannedQuestion.id) ?? attempt?.question;

      if (!question) return [];

      return [
        {
          id: question.id,
          statement: question.statement,
          areaName: question.area.name,
          subjectName: question.subject?.name ?? "Sin materia",
          subsubjectName: question.subsubject?.name ?? "Sin submateria",
          professorName: question.professors.map((link) => link.professor.name).join(", ") || "Sin profesor",
          sectionIndex: plannedQuestion.sectionIndex,
          sectionQuestionNumber: plannedQuestion.sectionQuestionNumber,
          sectionTitle: plannedQuestion.sectionTitle ?? question.area.name,
          focusSubsubjectName: plannedQuestion.focusSubsubjectName ?? question.subsubject?.name ?? "Submateria mixta",
          answered: Boolean(attempt),
          score: attempt ? toNumber(attempt.score) : null,
          answerMode: attempt?.answerMode ?? null,
          timeSeconds: attempt?.timeSeconds ?? 0,
          postStatus: attempt?.postStatus ?? "pending",
          feedback: attempt?.feedback
            ? {
                summary: attempt.feedback.summary,
                missingPoints: attempt.feedback.missingPoints,
                improvementSuggestions: attempt.feedback.improvementSuggestions,
                modelAnswerSuggested: attempt.feedback.modelAnswerSuggested,
              }
            : null,
          modelAnswer:
            attempt?.feedback?.modelAnswerSuggested ?? question.expectedAnswers[0]?.modelAnswer ?? null,
        },
      ];
    }),
    attempts: session.attempts.map((attempt) => ({
      id: attempt.id,
      questionId: attempt.questionId,
      statement: attempt.question.statement,
      areaName: attempt.question.area.name,
      subjectName: attempt.question.subject?.name ?? "Sin materia",
      subsubjectName: attempt.question.subsubject?.name ?? "Sin submateria",
      professorName: attempt.question.professors.map((link) => link.professor.name).join(", ") || "Sin profesor",
      score: toNumber(attempt.score),
      answerMode: attempt.answerMode,
      timeSeconds: attempt.timeSeconds ?? 0,
      postStatus: attempt.postStatus,
      feedback: attempt.feedback
        ? {
            summary: attempt.feedback.summary,
            missingPoints: attempt.feedback.missingPoints,
            improvementSuggestions: attempt.feedback.improvementSuggestions,
            modelAnswerSuggested: attempt.feedback.modelAnswerSuggested,
          }
        : null,
      modelAnswer: attempt.feedback?.modelAnswerSuggested ?? attempt.question.expectedAnswers[0]?.modelAnswer ?? null,
    })),
  });
}
