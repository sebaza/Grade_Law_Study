import { z } from "zod";

export const CLIMATE_TONES = ["estable", "activo", "tenso", "polarizado"] as const;
export const RELEVANCE_LEVELS = ["alta", "media", "baja"] as const;

export type ClimateTone = (typeof CLIMATE_TONES)[number];
export type RelevanceLevel = (typeof RELEVANCE_LEVELS)[number];

/**
 * Lo que devuelve el modelo. Referencia los titulares por índice (headlineIndex)
 * en vez de repetir la URL: así el enlace siempre sale del RSS real y el modelo
 * no puede inventar links.
 */
export const politicalBriefAnalysisSchema = z.object({
  climateSummary: z.string(),
  climateTone: z.enum(CLIMATE_TONES),
  highlightArea: z.string(),
  highlightSubject: z.string().nullable(),
  highlightReason: z.string(),
  items: z.array(z.object({
    headlineIndex: z.number().int().min(0),
    areaName: z.string(),
    subjectName: z.string().nullable(),
    legalAngle: z.string(),
    relevance: z.enum(RELEVANCE_LEVELS),
  })),
});

export type PoliticalBriefAnalysis = z.infer<typeof politicalBriefAnalysisSchema>;

/** Item ya resuelto contra el titular real del RSS, listo para la UI. */
export type PoliticalBriefItem = {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  areaName: string;
  subjectName: string | null;
  legalAngle: string;
  relevance: RelevanceLevel;
};

export type PoliticalBrief = {
  climateSummary: string;
  climateTone: ClimateTone;
  highlightArea: string | null;
  highlightSubject: string | null;
  highlightReason: string | null;
  items: PoliticalBriefItem[];
  sources: string[];
  headlineCount: number;
  generatedAt: string;
};
