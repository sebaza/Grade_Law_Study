import { unstable_cache } from "next/cache";
import { getPrisma } from "@/lib/db/prisma";

export type CachedQuestion = {
  id: string;
  sourceReference: string | null;
  statement: string;
  areaName: string;
  subjectName: string;
  subsubjectName: string;
  professorNames: string[];
  difficulty: "low" | "medium" | "high";
  estimatedProbability: number;
  priorityScore: number;
  questionType: string;
  keyPointCount: number;
};

/**
 * Areas and professors — shared across all users, rarely change.
 * Cached for 1 hour, shared across all Vercel function instances.
 */
export const getCachedFacets = unstable_cache(
  async () => {
    const db = getPrisma();
    const [areas, professors] = await Promise.all([
      db.lawArea.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
      db.professor.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    ]);
    return {
      areas: areas.map((a) => a.name),
      professors: professors.map((p) => p.name),
    };
  },
  ["practice-facets"],
  { revalidate: 3600, tags: ["facets"] },
);

/**
 * Active questions without user-specific state — identical for all users.
 * Cached for 5 minutes per filter combination.
 * Decimals converted to numbers so they survive JSON serialization.
 */
export const getCachedBaseQuestions = unstable_cache(
  async (area: string, professor: string, difficulty: string): Promise<CachedQuestion[]> => {
    const db = getPrisma();
    const questions = await db.question.findMany({
      where: {
        isActive: true,
        area: area ? { name: area } : undefined,
        difficulty: difficulty ? (difficulty as "low" | "medium" | "high") : undefined,
        professors: professor ? { some: { professor: { name: professor } } } : undefined,
      },
      include: {
        area: true,
        subject: true,
        subsubject: true,
        professors: { include: { professor: true } },
        _count: { select: { keyPoints: true } },
      },
      orderBy: [{ priorityScore: "desc" }, { estimatedProbability: "desc" }],
      take: 200,
    });

    return questions.map((q) => ({
      id: q.id,
      sourceReference: q.sourceReference,
      statement: q.statement,
      areaName: q.area.name,
      subjectName: q.subject?.name ?? "Sin materia",
      subsubjectName: q.subsubject?.name ?? "Sin submateria",
      professorNames: q.professors.map((link) => link.professor.name),
      difficulty: q.difficulty,
      estimatedProbability: Number(q.estimatedProbability),
      priorityScore: Number(q.priorityScore),
      questionType: q.questionType ?? "general",
      keyPointCount: q._count.keyPoints,
    }));
  },
  ["practice-base-questions"],
  { revalidate: 300, tags: ["questions"] },
);
