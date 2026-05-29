import mammoth from "mammoth";
import { getPrisma } from "../../src/lib/db/prisma";
import { SOURCE_MANIFEST, resolveSourcePath } from "./source-manifest";

function looksLikeArea(text: string) {
  return /^Derecho\s+.+\.?$/u.test(text) && text.length < 90;
}

function parseProfessorHeading(text: string) {
  const match = text.match(/^(\d+)\s+(.+?)\.?$/u);
  if (!match) return null;

  const possibleName = match[2].trim();
  if (possibleName.length < 3 || possibleName.length > 60) return null;
  if (possibleName.includes("?")) return null;

  return possibleName;
}

function isQuestionLike(text: string) {
  return text.includes("?") || text.startsWith("¿") || text.toLowerCase().startsWith("caso.");
}

async function main() {
  const source = SOURCE_MANIFEST.find((item) => item.kind === "questionnaire");

  if (!source) {
    throw new Error("No se encontro fuente de tipo questionnaire en el manifiesto");
  }

  const filePath = resolveSourcePath(source);
  const result = await mammoth.extractRawText({ path: filePath });
  const paragraphs = result.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const db = getPrisma();
  const sourceDocument = await db.sourceDocument.upsert({
    where: { filePath: source.relativePath },
    create: {
      title: source.title,
      filePath: source.relativePath,
      documentType: "docx",
      metadata: { key: source.key, kind: source.kind, importedBy: "scripts/ingest/docx-questionnaire.ts" },
      processedAt: new Date(),
    },
    update: {
      processedAt: new Date(),
      metadata: { key: source.key, kind: source.kind, importedBy: "scripts/ingest/docx-questionnaire.ts" },
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

  console.log(`Importadas ${imported} preguntas candidatas desde ${source.title}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
