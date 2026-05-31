import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/auth/user-profile";
import { getPrisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const stateUpdateSchema = z.object({
  status: z.enum(["pending", "in_practice", "answered", "mastered", "needs_review", "excluded"]).optional(),
  isExcluded: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  confidenceLevel: z.number().int().min(1).max(5).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params;
  const parsed = stateUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  await ensureUserProfile(data.user);

  const db = getPrisma();
  const question = await db.question.findUnique({ where: { id: questionId }, select: { id: true } });

  if (!question) {
    return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 });
  }

  const nextStatus = parsed.data.isExcluded ? "excluded" : parsed.data.status;
  const state = await db.studentQuestionState.upsert({
    where: {
      userId_questionId: {
        userId: data.user.id,
        questionId,
      },
    },
    create: {
      userId: data.user.id,
      questionId,
      status: nextStatus ?? "pending",
      isExcluded: parsed.data.isExcluded ?? nextStatus === "excluded",
      isFavorite: parsed.data.isFavorite ?? false,
      confidenceLevel: parsed.data.confidenceLevel,
    },
    update: {
      status: nextStatus,
      isExcluded: parsed.data.isExcluded,
      isFavorite: parsed.data.isFavorite,
      confidenceLevel: parsed.data.confidenceLevel,
    },
  });

  return NextResponse.json({ state });
}
