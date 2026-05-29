import fs from "node:fs/promises";
import path from "node:path";
import { getPrisma } from "../../src/lib/db/prisma";

type SeedQuestion = {
  sourceReference: string;
  statement: string;
  areaName: string;
  subjectName: string;
  subsubjectName: string;
  professorName: string;
  difficulty: "low" | "medium" | "high";
  estimatedProbability: number;
  priorityScore: number;
  questionType: string;
  origin: "real_question";
  expectedAnswer: string;
  rubricNotes: string;
  keyPoints: Array<{ label: string; description: string; weight: number; isRequired: boolean; orderIndex: number }>;
  commonErrors: Array<{ description: string; severity: "low" | "medium" | "high" }>;
  metadata: Record<string, unknown>;
};

type QuestionBankSeed = {
  questionCount: number;
  questions: SeedQuestion[];
};

const SEED_PATH = path.join(process.cwd(), "data", "processed", "question-bank.seed.json");

async function readSeed() {
  const content = await fs.readFile(SEED_PATH, "utf8");
  return JSON.parse(content) as QuestionBankSeed;
}

async function main() {
  const db = getPrisma();
  const seed = await readSeed();
  let imported = 0;

  for (const item of seed.questions) {
    const area = await db.lawArea.upsert({
      where: { name: item.areaName },
      create: { name: item.areaName },
      update: {},
    });

    const subject = await db.subject.upsert({
      where: {
        areaId_name: {
          areaId: area.id,
          name: item.subjectName,
        },
      },
      create: {
        areaId: area.id,
        name: item.subjectName,
      },
      update: {},
    });

    const subsubject = await db.subsubject.upsert({
      where: {
        subjectId_name: {
          subjectId: subject.id,
          name: item.subsubjectName,
        },
      },
      create: {
        subjectId: subject.id,
        name: item.subsubjectName,
      },
      update: {},
    });

    const professor = await db.professor.upsert({
      where: { name: item.professorName },
      create: { name: item.professorName },
      update: {},
    });

    const question = await db.question.upsert({
      where: { sourceReference: item.sourceReference },
      create: {
        sourceReference: item.sourceReference,
        statement: item.statement,
        areaId: area.id,
        subjectId: subject.id,
        subsubjectId: subsubject.id,
        difficulty: item.difficulty,
        estimatedProbability: item.estimatedProbability,
        priorityScore: item.priorityScore,
        questionType: item.questionType,
        origin: item.origin,
        isActive: true,
      },
      update: {
        statement: item.statement,
        areaId: area.id,
        subjectId: subject.id,
        subsubjectId: subsubject.id,
        difficulty: item.difficulty,
        estimatedProbability: item.estimatedProbability,
        priorityScore: item.priorityScore,
        questionType: item.questionType,
        origin: item.origin,
        isActive: true,
      },
    });

    await db.questionProfessor.upsert({
      where: {
        questionId_professorId: {
          questionId: question.id,
          professorId: professor.id,
        },
      },
      create: {
        questionId: question.id,
        professorId: professor.id,
      },
      update: {},
    });

    await db.expectedAnswer.deleteMany({ where: { questionId: question.id } });
    await db.keyPoint.deleteMany({ where: { questionId: question.id } });
    await db.commonError.deleteMany({ where: { questionId: question.id } });

    await db.expectedAnswer.create({
      data: {
        questionId: question.id,
        modelAnswer: item.expectedAnswer,
        rubricNotes: item.rubricNotes,
        version: 1,
        isActive: true,
      },
    });

    await db.keyPoint.createMany({
      data: item.keyPoints.map((point) => ({
        questionId: question.id,
        label: point.label,
        description: point.description,
        weight: point.weight,
        isRequired: point.isRequired,
        orderIndex: point.orderIndex,
      })),
    });

    await db.commonError.createMany({
      data: item.commonErrors.map((error) => ({
        questionId: question.id,
        description: error.description,
        severity: error.severity,
      })),
    });

    imported += 1;
  }

  console.log(`Importadas ${imported}/${seed.questionCount} preguntas normalizadas a Supabase/Postgres.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
