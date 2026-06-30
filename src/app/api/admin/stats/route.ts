import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { isAdminAuthFailure, requireAdminUser } from "@/lib/auth/admin";
import { getPrisma } from "@/lib/db/prisma";

type CountRow = {
  label: string;
  count: bigint;
};

type ScalarCountRow = {
  count: bigint;
};

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

type UserPerformanceRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  attempts: bigint | null;
  sessions: bigint | null;
  average_score: number | null;
  total_time_seconds: bigint | null;
  practiced_questions: bigint | null;
  mastered: bigint | null;
  needs_review: bigint | null;
  last_attempt_at: Date | null;
};

type DifficultQuestionRow = {
  question_id: string;
  statement: string;
  area: string;
  subject: string;
  subsubject: string;
  average_score: number | null;
  attempts: bigint;
};

function numberValue(value: number | bigint | null | undefined) {
  return Number(value ?? 0);
}

function scoreValue(value: unknown) {
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return Math.round(value.toNumber());
  }

  return Math.round(Number(value ?? 0));
}

function formatScoreRows(rows: ScoreRow[]) {
  return rows.map((row) => ({
    label: row.label,
    averageScore: scoreValue(row.average_score),
    attempts: numberValue(row.attempts),
  }));
}

export async function GET(request: Request) {
  const admin = await requireAdminUser();

  if (isAdminAuthFailure(admin)) {
    return admin.response;
  }

  const db = getPrisma();
  const { searchParams } = new URL(request.url);
  const selectedUserId = searchParams.get("userId") || undefined;
  const selectedUser = selectedUserId
    ? await db.userProfile.findUnique({ where: { id: selectedUserId }, select: { id: true, fullName: true, email: true } })
    : null;
  const scopedUserId = selectedUser?.id;
  const attemptWhere = scopedUserId ? Prisma.sql`where user_id = ${scopedUserId}::uuid` : Prisma.empty;
  const practiceAttemptWhere = scopedUserId ? { userId: scopedUserId } : undefined;
  const practiceSessionWhere = scopedUserId ? { userId: scopedUserId } : undefined;
  const stateWhere = scopedUserId ? { userId: scopedUserId } : undefined;
  const attemptAliasWhere = scopedUserId ? Prisma.sql`where pa.user_id = ${scopedUserId}::uuid` : Prisma.empty;

  const [
    totalUsers,
    activeUserRows,
    totalQuestions,
    activeQuestions,
    attemptsAggregate,
    sessionCount,
    statusCounts,
    users,
    scoreTimeline,
    byArea,
    bySubject,
    bySubsubject,
    byProfessor,
    byDifficulty,
    questionsByOrigin,
    difficultQuestions,
  ] = await Promise.all([
    db.userProfile.count(),
    db.$queryRaw<ScalarCountRow[]>`
      select count(distinct user_id)::bigint as count
      from practice_attempts
    `,
    db.question.count(),
    db.question.count({ where: { isActive: true } }),
    db.practiceAttempt.aggregate({
      where: practiceAttemptWhere,
      _avg: { score: true },
      _sum: { timeSeconds: true },
      _count: true,
    }),
    db.practiceSession.count({ where: practiceSessionWhere }),
    db.studentQuestionState.groupBy({
      by: ["status"],
      where: stateWhere,
      _count: true,
    }),
    db.$queryRaw<UserPerformanceRow[]>`
      select
        u.id as user_id,
        u.full_name,
        u.email,
        coalesce(pa.attempts, 0)::bigint as attempts,
        coalesce(ps.sessions, 0)::bigint as sessions,
        pa.average_score::float as average_score,
        coalesce(pa.total_time_seconds, 0)::bigint as total_time_seconds,
        coalesce(sqs.practiced_questions, 0)::bigint as practiced_questions,
        coalesce(sqs.mastered, 0)::bigint as mastered,
        coalesce(sqs.needs_review, 0)::bigint as needs_review,
        pa.last_attempt_at
      from user_profiles u
      left join (
        select
          user_id,
          count(*)::bigint as attempts,
          avg(score)::float as average_score,
          coalesce(sum(time_seconds), 0)::bigint as total_time_seconds,
          max(created_at) as last_attempt_at
        from practice_attempts
        group by user_id
      ) pa on pa.user_id = u.id
      left join (
        select user_id, count(*)::bigint as sessions
        from practice_sessions
        group by user_id
      ) ps on ps.user_id = u.id
      left join (
        select
          user_id,
          count(*) filter (where attempt_count > 0)::bigint as practiced_questions,
          count(*) filter (where status = 'mastered')::bigint as mastered,
          count(*) filter (where status = 'needs_review')::bigint as needs_review
        from student_question_states
        group by user_id
      ) sqs on sqs.user_id = u.id
      order by coalesce(pa.attempts, 0) desc, pa.last_attempt_at desc nulls last, u.created_at desc
      limit 100
    `,
    db.$queryRaw<TimelineRow[]>`
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
             avg(score)::float as average_score,
             count(*)::bigint as attempts
      from practice_attempts
      ${attemptWhere}
      group by date_trunc('day', created_at)
      order by day asc
      limit 30
    `,
    db.$queryRaw<ScoreRow[]>`
      select la.name as label,
             avg(pa.score)::float as average_score,
             count(*)::bigint as attempts
      from practice_attempts pa
      join questions q on q.id = pa.question_id
      join law_areas la on la.id = q.area_id
      ${attemptAliasWhere}
      group by la.name
      order by avg(pa.score) desc
    `,
    db.$queryRaw<ScoreRow[]>`
      select coalesce(s.name, 'Sin materia') as label,
             avg(pa.score)::float as average_score,
             count(*)::bigint as attempts
      from practice_attempts pa
      join questions q on q.id = pa.question_id
      left join subjects s on s.id = q.subject_id
      ${attemptAliasWhere}
      group by coalesce(s.name, 'Sin materia')
      order by avg(pa.score) desc
    `,
    db.$queryRaw<ScoreRow[]>`
      select coalesce(ss.name, 'Sin submateria') as label,
             avg(pa.score)::float as average_score,
             count(*)::bigint as attempts
      from practice_attempts pa
      join questions q on q.id = pa.question_id
      left join subsubjects ss on ss.id = q.subsubject_id
      ${attemptAliasWhere}
      group by coalesce(ss.name, 'Sin submateria')
      order by avg(pa.score) desc
    `,
    db.$queryRaw<ScoreRow[]>`
      select coalesce(p.name, 'Sin profesor') as label,
             avg(pa.score)::float as average_score,
             count(*)::bigint as attempts
      from practice_attempts pa
      join questions q on q.id = pa.question_id
      left join question_professors qp on qp.question_id = q.id
      left join professors p on p.id = qp.professor_id
      ${attemptAliasWhere}
      group by coalesce(p.name, 'Sin profesor')
      order by avg(pa.score) desc
    `,
    db.$queryRaw<ScoreRow[]>`
      select q.difficulty::text as label,
             avg(pa.score)::float as average_score,
             count(*)::bigint as attempts
      from practice_attempts pa
      join questions q on q.id = pa.question_id
      ${attemptAliasWhere}
      group by q.difficulty
      order by avg(pa.score) desc
    `,
    db.$queryRaw<CountRow[]>`
      select origin::text as label, count(*)::bigint as count
      from questions
      group by origin
      order by count(*) desc
    `,
    db.$queryRaw<DifficultQuestionRow[]>`
      select q.id as question_id,
             q.statement,
             la.name as area,
             coalesce(s.name, 'Sin materia') as subject,
             coalesce(ss.name, 'Sin submateria') as subsubject,
             avg(pa.score)::float as average_score,
             count(*)::bigint as attempts
      from practice_attempts pa
      join questions q on q.id = pa.question_id
      join law_areas la on la.id = q.area_id
      left join subjects s on s.id = q.subject_id
      left join subsubjects ss on ss.id = q.subsubject_id
      ${attemptAliasWhere}
      group by q.id, q.statement, la.name, coalesce(s.name, 'Sin materia'), coalesce(ss.name, 'Sin submateria')
      having count(*) > 0
      order by avg(pa.score) asc, count(*) desc
      limit 10
    `,
  ]);

  const statusMap = new Map(statusCounts.map((row) => [row.status, row._count]));
  const totalAttempts = attemptsAggregate._count;
  const activeUsers = numberValue(activeUserRows[0]?.count);

  return NextResponse.json({
    admin: {
      email: admin.user.email,
      restrictedByEmail: admin.restrictedByEmail,
    },
    selectedUser: selectedUser
      ? { id: selectedUser.id, fullName: selectedUser.fullName, email: selectedUser.email }
      : null,
    summary: {
      totalUsers,
      activeUsers,
      totalQuestions,
      activeQuestions,
      totalAttempts,
      totalSessions: sessionCount,
      averageScore: scoreValue(attemptsAggregate._avg.score),
      totalTimeSeconds: attemptsAggregate._sum.timeSeconds ?? 0,
      mastered: statusMap.get("mastered") ?? 0,
      needsReview: statusMap.get("needs_review") ?? 0,
      excluded: statusMap.get("excluded") ?? 0,
      answered: statusMap.get("answered") ?? 0,
    },
    users: users.map((user) => ({
      id: user.user_id,
      fullName: user.full_name,
      email: user.email,
      attempts: numberValue(user.attempts),
      sessions: numberValue(user.sessions),
      averageScore: scoreValue(user.average_score),
      totalTimeSeconds: numberValue(user.total_time_seconds),
      practicedQuestions: numberValue(user.practiced_questions),
      mastered: numberValue(user.mastered),
      needsReview: numberValue(user.needs_review),
      lastAttemptAt: user.last_attempt_at?.toISOString() ?? null,
    })),
    scoreTimeline: scoreTimeline.map((row) => ({
      day: row.day,
      averageScore: scoreValue(row.average_score),
      attempts: numberValue(row.attempts),
    })),
    byArea: formatScoreRows(byArea),
    bySubject: formatScoreRows(bySubject),
    bySubsubject: formatScoreRows(bySubsubject),
    byProfessor: formatScoreRows(byProfessor),
    byDifficulty: formatScoreRows(byDifficulty),
    questionsByOrigin: questionsByOrigin.map((row) => ({
      label: row.label,
      count: numberValue(row.count),
    })),
    difficultQuestions: difficultQuestions.map((row) => ({
      questionId: row.question_id,
      statement: row.statement,
      area: row.area,
      subject: row.subject,
      subsubject: row.subsubject,
      averageScore: scoreValue(row.average_score),
      attempts: numberValue(row.attempts),
    })),
  });
}
