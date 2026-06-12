import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemoQuestion } from "@/lib/practice/demo-bank";
import { assessDemoAnswerForFollowUp, evaluateDemoAnswer } from "@/lib/practice/demo-evaluator";

const demoEvaluationRequestSchema = z.object({
  sourceReference: z.string().min(1),
  answer: z.string().min(1),
  followUp: z.object({
    question: z.string().min(1),
    answer: z.string().min(1),
  }).optional(),
  timeSeconds: z.number().int().positive().optional(),
});

function formatCombinedAnswer(initialAnswer: string, followUpAnswer?: string) {
  if (!followUpAnswer?.trim()) return initialAnswer;

  return [
    "Respuesta inicial:",
    initialAnswer.trim(),
    "",
    "Respuesta complementaria:",
    followUpAnswer.trim(),
  ].join("\n");
}

export async function POST(request: Request) {
  const parsed = demoEvaluationRequestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const question = await getDemoQuestion(parsed.data.sourceReference);
  if (!question) {
    return NextResponse.json({ error: "Pregunta demo no encontrada" }, { status: 404 });
  }

  if (!parsed.data.followUp) {
    const followUpDecision = assessDemoAnswerForFollowUp(question, parsed.data.answer);

    if (followUpDecision.requiresFollowUp) {
      return NextResponse.json({
        mode: "demo",
        persisted: false,
        sourceReference: question.sourceReference,
        status: "requires_follow_up",
        followUp: {
          question: followUpDecision.followUpQuestion,
          reason: followUpDecision.reason,
          targetCriteria: followUpDecision.targetCriteria,
        },
        note: "Repregunta demo generada con heurística local.",
      });
    }
  }

  const evaluation = evaluateDemoAnswer(question, formatCombinedAnswer(parsed.data.answer, parsed.data.followUp?.answer));

  return NextResponse.json({
    mode: "demo",
    persisted: false,
    sourceReference: question.sourceReference,
    status: "evaluated",
    evaluation,
    adaptive: {
      usedFollowUp: Boolean(parsed.data.followUp),
    },
    note: "Evaluación local heurística. La evaluación definitiva usará OpenAI + Supabase cuando el .env esté configurado.",
  });
}
