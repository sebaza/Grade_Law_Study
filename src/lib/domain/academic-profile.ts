export type RubricCriterionKey =
  | "legalNorms"
  | "legalConcepts"
  | "practicalApplication"
  | "structureAndArgumentation";

export type AcademicEvaluationProfile = {
  professorName: string;
  areaName: string;
  source: "matrix-and-area-inferred" | "area-inferred";
  primaryCriteria: RubricCriterionKey[];
  guidance: string;
};

type BuildAcademicEvaluationProfileInput = {
  professorNames: string[];
  areaName: string;
  hasMatrixPriorities: boolean;
};

function profileForArea(areaName: string): Pick<AcademicEvaluationProfile, "primaryCriteria" | "guidance"> {
  if (areaName === "Derecho Constitucional") {
    return {
      primaryCriteria: ["legalNorms", "legalConcepts", "structureAndArgumentation"],
      guidance:
        "Este perfil debe exigir identificación precisa de norma constitucional, principio comprometido, estándar de control y conexión dogmática. Penalizá especialmente respuestas sin norma o garantía concreta.",
    };
  }

  if (areaName === "Derecho Procesal") {
    return {
      primaryCriteria: ["practicalApplication", "structureAndArgumentation", "legalNorms"],
      guidance:
        "Este perfil debe exigir orden procesal, oportunidad, vía procedimental, tribunal competente, carga argumentativa y fundamento normativo. Penalizá especialmente respuestas que sepan el concepto pero no lo apliquen al trámite.",
    };
  }

  if (areaName === "Derecho Civil") {
    return {
      primaryCriteria: ["legalConcepts", "legalNorms", "practicalApplication"],
      guidance:
        "Este perfil debe exigir concepto técnico, requisitos, clasificación, efectos jurídicos y norma/institución base. Penalizá especialmente respuestas vagas que no distingan requisitos, acciones o efectos.",
    };
  }

  return {
    primaryCriteria: ["legalNorms", "legalConcepts", "practicalApplication", "structureAndArgumentation"],
    guidance:
      "Este perfil debe aplicar la rúbrica institucional completa, exigiendo norma, concepto, aplicación y orden argumentativo.",
  };
}

export function buildAcademicEvaluationProfile(input: BuildAcademicEvaluationProfileInput): AcademicEvaluationProfile {
  const professorName = input.professorNames[0] ?? "Sin profesor";
  const areaProfile = profileForArea(input.areaName);

  return {
    professorName,
    areaName: input.areaName,
    source: input.hasMatrixPriorities ? "matrix-and-area-inferred" : "area-inferred",
    primaryCriteria: areaProfile.primaryCriteria,
    guidance: areaProfile.guidance,
  };
}
