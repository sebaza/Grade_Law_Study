import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { readSheet } from "read-excel-file/node";
import { SOURCE_MANIFEST, resolveSourcePath } from "../ingest/source-manifest";

type PriorityRow = {
  professor: string;
  area: string;
  subarea: string;
  frequency: number;
  professorPercentage: number;
  syllabusAlignment: string;
  relevance: string;
  priorityScore: number;
};

type RawCandidate = {
  areaName: string | null;
  professorName: string | null;
  statement: string;
  rawAnswer: string | null;
  orderIndex: number;
};

type GeneratedQuestion = {
  sourceReference: string;
  statement: string;
  areaName: string;
  subjectName: string;
  subsubjectName: string;
  professorName: string;
  difficulty: "low" | "medium" | "high";
  estimatedProbability: number;
  priorityScore: number;
  questionType: "definition" | "case" | "comparison" | "application" | "general";
  origin: "real_question";
  expectedAnswer: string;
  rubricNotes: string;
  keyPoints: Array<{ label: string; description: string; weight: number; isRequired: boolean; orderIndex: number }>;
  commonErrors: Array<{ description: string; severity: "low" | "medium" | "high" }>;
  metadata: {
    rawAreaName: string | null;
    rawProfessorName: string | null;
    rawOrderIndex: number;
    matchedPrioritySubarea: string;
    matchedPriorityScore: number;
    matchedRelevance: string;
    generationMethod: "heuristic-v1";
  };
};

type QuestionBank = {
  generatedAt: string;
  generationMethod: "heuristic-v1";
  targetQuestionCount: number;
  questionCount: number;
  sourceSummary: {
    priorityRows: number;
    rawCandidates: number;
    eligibleCandidates: number;
    eligibleByProfessor: Record<string, number>;
    generatedBeforeQuotaByProfessor: Record<string, number>;
    selectedByProfessor: Record<string, number>;
  };
  questions: GeneratedQuestion[];
};

const TARGET_QUESTION_COUNT = Number(process.env.PHASE3_TARGET_COUNT ?? 120);
const PRIORITY_PROFESSORS = new Set(["Felipe Ortiz", "Stephanie Merlet", "Mauricio Figueroa"]);

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Number(normalizeText(value).replace(",", "."));
  if (Number.isNaN(parsed)) throw new Error(`Valor numérico inválido: ${String(value)}`);
  return parsed;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function tokenize(value: string) {
  const stopWords = new Set([
    "que", "cual", "cuales", "como", "para", "por", "con", "del", "los", "las", "una", "uno", "sobre", "derecho",
    "concepto", "conceptos", "normas", "juridicas", "juridico", "juridicos", "art", "articulo", "usted", "caso",
  ]);

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3 && !stopWords.has(token));
}

function looksLikeArea(text: string) {
  return /^Derecho\s+.+\.?$/u.test(text) && text.length < 90;
}

function parseProfessorHeading(text: string) {
  const match = text.match(/^(\d+)\s+(.+?)\.?$/u);
  if (!match) return null;

  const possibleName = match[2].trim();
  if (possibleName.length < 3 || possibleName.length > 60) return null;
  if (possibleName.includes("?")) return null;

  return possibleName;
}

function isQuestionLike(text: string) {
  return text.includes("?") || text.startsWith("¿") || text.toLowerCase().startsWith("caso.");
}

async function readPriorities() {
  const source = SOURCE_MANIFEST.find((item) => item.kind === "priority_matrix");
  if (!source) throw new Error("No priority matrix source found");

  const rows = await readSheet(resolveSourcePath(source), "frequency_relevance_matrix");
  const [headers, ...dataRows] = rows;
  if (!headers) throw new Error("Excel sin encabezados");

  const headerIndexes = new Map<string, number>();
  headers.forEach((header, index) => headerIndexes.set(normalizeText(header), index));

  const get = (row: unknown[], header: string) => {
    const index = headerIndexes.get(header);
    if (index === undefined) throw new Error(`No existe columna ${header}`);
    return row[index];
  };

  return dataRows
    .filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ""))
    .map((row): PriorityRow => ({
      professor: normalizeText(get(row, "professor")),
      area: normalizeText(get(row, "area")),
      subarea: normalizeText(get(row, "subarea")),
      frequency: normalizeNumber(get(row, "frecuencia")),
      professorPercentage: normalizeNumber(get(row, "% profesor")),
      syllabusAlignment: normalizeText(get(row, "alineacion_temario")),
      relevance: normalizeText(get(row, "relevancia")),
      priorityScore: normalizeNumber(get(row, "score_prioridad")),
    }));
}

