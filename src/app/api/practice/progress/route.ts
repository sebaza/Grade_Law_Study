import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/auth/user-profile";
import { getPrisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    practiced,
    mastered,
    needsReview,
    excluded,
    attemptsAggregate,
    sessionCount,
    weakSubjects,
  ] = await Promise.all([
    db.question.count({ where: { isActive: true } }),
    db.studentQuestionState.count({ where: { userId: data.user.id, attemptCount: { gt: 0 } } }),
    db.studentQuestionState.count({ where: { userId: data.user.id, status: "mastered" } }),
    db.studentQuestionState.count({ where: { userId: data.user.id, status: "needs_review" } }),
    db.studentQuestionState.count({ where: { userId: data.user.id, isExcluded: true } }),
    db.practiceAttempt.aggregate({
      where: { userId: data.user.id },
      _avg: { score: true },
      _sum: { timeSeconds: true },
      _count: true,
    }),
    db.practiceSession.count({ where: { userId: data.user.id } }),
    db.$queryRaw<Array<{ subject: string; average_score: number; attempts: bigint }>>`
      select coalesce(s.name, 'Sin materia') as subject,
             avg(pa.score)::float as average_score,
             count(*)::bigint as attempts
      from practice_attempts pa
      join questions q on q.id = pa.question_id
      left join subjects s on s.id = q.subject_id
      where pa.user_id = ${data.user.id}::uuid
      group by coalesce(s.name, 'Sin materia')
      having count(*) > 0
      order by avg(pa.score) asc
      limit 5
    `,
  ]);

  return NextResponse.json({
    totalQuestions,
    practiced,
    mastered,
    pending: Math.max(totalQuestions - practiced - excluded, 0),
    needsReview,
    excluded,
    averageScore: Math.round(Number(attemptsAggregate._avg.score ?? 0)),
    attemptCount: attemptsAggregate._count,
    sessionCount,
    totalTimeSeconds: attemptsAggregate._sum.timeSeconds ?? 0,
    progressPercentage: totalQuestions > 0 ? Math.round((practiced / totalQuestions) * 100) : 0,
    weakSubjects: weakSubjects.map((row) => ({
      subject: row.subject,
      averageScore: Math.round(row.average_score),
      attempts: Number(row.attempts),
    })),
  });
}
