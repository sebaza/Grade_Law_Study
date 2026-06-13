import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { readSheet } from "read-excel-file/node";
import { SOURCE_MANIFEST, resolveSourcePath } from "../ingest/source-manifest";

export type PriorityRow = {
  professor: string;
  area: string;
  subarea: string;
  frequency: number;
  professorPercentage: number;
  syllabusAlignment: string;
  relevance: string;
  priorityScore: number;
};

export type RawCandidate = {
  areaName: string | null;
  professorName: string | null;
  statement: string;
  rawAnswer: string | null;
  orderIndex: number;
};

const EXCLUDED_PROFESSOR_PATTERNS = [/ascencio/iu];

const PROFESSOR_AREA_OVERRIDES: Record<string, string> = {
  "Mauricio Figueroa": "Derecho Constitucional",
  "Aníbal Chacama": "Derecho Civil",
  "Stephanie Merlet": "Derecho Civil",
  "Constanza Astudillo": "Derecho Civil",
  "Felipe Ortiz": "Derecho Procesal",
  "Fernando Orellana": "Derecho Procesal",
  "Carlos Alarcón": "Derecho Procesal",
};

type TopicRule = {
  subarea: string;
  tokens: string[];
};

const TOPIC_RULES_BY_AREA: Record<string, TopicRule[]> = {
  "Derecho Civil": [
    {
      subarea: "Acto jurídico: existencia, validez, modalidades e ineficacia",
      tokens: ["acto", "juridico", "voluntad", "consentimiento", "nulidad", "inexistencia", "error", "dolo", "fuerza", "objeto", "causa", "simulacion"],
    },
    {
      subarea: "Obligaciones: efectos, pago, incumplimiento y responsabilidad contractual",
      tokens: ["obligacion", "obligaciones", "pago", "incumplimiento", "mora", "deudor", "acreedor", "perjuicios", "indemnizacion", "solidaridad"],
    },
    {
      subarea: "Contratos: teoría general, compraventa, mandato y arrendamiento",
      tokens: ["contrato", "contratos", "compraventa", "mandato", "arrendamiento", "promesa", "mutuo", "comodato", "precio", "consensual"],
    },
    {
      subarea: "Bienes y derechos reales: dominio, posesión, tradición y prescripción adquisitiva",
      tokens: ["bien", "bienes", "dominio", "posesion", "tradicion", "prescripcion", "adquisitiva", "usufructo", "propiedad", "modo", "titulo"],
    },
    {
      subarea: "Responsabilidad civil: contractual, extracontractual, daño y causalidad",
      tokens: ["responsabilidad", "extracontractual", "contractual", "dano", "culpa", "causalidad", "hecho", "ilicito", "reparacion"],
    },
    {
      subarea: "Derecho de familia y sucesorio: matrimonio, filiación, herencia y partición",
      tokens: ["matrimonio", "familia", "filiacion", "alimentos", "herencia", "sucesion", "testamento", "legitima", "particion", "heredero"],
    },
  ],
  "Derecho Procesal": [
    {
      subarea: "Procesal: instituciones generales, jurisdicción y competencia",
      tokens: ["jurisdiccion", "competencia", "tribunal", "juez", "proceso", "procedimiento", "instancia", "territorio", "cuantia"],
    },
    {
      subarea: "Teoría de la acción, pretensión, partes y legitimación",
      tokens: ["accion", "pretension", "parte", "partes", "legitimacion", "interes", "demanda", "demandante", "demandado"],
    },
    {
      subarea: "Actos procesales: actuaciones, plazos, notificaciones y emplazamiento",
      tokens: ["acto", "actuacion", "plazo", "notificacion", "emplazamiento", "resolucion", "providencia", "citacion"],
    },
    {
      subarea: "Procedimiento ordinario: discusión, excepciones e incidentes",
      tokens: ["ordinario", "discusion", "contestacion", "replica", "duplica", "excepcion", "incidente", "conciliacion"],
    },
    {
      subarea: "Prueba: sistemas de valoración, medios probatorios y carga de la prueba",
      tokens: ["prueba", "probar", "probatorio", "testigo", "documento", "perito", "confesion", "carga", "valoracion"],
    },
    {
      subarea: "Resoluciones judiciales, sentencias y cosa juzgada",
      tokens: ["sentencia", "resolucion", "fallo", "cosa", "juzgada", "definitiva", "interlocutoria"],
    },
    {
      subarea: "Recursos e impugnaciones civiles y penales",
      tokens: ["recurso", "apelacion", "casacion", "reposicion", "queja", "nulidad", "impugnacion"],
    },
    {
      subarea: "Tutela ejecutiva: juicio ejecutivo, títulos, oposición y embargo",
      tokens: ["ejecutivo", "ejecucion", "titulo", "embargo", "oposicion", "mandamiento", "apremio"],
    },
    {
      subarea: "Proceso penal: garantías, etapas, medidas cautelares y salidas alternativas",
      tokens: ["penal", "fiscal", "imputado", "formalizacion", "cautelar", "prision", "acusacion", "juicio", "oral"],
    },
  ],
  "Derecho Constitucional": [
    {
      subarea: "Bases de la institucionalidad: art. 1, valores y estructura social",
      tokens: ["dignidad", "libertad", "igualdad", "familia", "sociedad", "estado", "bien", "comun", "art", "1"],
    },
    {
      subarea: "Derechos fundamentales: titularidad, límites, contenido esencial y garantías",
      tokens: ["derecho", "fundamental", "garantia", "contenido", "esencial", "limite", "privacidad", "vida", "propiedad", "vivienda"],
    },
    {
      subarea: "Igual protección, debido proceso, juez natural y garantías procesales",
      tokens: ["debido", "proceso", "juez", "natural", "sentencia", "plazo", "razonable", "igual", "proteccion"],
    },
    {
      subarea: "Acciones constitucionales: protección, amparo e inaplicabilidad",
      tokens: ["proteccion", "amparo", "inaplicabilidad", "accion", "recurso", "tribunal", "constitucional"],
    },
    {
      subarea: "Órganos constitucionales, control y supremacía constitucional",
      tokens: ["organo", "control", "supremacia", "constitucional", "congreso", "presidente", "contraloria"],
    },
  ],
};

