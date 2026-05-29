import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { getPrisma } from "../../src/lib/db/prisma";

const PROJECT_ROOT = process.cwd();
const QUESTIONS_DIR = path.join(PROJECT_ROOT, "Preguntas");

function looksLikeArea(text: string) {
  return /^Derecho\s+[A-ZÁÉÍÓÚÑa-záéíóúñ ]+\.?$/.test(text);
}

function parseProfessorHeading(text: string) {
  const match = text.match(/^(\d+)\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ ]{2,60})\.?$/);
  return match?.[2]?.trim() ?? null;
}

function isQuestionLike(text: string) {
  return text.includes("?") || text.startsWith("¿") || text.toLowerCase().startsWith("caso.");
}

async function main() {
  const files = await fs.readdir(QUESTIONS_DIR);
  const docxFile = files.find((file) => file.toLowerCase().endsWith(".docx"));

  if (!docxFile) {
    throw new Error(`No se encontró .docx en ${QUESTIONS_DIR}`);
  }

  const filePath = path.join(QUESTIONS_DIR, docxFile);
  const result = await mammoth.extractRawText({ path: filePath });
  const paragraphs = result.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const db = getPrisma();
  const sourceDocument = await db.sourceDocument.upsert({
    where: { filePath },
    create: {
      title: docxFile,
      filePath,
      documentType: "docx",
      metadata: { importedBy: "scripts/ingest/docx-questionnaire.ts" },
      processedAt: new Date(),
    },
    update: {
      processedAt: new Date(),
      metadata: { importedBy: "scripts/ingest/docx-questionnaire.ts" },
    },
  });

  await db.rawQuestion.deleteMany({ where: { sourceDocumentId: sourceDocument.id } });

  let currentArea: string | null = null;
  let currentProfessor: string | null = null;
  let imported = 0;

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];

    if (looksLikeArea(paragraph)) {
      currentArea = paragraph.replace(/\.$/, "");
      continue;
    }

    const professor = parseProfessorHeading(paragraph);
    if (professor) {
      currentProfessor = professor;
      await db.professor.upsert({ where: { name: professor }, create: { name: professor }, update: {} });
      continue;
    }

    if (!isQuestionLike(paragraph)) continue;

    const possibleAnswer = paragraphs[index + 1] && !isQuestionLike(paragraphs[index + 1])
      ? paragraphs[index + 1]
      : null;

    await db.rawQuestion.create({
      data: {
        sourceDocumentId: sourceDocument.id,
        areaName: currentArea,
        professorName: currentProfessor,
        statement: paragraph,
        rawAnswer: possibleAnswer,
        orderIndex: index,
        metadata: { parser: "heuristic-v1" },
      },
    });

    imported += 1;
  }

  console.log(`Importadas ${imported} preguntas candidatas desde ${docxFile}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });


