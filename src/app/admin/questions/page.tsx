"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Spinner } from "../../loading-spinner";

type Difficulty = "low" | "medium" | "high";
type QuestionOrigin = "real_question" | "generated" | "manual";

type AdminOption = {
  id: string;
  name: string;
};

type SubjectOption = AdminOption & {
  areaId: string;
};

type SubsubjectOption = AdminOption & {
  subjectId: string;
};

type AdminOptionsResponse = {
  admin: {
    email?: string;
    restrictedByEmail: boolean;
  };
  areas: AdminOption[];
  subjects: SubjectOption[];
  subsubjects: SubsubjectOption[];
  professors: AdminOption[];
};

type AdminQuestion = {
  id: string;
  statement: string;
  areaId: string;
  areaName: string;
  subjectId: string | null;
  subjectName: string;
  subsubjectId: string | null;
  subsubjectName: string;
  difficulty: Difficulty;
  estimatedProbability: number;
  priorityScore: number;
  questionType: string;
  isActive: boolean;
  origin: QuestionOrigin;
  sourceReference: string;
  expectedAnswer: {
    id: string;
    modelAnswer: string;
    rubricNotes: string;
    version: number;
  } | null;
  keyPoints: Array<{
    id?: string;
    label: string;
    description: string;
    weight: number;
    isRequired: boolean;
    orderIndex?: number;
  }>;
  commonErrors: Array<{
    id?: string;
    description: string;
    severity: string;
  }>;
  professorIds: string[];
  professorNames: string[];
};

type QuestionFormState = {
  id?: string;
  statement: string;
  areaId: string;
  subjectId: string;
  subsubjectId: string;
  difficulty: Difficulty;
  estimatedProbability: number;
  priorityScore: number;
  questionType: string;
  isActive: boolean;
  origin: QuestionOrigin;
  sourceReference: string;
  professorIds: string[];
  expectedAnswerModel: string;
  rubricNotes: string;
  keyPoints: Array<{
    id?: string;
    label: string;
    description: string;
    weight: number;
    isRequired: boolean;
  }>;
  commonErrorsText: string;
};

const difficultyLabels: Record<Difficulty, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

const originLabels: Record<QuestionOrigin, string> = {
  real_question: "Pregunta real",
  generated: "Generada",
  manual: "Manual",
};

function createEmptyForm(areaId = ""): QuestionFormState {
  return {
    statement: "",
    areaId,
    subjectId: "",
    subsubjectId: "",
    difficulty: "medium",
    estimatedProbability: 0,
    priorityScore: 0,
    questionType: "oral",
    isActive: true,
    origin: "manual",
    sourceReference: "",
    professorIds: [],
    expectedAnswerModel: "",
    rubricNotes: "",
    keyPoints: [{ label: "", description: "", weight: 1, isRequired: true }],
    commonErrorsText: "",
  };
}

function questionToForm(question: AdminQuestion): QuestionFormState {
  return {
    id: question.id,
    statement: question.statement,
    areaId: question.areaId,
    subjectId: question.subjectId ?? "",
    subsubjectId: question.subsubjectId ?? "",
    difficulty: question.difficulty,
    estimatedProbability: question.estimatedProbability,
    priorityScore: question.priorityScore,
    questionType: question.questionType,
    isActive: question.isActive,
    origin: question.origin,
    sourceReference: question.sourceReference,
    professorIds: question.professorIds,
    expectedAnswerModel: question.expectedAnswer?.modelAnswer ?? "",
    rubricNotes: question.expectedAnswer?.rubricNotes ?? "",
    keyPoints:
      question.keyPoints.length > 0
        ? question.keyPoints.map((point) => ({
            id: point.id,
            label: point.label,
            description: point.description,
            weight: point.weight,
            isRequired: point.isRequired,
          }))
        : [{ label: "", description: "", weight: 1, isRequired: true }],
    commonErrorsText: question.commonErrors.map((error) => `${error.severity}: ${error.description}`).join("\n"),
  };
}

function parseCommonErrors(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [maybeSeverity, ...rest] = line.split(":");
      const hasExplicitSeverity = rest.length > 0 && maybeSeverity.trim().length <= 20;

      return {
        severity: hasExplicitSeverity ? maybeSeverity.trim() : "medium",
        description: hasExplicitSeverity ? rest.join(":").trim() : line,
      };
    })
    .filter((error) => error.description.length > 0);
}

