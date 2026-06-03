import { NextResponse } from "next/server";
import { getDemoQuestions, getPracticeFacets } from "@/lib/practice/demo-bank";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const questions = await getDemoQuestions({
    area: searchParams.get("area") ?? undefined,
    subject: searchParams.get("subject") ?? undefined,
    subsubject: searchParams.get("subsubject") ?? undefined,
    professor: searchParams.get("professor") ?? undefined,
    difficulty: searchParams.get("difficulty") ?? undefined,
    questionType: searchParams.get("questionType") ?? undefined,
    mode: (searchParams.get("mode") as "priority" | "random" | "review" | null) ?? "priority",
  });

  return NextResponse.json({
    mode: "demo",
    count: questions.length,
    facets: getPracticeFacets(questions),
    questions: questions.slice(0, 50).map((question) => ({
      sourceReference: question.sourceReference,
      statement: question.statement,
      areaName: question.areaName,
      subjectName: question.subjectName,
      subsubjectName: question.subsubjectName,
      professorName: question.professorName,
      difficulty: question.difficulty,
      estimatedProbability: question.estimatedProbability,
      priorityScore: question.priorityScore,
      questionType: question.questionType,
      keyPointCount: question.keyPoints.length,
    })),
  });
}
