import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/ai/transcribe-audio";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("audio");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Debe enviar un archivo en el campo audio" }, { status: 400 });
  }

  const extension = file.name.split(".").pop() ?? "webm";
  const storagePath = `${data.user.id}/${crypto.randomUUID()}.${extension}`;

  const upload = await supabase.storage.from("answer-audios").upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 500 });
  }

  const transcription = await transcribeAudio(file);

  return NextResponse.json({
    audioPath: storagePath,
    transcription: transcription.text,
    editable: true,
    note: "La estudiante debe revisar y corregir esta transcripción antes de evaluarla.",
  });
}
