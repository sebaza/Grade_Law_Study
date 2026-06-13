import fs from "node:fs/promises";
import path from "node:path";
import {
  type PriorityRow,
  type RawCandidate,
  augmentPrioritiesWithInferredRows,
  countByProfessor,
  isExcludedProfessor,
  normalizeProfessorName,
  probabilityFor,
  readPriorityMatrix,
  readRawCandidatesFromQuestionnaire,
  slugify,
  subjectFromSubarea,
  tokenize,
} from "./question-generation-helpers";

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
    generationMethod: "heuristic-v2-all-professors";
  };
};

type QuestionBank = {
  generatedAt: string;
  generationMethod: "heuristic-v2-all-professors";
  targetQuestionCount: number;
  questionCount: number;
  sourceSummary: {
    priorityRows: number;
    originalPriorityRows: number;
    inferredPriorityRows: number;
    rawCandidates: number;
    eligibleCandidates: number;
    eligibleByProfessor: Record<string, number>;
    generatedBeforeQuotaByProfessor: Record<string, number>;
    selectedByProfessor: Record<string, number>;
    excludedProfessorRule: string;
  };
  questions: GeneratedQuestion[];
};

const TARGET_QUESTION_COUNT = Number(process.env.PHASE3_TARGET_COUNT ?? 0);

function inferQuestionType(statement: string): GeneratedQuestion["questionType"] {
  const lower = statement.toLowerCase();
  if (lower.startsWith("caso.")) return "case";
  if (lower.includes("diferenc") || lower.includes("compare") || lower.includes("distinga")) return "comparison";
  if (lower.includes("acción") || lower.includes("accion") || lower.includes("aplica") || lower.includes("qué se hace")) {
    return "application";
  }
  if (lower.includes("qué es") || lower.includes("que es") || lower.includes("concepto") || lower.includes("defina")) {
    return "definition";
  }
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
    .split(/(?<=[.!?])\s+/u)
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

function selectWithGlobalQuota(questions: GeneratedQuestion[]) {
  if (TARGET_QUESTION_COUNT <= 0 || TARGET_QUESTION_COUNT >= questions.length) {
    return questions.sort((a, b) => a.professorName.localeCompare(b.professorName) || b.priorityScore - a.priorityScore);
  }

  return questions
    .sort((a, b) => b.priorityScore - a.priorityScore || b.estimatedProbability - a.estimatedProbability)
    .slice(0, TARGET_QUESTION_COUNT)
    .sort((a, b) => a.professorName.localeCompare(b.professorName) || b.priorityScore - a.priorityScore);
}

async function main() {
  const originalPriorities = await readPriorityMatrix();
  const rawCandidates = await readRawCandidatesFromQuestionnaire();
  const eligibleCandidates = rawCandidates.filter((candidate): candidate is RawCandidate & { professorName: string } => {
    const professor = normalizeProfessorName(candidate.professorName);
    return Boolean(professor && !isExcludedProfessor(professor));
  });
  const priorities = augmentPrioritiesWithInferredRows(originalPriorities, eligibleCandidates);

  const generated: GeneratedQuestion[] = [];

  for (const candidate of eligibleCandidates) {
    const priority = matchPriority(candidate, priorities);
    if (!priority) continue;

    const expectedAnswer = buildExpectedAnswer(candidate, priority);
    const sourceReference = `docx:${candidate.orderIndex}:${slugify(candidate.professorName ?? "sin-profesor", 80)}:${slugify(candidate.statement, 80)}`;

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
        generationMethod: "heuristic-v2-all-professors",
      },
    });
  }

  const questions = selectWithGlobalQuota(generated);

  const bank: QuestionBank = {
    generatedAt: new Date().toISOString(),
    generationMethod: "heuristic-v2-all-professors",
    targetQuestionCount: TARGET_QUESTION_COUNT > 0 ? TARGET_QUESTION_COUNT : questions.length,
    questionCount: questions.length,
    sourceSummary: {
      priorityRows: priorities.length,
      originalPriorityRows: originalPriorities.length,
      inferredPriorityRows: priorities.length - originalPriorities.length,
      rawCandidates: rawCandidates.length,
      eligibleCandidates: eligibleCandidates.length,
      eligibleByProfessor: countByProfessor(eligibleCandidates),
      generatedBeforeQuotaByProfessor: countByProfessor(generated),
      selectedByProfessor: countByProfessor(questions),
      excludedProfessorRule: "Profesores cuyo nombre contiene /ascencio/i se omiten antes de generar seeds.",
    },
    questions,
  };

  const outputDir = path.join(process.cwd(), "data", "processed");
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "question-bank.seed.json");
  await fs.writeFile(outputPath, JSON.stringify(bank, null, 2), "utf8");

  console.log(`Banco generado en ${outputPath}`);
  console.log(`Preguntas reales normalizadas: ${bank.questionCount}/${bank.targetQuestionCount}`);
  console.log(`Distribución por profesor: ${JSON.stringify(bank.sourceSummary.selectedByProfessor)}`);
  console.log(`Prioridades originales/inferidas: ${bank.sourceSummary.originalPriorityRows}/${bank.sourceSummary.inferredPriorityRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
