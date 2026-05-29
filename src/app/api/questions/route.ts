import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  const db = getPrisma();
  const { searchParams } = new URL(request.url);

  const areaId = searchParams.get("areaId") ?? undefined;
  const subjectId = searchParams.get("subjectId") ?? undefined;
  const difficulty = searchParams.get("difficulty") ?? undefined;
  const professorId = searchParams.get("professorId") ?? undefined;
  const q = searchParams.get("q") ?? undefined;

  const questions = await db.question.findMany({
    where: {
      isActive: true,
      areaId,
      subjectId,
      difficulty: difficulty as never,
      statement: q ? { contains: q, mode: "insensitive" } : undefined,
      professors: professorId
        ? {
            some: { professorId },
          }
        : undefined,
    },
    include: {
      area: true,
      subject: true,
      subsubject: true,
      professors: { include: { professor: true } },
      keyPoints: { orderBy: { orderIndex: "asc" } },
    },
    orderBy: [{ priorityScore: "desc" }, { estimatedProbability: "desc" }],
    take: 100,
  });

  return NextResponse.json({ questions });
}
