import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readSheet } from "read-excel-file/node";
import { getPrisma } from "../../src/lib/db/prisma";

type Difficulty = "low" | "medium" | "high";
type QuestionType = "definition" | "case" | "comparison" | "application" | "general";

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

type PossibleQuestion = {
  sourceReference: string;
  statement: string;
  areaName: string;
  subjectName: string;
  subsubjectName: string;
  professorName: string;
  difficulty: Difficulty;
  estimatedProbability: number;
  priorityScore: number;
  questionType: QuestionType;
  origin: "generated";
  expectedAnswer: string;
  rubricNotes: string;
  keyPoints: Array<{ label: string; description: string; weight: number; isRequired: boolean; orderIndex: number }>;
  commonErrors: Array<{ description: string; severity: "low" | "medium" | "high" }>;
  metadata: Record<string, unknown>;
};

type PossibleQuestionBank = {
  generatedAt: string;
  generationMethod: "syllabus-professor-priority-v1";
  targetQuestionCount: number;
  questionCount: number;
  sourceSummary: {
    priorityRows: number;
    syllabusTopicsByArea: Record<string, number>;
    selectedByProfessor: Record<string, number>;
    selectedByArea: Record<string, number>;
  };
  questions: PossibleQuestion[];
};

type UpsertedQuestion = {
  id: string;
  source_reference: string;
};

const execFileAsync = promisify(execFile);

const TARGET_QUESTION_COUNT = Number(process.env.POSSIBLE_QUESTION_TARGET_COUNT ?? 99);
const PRIORITY_PROFESSORS = ["Felipe Ortiz", "Stephanie Merlet", "Mauricio Figueroa"];
const OUTPUT_PATH = path.join(process.cwd(), "data", "processed", "syllabus-possible-questions.seed.json");
const PRIORITY_MATRIX_PATH = path.join(process.cwd(), "Excel_Con preguntas", "frequency_relevance_matrix.xlsx");
const PDF_PARSE_CLI = path.join(process.cwd(), "node_modules", "pdf-parse", "bin", "cli.mjs");

const AREA_FILE_HINTS: Record<string, string[]> = {
  "Derecho Procesal": ["Procesal"],
  "Derecho Constitucional": ["CONSTITUCIONAL", "Constitucional"],
  "Derecho Civil": ["Civil"],
};

const CURATED_FALLBACK_TOPICS: Record<string, string[]> = {
  "Felipe Ortiz::Procesal: instituciones generales": [
    "la función jurisdiccional y sus límites",
    "la competencia civil y sus reglas de atribución",
    "la relación entre proceso y procedimiento",
    "los principios comunes a todo proceso",
    "los equivalentes jurisdiccionales y la autocomposición",
  ],
  "Mauricio Figueroa::Constitucional: instituciones generales": [
    "las bases de la institucionalidad",
    "los valores constitucionales de dignidad, libertad e igualdad",
    "la supremacía constitucional y la juridicidad",
    "los órganos constitucionales de control",
    "la teoría general de los derechos fundamentales",
  ],
  "Stephanie Merlet::Civil: instituciones generales": [
    "la teoría del acto jurídico",
    "los requisitos de existencia y validez del acto jurídico",
    "las obligaciones y sus efectos",
    "la teoría general del contrato",
    "la prescripción como institución civil",
  ],
};

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Number(normalizeText(value).replace(",", "."));
  if (Number.isNaN(parsed)) throw new Error(`Valor numérico inválido: ${String(value)}`);
  return parsed;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function tokenize(value: string) {
  const stopWords = new Set([
    "derecho",
    "derechos",
    "general",
    "generales",
    "teoria",
    "concepto",
    "conceptos",
    "principio",
    "principios",
    "instituciones",
    "reglas",
    "efectos",
    "requisitos",
    "procedimiento",
    "procesal",
    "constitucional",
    "civil",
    "chile",
    "chileno",
    "chilena",
    "clasificacion",
    "caracteristicas",
  ]);

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 3 && !stopWords.has(token));
}

