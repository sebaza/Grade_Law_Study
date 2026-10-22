import { getOpenAIClient } from "@/lib/ai/openai";
import {
  CLIMATE_TONES,
  RELEVANCE_LEVELS,
  politicalBriefAnalysisSchema,
  type ClimateTone,
  type PoliticalBriefItem,
} from "@/lib/domain/political-brief";
import type { Headline } from "@/lib/news/chile-feeds";

export type AnalyzeHeadlinesInput = {
  headlines: Headline[];
  /** Ramos reales de la BD. Se inyectan como enum: el modelo no puede inventar uno. */
  areaNames: string[];
  /** Materias por ramo, para acotar la sugerencia a lo que existe en el banco. */
  subjectsByArea: Record<string, string[]>;
};

export type AnalyzeHeadlinesResult = {
  climateSummary: string;
  climateTone: ClimateTone;
  highlightArea: string | null;
  highlightSubject: string | null;
  highlightReason: string;
  items: PoliticalBriefItem[];
};

export async function analyzePoliticalHeadlines(input: AnalyzeHeadlinesInput): Promise<AnalyzeHeadlinesResult> {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_EVALUATION_MODEL ?? "gpt-4.1-mini";

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "Sos profesor de Derecho en Chile y preparás a un alumno para el examen oral de grado. " +
              "Recibís titulares de prensa chilena reciente. Tu tarea es leer la coyuntura política y decir qué " +
              "materias del examen podrían verse reflejadas en las preguntas de la comisión. " +
              "Sé sobrio y preciso: no exageres la conexión jurídica ni fuerces un vínculo que no existe. " +
              "No opines políticamente ni tomes partido; describí el clima de forma técnica y neutral. " +
              "Devolvé solo JSON válido.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              headlines: input.headlines.map((headline, index) => ({
                index,
                title: headline.title,
                summary: headline.summary,
                source: headline.source,
                publishedAt: headline.publishedAt,
              })),
              availableAreas: input.areaNames,
              subjectsByArea: input.subjectsByArea,
              instructions: {
                climateSummary:
                  "2 o 3 frases sobre el clima político-jurídico chileno de estos días, en tono neutral y descriptivo. Mencioná los ejes concretos (reformas, fallos, conflictos institucionales), no generalidades vacías.",
                climateTone:
                  "estable = sin conflicto institucional relevante; activo = mucha agenda legislativa o judicial en movimiento; tenso = conflicto entre poderes o crisis puntual; polarizado = enfrentamiento político abierto y transversal.",
                highlight:
                  "highlightArea es el ramo del examen con más probabilidad de aparecer en preguntas dada la coyuntura. Debe salir de availableAreas. highlightSubject debe salir de subjectsByArea[highlightArea] o ser null si ninguna calza bien. highlightReason explica en una frase por qué, citando el hecho noticioso concreto.",
                items:
                  "Seleccioná entre 3 y 5 titulares con vínculo jurídico REAL con el examen de grado. Ignorá deportes, clima, farándula, policial rutinario y política sin arista jurídica. Si menos de 3 titulares tienen vínculo real, devolvé solo esos. headlineIndex debe ser el index exacto del titular. areaName debe salir de availableAreas. subjectName debe salir de subjectsByArea[areaName] o ser null. legalAngle explica en una frase qué institución o norma está en juego y cómo podría preguntarla la comisión.",
                relevance:
                  "alta = la conexión con el examen es directa y evidente; media = plausible; baja = tangencial.",
              },
            }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "political_climate_brief",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["climateSummary", "climateTone", "highlightArea", "highlightSubject", "highlightReason", "items"],
          properties: {
            climateSummary: { type: "string" },
            climateTone: { type: "string", enum: [...CLIMATE_TONES] },
            highlightArea: { type: "string", enum: input.areaNames },
            highlightSubject: { type: ["string", "null"] },
            highlightReason: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["headlineIndex", "areaName", "subjectName", "legalAngle", "relevance"],
                properties: {
                  headlineIndex: { type: "integer", minimum: 0 },
                  areaName: { type: "string", enum: input.areaNames },
                  subjectName: { type: ["string", "null"] },
                  legalAngle: { type: "string" },
                  relevance: { type: "string", enum: [...RELEVANCE_LEVELS] },
                },
              },
            },
          },
        },
      },
    },
  });

  const analysis = politicalBriefAnalysisSchema.parse(JSON.parse(response.output_text));
  const knownSubjects = new Set(Object.values(input.subjectsByArea).flat());

  // Resolver contra los titulares reales: el modelo solo aportó el índice.
  // Un índice fuera de rango se descarta en vez de romper la sección.
  const items = analysis.items.flatMap((item): PoliticalBriefItem[] => {
    const headline = input.headlines[item.headlineIndex];
    if (!headline) return [];

    return [{
      title: headline.title,
      url: headline.url,
      source: headline.source,
      publishedAt: headline.publishedAt,
      areaName: item.areaName,
      subjectName: item.subjectName && knownSubjects.has(item.subjectName) ? item.subjectName : null,
      legalAngle: item.legalAngle,
      relevance: item.relevance,
    }];
  });

  return {
    climateSummary: analysis.climateSummary,
    climateTone: analysis.climateTone,
    highlightArea: input.areaNames.includes(analysis.highlightArea) ? analysis.highlightArea : null,
    highlightSubject:
      analysis.highlightSubject && knownSubjects.has(analysis.highlightSubject) ? analysis.highlightSubject : null,
    highlightReason: analysis.highlightReason,
    items,
  };
}

export function briefModelName() {
  return process.env.OPENAI_EVALUATION_MODEL ?? "gpt-4.1-mini";
}
