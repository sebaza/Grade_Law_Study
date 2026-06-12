import type { AdaptiveFollowUpResult, EvaluationResult } from "@/lib/domain/evaluation";
import type { DemoQuestion } from "@/lib/practice/types";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenize(value: string) {
  const stopWords = new Set([
    "para", "como", "este", "esta", "estos", "estas", "debe", "deben", "sobre", "dentro", "derecho", "juridico",
    "juridica", "norma", "normas", "concepto", "conceptos", "pregunta", "respuesta", "articulo", "art", "una", "uno",
    "los", "las", "con", "por",
  ]);

  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3 && !stopWords.has(token));
}

function overlapRatio(answer: string, expected: string) {
  const expectedTokens = [...new Set(tokenize(expected))];
  if (expectedTokens.length === 0) return 0;

  const answerTokens = new Set(tokenize(answer));
  const matched = expectedTokens.filter((token) => answerTokens.has(token)).length;
  return matched / expectedTokens.length;
}

function scoreToLevel(score: number) {
  if (score >= 10) return "Excelente" as const;
  if (score >= 8) return "Bueno" as const;
  if (score >= 6) return "Regular" as const;
  if (score >= 4) return "Deficiente" as const;
  return "No cumple" as const;
}

function rubricScore(score: number, feedback: string, impact: string) {
  return {
    score: score as 2 | 4 | 6 | 8 | 10,
    level: scoreToLevel(score),
    feedback,
    impact,
  };
}

function clampRubricScore(value: number) {
  if (value >= 9) return 10;
  if (value >= 7) return 8;
  if (value >= 5) return 6;
  if (value >= 3) return 4;
  return 2;
}

function hasLegalSignals(answer: string) {
  const normalizedAnswer = normalize(answer);

  return ["articulo", "norma", "principio", "accion", "requisito", "efecto", "tribunal", "codigo", "constitucion"]
    .some((signal) => normalizedAnswer.includes(signal));
}

export function assessDemoAnswerForFollowUp(question: DemoQuestion, answer: string): AdaptiveFollowUpResult {
  const matchedKeyPoints = question.keyPoints.filter((point) => overlapRatio(answer, point.description) >= 0.18);
  const expectedRatio = overlapRatio(answer, question.expectedAnswer);
  const hasLegalLanguage = hasLegalSignals(answer);
  const isTooShort = tokenize(answer).length < 18;
  const weakKeyPoints = question.keyPoints.length > 0 && matchedKeyPoints.length / question.keyPoints.length < 0.35;
  const requiresFollowUp = isTooShort || weakKeyPoints || expectedRatio < 0.25 || !hasLegalLanguage;

  if (!requiresFollowUp) {
    return {
      requiresFollowUp: false,
      reason: "La respuesta inicial permite evaluar razonablemente los cuatro criterios de la rúbrica.",
      targetCriteria: [],
      followUpQuestion: "",
    };
  }

  const targetCriteria: AdaptiveFollowUpResult["targetCriteria"] = [];
  if (!hasLegalLanguage) targetCriteria.push("legalNorms");
  if (weakKeyPoints) targetCriteria.push("legalConcepts");
  if (expectedRatio < 0.25) targetCriteria.push("practicalApplication");
  if (isTooShort) targetCriteria.push("structureAndArgumentation");

  const missingPoint = question.keyPoints.find((point) => !matchedKeyPoints.includes(point));

  return {
    requiresFollowUp: true,
    reason: "La respuesta inicial es demasiado general para asignar una nota final con justicia.",
    targetCriteria: targetCriteria.length > 0 ? targetCriteria : ["legalConcepts"],
    followUpQuestion: missingPoint
      ? `Precisá este punto para completar tu respuesta: ${missingPoint.description}`
      : "Precisá la norma aplicable, el concepto central y cómo se aplica a la pregunta concreta.",
  };
}

export function evaluateDemoAnswer(question: DemoQuestion, answer: string): EvaluationResult {
  const matchedKeyPoints = question.keyPoints.filter((point) => overlapRatio(answer, point.description) >= 0.18);
  const missingKeyPoints = question.keyPoints.filter((point) => !matchedKeyPoints.includes(point));
  const answerTokens = tokenize(answer);
  const expectedRatio = overlapRatio(answer, question.expectedAnswer);
  const structureSignals = ["primero", "segundo", "ademas", "además", "por tanto", "en consecuencia", "finalmente"];
  const hasStructure = structureSignals.some((signal) => normalize(answer).includes(normalize(signal)));
  const hasLegalLanguage = hasLegalSignals(answer);

  const keyPointRatio = question.keyPoints.length > 0 ? matchedKeyPoints.length / question.keyPoints.length : expectedRatio;
  const legalNormsScore = clampRubricScore((hasLegalLanguage ? 4 : 2) + expectedRatio * 6);
  const legalConceptsScore = clampRubricScore(2 + keyPointRatio * 8);
  const practicalScore = clampRubricScore(2 + Math.max(expectedRatio, keyPointRatio) * 8 + (question.questionType === "case" ? 0 : -1));
  const structureScore = clampRubricScore((answerTokens.length > 25 ? 5 : 2) + (hasStructure ? 4 : 1));
  const totalScore = legalNormsScore + legalConceptsScore + practicalScore + structureScore;
  const percentage = Math.round((totalScore / 40) * 100);

  return {
    totalScore,
    percentage,
    isCorrect: percentage >= 70,
    rubric: {
      legalNorms: rubricScore(
        legalNormsScore,
        hasLegalLanguage ? "Usa señales de lenguaje normativo/jurídico." : "Falta mencionar normas, artículos o instituciones con precisión.",
        hasLegalLanguage
          ? "Sube porque la rúbrica premia identificar y ubicar normas aplicables."
          : "Baja con fuerza porque la rúbrica exige identificar y relacionar normas, no solo hablar en general.",
      ),
      legalConcepts: rubricScore(
        legalConceptsScore,
        `${matchedKeyPoints.length}/${question.keyPoints.length} puntos clave detectados.`,
        keyPointRatio >= 0.5
          ? "Sostiene el puntaje porque aparecen conceptos centrales de la pauta."
          : "Limita el puntaje porque no se distinguen suficientes conceptos técnico-jurídicos.",
      ),
      practicalApplication: rubricScore(
        practicalScore,
        expectedRatio >= 0.45 ? "Relaciona adecuadamente la respuesta con la pauta esperada." : "La aplicación a la pregunta todavía es parcial.",
        expectedRatio >= 0.45
          ? "Aporta porque conecta la teoría con la pregunta concreta."
          : "Baja porque la rúbrica exige aplicar normas e instituciones, no solo definirlas.",
      ),
      structureAndArgumentation: rubricScore(
        structureScore,
        hasStructure ? "Respuesta con señales de orden argumentativo." : "Conviene ordenar la respuesta en definición, desarrollo y cierre.",
        hasStructure
          ? "Ayuda a sostener claridad y secuencia oral."
          : "Afecta menos que el fondo si hay contenido, pero reduce claridad frente a comisión.",
      ),
    },
    summary: percentage >= 70
      ? "Respuesta aceptable para práctica inicial, aunque debe revisarse contra la pauta completa."
      : "Respuesta insuficiente o incompleta para el estándar de la rúbrica; requiere repaso.",
    correctKeyPoints: matchedKeyPoints.map((point) => point.description),
    missingKeyPoints: missingKeyPoints.map((point) => point.description),
    conceptualErrors: [],
    improvementRecommendation: "Reformulá la respuesta mencionando norma aplicable, concepto central, efectos y una conclusión ordenada.",
    modelAnswer: question.expectedAnswer,
  };
}
