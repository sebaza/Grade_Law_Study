import { getOpenAIClient } from "@/lib/ai/openai";

export async function transcribeAudio(file: File) {
  const client = getOpenAIClient();

  return client.audio.transcriptions.create({
    file,
    model: process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe",
    language: "es",
  });
}
