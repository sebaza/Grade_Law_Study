import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { readSheet } from "read-excel-file/node";
import { SOURCE_MANIFEST, resolveSourcePath } from "./source-manifest";

type PriorityRow = {
  professor: string;
  area: string;
  subarea: string;
  frequency: number;
  professorPercentage: number;
  syllabusAlignment: string;
  relevance: string;
  priorityScore: number;
};

type QuestionCandidate = {
  areaName: string | null;
  professorName: string | null;
  statement: string;
  rawAnswer: string | null;
  orderIndex: number;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Number(normalizeText(value).replace(",", "."));
  if (Number.isNaN(parsed)) throw new Error(`Valor numerico invalido: ${String(value)}`);
  return parsed;
}

function looksLikeArea(text: string) {
  return /^Derecho\s+[A-ZÃÃ‰ÃÃ“ÃšÃ‘a-zÃ¡Ã©Ã­Ã³ÃºÃ± ]+\.?$/.test(text);
}

function parseProfessorHeading(text: string) {
  const match = text.match(/^(\d+)\s+([A-ZÃÃ‰ÃÃ“ÃšÃ‘][A-Za-zÃÃ‰ÃÃ“ÃšÃ‘Ã¡Ã©Ã­Ã³ÃºÃ± ]{2,60})\.?$/);
  return match?.[2]?.trim() ?? null;
}

function isQuestionLike(text: string) {
  return text.includes("?") || text.startsWith("Â¿") || text.toLowerCase().startsWith("caso.");
}

async function analyzeExcel(filePath: string) {
  const rows = await readSheet(filePath, "frequency_relevance_matrix");
  const [headers, ...dataRows] = rows;
  if (!headers) throw new Error("Excel sin encabezados");

  const headerIndexes = new Map<string, number>();
  headers.forEach((header, index) => headerIndexes.set(normalizeText(header), index));

  const get = (row: unknown[], header: string) => {
    const index = headerIndexes.get(header);
    if (index === undefined) throw new Error(`No existe columna ${header}`);
    return row[index];
  };

  const priorities: PriorityRow[] = dataRows
    .filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ""))
    .map((row) => ({
      professor: normalizeText(get(row, "professor")),
      area: normalizeText(get(row, "area")),
      subarea: normalizeText(get(row, "subarea")),
      frequency: normalizeNumber(get(row, "frecuencia")),
      professorPercentage: normalizeNumber(get(row, "% profesor")),
      syllabusAlignment: normalizeText(get(row, "alineacion_temario")),
      relevance: normalizeText(get(row, "relevancia")),
      priorityScore: normalizeNumber(get(row, "score_prioridad")),
    }));

  const byProfessor = new Map<string, { rows: number; frequency: number; priorityScore: number }>();
  const byArea = new Map<string, { rows: number; frequency: number; priorityScore: number }>();

  for (const row of priorities) {
    const professor = byProfessor.get(row.professor) ?? { rows: 0, frequency: 0, priorityScore: 0 };
    professor.rows += 1;
    professor.frequency += row.frequency;
    professor.priorityScore += row.priorityScore;
    byProfessor.set(row.professor, professor);

    const area = byArea.get(row.area) ?? { rows: 0, frequency: 0, priorityScore: 0 };
    area.rows += 1;
    area.frequency += row.frequency;
    area.priorityScore += row.priorityScore;
    byArea.set(row.area, area);
  }

  return {
    rowCount: priorities.length,
    byProfessor: Object.fromEntries(byProfessor),
    byArea: Object.fromEntries(byArea),
    topPriorities: priorities
      .slice().sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 10),
  };
}

async function analyzeDocx(filePath: string) {
  const extracted = await mammoth.extractRawText({ path: filePath });
  const paragraphs = extracted.value
    .split(/\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  let currentArea: string | null = null;
  let currentProfessor: string | null = null;
  const candidates: QuestionCandidate[] = [];
  const byProfessor = new Map<string, number>();
  const byArea = new Map<string, number>();

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];

    if (looksLikeArea(paragraph)) {
      currentArea = paragraph.replace(/\.$/, "");
      continue;
    }

    const professor = parseProfessorHeading(paragraph);
    if (professor) {
      currentProfessor = professor;
      continue;
    }

    if (!isQuestionLike(paragraph)) continue;

    const rawAnswer = paragraphs[index + 1] && !isQuestionLike(paragraphs[index + 1])
      ? paragraphs[index + 1]
      : null;

    candidates.push({
      areaName: currentArea,
      professorName: currentProfessor,
      statement: paragraph,
      rawAnswer,
      orderIndex: index,
    });

    if (currentProfessor) byProfessor.set(currentProfessor, (byProfessor.get(currentProfessor) ?? 0) + 1);
    if (currentArea) byArea.set(currentArea, (byArea.get(currentArea) ?? 0) + 1);
  }

  return {
    paragraphCount: paragraphs.length,
    questionCandidateCount: candidates.length,
    byProfessor: Object.fromEntries([...byProfessor.entries()].sort((a, b) => b[1] - a[1])),
    byArea: Object.fromEntries([...byArea.entries()].sort((a, b) => b[1] - a[1])),
    samples: candidates.slice(0, 20),
  };
}

async function analyzePdf(filePath: string) {
  const { PDFParse } = await import("pdf-parse");
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buffer });

  try {
    const parsed = await parser.getText();
    const text = parsed.text.replace(/\s+/g, " ").trim();

    return {
      pageCount: parsed.total,
      characterCount: text.length,
      preview: text.slice(0, 900),
    };
  } finally {
    await parser.destroy();
  }
}

async function main() {
  const outputDir = path.join(process.cwd(), "data", "processed");
  await fs.mkdir(outputDir, { recursive: true });

  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    sources: {},
  };

  for (const source of SOURCE_MANIFEST) {
    const filePath = resolveSourcePath(source);
    const exists = await fs.access(filePath).then(() => true).catch(() => false);

    if (!exists) {
      (report.sources as Record<string, unknown>)[source.key] = {
        ...source,
        exists: false,
      };
      continue;
    }

    let analysis: unknown;
    if (source.kind === "priority_matrix") analysis = await analyzeExcel(filePath);
    else if (source.kind === "questionnaire") analysis = await analyzeDocx(filePath);
    else if (source.type === "pdf") analysis = await analyzePdf(filePath);
    else analysis = { skipped: true };

    const stats = await fs.stat(filePath);
    (report.sources as Record<string, unknown>)[source.key] = {
      ...source,
      exists: true,
      fileSizeBytes: stats.size,
      analysis,
    };
  }

  const outputPath = path.join(outputDir, "phase2-source-analysis.json");
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Analisis generado en ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