function subjectFromSubarea(subarea: string) {
  const beforeColon = subarea.split(":")[0]?.trim();
  if (beforeColon && beforeColon.length >= 4) return beforeColon;
  return subarea.split(",")[0]?.trim() || subarea;
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

async function readPriorities() {
  const rows = await readSheet(PRIORITY_MATRIX_PATH, "frequency_relevance_matrix");
  const [headers, ...dataRows] = rows;
  if (!headers) throw new Error("Excel sin encabezados");

  const headerIndexes = new Map<string, number>();
  headers.forEach((header, index) => headerIndexes.set(normalizeText(header), index));

  const get = (row: unknown[], header: string) => {
    const index = headerIndexes.get(header);
    if (index === undefined) throw new Error(`No existe columna ${header}`);
    return row[index];
  };

  return dataRows
    .filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ""))
    .map((row): PriorityRow => ({
      professor: normalizeText(get(row, "professor")),
      area: normalizeText(get(row, "area")),
      subarea: normalizeText(get(row, "subarea")),
      frequency: normalizeNumber(get(row, "frecuencia")),
      professorPercentage: normalizeNumber(get(row, "% profesor")),
      syllabusAlignment: normalizeText(get(row, "alineacion_temario")),
      relevance: normalizeText(get(row, "relevancia")),
      priorityScore: normalizeNumber(get(row, "score_prioridad")),
    }))
    .filter((row) => PRIORITY_PROFESSORS.includes(row.professor));
}

function cleanTopicLine(line: string) {
  return normalizeText(line)
    .replace(/^[-–—]+\s*/, "")
    .replace(/^(§\s*)?[IVXLCDM]+\.\s*/iu, "")
    .replace(/^\d+(\.\d+|\))?\.?\s*/u, "")
    .replace(/^[a-z]\.\s*/iu, "")
    .replace(/^[ivxlcdm]+\)\s*/iu, "")
    .replace(/^[A-Z]\)\s*/u, "")
    .replace(/[.:]$/, "")
    .trim();
}

function isBadTopic(topic: string) {
  const lower = topic.toLowerCase();
  const words = topic.split(/\s+/u).filter(Boolean);
  const meaningfulTokens = tokenize(topic);

  return (
    topic.length < 12 ||
    words.length < 2 ||
    meaningfulTokens.length === 0 ||
    /\bno se\b/iu.test(lower) ||
    (topic.match(/\(/gu)?.length ?? 0) !== (topic.match(/\)/gu)?.length ?? 0) ||
    /\b(de|del|la|las|el|los|y|o|con|para)$/iu.test(lower) ||
    /^[A-ZÁÉÍÓÚÑ\s]+$/u.test(topic)
  );
}

function splitCompositeTopic(line: string) {
  const parts = line
    .split(/;|\.\s+(?=[A-ZÁÉÍÓÚÑ])|,\s+(?=(?:concepto|clasificación|requisitos|efectos|principios|acciones|recursos|control|aplicación)\b)/iu)
    .map((part) => cleanTopicLine(part))
    .filter((part) => part.length <= 180 && !isBadTopic(part));

  return parts.length > 0 ? parts : [cleanTopicLine(line)].filter((part) => part.length <= 180 && !isBadTopic(part));
}

async function findSyllabusPdf(area: string) {
  const files = await fs.readdir(path.join(process.cwd(), "Temario"));
  const hints = AREA_FILE_HINTS[area] ?? [area.replace("Derecho ", "")];
  const file = files.find((candidate) => candidate.toLowerCase().endsWith(".pdf") && hints.some((hint) => candidate.includes(hint)));
  if (!file) throw new Error(`No encontré PDF de temario para ${area}`);
  return path.join(process.cwd(), "Temario", file);
}

async function extractPdfText(pdfPath: string) {
  const tmpDir = path.join(process.cwd(), "tmp", "pdfs");
  await fs.mkdir(tmpDir, { recursive: true });
  const outputPath = path.join(tmpDir, `${path.basename(pdfPath, ".pdf")}.txt`);
  await execFileAsync("node", [PDF_PARSE_CLI, "text", pdfPath, "--output", outputPath], { windowsHide: true });
  return fs.readFile(outputPath, "utf8");
}