async function readRawCandidates() {
  const source = SOURCE_MANIFEST.find((item) => item.kind === "questionnaire");
  if (!source) throw new Error("No questionnaire source found");

  const result = await mammoth.extractRawText({ path: resolveSourcePath(source) });
  const paragraphs = result.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let currentArea: string | null = null;
  let currentProfessor: string | null = null;
  const candidates: RawCandidate[] = [];

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];

    if (looksLikeArea(paragraph)) {
      currentArea = paragraph.replace(/\.$/, "");
      continue;
    }

    const professor = parseProfessorHeading(paragraph);
    if (professor) {
      currentProfessor = professor;
      continue;
    }

    if (!isQuestionLike(paragraph)) continue;

    const rawAnswer = paragraphs[index + 1] && !isQuestionLike(paragraphs[index + 1])
      ? paragraphs[index + 1]
      : null;

    candidates.push({
      areaName: currentArea,
      professorName: currentProfessor,
      statement: paragraph,
      rawAnswer,
      orderIndex: index,
    });
  }

  return candidates;
}

function inferQuestionType(statement: string): GeneratedQuestion["questionType"] {
  const lower = statement.toLowerCase();
  if (lower.startsWith("caso.")) return "case";
  if (lower.includes("diferenc") || lower.includes("compare") || lower.includes("distinga")) return "comparison";
  if (lower.includes("acción") || lower.includes("aplica") || lower.includes("qué se hace")) return "application";
  if (lower.includes("qué es") || lower.includes("concepto") || lower.includes("defina")) return "definition";
  return "general";
}

function inferDifficulty(priority: PriorityRow, candidate: RawCandidate) {
  const type = inferQuestionType(candidate.statement);
  const answerLength = candidate.rawAnswer?.length ?? 0;

  if (type === "case" || answerLength > 900 || priority.priorityScore >= 90) return "high";
  if (priority.relevance === "Baja" && priority.priorityScore <= 14 && answerLength < 350) return "low";
  if (priority.priorityScore >= 24 || answerLength > 250) return "medium";
  return "low";
}

function subjectFromSubarea(subarea: string) {
  const beforeColon = subarea.split(":")[0]?.trim();
  if (beforeColon && beforeColon.length >= 4) return beforeColon;
  return subarea.split(",")[0]?.trim() || subarea;
}

function matchPriority(candidate: RawCandidate, priorities: PriorityRow[]) {
  const professorPriorities = priorities.filter((priority) => priority.professor === candidate.professorName);
  if (professorPriorities.length === 0) return null;

  const haystackTokens = new Set(tokenize(`${candidate.statement} ${candidate.rawAnswer ?? ""} ${candidate.areaName ?? ""}`));

  let best = professorPriorities[0];
  let bestScore = -1;

  for (const priority of professorPriorities) {
    const subareaTokens = tokenize(priority.subarea);
    const overlap = subareaTokens.filter((token) => haystackTokens.has(token)).length;
    const score = overlap * 10 + priority.priorityScore / 10;

    if (score > bestScore) {
      best = priority;
      bestScore = score;
    }
  }

  return best;
}

function buildExpectedAnswer(candidate: RawCandidate, priority: PriorityRow) {
  if (candidate.rawAnswer && candidate.rawAnswer.length > 40) return candidate.rawAnswer;

  return [
    `Una respuesta suficiente debe abordar la submateria "${priority.subarea}" dentro de ${priority.area}.`,
    "Debe identificar las normas aplicables, explicar los conceptos técnico-jurídicos relevantes y ordenar la respuesta con fundamento.",
    "Esta respuesta base fue generada como pauta inicial y requiere revisión manual antes de usarla como respuesta definitiva.",
  ].join(" ");
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 30);
}

function buildKeyPoints(expectedAnswer: string, priority: PriorityRow) {
  const sentences = splitSentences(expectedAnswer).slice(0, 5);
  const points = sentences.length > 0
    ? sentences
    : [
        `Ubicar la pregunta dentro de ${priority.subarea}.`,
        "Identificar normas o instituciones jurídicas pertinentes.",
        "Explicar conceptos centrales con lenguaje técnico.",
        "Relacionar la respuesta con el problema o pregunta formulada.",
      ];

  return points.map((sentence, index) => ({
    label: `Punto clave ${index + 1}`,
    description: sentence,
    weight: index === 0 ? 1.5 : 1,
    isRequired: index < 3,
    orderIndex: index,
  }));
}

function buildCommonErrors(priority: PriorityRow) {
  return [
    {
      description: `Responder sin ubicar la materia en ${priority.subarea}.`,
      severity: "medium" as const,
    },
    {
      description: "Omitir normas aplicables o mencionarlas sin explicar su relación con la pregunta.",
      severity: "high" as const,
    },
    {
      description: "Entregar una respuesta desordenada, sin estructura de definición, desarrollo y cierre.",
      severity: "medium" as const,
    },
  ];
}


function countByProfessor<T extends { professorName: string }>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.professorName] = (acc[item.professorName] ?? 0) + 1;
    return acc;
  }, {});
}

