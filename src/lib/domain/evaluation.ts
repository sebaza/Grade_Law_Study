import { z } from "zod";

export const rubricCriterionSchema = z.object({
  score: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(8), z.literal(10)]),
  level: z.enum(["No cumple", "Deficiente", "Regular", "Bueno", "Excelente"]),
  feedback: z.string(),
});

export const evaluationResultSchema = z.object({
  totalScore: z.number().min(8).max(40),
  percentage: z.number().min(0).max(100),
  isCorrect: z.boolean(),
  rubric: z.object({
    legalNorms: rubricCriterionSchema,
    legalConcepts: rubricCriterionSchema,
    practicalApplication: rubricCriterionSchema,
    structureAndArgumentation: rubricCriterionSchema,
  }),
  summary: z.string(),
  correctKeyPoints: z.array(z.string()),
  missingKeyPoints: z.array(z.string()),
  conceptualErrors: z.array(z.string()),
  improvementRecommendation: z.string(),
  modelAnswer: z.string(),
});

export type EvaluationResult = z.infer<typeof evaluationResultSchema>;

export const evaluationRequestSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.string().min(1),
  answerMode: z.enum(["text", "voice"]).default("text"),
  timeSeconds: z.number().int().positive().optional(),
});
