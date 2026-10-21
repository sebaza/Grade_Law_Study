import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Prisma } from "@prisma/client";
import { loadEnvConfig } from "@next/env";

import { getPrisma } from "../../src/lib/db/prisma";

export type StagedQuestion = {
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
  keyPoints: Array<{
    label: string;
    description: string;
    weight: number;
    isRequired: boolean;
    orderIndex: number;
  }>;
  commonErrors: Array<{
    description: string;
    severity: "low" | "medium" | "high";
  }>;
  metadata: Record<string, unknown> & { legalReviewStatus: "reviewed" };
};

export type ExistingQuestionSnapshot = {
  id: string;
  sourceReference: string | null;
  statement: string;
  areaName: string;
  subjectName: string | null;
  subsubjectName: string | null;
  difficulty: string;
  estimatedProbability: number;
  priorityScore: number;
  questionType: string | null;
  origin: string;
  isActive: boolean;
  expectedAnswers: Array<{
    modelAnswer: string;
    rubricNotes: string | null;
    version: number;
    isActive: boolean;
  }>;
  keyPoints: StagedQuestion["keyPoints"];
  commonErrors: Array<{ description: string; severity: string }>;
  professorNames: string[];
};

export const CIVIL_IMPUBERES_CONTENT_MATCH = {
  sourceReference:
    "october-oral-exams:octubre-grado-no-indicado-civil-capacidad-arrendamiento:derecho-civil:003",
  statement: "¿Quiénes son impúberes?",
  areaName: "Derecho Civil",
} as const;

export const SOVEREIGNTY_CONTENT_MATCH = {
  sourceReference:
    "october-oral-exams:octubre-grado-no-indicado-consti-soberania-trabajo:derecho-constitucional:007",
  statement: "¿Cuáles son los límites de la soberanía?",
  areaName: "Derecho Constitucional",
} as const;

const APPROVED_CONTENT_MATCHES = [
  CIVIL_IMPUBERES_CONTENT_MATCH,
  SOVEREIGNTY_CONTENT_MATCH,
] as const;

export type PlanAction =
  | "insert"
  | "noop_source_match"
  | "noop_known_content_match"
  | "blocked_source_drift"
  | "blocked_content_collision";

export type PlanEntry = {
  sourceReference: string;
  action: PlanAction;
  existingQuestionId?: string;
  differences?: string[];
};

export type ImportPlan = {
  total: number;
  inserts: number;
  sourceMatches: number;
  knownContentMatches: number;
  conflicts: number;
  entries: PlanEntry[];
};

const STAGING_PATH = path.join(
  process.cwd(),
  "data",
  "staging",
  "october-question-bank.staging.json",
);

const REMOTE_TRANSACTION_OPTIONS = {
  maxWait: 60_000,
  timeout: 60_000,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string, context: string) {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context}.${key} must be a non-empty string.`);
  }
  return value;
}

function requiredNumber(record: Record<string, unknown>, key: string, context: string) {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${context}.${key} must be a finite number.`);
  }
  return value;
}

