import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/auth/user-profile";
import { getPrisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  await ensureUserProfile(data.user);

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 30), 100);
  const db = getPrisma();

  const attempts = await db.practiceAttempt.findMany({
    where: { userId: data.user.id },
    include: {
      session: true,
      feedback: true,
      question: {
        include: {
          area: true,
          subject: true,
          subsubject: true,
          professors: { include: { professor: true } },
          states: {
            where: { userId: data.user.id },
            select: { status: true, attemptCount: true, bestScore: true, averageScore: true, isExcluded: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    attempts: attempts.map((attempt) => ({
      id: attempt.id,
      sessionId: attempt.sessionId,
      createdAt: attempt.createdAt.toISOString(),
      answerMode: attempt.answerMode,
      score: Number(attempt.score),
      timeSeconds: attempt.timeSeconds ?? 0,
      postStatus: attempt.postStatus,
      audioPath: attempt.audioPath,
      rawAnswer: attempt.rawAnswer,
      transcription: attempt.transcription,
      hasTranscription: Boolean(attempt.transcription),
      question: {
        id: attempt.question.id,
        statement: attempt.question.statement,
        areaName: attempt.question.area.name,
        subjectName: attempt.question.subject?.name ?? "Sin materia",
        subsubjectName: attempt.question.subsubject?.name ?? "Sin submateria",
        professorName: attempt.question.professors.map((link) => link.professor.name).join(", ") || "Sin profesor",
        difficulty: attempt.question.difficulty,
        estimatedProbability: Number(attempt.question.estimatedProbability),
        state: attempt.question.states[0]
          ? {
              status: attempt.question.states[0].status,
              attemptCount: attempt.question.states[0].attemptCount,
              bestScore: Number(attempt.question.states[0].bestScore),
              averageScore: Number(attempt.question.states[0].averageScore),
              isExcluded: attempt.question.states[0].isExcluded,
            }
          : null,
      },
      feedback: attempt.feedback
        ? {
            summary: attempt.feedback.summary,
            correctPoints: attempt.feedback.correctPoints,
            missingPoints: attempt.feedback.missingPoints,
            conceptualErrors: attempt.feedback.conceptualErrors,
            improvementSuggestions: attempt.feedback.improvementSuggestions,
            modelAnswerSuggested: attempt.feedback.modelAnswerSuggested,
          }
        : null,
    })),
  });
}
