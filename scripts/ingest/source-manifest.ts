import path from "node:path";

export type SourceDocumentKind = "priority_matrix" | "questionnaire" | "rubric" | "regulation" | "syllabus";
export type SourceDocumentType = "xlsx" | "docx" | "pdf";

export type SourceManifestItem = {
  key: string;
  title: string;
  relativePath: string;
  type: SourceDocumentType;
  kind: SourceDocumentKind;
  areaName?: string;
  notes?: string;
};

export const PROJECT_ROOT = process.cwd();

export const SOURCE_MANIFEST: SourceManifestItem[] = [
  {
    key: "priority-matrix",
    title: "Matriz de frecuencia y relevancia por profesor",
    relativePath: path.join("Excel_Con preguntas", "frequency_relevance_matrix.xlsx"),
    type: "xlsx",
    kind: "priority_matrix",
    notes: "Fuente principal de prioridad, frecuencia y probabilidad inicial.",
  },
  {
    key: "jose-espejo-questionnaire",
    title: "Cuestionario Examen de Grado - Jose Espejo",
    relativePath: path.join("Preguntas", "Cuestionario Examen de Grado - José Espejo.docx"),
    type: "docx",
    kind: "questionnaire",
    notes: "Banco de preguntas reales o recopiladas, con respuestas base mezcladas en el texto.",
  },
  {
    key: "exam-rubric",
    title: "Rúbrica Evaluación Examen de Grado",
    relativePath: path.join("Reglamiento", "RÚBRICA EVALUACIÓN EXAMEN DE GRADO.pdf"),
    type: "pdf",
    kind: "rubric",
    notes: "Fuente normativa para los criterios de evaluación automática.",
  },
  {
    key: "exam-regulation-2025",
    title: "Reglamento Examen de Grado 2025",
    relativePath: path.join("Reglamiento", "Resolucion FCJ N21-2025 Reg lamento Examen de Grado.pdf"),
    type: "pdf",
    kind: "regulation",
    notes: "Define modalidad oral, áreas obligatorias y reglas generales del examen.",
  },
  {
    key: "civil-syllabus",
    title: "Temario Derecho Civil",
    relativePath: path.join("Temario", "Temario Derecho Civil. Examen de Grado.pdf"),
    type: "pdf",
    kind: "syllabus",
    areaName: "Derecho Civil",
  },
  {
    key: "constitutional-syllabus",
    title: "Cedulario Derecho Constitucional",
    relativePath: path.join("Temario", "Propuesta NUEVO CEDULARIO DE DERECHO CONSTITUCIONAL.pdf"),
    type: "pdf",
    kind: "syllabus",
    areaName: "Derecho Constitucional",
  },
  {
    key: "criminal-syllabus",
    title: "Temario Derecho Penal",
    relativePath: path.join("Temario", "Propuesta Temario Derecho Penal. Examen de Grado.pdf"),
    type: "pdf",
    kind: "syllabus",
    areaName: "Derecho Penal",
  },
  {
    key: "procedural-syllabus",
    title: "Cedulario Derecho Procesal",
    relativePath: path.join("Temario", "Propuesta modificación cedulario Derecho Procesal.pdf"),
    type: "pdf",
    kind: "syllabus",
    areaName: "Derecho Procesal",
  },
];

export function resolveSourcePath(item: SourceManifestItem) {
  return path.join(PROJECT_ROOT, item.relativePath);
}
