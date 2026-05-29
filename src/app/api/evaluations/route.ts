import { NextResponse } from "next/server";
import { evaluateAnswer } from "@/lib/ai/evaluate-answer";
import { getPrisma } from "@/lib/db/prisma";
import { evaluationRequestSchema } from "@/lib/domain/evaluation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const expectedAnswer = question.expectedAnswers[0]?.modelAnswer ?? "";
  const evaluation = await evaluateAnswer({
    question: question.statement,
    expectedAnswer,
    keyPoints: question.keyPoints.map((point) => `${point.label}: ${point.description}`),
    commonErrors: question.commonErrors.map((error) => error.description),
    studentAnswer: parsed.data.answer,
  });

  const postStatus = evaluation.percentage >= 85 ? "mastered" : evaluation.percentage >= 60 ? "answered" : "needs_review";

  const attempt = await db.practiceAttempt.create({
    data: {
      userId: data.user.id,
      questionId: question.id,
      answerMode: parsed.data.answerMode,
      rawAnswer: parsed.data.answer,
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
      bestScore: { set: evaluation.percentage },
      averageScore: { set: evaluation.percentage },
      attemptCount: { increment: 1 },
    },
  });

  return NextResponse.json({ attemptId: attempt.id, evaluation });
}