function parseQuestion(value: unknown, index: number): StagedQuestion {
  const context = `questions[${index}]`;
  if (!isRecord(value)) throw new Error(`${context} must be an object.`);

  const difficulty = requiredString(value, "difficulty", context);
  if (!(["low", "medium", "high"] as const).includes(difficulty as StagedQuestion["difficulty"])) {
    throw new Error(`${context}.difficulty is invalid.`);
  }
  const origin = requiredString(value, "origin", context);
  if (origin !== "real_question") throw new Error(`${context}.origin must be real_question.`);

  if (!Array.isArray(value.keyPoints) || value.keyPoints.length === 0) {
    throw new Error(`${context}.keyPoints must be a non-empty array.`);
  }
  const keyPoints = value.keyPoints.map((point, pointIndex) => {
    const pointContext = `${context}.keyPoints[${pointIndex}]`;
    if (!isRecord(point)) throw new Error(`${pointContext} must be an object.`);
    if (typeof point.isRequired !== "boolean") {
      throw new Error(`${pointContext}.isRequired must be boolean.`);
    }
    return {
      label: requiredString(point, "label", pointContext),
      description: requiredString(point, "description", pointContext),
      weight: requiredNumber(point, "weight", pointContext),
      isRequired: point.isRequired,
      orderIndex: requiredNumber(point, "orderIndex", pointContext),
    };
  });

  if (!Array.isArray(value.commonErrors) || value.commonErrors.length === 0) {
    throw new Error(`${context}.commonErrors must be a non-empty array.`);
  }
  const commonErrors = value.commonErrors.map((error, errorIndex) => {
    const errorContext = `${context}.commonErrors[${errorIndex}]`;
    if (!isRecord(error)) throw new Error(`${errorContext} must be an object.`);
    const severity = requiredString(error, "severity", errorContext);
    if (!(["low", "medium", "high"] as const).includes(severity as "low" | "medium" | "high")) {
      throw new Error(`${errorContext}.severity is invalid.`);
    }
    return {
      description: requiredString(error, "description", errorContext),
      severity: severity as "low" | "medium" | "high",
    };
  });

  if (!isRecord(value.metadata) || value.metadata.legalReviewStatus !== "reviewed") {
    throw new Error(`${context}.metadata.legalReviewStatus must be reviewed.`);
  }

  return {
    sourceReference: requiredString(value, "sourceReference", context),
    statement: requiredString(value, "statement", context),
    areaName: requiredString(value, "areaName", context),
    subjectName: requiredString(value, "subjectName", context),
    subsubjectName: requiredString(value, "subsubjectName", context),
    professorName: requiredString(value, "professorName", context),
    difficulty: difficulty as StagedQuestion["difficulty"],
    estimatedProbability: requiredNumber(value, "estimatedProbability", context),
    priorityScore: requiredNumber(value, "priorityScore", context),
    questionType: requiredString(value, "questionType", context),
    origin: "real_question",
    expectedAnswer: requiredString(value, "expectedAnswer", context),
    rubricNotes: requiredString(value, "rubricNotes", context),
    keyPoints,
    commonErrors,
    metadata: value.metadata as StagedQuestion["metadata"],
  };
}

export function validateStagingBatch(value: unknown): StagedQuestion[] {
  if (!isRecord(value)) throw new Error("Staging file must be an object.");
  if (value.questionCount !== 226) throw new Error("Staging questionCount must equal 226.");
  if (!Array.isArray(value.questions) || value.questions.length !== 226) {
    throw new Error("Staging questions must contain exactly 226 records.");
  }

  const questions = value.questions.map(parseQuestion);
  const references = new Set<string>();
  const statements = new Set<string>();
  for (const question of questions) {
    if (references.has(question.sourceReference)) {
      throw new Error(`Duplicate sourceReference: ${question.sourceReference}`);
    }
    references.add(question.sourceReference);
    const statementKey = normalizedText(question.statement);
    if (statements.has(statementKey)) {
      throw new Error(`Duplicate statement in staging: ${question.statement}`);
    }
    statements.add(statementKey);
  }
  return questions;
}

