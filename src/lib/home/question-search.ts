import type { Prisma } from "@prisma/client";

/** Builds the shared substring search clause without changing independent filters. */
export function buildQuestionSearchWhere(query?: string): Prisma.QuestionWhereInput {
  const value = query?.trim();
  if (!value) return {};

  const contains = { contains: value, mode: "insensitive" as const };
  return {
    OR: [
      { statement: contains },
      { area: { name: contains } },
      { subject: { name: contains } },
      { subsubject: { name: contains } },
      { professors: { some: { professor: { name: contains } } } },
      { expectedAnswers: { some: { isActive: true, OR: [
        { modelAnswer: contains },
        { rubricNotes: contains },
      ] } } },
      { keyPoints: { some: { OR: [
        { label: contains },
        { description: contains },
      ] } } },
      { commonErrors: { some: { description: contains } } },
    ],
  };
}