export function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeNumber(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Number(normalizeText(value).replace(",", "."));
  if (Number.isNaN(parsed)) throw new Error(`Valor numérico inválido: ${String(value)}`);
  return parsed;
}

export function slugify(value: string, maxLength = 100) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength);
}

export function tokenize(value: string) {
  const stopWords = new Set([
    "que",
    "cual",
    "cuales",
    "como",
    "para",
    "por",
    "con",
    "del",
    "los",
    "las",
    "una",
    "uno",
    "sobre",
    "derecho",
    "derechos",
    "concepto",
    "conceptos",
    "normas",
    "juridicas",
    "juridico",
    "juridicos",
    "art",
    "articulo",
    "usted",
    "caso",
    "general",
    "generales",
    "teoria",
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

export function isExcludedProfessor(name: string | null | undefined) {
  return Boolean(name && EXCLUDED_PROFESSOR_PATTERNS.some((pattern) => pattern.test(name)));
}

export function normalizeProfessorName(name: string | null | undefined) {
  if (!name) return null;
  return normalizeText(name).replace(/\.$/, "");
}

export function inferAreaForProfessor(professorName: string | null | undefined, rawAreaName?: string | null) {
  const normalizedProfessor = normalizeProfessorName(professorName);
  if (normalizedProfessor && PROFESSOR_AREA_OVERRIDES[normalizedProfessor]) {
    return PROFESSOR_AREA_OVERRIDES[normalizedProfessor];
  }

  const normalizedArea = normalizeText(rawAreaName);
  if (["Derecho Civil", "Derecho Procesal", "Derecho Constitucional", "Derecho Penal"].includes(normalizedArea)) {
    return normalizedArea;
  }

  return normalizedArea.startsWith("Derecho ") ? normalizedArea : "Derecho General";
}

function looksLikeArea(text: string) {
  return /^Derecho\s+.+\.?$/u.test(text) && text.length < 90;
}

function parseProfessorHeading(text: string) {
  const match = text.match(/^(\d+)\s+(.+?)\.?$/u);
  if (!match) return null;

  const possibleName = normalizeProfessorName(match[2]);
  if (!possibleName || possibleName.length < 3 || possibleName.length > 60) return null;
  if (possibleName.includes("?")) return null;

  return possibleName;
}

function isQuestionLike(text: string) {
  return text.includes("?") || text.startsWith("¿") || text.startsWith("Â¿") || text.toLowerCase().startsWith("caso.");
}

async function resolveExistingSourcePath(kind: string) {
  const source = SOURCE_MANIFEST.find((item) => item.kind === kind);
  if (!source) throw new Error(`No source found for kind: ${kind}`);

  const manifestPath = resolveSourcePath(source);
  if (await fs.access(manifestPath).then(() => true).catch(() => false)) {
    return manifestPath;
  }

  const directory = path.dirname(manifestPath);
  const extension = path.extname(source.relativePath).toLowerCase();
  const files = await fs.readdir(directory);
  const fallback = files.find((file) => file.toLowerCase().endsWith(extension));
  if (!fallback) throw new Error(`No encontré archivo ${extension} en ${directory}`);

  return path.join(directory, fallback);
}

export async function readPriorityMatrix() {
  const rows = await readSheet(await resolveExistingSourcePath("priority_matrix"), "frequency_relevance_matrix");
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
    }));
}

