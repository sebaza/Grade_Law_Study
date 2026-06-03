import fs from "node:fs/promises";
import path from "node:path";
import type { DemoQuestion, DemoQuestionBank, PracticeFilters } from "@/lib/practice/types";

const BANK_PATH = path.join(process.cwd(), "data", "processed", "question-bank.seed.json");

let cachedBank: DemoQuestionBank | null = null;

export async function getDemoQuestionBank() {
  if (!cachedBank) {
    const raw = await fs.readFile(BANK_PATH, "utf8");
    cachedBank = JSON.parse(raw) as DemoQuestionBank;
  }

  return cachedBank;
}

export async function getDemoQuestions(filters: PracticeFilters = {}) {
  const bank = await getDemoQuestionBank();
  let questions = bank.questions;

  if (filters.area) questions = questions.filter((question) => question.areaName === filters.area);
  if (filters.subject) questions = questions.filter((question) => question.subjectName === filters.subject);
  if (filters.subsubject) questions = questions.filter((question) => question.subsubjectName === filters.subsubject);
  if (filters.professor) questions = questions.filter((question) => question.professorName === filters.professor);
  if (filters.difficulty) questions = questions.filter((question) => question.difficulty === filters.difficulty);
  if (filters.questionType) questions = questions.filter((question) => question.questionType === filters.questionType);

  if (filters.mode === "random") {
    questions = questions.slice().sort(() => Math.random() - 0.5);
  } else {
    questions = questions.slice().sort((a, b) => b.priorityScore - a.priorityScore || b.estimatedProbability - a.estimatedProbability);
  }

  return questions;
}

export async function getDemoQuestion(sourceReference: string) {
  const bank = await getDemoQuestionBank();
  return bank.questions.find((question) => question.sourceReference === sourceReference) ?? null;
}

export function getPracticeFacets(questions: DemoQuestion[]) {
  const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

  return {
    areas: unique(questions.map((question) => question.areaName)),
    subjects: unique(questions.map((question) => question.subjectName)),
    subsubjects: unique(questions.map((question) => question.subsubjectName)),
    professors: unique(questions.map((question) => question.professorName)),
    difficulties: unique(questions.map((question) => question.difficulty)),
    questionTypes: unique(questions.map((question) => question.questionType)),
  };
}
