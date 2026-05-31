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
    throw new Error(`Valor num?rico inv?lido: ${String(value)}`);
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
          throw new Error(`Fila ${index + 2}: columna ${header} est? vac?a`);
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

  const professorNames = Array.from(new Set(rows.map((row) => row.professor)));
  const areaNames = Array.from(new Set(rows.map((row) => row.area)));

  await db.professor.createMany({
    data: professorNames.map((name) => ({ name })),
    skipDuplicates: true,
  });

  await db.lawArea.createMany({
    data: areaNames.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const [professors, areas] = await Promise.all([
    db.professor.findMany({ where: { name: { in: professorNames } } }),
    db.lawArea.findMany({ where: { name: { in: areaNames } } }),
  ]);

  const professorByName = new Map(professors.map((professor) => [professor.name, professor]));
  const areaByName = new Map(areas.map((area) => [area.name, area]));

  const priorityRows = rows.map((row) => {
    const professor = professorByName.get(row.professor);
    const area = areaByName.get(row.area);

    if (!professor) throw new Error(`Profesor no encontrado: ${row.professor}`);
    if (!area) throw new Error(`Area no encontrada: ${row.area}`);

    return {
      professor_id: professor.id,
      area_id: area.id,
      subarea: row.subarea,
      frequency: row.frecuencia,
      professor_percentage: row.professorPercentage,
      syllabus_alignment: row.alineacionTemario,
      relevance: row.relevancia,
      priority_score: row.scorePrioridad,
    };
  });

  await db.$executeRaw`
    with payload as (
      select *
      from jsonb_to_recordset(${JSON.stringify(priorityRows)}::jsonb) as item(
        professor_id uuid,
        area_id uuid,
        subarea text,
        frequency integer,
        professor_percentage numeric,
        syllabus_alignment text,
        relevance text,
        priority_score numeric
      )
    )
    insert into professor_topic_priorities (
      professor_id,
      area_id,
      subarea,
      frecuencia,
      professor_percentage,
      syllabus_alignment,
      relevance,
      priority_score
    )
    select
      professor_id,
      area_id,
      subarea,
      frequency,
      professor_percentage,
      syllabus_alignment,
      relevance,
      priority_score
    from payload
    on conflict (professor_id, area_id, subarea) do update set
      frecuencia = excluded.frecuencia,
      professor_percentage = excluded.professor_percentage,
      syllabus_alignment = excluded.syllabus_alignment,
      relevance = excluded.relevance,
      priority_score = excluded.priority_score
  `;

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
