import mammoth from "mammoth";
import { getPrisma } from "../../src/lib/db/prisma";
import { SOURCE_MANIFEST, resolveSourcePath } from "./source-manifest";

const EXCLUDED_PROFESSOR_PATTERNS = [/ascencio/iu];

function isExcludedProfessor(name: string | null) {
  return Boolean(name && EXCLUDED_PROFESSOR_PATTERNS.some((pattern) => pattern.test(name)));
}

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
  const professorNames = new Set<string>();
  const rawQuestions: Array<{
    sourceDocumentId: string;
    areaName: string | null;
    professorName: string | null;
    statement: string;
    rawAnswer: string | null;
    orderIndex: number;
    metadata: { parser: string };
  }> = [];

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];

    if (looksLikeArea(paragraph)) {
      currentArea = paragraph.replace(/\.$/, "");
      continue;
    }

    const professor = parseProfessorHeading(paragraph);
    if (professor) {
      currentProfessor = professor;
      if (!isExcludedProfessor(professor)) {
        professorNames.add(professor);
      }
      continue;
    }

    if (!isQuestionLike(paragraph)) continue;
    if (isExcludedProfessor(currentProfessor)) continue;

    const possibleAnswer = paragraphs[index + 1] && !isQuestionLike(paragraphs[index + 1])
      ? paragraphs[index + 1]
      : null;

    rawQuestions.push({
      sourceDocumentId: sourceDocument.id,
      areaName: currentArea,
      professorName: currentProfessor,
      statement: paragraph,
      rawAnswer: possibleAnswer,
      orderIndex: index,
      metadata: { parser: "heuristic-v1" },
    });
  }

  if (professorNames.size > 0) {
    await db.professor.createMany({
      data: Array.from(professorNames).map((name) => ({ name })),
      skipDuplicates: true,
    });
  }

  const batchSize = 200;
  for (let start = 0; start < rawQuestions.length; start += batchSize) {
    await db.rawQuestion.createMany({
      data: rawQuestions.slice(start, start + batchSize),
    });
  }

  console.log(`Importadas ${rawQuestions.length} preguntas candidatas desde ${source.title}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
