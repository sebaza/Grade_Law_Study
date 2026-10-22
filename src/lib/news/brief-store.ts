import { getPrisma } from "@/lib/db/prisma";
import type { ClimateTone, PoliticalBrief, PoliticalBriefItem } from "@/lib/domain/political-brief";
import { fetchChileanPoliticalHeadlines, feedSourceNames } from "@/lib/news/chile-feeds";
import { analyzePoliticalHeadlines, briefModelName } from "@/lib/news/political-brief";

const BRIEF_TTL_HOURS = Number(process.env.POLITICAL_BRIEF_TTL_HOURS ?? 6);
const MIN_HEADLINES = 4;

type StoredBrief = {
  id: string;
  climateSummary: string;
  climateTone: string;
  highlightArea: string | null;
  highlightSubject: string | null;
  highlightReason: string | null;
  items: unknown;
  sources: unknown;
  headlineCount: number;
  generatedAt: Date;
};

function toBrief(row: StoredBrief): PoliticalBrief {
  return {
    climateSummary: row.climateSummary,
    climateTone: row.climateTone as ClimateTone,
    highlightArea: row.highlightArea,
    highlightSubject: row.highlightSubject,
    highlightReason: row.highlightReason,
    items: (row.items as PoliticalBriefItem[] | null) ?? [],
    sources: (row.sources as string[] | null) ?? [],
    headlineCount: row.headlineCount,
    generatedAt: row.generatedAt.toISOString(),
  };
}

function isStale(generatedAt: Date) {
  return Date.now() - generatedAt.getTime() > BRIEF_TTL_HOURS * 60 * 60 * 1000;
}

async function readLatest() {
  const db = getPrisma();
  return db.politicalBrief.findFirst({ orderBy: { generatedAt: "desc" } });
}

/** Lee ramos y materias reales del banco para acotar lo que el modelo puede responder. */
async function readTaxonomy() {
  const db = getPrisma();
  // Lecturas secuenciales: el pool corre con connection_limit=1.
  const areas = await db.lawArea.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const subjects = await db.subject.findMany({
    orderBy: { name: "asc" },
    select: { name: true, areaId: true },
  });

  const areaNameById = new Map(areas.map((area) => [area.id, area.name]));
  const subjectsByArea: Record<string, string[]> = {};
  for (const area of areas) subjectsByArea[area.name] = [];
  for (const subject of subjects) {
    const areaName = areaNameById.get(subject.areaId);
    if (areaName) subjectsByArea[areaName].push(subject.name);
  }

  return { areaNames: areas.map((area) => area.name), subjectsByArea };
}

export async function generateBrief(): Promise<PoliticalBrief> {
  const [headlines, taxonomy] = await Promise.all([fetchChileanPoliticalHeadlines(), readTaxonomy()]);

  if (headlines.length < MIN_HEADLINES) {
    throw new Error("No hay suficientes titulares disponibles para leer la coyuntura.");
  }
  if (taxonomy.areaNames.length === 0) {
    throw new Error("El banco todavía no tiene ramos cargados.");
  }

  const analysis = await analyzePoliticalHeadlines({
    headlines,
    areaNames: taxonomy.areaNames,
    subjectsByArea: taxonomy.subjectsByArea,
  });

  const db = getPrisma();
  const created = await db.politicalBrief.create({
    data: {
      climateSummary: analysis.climateSummary,
      climateTone: analysis.climateTone,
      highlightArea: analysis.highlightArea,
      highlightSubject: analysis.highlightSubject,
      highlightReason: analysis.highlightReason,
      items: analysis.items,
      sources: feedSourceNames(),
      headlineCount: headlines.length,
      model: briefModelName(),
    },
  });

  return toBrief(created);
}

/**
 * Brief para la home. Sirve el último guardado; si venció el TTL intenta
 * regenerar, y si esa regeneración falla devuelve el viejo antes que nada.
 */
export async function getBriefForHome(): Promise<PoliticalBrief | null> {
  const latest = await readLatest();

  if (latest && !isStale(latest.generatedAt)) {
    return toBrief(latest);
  }

  try {
    return await generateBrief();
  } catch (error) {
    if (latest) {
      console.error("No se pudo refrescar la coyuntura, se sirve la última guardada:", error);
      return toBrief(latest);
    }
    throw error;
  }
}
