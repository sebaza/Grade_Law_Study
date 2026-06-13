import { getOpenAIClient } from "@/lib/ai/openai";
import {
  adaptiveFollowUpResultSchema,
  evaluationResultSchema,
  type AdaptiveFollowUpResult,
  type EvaluationResult,
} from "@/lib/domain/evaluation";
import { LAW_EXAM_RUBRIC } from "@/lib/domain/rubric";
import type { AcademicEvaluationProfile } from "@/lib/domain/academic-profile";

export type EvaluateAnswerInput = {
  question: string;
  expectedAnswer: string;
  keyPoints: string[];
  commonErrors: string[];
  studentAnswer: string;
  academicProfile?: AcademicEvaluationProfile;
  adaptiveContext?: {
    followUpQuestion: string;
    followUpAnswer: string;
  };
};

export type AssessAnswerForFollowUpInput = {
  question: string;
  expectedAnswer: string;
  keyPoints: string[];
  commonErrors: string[];
  studentAnswer: string;
};

const rubricCriterionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "level", "feedback", "impact"],
  properties: {
    score: { type: "number", enum: [2, 4, 6, 8, 10] },
    level: { type: "string", enum: ["No cumple", "Deficiente", "Regular", "Bueno", "Excelente"] },
    feedback: { type: "string" },
    impact: { type: "string" },
  },
} as const;

export async function assessAnswerForFollowUp(input: AssessAnswerForFollowUpInput): Promise<AdaptiveFollowUpResult> {
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
              "Sos un examinador experto del examen oral de grado de Derecho en Chile. No pongas nota. Decidí si la respuesta inicial permite evaluar o si requiere una sola repregunta específica. Devolvé solo JSON válido.",
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
                whenToAsk:
                  "Pedí repregunta si la respuesta es demasiado general, meramente definicional cuando la pregunta exige precisión, omite normas centrales, no aterriza conceptos, o no permite distinguir entre Regular/Deficiente/Bueno con seguridad.",
                whenNotToAsk:
                  "No pidas repregunta si la respuesta ya permite evaluar razonablemente los cuatro criterios de la rúbrica, aunque tenga errores o faltantes.",
                followUpStyle:
                  "La repregunta debe ser breve, oral, específica y dirigida a completar la misma respuesta; no debe abrir un tema nuevo.",
              },
            }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "adaptive_follow_up_decision",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["requiresFollowUp", "reason", "targetCriteria", "followUpQuestion"],
          properties: {
            requiresFollowUp: { type: "boolean" },
            reason: { type: "string" },
            targetCriteria: {
              type: "array",
              items: {
                type: "string",
                enum: ["legalNorms", "legalConcepts", "practicalApplication", "structureAndArgumentation"],
              },
            },
            followUpQuestion: { type: "string" },
          },
        },
      },
    },
  });

  return adaptiveFollowUpResultSchema.parse(JSON.parse(response.output_text));
}

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
              "Sos un evaluador experto del examen oral de grado de Derecho en Chile. Evaluás con criterio estricto pero pedagógico, usando la rúbrica institucional entregada. Si recibís academicProfile, usalo como perfil inferido del académico: sé especialmente exigente en sus primaryCriteria y aplicá su guidance sin inventar ponderaciones matemáticas. No inventes normas ni premies respuestas vagas. Devolvé solo JSON válido.",
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
              academicProfile: input.academicProfile
                ? {
                    professorName: input.academicProfile.professorName,
                    areaName: input.academicProfile.areaName,
                    source: input.academicProfile.source,
                    primaryCriteria: input.academicProfile.primaryCriteria,
                    guidance: input.academicProfile.guidance,
                  }
                : null,
              adaptiveContext: input.adaptiveContext
                ? {
                    note:
                      "La respuesta evaluada combina una respuesta inicial con una respuesta complementaria guiada por repregunta. Evaluá el desempeño final completo, no la repregunta como pregunta separada.",
                    followUpQuestion: input.adaptiveContext.followUpQuestion,
                    followUpAnswer: input.adaptiveContext.followUpAnswer,
                  }
                : null,
              instructions: {
                scoring:
                  "Evaluá cada criterio con 2, 4, 6, 8 o 10 según la rúbrica institucional. totalScore es la suma de los 4 criterios. percentage = totalScore / 40 * 100.",
                feedback:
                  "En cada criterio, feedback debe resumir qué se observó e impact debe explicar por qué ese criterio subió o bajó el puntaje. Sé breve, específico y pedagógico. Explicá mayor impacto cuando la pregunta exigía normas, conceptos, aplicación práctica u orden argumentativo.",
                output:
                  "La respuesta debe ser resumida. No escribas tratados. El alumno tiene que entender por qué recibió el puntaje.",
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
            criterion: rubricCriterionSchema,
          },
        },
      },
    },
  });

  return evaluationResultSchema.parse(JSON.parse(response.output_text));
}