function buildPayload(form: QuestionFormState) {
  const modelAnswer = form.expectedAnswerModel.trim();

  return {
    statement: form.statement.trim(),
    areaId: form.areaId,
    subjectId: form.subjectId || null,
    subsubjectId: form.subsubjectId || null,
    difficulty: form.difficulty,
    estimatedProbability: form.estimatedProbability,
    priorityScore: form.priorityScore,
    questionType: form.questionType.trim() || null,
    isActive: form.isActive,
    origin: form.origin,
    sourceReference: form.sourceReference.trim() || null,
    professorIds: form.professorIds,
    expectedAnswer: modelAnswer
      ? {
          modelAnswer,
          rubricNotes: form.rubricNotes.trim() || null,
        }
      : undefined,
    keyPoints: form.keyPoints
      .map((point) => ({
        id: point.id,
        label: point.label.trim(),
        description: point.description.trim(),
        weight: Number(point.weight) || 1,
        isRequired: point.isRequired,
      }))
      .filter((point) => point.label && point.description),
    commonErrors: parseCommonErrors(form.commonErrorsText),
  };
}

export default function AdminQuestionsPage() {
  const [options, setOptions] = useState<AdminOptionsResponse | null>(null);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [form, setForm] = useState<QuestionFormState>(() => createEmptyForm());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    q: "",
    areaId: "",
    subjectId: "",
    subsubjectId: "",
    professorId: "",
    difficulty: "",
    active: "active",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const subjectsForArea = useMemo(() => {
    if (!options) return [];
    return options.subjects.filter((subject) => !form.areaId || subject.areaId === form.areaId);
  }, [form.areaId, options]);

  const subsubjectsForSubject = useMemo(() => {
    if (!options) return [];
    return options.subsubjects.filter((subsubject) => !form.subjectId || subsubject.subjectId === form.subjectId);
  }, [form.subjectId, options]);

  const filterSubjectsForArea = useMemo(() => {
    if (!options) return [];
    return options.subjects.filter((subject) => !filters.areaId || subject.areaId === filters.areaId);
  }, [filters.areaId, options]);

  const filterSubsubjectsForSubject = useMemo(() => {
    if (!options) return [];
    return options.subsubjects.filter((subsubject) => !filters.subjectId || subsubject.subjectId === filters.subjectId);
  }, [filters.subjectId, options]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOptions() {
      const response = await fetch("/api/admin/options", { signal: controller.signal });

      if (response.status === 401 || response.status === 403) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setErrorMessage(payload?.error ?? "Tenés que iniciar sesión para administrar preguntas.");
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error("No se pudieron cargar las opciones del banco.");
      }

      const payload = (await response.json()) as AdminOptionsResponse;
      setOptions(payload);
      setForm((current) => ({
        ...current,
        areaId: current.areaId || payload.areas[0]?.id || "",
      }));
    }

    loadOptions().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setErrorMessage(error instanceof Error ? error.message : "Error inesperado al cargar opciones.");
      setIsLoading(false);
    });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadQuestions() {
      setIsLoading(true);
      setErrorMessage("");

      const params = new URLSearchParams();
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.areaId) params.set("areaId", filters.areaId);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      if (filters.subsubjectId) params.set("subsubjectId", filters.subsubjectId);
      if (filters.professorId) params.set("professorId", filters.professorId);
      if (filters.difficulty) params.set("difficulty", filters.difficulty);
      if (filters.active) params.set("active", filters.active);
      params.set("limit", "80");

      const response = await fetch(`/api/admin/questions?${params.toString()}`, { signal: controller.signal });

      if (response.status === 401 || response.status === 403) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setQuestions([]);
        setErrorMessage(payload?.error ?? "Tenés que iniciar sesión para administrar preguntas.");
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error("No se pudo cargar el banco de preguntas.");
      }

      const payload = (await response.json()) as { questions: AdminQuestion[] };
      setQuestions(payload.questions);

      const nextSelected = payload.questions.find((question) => question.id === selectedId) ?? payload.questions[0];
      if (nextSelected) {
        setSelectedId(nextSelected.id);
        setForm(questionToForm(nextSelected));
      } else if (!selectedId) {
        setForm(createEmptyForm(options?.areas[0]?.id ?? ""));
      }

      setIsLoading(false);
    }

    loadQuestions().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setQuestions([]);
      setErrorMessage(error instanceof Error ? error.message : "Error inesperado al cargar preguntas.");
      setIsLoading(false);
    });

    return () => controller.abort();
  }, [filters, options?.areas, reloadKey, selectedId]);

  function selectQuestion(question: AdminQuestion) {
    setSelectedId(question.id);
    setForm(questionToForm(question));
    setMessage("");
    setErrorMessage("");
  }

  function startNewQuestion() {
    setSelectedId(null);
    setForm(createEmptyForm(options?.areas[0]?.id ?? ""));
    setMessage("Creando pregunta nueva. Completá la pauta antes de guardar.");
    setErrorMessage("");
  }

  function updateKeyPoint(index: number, patch: Partial<QuestionFormState["keyPoints"][number]>) {
    setForm((current) => ({
      ...current,
      keyPoints: current.keyPoints.map((point, pointIndex) =>
        pointIndex === index ? { ...point, ...patch } : point,
      ),
    }));
  }

  async function saveQuestion() {
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const payload = buildPayload(form);
      const endpoint = selectedId ? `/api/admin/questions/${selectedId}` : "/api/admin/questions";
      const response = await fetch(endpoint, {
        method: selectedId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: unknown } | null;
        setErrorMessage(typeof errorPayload?.error === "string" ? errorPayload.error : "No se pudo guardar la pregunta.");
        setIsSaving(false);
        return;
      }

      const savedPayload = (await response.json()) as { question: AdminQuestion };
      setSelectedId(savedPayload.question.id);
      setForm(questionToForm(savedPayload.question));
      setQuestions((current) => {
        const exists = current.some((question) => question.id === savedPayload.question.id);
        return exists
          ? current.map((question) => (question.id === savedPayload.question.id ? savedPayload.question : question))
          : [savedPayload.question, ...current];
      });
      setMessage("Pregunta guardada. Buenísimo: el banco ya quedó actualizado.");
      setIsSaving(false);
    } catch {
      setErrorMessage("No se pudo guardar la pregunta.");
      setIsSaving(false);
    }
  }

  async function toggleActive() {
    if (!selectedId) return;
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(`/api/admin/questions/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !form.isActive }),
      });

      if (!response.ok) {
        setErrorMessage("No se pudo cambiar el estado de la pregunta.");
        setIsSaving(false);
        return;
      }

      const payload = (await response.json()) as { question: AdminQuestion };
      setForm(questionToForm(payload.question));
      setQuestions((current) => current.map((question) => (question.id === payload.question.id ? payload.question : question)));
      setMessage(payload.question.isActive ? "Pregunta reactivada." : "Pregunta archivada fuera del rotatorio general.");
      setIsSaving(false);
    } catch {
      setErrorMessage("No se pudo cambiar el estado de la pregunta.");
      setIsSaving(false);
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-hero">
        <div>
          <Link className="back-link" href="/">← Volver al inicio</Link>
          <p className="eyebrow">Banco editable</p>
          <h1>Panel de preguntas y revisión manual</h1>
          <p>
            Ajustá preguntas, pauta esperada, puntos clave, errores comunes, profesores y probabilidad sin tocar scripts.
          </p>
        </div>
        <div className="admin-hero-card">
          <span>{questions.length}</span>
          <strong>preguntas cargadas</strong>
          <p>{options?.admin.restrictedByEmail ? "Acceso restringido por ADMIN_EMAILS." : "Modo MVP: cualquier usuario autenticado puede administrar."}</p>
        </div>
      </header>

      {errorMessage ? <div className="notice error">{errorMessage}</div> : null}
      {message ? <div className="notice success">{message}</div> : null}

      <section className="admin-layout">
        <aside className="admin-list-panel card">
          <div className="admin-panel-header">
            <div>
              <h2>Banco de preguntas</h2>
              <p>Busca, filtra y elige una pregunta para revisar.</p>
            </div>
            <button className="secondary-button" type="button" onClick={startNewQuestion}>
              + Nueva
            </button>
          </div>

          <div className="admin-filters">
            <label>
              Buscar
              <input
                value={filters.q}
                onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                placeholder="Texto de la pregunta"
              />
            </label>
            <label>
              Área
              <select value={filters.areaId} onChange={(event) => setFilters((current) => ({ ...current, areaId: event.target.value, subjectId: "", subsubjectId: "" }))}>
                <option value="">Todas</option>
                {options?.areas.map((area) => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
            </label>
            <label>
              Materia
              <select value={filters.subjectId} onChange={(event) => setFilters((current) => ({ ...current, subjectId: event.target.value, subsubjectId: "" }))}>
                <option value="">Todas</option>
                {filterSubjectsForArea.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </label>
            <label>
              Submateria
              <select value={filters.subsubjectId} onChange={(event) => setFilters((current) => ({ ...current, subsubjectId: event.target.value }))}>
                <option value="">Todas</option>
                {filterSubsubjectsForSubject.map((subsubject) => (
                  <option key={subsubject.id} value={subsubject.id}>{subsubject.name}</option>
                ))}
              </select>
            </label>
            <label>
              Profesor
              <select value={filters.professorId} onChange={(event) => setFilters((current) => ({ ...current, professorId: event.target.value }))}>
                <option value="">Todos</option>
                {options?.professors.map((professor) => (
                  <option key={professor.id} value={professor.id}>{professor.name}</option>
                ))}
              </select>
            </label>

            <label>
              Dificultad
              <select
                value={filters.difficulty}
                onChange={(event) => setFilters((current) => ({ ...current, difficulty: event.target.value }))}
              >
                <option value="">Todas</option>
                {Object.entries(difficultyLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select value={filters.active} onChange={(event) => setFilters((current) => ({ ...current, active: event.target.value }))}>
                <option value="active">Activas</option>
                <option value="inactive">Archivadas</option>
                <option value="all">Todas</option>
              </select>
            </label>
          </div>

          <button className="ghost-button" type="button" onClick={() => setReloadKey((current) => current + 1)}>
            Actualizar listado
          </button>

          <div className="admin-question-list" aria-live="polite">
            {isLoading ? <p className="empty-state loading-inline"><Spinner size={16} /> Cargando banco...</p> : null}
            {!isLoading && questions.length === 0 ? <p className="empty-state">No hay preguntas con esos filtros.</p> : null}
            {questions.map((question) => (
              <button
                className={`admin-question-row ${selectedId === question.id ? "active" : ""}`}
                key={question.id}
                type="button"
                onClick={() => selectQuestion(question)}
              >
                <span className={question.isActive ? "status-dot active" : "status-dot muted"} />
                <span>
                  <strong>{question.statement}</strong>
                  <small>
                    {question.areaName} · {question.subjectName} · {question.subsubjectName} · {difficultyLabels[question.difficulty]} · {question.estimatedProbability}%
                  </small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="admin-editor card">
          <div className="admin-panel-header">
            <div>
              <h2>{selectedId ? "Editar pregunta" : "Nueva pregunta"}</h2>
              <p>La pauta es la estructura: sin pauta buena, la IA evalúa a ciegas. No saltees esto.</p>
            </div>
            <span className={`score-pill ${form.isActive ? "strong" : "danger"}`}>
              {form.isActive ? "Activa" : "Archivada"}
            </span>
          </div>

          <div className="admin-form-grid">
            <label className="wide">
              Enunciado
              <textarea
                rows={4}
                value={form.statement}
                onChange={(event) => setForm((current) => ({ ...current, statement: event.target.value }))}
                placeholder="Ej: Explique los requisitos de la responsabilidad contractual..."
              />
            </label>

            <label>
              Área
              <select
                value={form.areaId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, areaId: event.target.value, subjectId: "", subsubjectId: "" }))
                }
              >
                {options?.areas.map((area) => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
            </label>

            <label>
              Materia
              <select
                value={form.subjectId}
                onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value, subsubjectId: "" }))}
              >
                <option value="">Sin materia</option>
                {subjectsForArea.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </label>

            <label>
              Submateria
              <select
                value={form.subsubjectId}
                onChange={(event) => setForm((current) => ({ ...current, subsubjectId: event.target.value }))}
              >
                <option value="">Sin submateria</option>
                {subsubjectsForSubject.map((subsubject) => (
                  <option key={subsubject.id} value={subsubject.id}>{subsubject.name}</option>
                ))}
              </select>
            </label>

            <label>
              Dificultad
              <select
                value={form.difficulty}
                onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value as Difficulty }))}
              >
                {Object.entries(difficultyLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label>
              Probabilidad %
              <input
                min="0"
                max="100"
                type="number"
                value={form.estimatedProbability}
                onChange={(event) => setForm((current) => ({ ...current, estimatedProbability: Number(event.target.value) }))}
              />
            </label>

            <label>
              Prioridad
              <input
                min="0"
                type="number"
                value={form.priorityScore}
                onChange={(event) => setForm((current) => ({ ...current, priorityScore: Number(event.target.value) }))}
              />
            </label>

            <label>
              Tipo
              <input
                value={form.questionType}
                onChange={(event) => setForm((current) => ({ ...current, questionType: event.target.value }))}
                placeholder="oral, conceptual, caso práctico..."
              />
            </label>

            <label>
              Origen
              <select value={form.origin} onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value as QuestionOrigin }))}>
                {Object.entries(originLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="wide">
              Profesores asociados
              <select
                multiple
                value={form.professorIds}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    professorIds: Array.from(event.target.selectedOptions).map((option) => option.value),
                  }))
                }
              >
                {options?.professors.map((professor) => (
                  <option key={professor.id} value={professor.id}>{professor.name}</option>
                ))}
              </select>
              <small>Mantené Ctrl/Cmd para seleccionar varios.</small>
            </label>

            <label className="wide">
              Referencia de fuente
              <input
                value={form.sourceReference}
                onChange={(event) => setForm((current) => ({ ...current, sourceReference: event.target.value }))}
                placeholder="Excel, documento, profesor o folio de origen"
              />
            </label>

            <label className="wide">
              Respuesta esperada
              <textarea
                rows={7}
                value={form.expectedAnswerModel}
                onChange={(event) => setForm((current) => ({ ...current, expectedAnswerModel: event.target.value }))}
                placeholder="Respuesta modelo o pauta principal..."
              />
            </label>

            <label className="wide">
              Notas de rúbrica
              <textarea
                rows={3}
                value={form.rubricNotes}
                onChange={(event) => setForm((current) => ({ ...current, rubricNotes: event.target.value }))}
                placeholder="Criterios especiales para evaluar esta pregunta"
              />
            </label>
          </div>

          <section className="admin-subsection">
            <div className="admin-panel-header">
              <div>
                <h3>Puntos clave</h3>
                <p>Estos puntos alimentan la evaluación automática. Acá no hay magia: buena pauta, buen feedback.</p>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    keyPoints: [...current.keyPoints, { label: "", description: "", weight: 1, isRequired: true }],
                  }))
                }
              >
                + Punto
              </button>
            </div>

            <div className="keypoint-editor-list">
              {form.keyPoints.map((point, index) => (
                <div className="keypoint-editor-row" key={point.id ?? `new-${index}`}>
                  <input
                    value={point.label}
                    onChange={(event) => updateKeyPoint(index, { label: event.target.value })}
                    placeholder="Etiqueta"
                  />
                  <input
                    value={point.description}
                    onChange={(event) => updateKeyPoint(index, { description: event.target.value })}
                    placeholder="Descripción esperada"
                  />
                  <input
                    min="0"
                    type="number"
                    value={point.weight}
                    onChange={(event) => updateKeyPoint(index, { weight: Number(event.target.value) })}
                    aria-label="Peso"
                  />
                  <label className="checkbox-label">
                    <input
                      checked={point.isRequired}
                      type="checkbox"
                      onChange={(event) => updateKeyPoint(index, { isRequired: event.target.checked })}
                    />
                    Obligatorio
                  </label>
                </div>
              ))}
            </div>
          </section>

          <label className="wide admin-textarea-label">
            Errores comunes
            <textarea
              rows={5}
              value={form.commonErrorsText}
              onChange={(event) => setForm((current) => ({ ...current, commonErrorsText: event.target.value }))}
              placeholder="medium: Confundir prescripción con caducidad"
            />
            <small>Un error por línea. Podés usar formato `gravedad: descripción`.</small>
          </label>

          <div className="admin-actions">
            <button className="primary-button" type="button" disabled={isSaving || !form.areaId} onClick={saveQuestion}>
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </button>
            {selectedId ? (
              <button className="secondary-button" type="button" disabled={isSaving} onClick={toggleActive}>
                {form.isActive ? "Archivar" : "Reactivar"}
              </button>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
