import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/auth/user-profile";
import { assessAnswerForFollowUp, evaluateAnswer } from "@/lib/ai/evaluate-answer";
import { getPrisma } from "@/lib/db/prisma";
import { evaluationRequestSchema } from "@/lib/domain/evaluation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatCombinedAnswer(initialAnswer: string, followUpAnswer?: string) {
  if (!followUpAnswer?.trim()) return initialAnswer;

  return [
    "Respuesta inicial:",
    initialAnswer.trim(),
    "",
    "Respuesta complementaria:",
    followUpAnswer.trim(),
  ].join("\n");
}

function formatStoredTranscription(answer: string, transcription?: string, followUpAnswer?: string) {
  const initialTranscription = transcription?.trim() ? transcription : answer;

  return formatCombinedAnswer(initialTranscription, followUpAnswer);
}

export async function POST(request: Request) {
  const parsed = evaluationRequestSchema.safeParse(await request.json());

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
  const question = await db.question.findUnique({
    where: { id: parsed.data.questionId },
    include: {
      expectedAnswers: { where: { isActive: true }, orderBy: { version: "desc" }, take: 1 },
      keyPoints: { orderBy: { orderIndex: "asc" } },
      commonErrors: true,
    },
  });

  if (!question) {
    return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 });
  }

  if (parsed.data.sessionId) {
    const session = await db.practiceSession.findFirst({
      where: {
        id: parsed.data.sessionId,
        userId: data.user.id,
      },
      select: { id: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Sesión de práctica no encontrada" }, { status: 404 });
    }
  }

  const expectedAnswer = question.expectedAnswers[0]?.modelAnswer ?? "";
  const keyPoints = question.keyPoints.map((point) => `${point.label}: ${point.description}`);
  const commonErrors = question.commonErrors.map((error) => error.description);

  if (!parsed.data.followUp) {
    const followUpDecision = await assessAnswerForFollowUp({
      question: question.statement,
      expectedAnswer,
      keyPoints,
      commonErrors,
      studentAnswer: parsed.data.answer,
    });

    if (followUpDecision.requiresFollowUp) {
      return NextResponse.json({
        status: "requires_follow_up",
        followUp: {
          question: followUpDecision.followUpQuestion,
          reason: followUpDecision.reason,
          targetCriteria: followUpDecision.targetCriteria,
        },
      });
    }
  }

  const answerForEvaluation = formatCombinedAnswer(parsed.data.answer, parsed.data.followUp?.answer);
  const transcriptionForStorage = parsed.data.answerMode === "voice"
    ? formatStoredTranscription(parsed.data.answer, parsed.data.transcription, parsed.data.followUp?.answer)
    : undefined;
  const evaluation = await evaluateAnswer({
    question: question.statement,
    expectedAnswer,
    keyPoints,
    commonErrors,
    studentAnswer: answerForEvaluation,
    adaptiveContext: parsed.data.followUp
      ? {
          followUpQuestion: parsed.data.followUp.question,
          followUpAnswer: parsed.data.followUp.answer,
        }
      : undefined,
  });

  const postStatus = evaluation.percentage >= 85 ? "mastered" : evaluation.percentage >= 60 ? "answered" : "needs_review";

  const attempt = await db.practiceAttempt.create({
    data: {
      sessionId: parsed.data.sessionId,
      userId: data.user.id,
      questionId: question.id,
      answerMode: parsed.data.answerMode,
      rawAnswer: answerForEvaluation,
      transcription: transcriptionForStorage,
      audioPath: parsed.data.audioPath,
      score: evaluation.percentage,
      rubricScore: evaluation.rubric,
      timeSeconds: parsed.data.timeSeconds,
      postStatus,
      feedback: {
        create: {
          summary: evaluation.summary,
          correctPoints: evaluation.correctKeyPoints,
          missingPoints: evaluation.missingKeyPoints,
          conceptualErrors: evaluation.conceptualErrors,
          improvementSuggestions: evaluation.improvementRecommendation,
          modelAnswerSuggested: evaluation.modelAnswer,
        },
      },
    },
    include: { feedback: true },
  });

  const keyPointMatches = question.keyPoints.map((point) => {
    const matched = evaluation.correctKeyPoints.some((correctPoint) =>
      correctPoint.includes(point.description) || point.description.includes(correctPoint),
    );

    return {
      attemptId: attempt.id,
      keyPointId: point.id,
      matched,
      confidence: matched ? 0.85 : 0.2,
      comment: matched ? "Detectado por evaluación IA" : "No detectado por evaluación IA",
    };
  });

  if (keyPointMatches.length > 0) {
    await db.attemptKeyPoint.createMany({ data: keyPointMatches });
  }

  const questionProgress = await db.practiceAttempt.aggregate({
    where: {
      userId: data.user.id,
      questionId: question.id,
    },
    _avg: { score: true },
    _max: { score: true },
    _count: true,
  });

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
      status: postStatus,
      lastAttemptAt: new Date(),
      bestScore: evaluation.percentage,
      averageScore: evaluation.percentage,
      attemptCount: 1,
    },
    update: {
      status: postStatus,
      lastAttemptAt: new Date(),
      bestScore: Number(questionProgress._max.score ?? evaluation.percentage),
      averageScore: Number(questionProgress._avg.score ?? evaluation.percentage),
      attemptCount: questionProgress._count,
    },
  });

  if (parsed.data.sessionId) {
    const sessionProgress = await db.practiceAttempt.aggregate({
      where: {
        userId: data.user.id,
        sessionId: parsed.data.sessionId,
      },
      _avg: { score: true },
      _sum: { timeSeconds: true },
    });

    await db.practiceSession.updateMany({
      where: {
        id: parsed.data.sessionId,
        userId: data.user.id,
      },
      data: {
        averageScore: Number(sessionProgress._avg.score ?? 0),
        totalTimeSeconds: sessionProgress._sum.timeSeconds ?? 0,
      },
    });
  }

  return NextResponse.json({
    status: "evaluated",
    attemptId: attempt.id,
    evaluation,
    adaptive: {
      usedFollowUp: Boolean(parsed.data.followUp),
    },
  });
}
