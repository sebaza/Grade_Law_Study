import { getOpenAIClient } from "@/lib/ai/openai";
import { evaluationResultSchema, type EvaluationResult } from "@/lib/domain/evaluation";
import { LAW_EXAM_RUBRIC } from "@/lib/domain/rubric";

export type EvaluateAnswerInput = {
  question: string;
  expectedAnswer: string;
  keyPoints: string[];
  commonErrors: string[];
  studentAnswer: string;
};

export async function evaluateAnswer(input: EvaluateAnswerInput): Promise<EvaluationResult> {
  const client = getOpenAIClient();

  const response = await client.responses.create({
    model: process.env.OPENAI_EVALUATION_MODEL ?? "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "Sos un evaluador experto del examen oral de grado de Derecho en Chile. Evaluás con criterio estricto pero pedagógico, usando la rúbrica institucional entregada. No inventes normas ni premies respuestas vagas. Devolvé solo JSON válido.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              rubric: LAW_EXAM_RUBRIC,
              question: input.question,
              expectedAnswer: input.expectedAnswer,
              keyPoints: input.keyPoints,
              commonErrors: input.commonErrors,
              studentAnswer: input.studentAnswer,
              instructions: {
                scoring:
                  "Evalúa cada criterio con 2, 4, 6, 8 o 10. totalScore es la suma de los 4 criterios. percentage = totalScore / 40 * 100.",
                feedback:
                  "Indica puntos correctos, puntos faltantes, errores conceptuales, recomendación concreta y respuesta modelo breve.",
              },
            }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "law_exam_evaluation",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "totalScore",
            "percentage",
            "isCorrect",
            "rubric",
            "summary",
            "correctKeyPoints",
            "missingKeyPoints",
            "conceptualErrors",
            "improvementRecommendation",
            "modelAnswer",
          ],
          properties: {
            totalScore: { type: "number", minimum: 8, maximum: 40 },
            percentage: { type: "number", minimum: 0, maximum: 100 },
            isCorrect: { type: "boolean" },
            rubric: {
              type: "object",
              additionalProperties: false,
              required: ["legalNorms", "legalConcepts", "practicalApplication", "structureAndArgumentation"],
              properties: {
                legalNorms: { $ref: "#/$defs/criterion" },
                legalConcepts: { $ref: "#/$defs/criterion" },
                practicalApplication: { $ref: "#/$defs/criterion" },
                structureAndArgumentation: { $ref: "#/$defs/criterion" },
              },
            },
            summary: { type: "string" },
            correctKeyPoints: { type: "array", items: { type: "string" } },
            missingKeyPoints: { type: "array", items: { type: "string" } },
            conceptualErrors: { type: "array", items: { type: "string" } },
            improvementRecommendation: { type: "string" },
            modelAnswer: { type: "string" },
          },
          $defs: {
            criterion: {
              type: "object",
              additionalProperties: false,
              required: ["score", "level", "feedback"],
              properties: {
                score: { type: "number", enum: [2, 4, 6, 8, 10] },
                level: { type: "string", enum: ["No cumple", "Deficiente", "Regular", "Bueno", "Excelente"] },
                feedback: { type: "string" },
              },
            },
          },
        },
      },
    },
  });

  const content = response.output_text;
  return evaluationResultSchema.parse(JSON.parse(content));
}
