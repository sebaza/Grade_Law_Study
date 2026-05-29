import fs from "node:fs";
import path from "node:path";
import { readSheet, type CellValue } from "read-excel-file/node";
import { getPrisma } from "../../src/lib/db/prisma";

const PROJECT_ROOT = process.cwd();
const EXCEL_PATH = path.join(PROJECT_ROOT, "Excel_Con preguntas", "frequency_relevance_matrix.xlsx");

type PriorityRow = {
  professor: string;
  area: string;
  subarea: string;
  frecuencia: number;
  professorPercentage: number;
  alineacionTemario: string;
  relevancia: string;
  scorePrioridad: number;
};

const REQUIRED_HEADERS = [
  "professor",
  "area",
  "subarea",
  "frecuencia",
  "% profesor",
  "alineacion_temario",
  "relevancia",
  "score_prioridad",
] as const;

function valueAsString(value: CellValue | null) {
  return String(value ?? "").trim();
}

function valueAsNumber(value: CellValue | null) {
  if (typeof value === "number") return value;
  const parsed = Number(valueAsString(value).replace(",", "."));
  if (Number.isNaN(parsed)) {
    throw new Error(`Valor numerico invalido: ${String(value)}`);
  }
  return parsed;
}

async function readRows() {
  const rows = await readSheet(EXCEL_PATH, "frequency_relevance_matrix");
  const [headerRow, ...dataRows] = rows;

  if (!headerRow) {
    throw new Error("El Excel no tiene encabezados");
  }

  const headerIndexes = new Map<string, number>();
  headerRow.forEach((header, index) => headerIndexes.set(valueAsString(header), index));

  for (const header of REQUIRED_HEADERS) {
    if (!headerIndexes.has(header)) {
      throw new Error(`No existe la columna requerida: ${header}`);
    }
  }

  return dataRows
    .filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ""))
    .map((row, index): PriorityRow => {
      const get = (header: (typeof REQUIRED_HEADERS)[number]) => {
        const columnIndex = headerIndexes.get(header);
        if (columnIndex === undefined) throw new Error(`No existe la columna requerida: ${header}`);
        const value = row[columnIndex];
        if (value === null || value === undefined || value === "") {
          throw new Error(`Fila ${index + 2}: columna ${header} esta vacia`);
        }
        return value;
      };

      return {
        professor: valueAsString(get("professor")),
        area: valueAsString(get("area")),
        subarea: valueAsString(get("subarea")),
        frecuencia: valueAsNumber(get("frecuencia")),
        professorPercentage: valueAsNumber(get("% profesor")),
        alineacionTemario: valueAsString(get("alineacion_temario")),
        relevancia: valueAsString(get("relevancia")),
        scorePrioridad: valueAsNumber(get("score_prioridad")),
      };
    });
}

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`No existe el Excel esperado: ${EXCEL_PATH}`);
  }

  const db = getPrisma();
  const rows = await readRows();

  for (const row of rows) {
    const professor = await db.professor.upsert({
      where: { name: row.professor },
      create: { name: row.professor },
      update: {},
    });

    const area = await db.lawArea.upsert({
      where: { name: row.area },
      create: { name: row.area },
      update: {},
    });

    await db.professorTopicPriority.upsert({
      where: {
        professorId_areaId_subarea: {
          professorId: professor.id,
          areaId: area.id,
          subarea: row.subarea,
        },
      },
      create: {
        professorId: professor.id,
        areaId: area.id,
        subarea: row.subarea,
        frequency: row.frecuencia,
        professorPercentage: row.professorPercentage,
        syllabusAlignment: row.alineacionTemario,
        relevance: row.relevancia,
        priorityScore: row.scorePrioridad,
      },
      update: {
        frequency: row.frecuencia,
        professorPercentage: row.professorPercentage,
        syllabusAlignment: row.alineacionTemario,
        relevance: row.relevancia,
        priorityScore: row.scorePrioridad,
      },
    });
  }

  console.log(`Importadas ${rows.length} prioridades desde el Excel.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