export async function readRawCandidatesFromQuestionnaire() {
  const result = await mammoth.extractRawText({ path: await resolveExistingSourcePath("questionnaire") });
  const paragraphs = result.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let currentArea: string | null = null;
  let currentProfessor: string | null = null;
  const candidates: RawCandidate[] = [];

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
    if (isExcludedProfessor(currentProfessor)) continue;

    const rawAnswer = paragraphs[index + 1] && !isQuestionLike(paragraphs[index + 1])
      ? paragraphs[index + 1]
      : null;

    candidates.push({
      areaName: inferAreaForProfessor(currentProfessor, currentArea),
      professorName: normalizeProfessorName(currentProfessor),
      statement: paragraph,
      rawAnswer,
      orderIndex: index,
    });
  }

  return candidates;
}

export function subjectFromSubarea(subarea: string) {
  const beforeColon = subarea.split(":")[0]?.trim();
  if (beforeColon && beforeColon.length >= 4) return beforeColon;
  return subarea.split(",")[0]?.trim() || subarea;
}

export function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export function countByProfessor<T extends { professorName: string }>(items: T[]) {
  return countBy(items, (item) => item.professorName);
}

function classifySubarea(candidate: RawCandidate) {
  const area = inferAreaForProfessor(candidate.professorName, candidate.areaName);
  const rules = TOPIC_RULES_BY_AREA[area] ?? [];
  const tokens = new Set(tokenize(`${candidate.statement} ${candidate.rawAnswer ?? ""}`));

  let bestRule = rules[0];
  let bestScore = -1;

  for (const rule of rules) {
    const score = rule.tokens.reduce((sum, token) => sum + (tokens.has(token) ? 1 : 0), 0);
    if (score > bestScore) {
      bestRule = rule;
      bestScore = score;
    }
  }

  if (bestRule && bestScore > 0) return bestRule.subarea;

  if (area === "Derecho Civil") return "Civil: instituciones generales";
  if (area === "Derecho Procesal") return "Procesal: instituciones generales";
  if (area === "Derecho Constitucional") return "Constitucional: instituciones generales";
  return `${area}: instituciones generales`;
}

function relevanceFor(percentage: number) {
  if (percentage >= 15) return "Alta";
  if (percentage >= 5) return "Media";
  return "Baja";
}

function priorityScoreFor(frequency: number, percentage: number) {
  const percentageBoost = percentage >= 20 ? 10 : percentage >= 10 ? 6 : percentage >= 5 ? 3 : 1;
  return Math.max(1, Math.round(frequency * 2 + percentageBoost));
}

export function augmentPrioritiesWithInferredRows(existingPriorities: PriorityRow[], rawCandidates: RawCandidate[]) {
  const existingProfessorNames = new Set(existingPriorities.map((row) => row.professor));
  const grouped = new Map<string, Map<string, { area: string; count: number }>>();

  for (const candidate of rawCandidates) {
    const professor = normalizeProfessorName(candidate.professorName);
    if (!professor || isExcludedProfessor(professor) || existingProfessorNames.has(professor)) continue;

    const area = inferAreaForProfessor(professor, candidate.areaName);
    const subarea = classifySubarea(candidate);
    const professorRows = grouped.get(professor) ?? new Map<string, { area: string; count: number }>();
    const current = professorRows.get(subarea) ?? { area, count: 0 };
    current.count += 1;
    professorRows.set(subarea, current);
    grouped.set(professor, professorRows);
  }

  const inferredRows: PriorityRow[] = [];
  for (const [professor, subareas] of grouped) {
    const total = Array.from(subareas.values()).reduce((sum, row) => sum + row.count, 0);
    for (const [subarea, row] of subareas) {
      const professorPercentage = total > 0 ? Math.round((row.count / total) * 10000) / 100 : 0;
      inferredRows.push({
        professor,
        area: row.area,
        subarea,
        frequency: row.count,
        professorPercentage,
        syllabusAlignment: "Inferida desde preguntas reales y clasificación temática heurística",
        relevance: relevanceFor(professorPercentage),
        priorityScore: priorityScoreFor(row.count, professorPercentage),
      });
    }
  }

  return [...existingPriorities, ...inferredRows];
}

export function probabilityFor(priority: PriorityRow, allPriorities: PriorityRow[]) {
  const total = allPriorities
    .filter((row) => row.professor === priority.professor)
    .reduce((sum, row) => sum + row.priorityScore, 0);

  if (total === 0) return 0;
  return Math.round((priority.priorityScore / total) * 10000) / 100;
}