function normalizedText(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

function contentKey(areaName: string, statement: string) {
  return `${normalizedText(areaName)}::${normalizedText(statement)}`;
}

function sorted<T>(items: T[], selector: (item: T) => string) {
  return [...items].sort((left, right) => selector(left).localeCompare(selector(right), "es"));
}

function stagedComparable(question: StagedQuestion) {
  return {
    statement: question.statement,
    areaName: question.areaName,
    subjectName: question.subjectName,
    subsubjectName: question.subsubjectName,
    difficulty: question.difficulty,
    estimatedProbability: question.estimatedProbability,
    priorityScore: question.priorityScore,
    questionType: question.questionType,
    origin: question.origin,
    isActive: true,
    expectedAnswers: [
      {
        modelAnswer: question.expectedAnswer,
        rubricNotes: question.rubricNotes,
        version: 1,
        isActive: true,
      },
    ],
    keyPoints: [...question.keyPoints].sort((left, right) => left.orderIndex - right.orderIndex),
    commonErrors: sorted(question.commonErrors, (item) => `${item.description}\u0000${item.severity}`),
    professorNames: [question.professorName],
  };
}

function existingComparable(question: ExistingQuestionSnapshot) {
  return {
    statement: question.statement,
    areaName: question.areaName,
    subjectName: question.subjectName,
    subsubjectName: question.subsubjectName,
    difficulty: question.difficulty,
    estimatedProbability: question.estimatedProbability,
    priorityScore: question.priorityScore,
    questionType: question.questionType,
    origin: question.origin,
    isActive: question.isActive,
    expectedAnswers: sorted(question.expectedAnswers, (item) => `${item.version}\u0000${item.modelAnswer}`),
    keyPoints: [...question.keyPoints].sort((left, right) => left.orderIndex - right.orderIndex),
    commonErrors: sorted(question.commonErrors, (item) => `${item.description}\u0000${item.severity}`),
    professorNames: [...question.professorNames].sort((left, right) => left.localeCompare(right, "es")),
  };
}

function compareQuestion(question: StagedQuestion, existing: ExistingQuestionSnapshot) {
  const desired = stagedComparable(question);
  const actual = existingComparable(existing);
  return Object.keys(desired).filter((key) => {
    const field = key as keyof typeof desired;
    return JSON.stringify(desired[field]) !== JSON.stringify(actual[field]);
  });
}

function isKnownContentMatch(question: StagedQuestion) {
  return APPROVED_CONTENT_MATCHES.some(
    (approved) =>
      question.sourceReference === approved.sourceReference &&
      normalizedText(question.statement) === normalizedText(approved.statement) &&
      normalizedText(question.areaName) === normalizedText(approved.areaName),
  );
}

export function buildImportPlan(
  questions: StagedQuestion[],
  existingQuestions: ExistingQuestionSnapshot[],
): ImportPlan {
  const byReference = new Map(
    existingQuestions
      .filter((question) => question.sourceReference !== null)
      .map((question) => [question.sourceReference as string, question]),
  );
  const byContent = new Map<string, ExistingQuestionSnapshot[]>();
  for (const question of existingQuestions) {
    const key = contentKey(question.areaName, question.statement);
    byContent.set(key, [...(byContent.get(key) ?? []), question]);
  }

  const entries = questions.map<PlanEntry>((question) => {
    const referenceMatch = byReference.get(question.sourceReference);
    if (referenceMatch) {
      const differences = compareQuestion(question, referenceMatch);
      return differences.length === 0
        ? {
            sourceReference: question.sourceReference,
            action: "noop_source_match",
            existingQuestionId: referenceMatch.id,
          }
        : {
            sourceReference: question.sourceReference,
            action: "blocked_source_drift",
            existingQuestionId: referenceMatch.id,
            differences,
          };
    }

    const contentMatches = byContent.get(contentKey(question.areaName, question.statement)) ?? [];
    if (contentMatches.length > 0) {
      if (isKnownContentMatch(question) && contentMatches.length === 1) {
        return {
          sourceReference: question.sourceReference,
          action: "noop_known_content_match",
          existingQuestionId: contentMatches[0].id,
        };
      }
      return {
        sourceReference: question.sourceReference,
        action: "blocked_content_collision",
        existingQuestionId: contentMatches[0].id,
      };
    }

    return { sourceReference: question.sourceReference, action: "insert" };
  });

  return {
    total: entries.length,
    inserts: entries.filter((entry) => entry.action === "insert").length,
    sourceMatches: entries.filter((entry) => entry.action === "noop_source_match").length,
    knownContentMatches: entries.filter((entry) => entry.action === "noop_known_content_match").length,
    conflicts: entries.filter((entry) => entry.action.startsWith("blocked_")).length,
    entries,
  };
}

async function readStagingFile() {
  return validateStagingBatch(JSON.parse(await fs.readFile(STAGING_PATH, "utf8")) as unknown);
}

type DatabaseClient = ReturnType<typeof getPrisma>;

async function loadExistingQuestions(
  db: DatabaseClient | Prisma.TransactionClient,
  questions: StagedQuestion[],
): Promise<ExistingQuestionSnapshot[]> {
  const rows = await db.question.findMany({
    where: {
      OR: [
        { sourceReference: { in: questions.map((question) => question.sourceReference) } },
        { statement: { in: questions.map((question) => question.statement) } },
      ],
    },
    include: {
      area: true,
      subject: true,
      subsubject: true,
      expectedAnswers: { where: { isActive: true } },
      keyPoints: { orderBy: [{ orderIndex: "asc" }, { label: "asc" }] },
      commonErrors: true,
      professors: { include: { professor: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    sourceReference: row.sourceReference,
    statement: row.statement,
    areaName: row.area.name,
    subjectName: row.subject?.name ?? null,
    subsubjectName: row.subsubject?.name ?? null,
    difficulty: row.difficulty,
    estimatedProbability: Number(row.estimatedProbability),
    priorityScore: Number(row.priorityScore),
    questionType: row.questionType,
    origin: row.origin,
    isActive: row.isActive,
    expectedAnswers: row.expectedAnswers.map((answer) => ({
      modelAnswer: answer.modelAnswer,
      rubricNotes: answer.rubricNotes,
      version: answer.version,
      isActive: answer.isActive,
    })),
    keyPoints: row.keyPoints.map((point) => ({
      label: point.label,
      description: point.description,
      weight: Number(point.weight),
      isRequired: point.isRequired,
      orderIndex: point.orderIndex,
    })),
    commonErrors: row.commonErrors.map((error) => ({
      description: error.description,
      severity: error.severity,
    })),
    professorNames: row.professors.map((link) => link.professor.name),
  }));
}

async function createQuestion(tx: Prisma.TransactionClient, question: StagedQuestion) {
  const payload = JSON.stringify(question);
  const rows = await tx.$queryRaw<Array<{ question_id: string }>>(Prisma.sql`
    WITH payload AS (
      SELECT ${payload}::jsonb AS data
    ),
    area AS (
      INSERT INTO law_areas (name)
      SELECT data->>'areaName' FROM payload
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    ),
    subject AS (
      INSERT INTO subjects (area_id, name)
      SELECT area.id, payload.data->>'subjectName' FROM area, payload
      ON CONFLICT (area_id, name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    ),
    subsubject AS (
      INSERT INTO subsubjects (subject_id, name)
      SELECT subject.id, payload.data->>'subsubjectName' FROM subject, payload
      ON CONFLICT (subject_id, name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    ),
    professor AS (
      INSERT INTO professors (name)
      SELECT data->>'professorName' FROM payload
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    ),
    inserted_question AS (
      INSERT INTO questions (
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
      SELECT
        payload.data->>'sourceReference',
        payload.data->>'statement',
        area.id,
        subject.id,
        subsubject.id,
        (payload.data->>'difficulty')::difficulty,
        (payload.data->>'estimatedProbability')::numeric,
        (payload.data->>'priorityScore')::numeric,
        payload.data->>'questionType',
        (payload.data->>'origin')::question_origin,
        true
      FROM payload, area, subject, subsubject
      WHERE NOT EXISTS (
        SELECT 1 FROM questions existing
        WHERE existing.source_reference = payload.data->>'sourceReference'
      )
      AND NOT EXISTS (
        SELECT 1 FROM questions existing
        WHERE existing.area_id = area.id
          AND existing.statement = payload.data->>'statement'
      )
      RETURNING id
    ),
    expected_answer AS (
      INSERT INTO expected_answers (
        question_id,
        model_answer,
        rubric_notes,
        version,
        is_active
      )
      SELECT
        inserted_question.id,
        payload.data->>'expectedAnswer',
        payload.data->>'rubricNotes',
        1,
        true
      FROM inserted_question, payload
      RETURNING id
    ),
    key_points AS (
      INSERT INTO key_points (
        question_id,
        label,
        description,
        weight,
        is_required,
        order_index
      )
      SELECT
        inserted_question.id,
        point.label,
        point.description,
        point.weight,
        point."isRequired",
        point."orderIndex"
      FROM inserted_question, payload
      CROSS JOIN LATERAL jsonb_to_recordset(payload.data->'keyPoints') AS point(
        label text,
        description text,
        weight numeric,
        "isRequired" boolean,
        "orderIndex" integer
      )
      RETURNING id
    ),
    common_errors AS (
      INSERT INTO common_errors (question_id, description, severity)
      SELECT inserted_question.id, error.description, error.severity
      FROM inserted_question, payload
      CROSS JOIN LATERAL jsonb_to_recordset(payload.data->'commonErrors') AS error(
        description text,
        severity text
      )
      RETURNING id
    ),
    question_professor AS (
      INSERT INTO question_professors (question_id, professor_id)
      SELECT inserted_question.id, professor.id
      FROM inserted_question, professor
      RETURNING question_id
    )
    SELECT inserted_question.id AS question_id
    FROM inserted_question
  `);

  if (rows.length !== 1) {
    throw new Error(`Concurrent sourceReference or statement/area collision: ${question.sourceReference}`);
  }
}

function publicPlan(plan: ImportPlan) {
  return {
    total: plan.total,
    inserts: plan.inserts,
    sourceMatches: plan.sourceMatches,
    knownContentMatches: plan.knownContentMatches,
    conflicts: plan.conflicts,
    blocked: plan.entries
      .filter((entry) => entry.action.startsWith("blocked_"))
      .map(({ sourceReference, action, differences }) => ({ sourceReference, action, differences })),
  };
}

function printResult(mode: string, value: Record<string, unknown>) {
  console.log(JSON.stringify({ mode, ...value }));
}

async function runDatabaseMode(mode: "plan" | "apply" | "verify", questions: StagedQuestion[]) {
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const db = getPrisma();
  try {
    const existing = await loadExistingQuestions(db, questions);
    const plan = buildImportPlan(questions, existing);

    if (mode === "plan") {
      printResult("plan", publicPlan(plan));
      if (plan.conflicts > 0) process.exitCode = 2;
      return;
    }

    if (mode === "verify") {
      if (
        plan.conflicts !== 0 ||
        plan.inserts !== 0 ||
        plan.sourceMatches !== 224 ||
        plan.knownContentMatches !== 2
      ) {
        throw new Error(`Verification failed: ${JSON.stringify(publicPlan(plan))}`);
      }
      printResult("verify", { ...publicPlan(plan), verified: 226 });
      return;
    }

    if (!process.argv.includes("--confirm-batch=226")) {
      throw new Error("Apply requires --confirm-batch=226.");
    }
    if (plan.conflicts > 0) {
      throw new Error(`Apply blocked by plan conflicts: ${JSON.stringify(publicPlan(plan))}`);
    }

    let inserted = 0;
    for (const entry of plan.entries) {
      if (entry.action !== "insert") continue;
      const question = questions.find((item) => item.sourceReference === entry.sourceReference);
      if (!question) throw new Error(`Missing staged question: ${entry.sourceReference}`);
      try {
        await db.$transaction(
          (tx) => createQuestion(tx, question),
          REMOTE_TRANSACTION_OPTIONS,
        );
        inserted += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Apply stopped safely after ${inserted} committed question transactions; rerun is idempotent. Failure at ${entry.sourceReference}: ${message}`,
        );
      }
    }
    printResult("apply", {
      ...publicPlan(plan),
      inserted,
      skippedSourceMatches: plan.sourceMatches,
      skippedKnownContentMatches: plan.knownContentMatches,
    });
  } finally {
    await db.$disconnect();
  }
}

export async function runCli() {
  const mode = process.argv[2];
  const questions = await readStagingFile();
  if (mode === "validate") {
    printResult("validate", { reviewed: questions.length, errors: 0 });
    return;
  }
  if (mode !== "plan" && mode !== "apply" && mode !== "verify") {
    throw new Error("Usage: staged-question-bank <validate|plan|apply|verify> [--confirm-batch=226]");
  }
  await runDatabaseMode(mode, questions);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  void runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
