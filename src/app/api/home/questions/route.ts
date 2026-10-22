import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHomeQuestionOrder, parseHomeFeedRequest, summarizePublicAreas } from "@/lib/home/question-feed";
import { buildQuestionSearchWhere } from "@/lib/home/question-search";

export async function GET(request: Request) {
  const db = getPrisma();
  const { searchParams } = new URL(request.url);
  const { view, limit, cursor, query } = parseHomeFeedRequest(searchParams);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  const orderBy = getHomeQuestionOrder(view);
  const selected = await db.question.findMany({
    where: { isActive: true, ...buildQuestionSearchWhere(query) },
    orderBy,
    ...(userId && cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
    take: userId ? limit + 1 : 3,
    select: { id: true, statement: true, createdAt: true, area: { select: { name: true } }, subject: { select: { name: true } } },
  });

  if (!userId) {
    return NextResponse.json({ view, public: true, byArea: summarizePublicAreas(selected) });
  }

  const hasMore = selected.length > limit;
  const questions = selected.slice(0, limit);
  const states = questions.length ? await db.studentQuestionState.findMany({
    where: { userId, questionId: { in: questions.map(({ id }) => id) } },
    select: { questionId: true, attemptCount: true },
  }) : [];
  const attempts = new Map(states.map((state) => [state.questionId, state.attemptCount]));
  const last = questions.at(-1);
  const nextCursor = hasMore && last ? `${last.createdAt.toISOString()}|${last.id}` : null;

  return NextResponse.json({
    view,
    public: false,
    questions: questions.map((question) => ({
      id: question.id,
      statement: question.statement,
      areaName: question.area.name,
      subjectName: question.subject?.name ?? "Sin materia",
      createdAt: question.createdAt.toISOString(),
      completed: (attempts.get(question.id) ?? 0) > 0,
    })),
    nextCursor,
  });
}
