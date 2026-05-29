export const LAW_EXAM_RUBRIC = {
  criteria: [
    {
      key: "legalNorms",
      name: "Detección y manejo de normas jurídicas aplicables",
      description:
        "Evalúa si identifica, define, ubica y relaciona las normas jurídicas pertinentes al tema o pregunta.",
    },
    {
      key: "legalConcepts",
      name: "Manejo de teorías y conceptos técnico-jurídicos",
      description:
        "Evalúa si distingue, comprende y utiliza conceptos jurídicos con lenguaje técnico y sustento dogmático.",
    },
    {
      key: "practicalApplication",
      name: "Aplicación de conceptos y normas a planteamientos prácticos",
      description:
        "Evalúa si desarrolla, interpreta y aplica normas e instituciones a problemas jurídicos concretos.",
    },
    {
      key: "structureAndArgumentation",
      name: "Fundamentación y orden de las respuestas",
      description:
        "Evalúa claridad, fluidez, precisión, asertividad, orden lógico y secuencial de la exposición.",
    },
  ],
  levels: [
    { level: "Excelente", score: 10 },
    { level: "Bueno", score: 8 },
    { level: "Regular", score: 6 },
    { level: "Deficiente", score: 4 },
    { level: "No cumple", score: 2 },
  ],
} as const;
