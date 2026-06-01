import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/auth/user-profile";
import { transcribeAudio } from "@/lib/ai/transcribe-audio";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "video/webm",
]);

function extensionFromFile(file: File) {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 6) return fromName.toLowerCase();
  if (file.type.includes("webm")) return "webm";
  if (file.type.includes("mpeg") || file.type.includes("mp3")) return "mp3";
  if (file.type.includes("mp4")) return "mp4";
  if (file.type.includes("wav")) return "wav";
  if (file.type.includes("ogg")) return "ogg";
  return "webm";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  await ensureUserProfile(data.user);

  const formData = await request.formData();
  const file = formData.get("audio");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Debe enviar un archivo en el campo audio" }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "El audio está vacío" }, { status: 400 });
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "El audio supera el máximo permitido de 25 MB" }, { status: 413 });
  }

  const baseType = file.type ? file.type.split(";")[0].trim() : "";
  if (baseType && !ALLOWED_AUDIO_TYPES.has(baseType)) {
    return NextResponse.json({ error: `Formato de audio no soportado: ${file.type}` }, { status: 400 });
  }

  const extension = extensionFromFile(file);
  const storagePath = `${data.user.id}/${crypto.randomUUID()}.${extension}`;
  const audioBytes = await file.arrayBuffer();
  const contentType = baseType || "audio/webm";
  const admin = getSupabaseAdminClient();

  const upload = await admin.storage.from("answer-audios").upload(storagePath, audioBytes, {
    contentType,
    upsert: false,
  });

  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 500 });
  }

  let transcription;
  try {
    transcription = await transcribeAudio(new File([audioBytes], `answer.${extension}`, { type: contentType }));
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("Audio transcription failed", error);
    return NextResponse.json({ error: `Falló la transcripción con OpenAI: ${reason}` }, { status: 502 });
  }

  return NextResponse.json({
    audioPath: storagePath,
    transcription: transcription.text,
    editable: true,
    note: "La estudiante debe revisar y corregir esta transcripción antes de evaluarla.",
  });
}
