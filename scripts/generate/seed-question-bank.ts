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

type UpsertedQuestion = {
  id: string;
  source_reference: string;
};

const SEED_PATH = path.join(process.cwd(), "data", "processed", "question-bank.seed.json");

async function readSeed() {
  const content = await fs.readFile(SEED_PATH, "utf8");
  return JSON.parse(content) as QuestionBankSeed;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function subjectKey(areaId: string, name: string) {
  return `${areaId}::${name}`;
}

function subsubjectKey(subjectId: string, name: string) {
  return `${subjectId}::${name}`;
}

async function main() {
  const db = getPrisma();
  const seed = await readSeed();

  const areaNames = unique(seed.questions.map((item) => item.areaName));
  const professorNames = unique(seed.questions.map((item) => item.professorName));

  await db.lawArea.createMany({
    data: areaNames.map((name) => ({ name })),
    skipDuplicates: true,
  });

  await db.professor.createMany({
    data: professorNames.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const [areas, professors] = await Promise.all([
    db.lawArea.findMany({ where: { name: { in: areaNames } } }),
    db.professor.findMany({ where: { name: { in: professorNames } } }),
  ]);

  const areaByName = new Map(areas.map((area) => [area.name, area]));
  const professorByName = new Map(professors.map((professor) => [professor.name, professor]));

  await db.subject.createMany({
    data: unique(
      seed.questions.map((item) => {
        const area = areaByName.get(item.areaName);
        if (!area) throw new Error(`Area no encontrada: ${item.areaName}`);
        return JSON.stringify({ areaId: area.id, name: item.subjectName });
      }),
    ).map((item) => JSON.parse(item) as { areaId: string; name: string }),
    skipDuplicates: true,
  });

  const subjects = await db.subject.findMany({
    where: { areaId: { in: areas.map((area) => area.id) } },
  });
  const subjectByAreaAndName = new Map(subjects.map((subject) => [subjectKey(subject.areaId, subject.name), subject]));

  await db.subsubject.createMany({
    data: unique(
      seed.questions.map((item) => {
        const area = areaByName.get(item.areaName);
        if (!area) throw new Error(`Area no encontrada: ${item.areaName}`);

        const subject = subjectByAreaAndName.get(subjectKey(area.id, item.subjectName));
        if (!subject) throw new Error(`Materia no encontrada: ${item.areaName} / ${item.subjectName}`);

        return JSON.stringify({ subjectId: subject.id, name: item.subsubjectName });
      }),
    ).map((item) => JSON.parse(item) as { subjectId: string; name: string }),
    skipDuplicates: true,
  });

  const subsubjects = await db.subsubject.findMany({
    where: { subjectId: { in: subjects.map((subject) => subject.id) } },
  });
  const subsubjectBySubjectAndName = new Map(
    subsubjects.map((subsubject) => [subsubjectKey(subsubject.subjectId, subsubject.name), subsubject]),
  );

  const questionRows = seed.questions.map((item) => {
    const area = areaByName.get(item.areaName);
    if (!area) throw new Error(`Area no encontrada: ${item.areaName}`);

    const subject = subjectByAreaAndName.get(subjectKey(area.id, item.subjectName));
    if (!subject) throw new Error(`Materia no encontrada: ${item.areaName} / ${item.subjectName}`);

    const subsubject = subsubjectBySubjectAndName.get(subsubjectKey(subject.id, item.subsubjectName));
    if (!subsubject) throw new Error(`Submateria no encontrada: ${item.subjectName} / ${item.subsubjectName}`);

    return {
      source_reference: item.sourceReference,
      statement: item.statement,
      area_id: area.id,
      subject_id: subject.id,
      subsubject_id: subsubject.id,
      difficulty: item.difficulty,
      estimated_probability: item.estimatedProbability,
      priority_score: item.priorityScore,
      question_type: item.questionType,
      origin: item.origin,
      is_active: true,
    };
  });

  const upsertedQuestions = await db.$queryRaw<UpsertedQuestion[]>`
    with payload as (
      select *
      from jsonb_to_recordset(${JSON.stringify(questionRows)}::jsonb) as item(
        source_reference text,
        statement text,
        area_id uuid,
        subject_id uuid,
        subsubject_id uuid,
        difficulty text,
        estimated_probability numeric,
        priority_score numeric,
        question_type text,
        origin text,
        is_active boolean
      )
    )
    insert into questions (
      source_reference,
      statement,
      area_id,
      subject_id,
      subsubject_id,
      difficulty,
      estimated_probability,
      priority_score,
      question_type,
      origin,
      is_active
    )
    select
      source_reference,
      statement,
      area_id,
      subject_id,
      subsubject_id,
      difficulty::difficulty,
      estimated_probability,
      priority_score,
      question_type,
      origin::question_origin,
      is_active
    from payload
    on conflict (source_reference) do update set
      statement = excluded.statement,
      area_id = excluded.area_id,
      subject_id = excluded.subject_id,
      subsubject_id = excluded.subsubject_id,
      difficulty = excluded.difficulty,
      estimated_probability = excluded.estimated_probability,
      priority_score = excluded.priority_score,
      question_type = excluded.question_type,
      origin = excluded.origin,
      is_active = excluded.is_active,
      updated_at = now()
    returning id, source_reference
  `;

  const questionByReference = new Map(upsertedQuestions.map((question) => [question.source_reference, question]));
  const questionIds = upsertedQuestions.map((question) => question.id);

  await db.questionProfessor.deleteMany({ where: { questionId: { in: questionIds } } });
  await db.expectedAnswer.deleteMany({ where: { questionId: { in: questionIds } } });
  await db.keyPoint.deleteMany({ where: { questionId: { in: questionIds } } });
  await db.commonError.deleteMany({ where: { questionId: { in: questionIds } } });

  await db.questionProfessor.createMany({
    data: seed.questions.map((item) => {
      const question = questionByReference.get(item.sourceReference);
      const professor = professorByName.get(item.professorName);
      if (!question) throw new Error(`Pregunta no encontrada: ${item.sourceReference}`);
      if (!professor) throw new Error(`Profesor no encontrado: ${item.professorName}`);

      return {
        questionId: question.id,
        professorId: professor.id,
      };
    }),
    skipDuplicates: true,
  });

  await db.expectedAnswer.createMany({
    data: seed.questions.map((item) => {
      const question = questionByReference.get(item.sourceReference);
      if (!question) throw new Error(`Pregunta no encontrada: ${item.sourceReference}`);

      return {
        questionId: question.id,
        modelAnswer: item.expectedAnswer,
        rubricNotes: item.rubricNotes,
        version: 1,
        isActive: true,
      };
    }),
  });

  await db.keyPoint.createMany({
    data: seed.questions.flatMap((item) => {
      const question = questionByReference.get(item.sourceReference);
      if (!question) throw new Error(`Pregunta no encontrada: ${item.sourceReference}`);

      return item.keyPoints.map((point) => ({
        questionId: question.id,
        label: point.label,
        description: point.description,
        weight: point.weight,
        isRequired: point.isRequired,
        orderIndex: point.orderIndex,
      }));
    }),
  });

  await db.commonError.createMany({
    data: seed.questions.flatMap((item) => {
      const question = questionByReference.get(item.sourceReference);
      if (!question) throw new Error(`Pregunta no encontrada: ${item.sourceReference}`);

      return item.commonErrors.map((error) => ({
        questionId: question.id,
        description: error.description,
        severity: error.severity,
      }));
    }),
  });

  console.log(`Importadas ${upsertedQuestions.length}/${seed.questionCount} preguntas normalizadas a Supabase/Postgres.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
