import { NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminUser } from "@/lib/auth/admin";
import { generateBrief, getBriefForHome } from "@/lib/news/brief-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// La generación llama a OpenAI y a tres feeds externos: puede pasar el default.
export const maxDuration = 60;

// Coyuntura política para la home. Sirve el brief guardado y solo regenera
// cuando venció el TTL, así la mayoría de las visitas no gastan tokens.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const brief = await getBriefForHome();
    if (!brief) {
      return NextResponse.json({ error: "Todavía no hay lectura de coyuntura disponible." }, { status: 404 });
    }
    return NextResponse.json(brief);
  } catch (error) {
    console.error("Error al generar la coyuntura política:", error);
    return NextResponse.json({ error: "No se pudo leer la coyuntura política." }, { status: 503 });
  }
}

// Refresco manual desde el panel admin, ignorando el TTL.
export async function POST() {
  const auth = await requireAdminUser();
  if (isAdminAuthFailure(auth)) return auth.response;

  try {
    return NextResponse.json(await generateBrief());
  } catch (error) {
    console.error("Error al refrescar la coyuntura política:", error);
    return NextResponse.json({ error: "No se pudo refrescar la coyuntura política." }, { status: 503 });
  }
}
