import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemoQuestion } from "@/lib/practice/demo-bank";
import { evaluateDemoAnswer } from "@/lib/practice/demo-evaluator";

const demoEvaluationRequestSchema = z.object({
  sourceReference: z.string().min(1),
  answer: z.string().min(1),
  timeSeconds: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const parsed = demoEvaluationRequestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const question = await getDemoQuestion(parsed.data.sourceReference);
  if (!question) {
    return NextResponse.json({ error: "Pregunta demo no encontrada" }, { status: 404 });
  }

  const evaluation = evaluateDemoAnswer(question, parsed.data.answer);

  return NextResponse.json({
    mode: "demo",
    persisted: false,
    sourceReference: question.sourceReference,
    evaluation,
    note: "Evaluación local heurística. La evaluación definitiva usará OpenAI + Supabase cuando el .env esté configurado.",
  });
}
