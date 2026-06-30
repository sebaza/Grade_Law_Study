import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";

// Public landing summary: no auth required. Powers the logged-out home view
// (total questions, breakdown per law area, and bank coverage).
export async function GET() {
  const db = getPrisma();

  // Keep reads sequential: the Prisma pool runs with connection_limit=1 and
  // parallel aggregates can starve it (see api/questions/route.ts).
  const totalQuestions = await db.question.count({ where: { isActive: true } });
  const grouped = await db.question.groupBy({
    by: ["areaId"],
    where: { isActive: true },
    _count: { _all: true },
  });
  const areas = await db.lawArea.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const subjectCount = await db.subject.count();
  const professorCount = await db.professor.count();

  const countByAreaId = new Map(grouped.map((row) => [row.areaId, row._count._all]));
  const byArea = areas
    .map((area) => ({ id: area.id, name: area.name, questionCount: countByAreaId.get(area.id) ?? 0 }))
    .filter((area) => area.questionCount > 0)
    .sort((a, b) => b.questionCount - a.questionCount);

  return NextResponse.json({
    totalQuestions,
    subjectCount,
    professorCount,
    areaCount: byArea.length,
    byArea,
  });
}