function selectWithProfessorQuotas(questions: GeneratedQuestion[], priorities: PriorityRow[]) {
  const professorScores = [...PRIORITY_PROFESSORS].map((professorName) => ({
    professorName,
    score: priorities
      .filter((priority) => priority.professor === professorName)
      .reduce((sum, priority) => sum + priority.priorityScore, 0),
  }));

  const totalScore = professorScores.reduce((sum, item) => sum + item.score, 0);
  const quotas = new Map<string, number>();
  let assigned = 0;

  for (const item of professorScores) {
    const quota = Math.floor((item.score / totalScore) * TARGET_QUESTION_COUNT);
    quotas.set(item.professorName, quota);
    assigned += quota;
  }

  let remainingQuota = TARGET_QUESTION_COUNT - assigned;
  for (const item of professorScores.slice().sort((a, b) => b.score - a.score)) {
    if (remainingQuota <= 0) break;
    quotas.set(item.professorName, (quotas.get(item.professorName) ?? 0) + 1);
    remainingQuota -= 1;
  }

  const byProfessor = new Map<string, GeneratedQuestion[]>();
  for (const question of questions) {
    const group = byProfessor.get(question.professorName) ?? [];
    group.push(question);
    byProfessor.set(question.professorName, group);
  }

  const selected: GeneratedQuestion[] = [];
  const leftovers: GeneratedQuestion[] = [];

  for (const [professorName, group] of byProfessor) {
    const ordered = group.sort((a, b) => b.priorityScore - a.priorityScore || b.estimatedProbability - a.estimatedProbability);
    const quota = quotas.get(professorName) ?? 0;
    selected.push(...ordered.slice(0, quota));
    leftovers.push(...ordered.slice(quota));
  }

  if (selected.length < TARGET_QUESTION_COUNT) {
    selected.push(
      ...leftovers
        .sort((a, b) => b.priorityScore - a.priorityScore || b.estimatedProbability - a.estimatedProbability)
        .slice(0, TARGET_QUESTION_COUNT - selected.length),
    );
  }

  return selected
    .sort((a, b) => b.priorityScore - a.priorityScore || a.professorName.localeCompare(b.professorName))
    .slice(0, TARGET_QUESTION_COUNT);
}

function probabilityFor(priority: PriorityRow, allPriorities: PriorityRow[]) {
  const total = allPriorities
    .filter((row) => row.professor === priority.professor)
    .reduce((sum, row) => sum + row.priorityScore, 0);

  if (total === 0) return 0;
  return Math.round((priority.priorityScore / total) * 10000) / 100;
}

async function main() {
  const priorities = await readPriorities();
  const rawCandidates = await readRawCandidates();
  const eligibleCandidates = rawCandidates.filter((candidate) => candidate.professorName && PRIORITY_PROFESSORS.has(candidate.professorName));

  const generated: GeneratedQuestion[] = [];

  for (const candidate of eligibleCandidates) {
    const priority = matchPriority(candidate, priorities);
    if (!priority) continue;

    const expectedAnswer = buildExpectedAnswer(candidate, priority);
    const sourceReference = `docx:${candidate.orderIndex}:${slugify(candidate.professorName ?? "sin-profesor")}:${slugify(candidate.statement)}`;

    generated.push({
      sourceReference,
      statement: candidate.statement,
      areaName: priority.area,
      subjectName: subjectFromSubarea(priority.subarea),
      subsubjectName: priority.subarea,
      professorName: priority.professor,
      difficulty: inferDifficulty(priority, candidate),
      estimatedProbability: probabilityFor(priority, priorities),
      priorityScore: priority.priorityScore,
      questionType: inferQuestionType(candidate.statement),
      origin: "real_question",
      expectedAnswer,
      rubricNotes: "Pauta inicial generada desde pregunta real, respuesta base y rúbrica institucional. Requiere revisión manual para versión definitiva.",
      keyPoints: buildKeyPoints(expectedAnswer, priority),
      commonErrors: buildCommonErrors(priority),
      metadata: {
        rawAreaName: candidate.areaName,
        rawProfessorName: candidate.professorName,
        rawOrderIndex: candidate.orderIndex,
        matchedPrioritySubarea: priority.subarea,
        matchedPriorityScore: priority.priorityScore,
        matchedRelevance: priority.relevance,
        generationMethod: "heuristic-v1",
      },
    });
  }

  const questions = selectWithProfessorQuotas(generated, priorities);

  const bank: QuestionBank = {
    generatedAt: new Date().toISOString(),
    generationMethod: "heuristic-v1",
    targetQuestionCount: TARGET_QUESTION_COUNT,
    questionCount: questions.length,
    sourceSummary: {
      priorityRows: priorities.length,
      rawCandidates: rawCandidates.length,
      eligibleCandidates: eligibleCandidates.length,
      eligibleByProfessor: countByProfessor(eligibleCandidates.filter((candidate): candidate is RawCandidate & { professorName: string } => Boolean(candidate.professorName))),
      generatedBeforeQuotaByProfessor: countByProfessor(generated),
      selectedByProfessor: countByProfessor(questions),
    },
    questions,
  };

  const outputDir = path.join(process.cwd(), "data", "processed");
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "question-bank.seed.json");
  await fs.writeFile(outputPath, JSON.stringify(bank, null, 2), "utf8");

  console.log(`Banco generado en ${outputPath}`);
  console.log(`Preguntas generadas: ${bank.questionCount}`);
  console.log(`Candidatas elegibles: ${bank.sourceSummary.eligibleCandidates}/${bank.sourceSummary.rawCandidates}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
