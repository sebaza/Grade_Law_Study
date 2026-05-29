import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { getPrisma } from "../../src/lib/db/prisma";

const PROJECT_ROOT = process.cwd();
const EXCEL_PATH = path.join(PROJECT_ROOT, "Excel_Con preguntas", "frequency_relevance_matrix.xlsx");

type PriorityRow = {
  professor: string;
  area: string;
  subarea: string;
  frecuencia: number;
  "% profesor": string | number;
  alineacion_temario: string;
  relevancia: string;
  score_prioridad: number;
};

function asNumber(value: string | number) {
  if (typeof value === "number") return value;
  return Number(value.replace(",", "."));
}

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`No existe el Excel esperado: ${EXCEL_PATH}`);
  }

  const db = getPrisma();
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets["frequency_relevance_matrix"];

  if (!sheet) {
    throw new Error("No existe la hoja frequency_relevance_matrix");
  }

  const rows = XLSX.utils.sheet_to_json<PriorityRow>(sheet, { defval: "" });

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
        frequency: Number(row.frecuencia),
        professorPercentage: asNumber(row["% profesor"]),
        syllabusAlignment: row.alineacion_temario,
        relevance: row.relevancia,
        priorityScore: Number(row.score_prioridad),
      },
      update: {
        frequency: Number(row.frecuencia),
        professorPercentage: asNumber(row["% profesor"]),
        syllabusAlignment: row.alineacion_temario,
        relevance: row.relevancia,
        priorityScore: Number(row.score_prioridad),
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
