import { z } from "zod";

export const rubricCriterionSchema = z.object({
  score: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(8), z.literal(10)]),
  level: z.enum(["No cumple", "Deficiente", "Regular", "Bueno", "Excelente"]),
  feedback: z.string(),
  impact: z.string(),
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

export const followUpRequestSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const evaluationRequestSchema = z.object({
  questionId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  answer: z.string().min(1),
  followUp: followUpRequestSchema.optional(),
  answerMode: z.enum(["text", "voice"]).default("text"),
  transcription: z.string().optional(),
  audioPath: z.string().optional(),
  timeSeconds: z.number().int().positive().optional(),
});

export const adaptiveFollowUpResultSchema = z.object({
  requiresFollowUp: z.boolean(),
  reason: z.string(),
  targetCriteria: z.array(z.enum(["legalNorms", "legalConcepts", "practicalApplication", "structureAndArgumentation"])),
  followUpQuestion: z.string(),
});

export type AdaptiveFollowUpResult = z.infer<typeof adaptiveFollowUpResultSchema>;
