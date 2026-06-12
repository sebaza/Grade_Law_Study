export const RUBRIC_CRITERION_KEYS = [
  "legalNorms",
  "legalConcepts",
  "practicalApplication",
  "structureAndArgumentation",
] as const;

export type RubricCriterionKey = (typeof RUBRIC_CRITERION_KEYS)[number];

export const LAW_EXAM_RUBRIC = {
  source: "RÚBRICA EVALUACIÓN EXAMEN DE GRADO",
  criteria: [
    {
      key: "legalNorms",
      name: "Detección y manejo de las normas jurídicas aplicables",
      competency: "Competencia 1 - Dominio 1",
      description:
        "Evalúa si identifica, define, ubica y relaciona las normas jurídicas correspondientes al tema o pregunta realizada.",
      levels: {
        Excelente:
          "Identifica, define y describe las normas; las ubica en el cuerpo normativo y las relaciona con otras normas relevantes.",
        Bueno:
          "Identifica, define y describe normas con alguna dificultad; presenta inconvenientes de ubicación o relaciones normativas mayores.",
        Regular:
          "Identifica solo algunas normas o las define incompletamente; ubica con escasa precisión y establece relaciones básicas.",
        Deficiente:
          "Identifica escasamente las normas o las define de manera precaria; tiene dificultad para ubicarlas y relacionarlas.",
        "No cumple":
          "No identifica las normas correspondientes, no las ubica y no logra relacionarlas con el ordenamiento jurídico.",
      },
    },
    {
      key: "legalConcepts",
      name: "Manejo de teorías y/o conceptos técnico-jurídicos",
      competency: "Competencia 2 - Dominio 1",
      description:
        "Evalúa si distingue, comprende y utiliza conceptos jurídicos con lenguaje técnico y sustento teórico o dogmático.",
      levels: {
        Excelente:
          "Distingue, comprende y utiliza conceptos jurídicos con lenguaje técnico y dominio cabal de las instituciones.",
        Bueno:
          "Distingue y comprende conceptos jurídicos, usando lenguaje técnico e incorporando algunos fundamentos teóricos o dogmáticos.",
        Regular:
          "Distingue solo parte de los conceptos, usa lenguaje técnico mínimo e incorpora escasos fundamentos.",
        Deficiente:
          "Distingue con dificultad, no demuestra acervo jurídico mínimo, no relaciona conceptos ni usa lenguaje técnico.",
        "No cumple":
          "No distingue conceptos jurídicos ni demuestra acervo técnico o dogmático sobre la institución preguntada.",
      },
    },
    {
      key: "practicalApplication",
      name: "Capacidad de aplicar conceptos técnicos y normas jurídicas a planteamientos prácticos",
      competency: "Competencia 2 - Dominio 2",
      description:
        "Evalúa si desarrolla, interpreta y aplica normas e instituciones jurídicas a problemas concretos, fundamentando soluciones.",
      levels: {
        Excelente:
          "Desarrolla e interpreta fluidamente normas e instituciones aplicables y fundamenta jurídicamente cada alternativa.",
        Bueno:
          "Desarrolla e interpreta adecuadamente normas e instituciones y fundamenta la mayoría de las alternativas.",
        Regular:
          "Desarrolla e interpreta suficientemente algunas normas o instituciones y fundamenta solo algunas alternativas.",
        Deficiente:
          "Desarrolla algunas normas o instituciones, pero fundamenta escasamente las opciones planteadas.",
        "No cumple":
          "No desarrolla ni interpreta normas o instituciones aplicables y no fundamenta opciones jurídicas.",
      },
    },
    {
      key: "structureAndArgumentation",
      name: "Fundamentación y orden de las respuestas",
      competency: "Competencia 1 - Dominio 2",
      description:
        "Evalúa claridad, fluidez, precisión, asertividad y orden lógico-secuencial de la exposición oral.",
      levels: {
        Excelente:
          "Expresa ideas con claridad, fluidez, precisión y asertividad; expone de manera lógica, secuencial e interesante.",
        Bueno:
          "Expresa ideas con claridad casi todo el tiempo y mantiene una exposición lógica-secuencial adecuada.",
        Regular:
          "Expresa ideas con relativa claridad, pero cambia de idea sin hilo conductor consistente.",
        Deficiente:
          "Expresa ideas con poca claridad y expone de manera poco lógica, sin hilo conductor permanente.",
        "No cumple":
          "No expresa ideas con claridad ni sigue un hilo conductor común.",
      },
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
