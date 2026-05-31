import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/auth/user-profile";
import { getPrisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ScoreRow = {
  label: string;
  average_score: number | null;
  attempts: bigint;
};

type TimelineRow = {
  day: string;
  average_score: number | null;
  attempts: bigint;
};

type DifficultQuestionRow = {
  question_id: string;
  statement: string;
  subject: string;
  average_score: number | null;
  attempts: bigint;
};

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  await ensureUserProfile(data.user);

  const db = getPrisma();
  const [
    totalQuestions,
    practicedQuestionCount,
    statusCounts,
    attemptsAggregate,
    sessionCount,
    recentSessions,
    scoreTimeline,
    bySubject,
    byArea,
    byProfessor,
    difficultQuestions,
  ] = await Promise.all([
    db.question.count({ where: { isActive: true } }),
    db.studentQuestionState.count({ where: { userId: data.user.id, attemptCount: { gt: 0 } } }),
    db.studentQuestionState.groupBy({
      by: ["status"],
      where: { userId: data.user.id },
      _count: true,
    }),
    db.practiceAttempt.aggregate({
      where: { userId: data.user.id },
      _avg: { score: true },
      _sum: { timeSeconds: true },
      _count: true,
    }),
    db.practiceSession.count({ where: { userId: data.user.id } }),
    db.practiceSession.findMany({
      where: { userId: data.user.id },
      orderBy: { startedAt: "desc" },
      take: 8,
      include: { _count: { select: { attempts: true } } },
    }),
    db.$queryRaw<TimelineRow[]>`
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
             avg(score)::float as average_score,
             count(*)::bigint as attempts
      from practice_attempts
      where user_id = ${data.user.id}::uuid
      group by date_trunc('day', created_at)
      order by day asc
      limit 30
    `,
    db.$queryRaw<ScoreRow[]>`
      select coalesce(s.name, 'Sin materia') as label,
             avg(pa.score)::float as average_score,
             count(*)::bigint as attempts
      from practice_attempts pa
      join questions q on q.id = pa.question_id
      left join subjects s on s.id = q.subject_id
      where pa.user_id = ${data.user.id}::uuid
      group by coalesce(s.name, 'Sin materia')
      order by avg(pa.score) desc
    `,
    db.$queryRaw<ScoreRow[]>`
      select la.name as label,
             avg(pa.score)::float as average_score,
             count(*)::bigint as attempts
      from practice_attempts pa
      join questions q on q.id = pa.question_id
      join law_areas la on la.id = q.area_id
      where pa.user_id = ${data.user.id}::uuid
      group by la.name
      order by avg(pa.score) desc
    `,
    db.$queryRaw<ScoreRow[]>`
      select p.name as label,
             avg(pa.score)::float as average_score,
             count(*)::bigint as attempts
      from practice_attempts pa
      join question_professors qp on qp.question_id = pa.question_id
      join professors p on p.id = qp.professor_id
      where pa.user_id = ${data.user.id}::uuid
      group by p.name
      order by avg(pa.score) desc
    `,
    db.$queryRaw<DifficultQuestionRow[]>`
      select q.id as question_id,
             q.statement,
             coalesce(s.name, 'Sin materia') as subject,
             avg(pa.score)::float as average_score,
             count(*)::bigint as attempts
      from practice_attempts pa
      join questions q on q.id = pa.question_id
      left join subjects s on s.id = q.subject_id
      where pa.user_id = ${data.user.id}::uuid
      group by q.id, q.statement, coalesce(s.name, 'Sin materia')
      having count(*) > 0
      order by avg(pa.score) asc, count(*) desc
      limit 8
    `,
  ]);

  const statusMap = new Map(statusCounts.map((row) => [row.status, row._count]));
  const excluded = statusMap.get("excluded") ?? 0;

  const formatScoreRows = (rows: ScoreRow[]) => rows.map((row) => ({
    label: row.label,
    averageScore: Math.round(Number(row.average_score ?? 0)),
    attempts: Number(row.attempts),
  }));

  return NextResponse.json({
    summary: {
      totalQuestions,
      practiced: practicedQuestionCount,
      pending: Math.max(totalQuestions - practicedQuestionCount - excluded, 0),
      mastered: statusMap.get("mastered") ?? 0,
      needsReview: statusMap.get("needs_review") ?? 0,
      excluded,
      answered: statusMap.get("answered") ?? 0,
      inPractice: statusMap.get("in_practice") ?? 0,
      attemptCount: attemptsAggregate._count,
      sessionCount,
      averageScore: Math.round(Number(attemptsAggregate._avg.score ?? 0)),
      totalTimeSeconds: attemptsAggregate._sum.timeSeconds ?? 0,
      progressPercentage: totalQuestions > 0 ? Math.round((practicedQuestionCount / totalQuestions) * 100) : 0,
    },
    scoreTimeline: scoreTimeline.map((row) => ({
      day: row.day,
      averageScore: Math.round(Number(row.average_score ?? 0)),
      attempts: Number(row.attempts),
    })),
    bySubject: formatScoreRows(bySubject),
    byArea: formatScoreRows(byArea),
    byProfessor: formatScoreRows(byProfessor),
    difficultQuestions: difficultQuestions.map((row) => ({
      questionId: row.question_id,
      statement: row.statement,
      subject: row.subject,
      averageScore: Math.round(Number(row.average_score ?? 0)),
      attempts: Number(row.attempts),
    })),
    recentSessions: recentSessions.map((session) => ({
      id: session.id,
      mode: session.mode,
      startedAt: session.startedAt.toISOString(),
      finishedAt: session.finishedAt?.toISOString() ?? null,
      totalQuestions: session.totalQuestions,
      averageScore: Number(session.averageScore),
      totalTimeSeconds: session.totalTimeSeconds,
      attemptCount: session._count.attempts,
    })),
  });
}