function extractTopics(text: string) {
  const skipped = [
    /^-- \d+ of \d+ --$/u,
    /^TEMARIO DE/u,
    /^CEDULARIO/u,
    /^Nuevo Modelo/u,
    /^Nuevo modelo/u,
    /^Examen de Grado/u,
    /^UNIVERSIDAD/u,
    /^FACULTAD/u,
    /^\d{1,2} DE /u,
  ];

  const topics: string[] = [];
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = normalizeText(rawLine);
    if (!line) continue;
    if (skipped.some((pattern) => pattern.test(line))) continue;
    if (line.length < 8) continue;

    const cleaned = cleanTopicLine(line);
    if (!cleaned || cleaned.length < 8) continue;
    if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X)$/u.test(cleaned)) continue;

    topics.push(...splitCompositeTopic(cleaned));
  }

  return Array.from(new Set(topics));
}

async function readSyllabusTopicsByArea(priorities: PriorityRow[]) {
  const areas = Array.from(new Set(priorities.map((row) => row.area)));
  const result: Record<string, string[]> = {};

  for (const area of areas) {
    const pdfPath = await findSyllabusPdf(area);
    const text = await extractPdfText(pdfPath);
    result[area] = extractTopics(text);
  }

  return result;
}

function allocateInteger(total: number, weights: Array<{ key: string; weight: number }>) {
  const weightSum = weights.reduce((sum, item) => sum + item.weight, 0);
  const rows = weights.map((item) => {
    const exact = weightSum === 0 ? total / weights.length : (item.weight / weightSum) * total;
    return { ...item, exact, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });

  let assigned = rows.reduce((sum, item) => sum + item.count, 0);
  for (const row of rows.slice().sort((a, b) => b.remainder - a.remainder || b.weight - a.weight)) {
    if (assigned >= total) break;
    row.count += 1;
    assigned += 1;
  }

  return new Map(rows.map((row) => [row.key, row.count]));
}

function professorQuotas(priorities: PriorityRow[]) {
  const professorWeights = PRIORITY_PROFESSORS.map((professor) => ({
    key: professor,
    weight: priorities.filter((row) => row.professor === professor).reduce((sum, row) => sum + row.priorityScore, 0),
  }));

  return allocateInteger(TARGET_QUESTION_COUNT, professorWeights);
}

function priorityQuotas(priorities: PriorityRow[]) {
  const professorQuota = professorQuotas(priorities);
  const quotas = new Map<string, number>();

  for (const professor of PRIORITY_PROFESSORS) {
    const professorRows = priorities.filter((row) => row.professor === professor);
    const allocated = allocateInteger(
      professorQuota.get(professor) ?? 0,
      professorRows.map((row, index) => ({ key: String(index), weight: row.priorityScore })),
    );

    professorRows.forEach((row, index) => {
      quotas.set(priorityKey(row), allocated.get(String(index)) ?? 0);
    });
  }

  return quotas;
}

function priorityKey(row: PriorityRow) {
  return `${row.professor}::${row.area}::${row.subarea}`;
}

function probabilityFor(row: PriorityRow, priorities: PriorityRow[]) {
  const professorTotal = priorities
    .filter((priority) => priority.professor === row.professor)
    .reduce((sum, priority) => sum + priority.priorityScore, 0);

  if (professorTotal === 0) return 0;
  return Math.round((row.priorityScore / professorTotal) * 10000) / 100;
}

function matchingTopics(row: PriorityRow, areaTopics: string[]) {
  const curatedFallback = CURATED_FALLBACK_TOPICS[`${row.professor}::${row.subarea}`];
  const priorityTokens = new Set(tokenize(row.subarea));
  if (priorityTokens.size === 0) return curatedFallback ?? [row.subarea];

  const scored = areaTopics
    .map((topic) => {
      const topicTokens = tokenize(topic);
      const overlap = topicTokens.filter((token) => priorityTokens.has(token)).length;
      return {
        topic,
        score: overlap * 10,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.topic.length - b.topic.length)
    .map((item) => item.topic);

  return scored.length > 0 ? Array.from(new Set([row.subarea, ...scored])) : curatedFallback ?? [row.subarea];
}

function templateFor(row: PriorityRow, topic: string, variant: number): { statement: string; type: QuestionType } {
  const subarea = row.subarea;

  if (row.professor === "Felipe Ortiz") {
    const templates = [
      { type: "definition" as const, statement: `Explique ${topic} dentro de ${subarea}. ¿Qué conceptos, requisitos y efectos procesales no puede omitir?` },
      { type: "application" as const, statement: `Si en un examen le preguntan por ${topic}, ¿cómo ordenaría la respuesta desde la institución procesal hasta sus consecuencias prácticas?` },
      { type: "comparison" as const, statement: `Distinga ${topic} de las instituciones procesales cercanas y explique por qué esa diferencia importa en juicio.` },
      { type: "case" as const, statement: `Caso. En un proceso se discute un problema relativo a ${topic}. ¿Qué vía, oportunidad procesal y fundamento invocaría?` },
      { type: "general" as const, statement: `¿Cuál es la función de ${topic} en el sistema procesal chileno y cómo se conecta con la tutela judicial efectiva?` },
    ];
    return templates[variant % templates.length];
  }

  if (row.professor === "Stephanie Merlet") {
    const templates = [
      { type: "definition" as const, statement: `Explique ${topic} en Derecho Civil. ¿Cuáles son sus requisitos, efectos y principales clasificaciones?` },
      { type: "application" as const, statement: `¿Cómo resolvería una pregunta oral sobre ${topic}, vinculándola con ${subarea} y sus consecuencias jurídicas?` },
      { type: "comparison" as const, statement: `Distinga ${topic} de figuras civiles próximas y señale qué cambia en cuanto a acción, prueba o efectos.` },
      { type: "case" as const, statement: `Caso. Un cliente consulta por un conflicto asociado a ${topic}. ¿Qué institución civil aplicaría, qué requisitos verificaría y qué acción o defensa sugeriría?` },
      { type: "general" as const, statement: `¿Por qué ${topic} es relevante dentro de ${subarea} y qué errores conceptuales suelen cometerse al explicarlo?` },
    ];
    return templates[variant % templates.length];
  }

  const templates = [
    { type: "definition" as const, statement: `Explique el sentido y alcance constitucional de ${topic}. ¿Qué norma, principio o garantía debe quedar claramente identificado?` },
    { type: "comparison" as const, statement: `Distinga ${topic} de instituciones constitucionales relacionadas y explique la consecuencia de esa diferencia.` },
    { type: "application" as const, statement: `¿Cómo aplicaría ${topic} frente a un conflicto constitucional concreto y qué estándar de control usaría?` },
    { type: "case" as const, statement: `Caso. Una autoridad adopta una decisión que tensiona ${topic}. ¿Qué argumentos constitucionales, acción o control correspondería analizar?` },
    { type: "general" as const, statement: `¿Cómo se relaciona ${topic} con ${subarea} y con la supremacía constitucional?` },
  ];
  return templates[variant % templates.length];
}

function inferDifficulty(row: PriorityRow, type: QuestionType) {
  if (type === "case" || row.priorityScore >= 70) return "high";
  if (row.priorityScore >= 28 || row.relevance === "Alta") return "medium";
  return "low";
}

function buildExpectedAnswer(row: PriorityRow, topic: string, type: QuestionType) {
  const practicalFocus =
    row.area === "Derecho Procesal"
      ? "oportunidad procesal, tribunal competente, carga argumentativa y efectos de la decisión"
      : row.area === "Derecho Civil"
        ? "requisitos, clasificación, efectos patrimoniales, acciones o defensas disponibles"
        : "norma constitucional aplicable, principio comprometido, estándar de control y consecuencia institucional";

  const caseFocus = type === "case" ? " En caso práctico, debe identificar hechos relevantes, problema jurídico, regla aplicable, subsunción y conclusión." : "";

  return [
    `Una respuesta suficiente debe ubicar "${topic}" dentro de "${row.subarea}" del temario de ${row.area}.`,
    `Debe definir la institución con lenguaje técnico, indicar su fundamento normativo o dogmático, explicar sus elementos centrales y desarrollar ${practicalFocus}.`,
    `La respuesta debe cerrar conectando el punto con la forma en que ${row.professor} suele preguntar: orden conceptual, precisión jurídica y aplicación al problema.${caseFocus}`,
  ].join(" ");
}

function buildKeyPoints(row: PriorityRow, topic: string, type: QuestionType) {
  const points = [
    {
      label: "Ubicación temática",
      description: `Ubicar la pregunta en ${row.area}, específicamente en "${row.subarea}", y explicar por qué "${topic}" pertenece a ese bloque del temario.`,
      weight: 1.25,
      isRequired: true,
    },
    {
      label: "Concepto técnico",
      description: `Definir "${topic}" con vocabulario jurídico preciso, evitando una explicación coloquial o puramente memorística.`,
      weight: 1.5,
      isRequired: true,
    },
    {
      label: "Fundamento normativo",
      description: "Mencionar normas, principios o instituciones base que sostienen la respuesta, sin quedarse en una cita aislada.",
      weight: 1.25,
      isRequired: true,
    },
    {
      label: "Elementos y efectos",
      description: "Desarrollar requisitos, presupuestos, clasificación, efectos y consecuencias prácticas según corresponda a la materia.",
      weight: 1,
      isRequired: true,
    },
    {
      label: type === "case" ? "Aplicación al caso" : "Cierre oral",
      description:
        type === "case"
          ? "Aplicar la regla a los hechos del caso, justificar la solución y cerrar con una conclusión jurídicamente defendible."
          : `Cerrar la respuesta con una conexión clara entre "${topic}" y el tipo de pregunta oral que podría formular ${row.professor}.`,
      weight: 1,
      isRequired: type === "case",
    },
  ];

  return points.map((point, orderIndex) => ({ ...point, orderIndex }));
}

function buildCommonErrors(row: PriorityRow, topic: string) {
  return [
    {
      description: `Responder "${topic}" sin conectarlo con el bloque "${row.subarea}" del temario.`,
      severity: "medium" as const,
    },
    {
      description: "Enumerar normas o conceptos sin explicar requisitos, efectos ni consecuencias prácticas.",
      severity: "high" as const,
    },
    {
      description: `No adaptar la respuesta al estilo probable de ${row.professor}: pregunta oral, repregunta y exigencia de precisión.`,
      severity: "medium" as const,
    },
  ];
}

function generateQuestions(priorities: PriorityRow[], syllabusTopicsByArea: Record<string, string[]>) {
  const quotas = priorityQuotas(priorities);
  const questions: PossibleQuestion[] = [];

  for (const row of priorities) {
    const quota = quotas.get(priorityKey(row)) ?? 0;
    const topics = matchingTopics(row, syllabusTopicsByArea[row.area] ?? []);

    for (let index = 0; index < quota; index += 1) {
      const topic = topics[index % topics.length];
      const template = templateFor(row, topic, index);
      const sourceReference = `syllabus-generated-v1:${slugify(row.professor)}:${slugify(row.area)}:${slugify(row.subarea)}:${index + 1}`;

      questions.push({
        sourceReference,
        statement: template.statement,
        areaName: row.area,
        subjectName: subjectFromSubarea(row.subarea),
        subsubjectName: row.subarea,
        professorName: row.professor,
        difficulty: inferDifficulty(row, template.type),
        estimatedProbability: probabilityFor(row, priorities),
        priorityScore: row.priorityScore,
        questionType: template.type,
        origin: "generated",
        expectedAnswer: buildExpectedAnswer(row, topic, template.type),
        rubricNotes:
          "Pregunta posible generada desde temario oficial, matriz de frecuencia/relevancia y estilo de preguntas reales por profesor. Validar manualmente si se quiere transformar en pauta doctrinal definitiva.",
        keyPoints: buildKeyPoints(row, topic, template.type),
        commonErrors: buildCommonErrors(row, topic),
        metadata: {
          generationMethod: "syllabus-professor-priority-v1",
          syllabusTopic: topic,
          prioritySubarea: row.subarea,
          professorPercentage: row.professorPercentage,
          frequency: row.frequency,
          relevance: row.relevance,
          syllabusAlignment: row.syllabusAlignment,
        },
      });
    }
  }

  return questions
    .sort((a, b) => {
      const professorOrder = PRIORITY_PROFESSORS.indexOf(a.professorName) - PRIORITY_PROFESSORS.indexOf(b.professorName);
      return professorOrder || b.priorityScore - a.priorityScore || b.estimatedProbability - a.estimatedProbability;
    })
    .slice(0, TARGET_QUESTION_COUNT);
}

async function writeQuestionBank(bank: PossibleQuestionBank) {
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(bank, null, 2), "utf8");
}

async function seedQuestionBank(bank: PossibleQuestionBank) {
  const db = getPrisma();
  const areaNames = Array.from(new Set(bank.questions.map((item) => item.areaName)));
  const professorNames = Array.from(new Set(bank.questions.map((item) => item.professorName)));

  await db.lawArea.createMany({
    data: areaNames.map((name) => ({ name })),
    skipDuplicates: true,
  });

  await db.professor.createMany({
    data: professorNames.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const [areas, professors] = await Promise.all([
    db.lawArea.findMany({ where: { name: { in: areaNames } } }),
    db.professor.findMany({ where: { name: { in: professorNames } } }),
  ]);

  const areaByName = new Map(areas.map((area) => [area.name, area]));
  const professorByName = new Map(professors.map((professor) => [professor.name, professor]));

  await db.subject.createMany({
    data: Array.from(
      new Map(
        bank.questions.map((item) => {
          const area = areaByName.get(item.areaName);
          if (!area) throw new Error(`Área no encontrada: ${item.areaName}`);
          return [`${area.id}::${item.subjectName}`, { areaId: area.id, name: item.subjectName }];
        }),
      ).values(),
    ),
    skipDuplicates: true,
  });

  const subjects = await db.subject.findMany({ where: { areaId: { in: areas.map((area) => area.id) } } });
  const subjectByAreaAndName = new Map(subjects.map((subject) => [`${subject.areaId}::${subject.name}`, subject]));

  await db.subsubject.createMany({
    data: Array.from(
      new Map(
        bank.questions.map((item) => {
          const area = areaByName.get(item.areaName);
          if (!area) throw new Error(`Área no encontrada: ${item.areaName}`);
          const subject = subjectByAreaAndName.get(`${area.id}::${item.subjectName}`);
          if (!subject) throw new Error(`Materia no encontrada: ${item.areaName} / ${item.subjectName}`);
          return [`${subject.id}::${item.subsubjectName}`, { subjectId: subject.id, name: item.subsubjectName }];
        }),
      ).values(),
    ),
    skipDuplicates: true,
  });

  const subsubjects = await db.subsubject.findMany({
    where: { subjectId: { in: subjects.map((subject) => subject.id) } },
  });
  const subsubjectBySubjectAndName = new Map(
    subsubjects.map((subsubject) => [`${subsubject.subjectId}::${subsubject.name}`, subsubject]),
  );

  const questionRows = bank.questions.map((item) => {
    const area = areaByName.get(item.areaName);
    if (!area) throw new Error(`Área no encontrada: ${item.areaName}`);
    const subject = subjectByAreaAndName.get(`${area.id}::${item.subjectName}`);
    if (!subject) throw new Error(`Materia no encontrada: ${item.areaName} / ${item.subjectName}`);
    const subsubject = subsubjectBySubjectAndName.get(`${subject.id}::${item.subsubjectName}`);
    if (!subsubject) throw new Error(`Submateria no encontrada: ${item.subjectName} / ${item.subsubjectName}`);

    return {
      source_reference: item.sourceReference,
      statement: item.statement,
      area_id: area.id,
      subject_id: subject.id,
      subsubject_id: subsubject.id,
      difficulty: item.difficulty,
      estimated_probability: item.estimatedProbability,
      priority_score: item.priorityScore,
      question_type: item.questionType,
      origin: item.origin,
      is_active: true,
    };
  });

  const upsertedQuestions = await db.$queryRaw<UpsertedQuestion[]>`
    with payload as (
      select *
      from jsonb_to_recordset(${JSON.stringify(questionRows)}::jsonb) as item(
        source_reference text,
        statement text,
        area_id uuid,
        subject_id uuid,
        subsubject_id uuid,
        difficulty text,
        estimated_probability numeric,
        priority_score numeric,
        question_type text,
        origin text,
        is_active boolean
      )
    )
    insert into questions (
      source_reference,
      statement,
      area_id,
      subject_id,
      subsubject_id,
      difficulty,
      estimated_probability,
      priority_score,
      question_type,
      origin,
      is_active
    )
    select
      source_reference,
      statement,
      area_id,
      subject_id,
      subsubject_id,
      difficulty::difficulty,
      estimated_probability,
      priority_score,
      question_type,
      origin::question_origin,
      is_active
    from payload
    on conflict (source_reference) do update set
      statement = excluded.statement,
      area_id = excluded.area_id,
      subject_id = excluded.subject_id,
      subsubject_id = excluded.subsubject_id,
      difficulty = excluded.difficulty,
      estimated_probability = excluded.estimated_probability,
      priority_score = excluded.priority_score,
      question_type = excluded.question_type,
      origin = excluded.origin,
      is_active = excluded.is_active,
      updated_at = now()
    returning id, source_reference
  `;

  const questionByReference = new Map(upsertedQuestions.map((question) => [question.source_reference, question]));
  const questionIds = upsertedQuestions.map((question) => question.id);

  await db.questionProfessor.deleteMany({ where: { questionId: { in: questionIds } } });
  await db.expectedAnswer.deleteMany({ where: { questionId: { in: questionIds } } });
  await db.keyPoint.deleteMany({ where: { questionId: { in: questionIds } } });
  await db.commonError.deleteMany({ where: { questionId: { in: questionIds } } });

  await db.questionProfessor.createMany({
    data: bank.questions.map((item) => {
      const question = questionByReference.get(item.sourceReference);
      const professor = professorByName.get(item.professorName);
      if (!question) throw new Error(`Pregunta no encontrada: ${item.sourceReference}`);
      if (!professor) throw new Error(`Profesor no encontrado: ${item.professorName}`);
      return { questionId: question.id, professorId: professor.id };
    }),
    skipDuplicates: true,
  });

  await db.expectedAnswer.createMany({
    data: bank.questions.map((item) => {
      const question = questionByReference.get(item.sourceReference);
      if (!question) throw new Error(`Pregunta no encontrada: ${item.sourceReference}`);
      return {
        questionId: question.id,
        modelAnswer: item.expectedAnswer,
        rubricNotes: item.rubricNotes,
        version: 1,
        isActive: true,
      };
    }),
  });

  await db.keyPoint.createMany({
    data: bank.questions.flatMap((item) => {
      const question = questionByReference.get(item.sourceReference);
      if (!question) throw new Error(`Pregunta no encontrada: ${item.sourceReference}`);
      return item.keyPoints.map((point) => ({
        questionId: question.id,
        label: point.label,
        description: point.description,
        weight: point.weight,
        isRequired: point.isRequired,
        orderIndex: point.orderIndex,
      }));
    }),
  });

  await db.commonError.createMany({
    data: bank.questions.flatMap((item) => {
      const question = questionByReference.get(item.sourceReference);
      if (!question) throw new Error(`Pregunta no encontrada: ${item.sourceReference}`);
      return item.commonErrors.map((error) => ({
        questionId: question.id,
        description: error.description,
        severity: error.severity,
      }));
    }),
  });

  return upsertedQuestions.length;
}

async function main() {
  const shouldSeed = process.argv.includes("--seed");
  const priorities = await readPriorities();
  const syllabusTopicsByArea = await readSyllabusTopicsByArea(priorities);
  const questions = generateQuestions(priorities, syllabusTopicsByArea);

  const bank: PossibleQuestionBank = {
    generatedAt: new Date().toISOString(),
    generationMethod: "syllabus-professor-priority-v1",
    targetQuestionCount: TARGET_QUESTION_COUNT,
    questionCount: questions.length,
    sourceSummary: {
      priorityRows: priorities.length,
      syllabusTopicsByArea: Object.fromEntries(
        Object.entries(syllabusTopicsByArea).map(([area, topics]) => [area, topics.length]),
      ),
      selectedByProfessor: countBy(questions, (question) => question.professorName),
      selectedByArea: countBy(questions, (question) => question.areaName),
    },
    questions,
  };

  await writeQuestionBank(bank);
  console.log(`Banco de preguntas posibles generado en ${OUTPUT_PATH}`);
  console.log(`Preguntas generadas: ${bank.questionCount}/${bank.targetQuestionCount}`);
  console.log(`Distribución por profesor: ${JSON.stringify(bank.sourceSummary.selectedByProfessor)}`);

  if (shouldSeed) {
    const imported = await seedQuestionBank(bank);
    console.log(`Importadas ${imported}/${bank.questionCount} preguntas posibles a Supabase/Postgres.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
