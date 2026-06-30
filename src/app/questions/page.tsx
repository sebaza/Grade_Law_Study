"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppTopNav } from "../app-top-nav";
import { LoadingCard } from "../loading-spinner";
import { ProbabilityBadge, InfoHint } from "../question-badges";

type FacetOption = { id: string; name: string; areaId?: string; subjectId?: string };

type QuestionBankResponse = {
  pagination: { page: number; limit: number; total: number; totalPages: number };
  facets: {
    areas: FacetOption[];
    subjects: Array<FacetOption & { areaId: string }>;
    subsubjects: Array<FacetOption & { subjectId: string }>;
    professors: FacetOption[];
    difficulties: string[];
    questionTypes: string[];
  };
  questions: Array<{
    id: string;
    statement: string;
    areaName: string;
    subjectName: string;
    subsubjectName: string;
    professorName: string;
    difficulty: "low" | "medium" | "high";
    estimatedProbability: number;
    priorityScore: number;
    questionType: string;
    keyPointCount: number;
    globalAttemptCount: number;
    status: string;
    attemptCount: number;
    bestScore: number;
    averageScore: number;
  }>;
};

const difficultyLabels: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const statusLabels: Record<string, string> = {
  pending: "Inicial",
  in_practice: "En práctica",
  answered: "Practicada",
  mastered: "Dominada",
  needs_review: "Repaso",
  excluded: "Excluida",
};

function scoreTone(score: number) {
  if (score >= 85) return "strong";
  if (score >= 60) return "warn";
  return "danger";
}

function compactStatement(statement: string) {
  return statement.length > 220 ? `${statement.slice(0, 220)}...` : statement;
}

export default function QuestionsPage() {
  const [payload, setPayload] = useState<QuestionBankResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    q: "",
    area: "",
    subject: "",
    subsubject: "",
    professor: "",
    difficulty: "",
    questionType: "",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadQuestions() {
      setIsLoading(true);
      setErrorMessage("");

      const params = new URLSearchParams({ page: String(page), limit: "20" });
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      const response = await fetch(`/api/questions?${params.toString()}`, { signal: controller.signal });

      if (!response.ok) {
        setErrorMessage("No se pudo cargar el banco de preguntas.");
        setIsLoading(false);
        return;
      }

      setPayload(await response.json() as QuestionBankResponse);
      setIsLoading(false);
    }

    loadQuestions().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setErrorMessage(error instanceof Error ? error.message : "Error inesperado al cargar el banco.");
      setIsLoading(false);
    });

    return () => controller.abort();
  }, [filters, page]);

  const filteredSubjects = useMemo(() => {
    if (!payload) return [];
    if (!filters.area) return payload.facets.subjects;
    const areaId = payload.facets.areas.find((area) => area.name === filters.area)?.id;
    return payload.facets.subjects.filter((subject) => subject.areaId === areaId);
  }, [filters.area, payload]);

  const filteredSubsubjects = useMemo(() => {
    if (!payload) return [];
    if (!filters.subject) return payload.facets.subsubjects;
    const subjectId = payload.facets.subjects.find((subject) => subject.name === filters.subject)?.id;
    return payload.facets.subsubjects.filter((subsubject) => subsubject.subjectId === subjectId);
  }, [filters.subject, payload]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "area" ? { subject: "", subsubject: "" } : {}),
      ...(key === "subject" ? { subsubject: "" } : {}),
    }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({ q: "", area: "", subject: "", subsubject: "", professor: "", difficulty: "", questionType: "" });
    setPage(1);
  }

  return (
    <main className="menu-page-shell question-bank-shell">
      <AppTopNav />

      <header className="page-hero compact-hero">
        <div>
          <p className="eyebrow">Banco de preguntas</p>
          <h1>Banco de preguntas</h1>
        </div>
        <Link className="primary-button" href="/practice">Practicar aleatorio</Link>
      </header>

      <section className="bank-filter-bar" aria-label="Filtros del banco de preguntas">
        <label>
          Buscar
          <input
            type="search"
            value={filters.q}
            onChange={(event) => updateFilter("q", event.target.value)}
            placeholder="Texto de la pregunta"
          />
        </label>
        <label>
          Ramo principal
          <select value={filters.area} onChange={(event) => updateFilter("area", event.target.value)}>
            <option value="">Todos</option>
            {payload?.facets.areas.map((area) => <option key={area.id} value={area.name}>{area.name}</option>)}
          </select>
        </label>
        <label>
          Materia
          <select value={filters.subject} onChange={(event) => updateFilter("subject", event.target.value)}>
            <option value="">Todas</option>
            {filteredSubjects.map((subject) => <option key={subject.id} value={subject.name}>{subject.name}</option>)}
          </select>
        </label>
        <label>
          Submateria
          <select value={filters.subsubject} onChange={(event) => updateFilter("subsubject", event.target.value)}>
            <option value="">Todas</option>
            {filteredSubsubjects.map((subsubject) => <option key={subsubject.id} value={subsubject.name}>{subsubject.name}</option>)}
          </select>
        </label>
        <label>
          Profesor
          <select value={filters.professor} onChange={(event) => updateFilter("professor", event.target.value)}>
            <option value="">Todos</option>
            {payload?.facets.professors.map((professor) => <option key={professor.id} value={professor.name}>{professor.name}</option>)}
          </select>
        </label>
        <label>
          Dificultad
          <select value={filters.difficulty} onChange={(event) => updateFilter("difficulty", event.target.value)}>
            <option value="">Todas</option>
            {payload?.facets.difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{difficultyLabels[difficulty] ?? difficulty}</option>)}
          </select>
        </label>
        <label>
          Tipo
          <select value={filters.questionType} onChange={(event) => updateFilter("questionType", event.target.value)}>
            <option value="">Todos</option>
            {payload?.facets.questionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <button className="secondary-button" type="button" onClick={clearFilters}>Limpiar</button>
      </section>

      <section className="bank-summary-strip">
        <strong>{payload?.pagination.total ?? 0}</strong>
        <span>preguntas activas encontradas · página {payload?.pagination.page ?? page} de {payload?.pagination.totalPages ?? 1}</span>
      </section>

      {isLoading && <LoadingCard label="Cargando banco..." />}
      {!isLoading && errorMessage && <section className="practice-card-large empty-state"><h2>{errorMessage}</h2></section>}

      {!isLoading && payload && (
        <>
          <section className="question-bank-list">
            {payload.questions.length > 0 ? payload.questions.map((question) => (
              <article className="bank-question-card" key={question.id}>
                <div className="question-meta bank-card-meta">
                  <span>{question.areaName}</span>
                  <span>{question.subjectName}</span>
                  <span>{question.professorName}</span>
                  <span>Dificultad: {difficultyLabels[question.difficulty]}</span>
                  <ProbabilityBadge probability={question.estimatedProbability} />
                  <InfoHint text={`${question.keyPointCount} puntos clave esperados en la respuesta.`} />
                </div>
                <div className="bank-card-body">
                  <div>
                    <h2>{compactStatement(question.statement)}</h2>
                    <p>{question.subsubjectName} · {question.questionType}</p>
                  </div>
                  <div className="bank-card-scorebox">
                    <span className="score-pill strong prio-pill">
                      Prioridad {Math.round(question.priorityScore)}
                      <InfoHint text="Prioridad de estudio: combina probabilidad de salir, dificultad y tu desempeño. Más alto = conviene estudiarla antes." />
                    </span>
                    <span className={`score-pill ${scoreTone(question.bestScore)}`}>Tu mejor nota {Math.round(question.bestScore)}%</span>
                    <small>{statusLabels[question.status] ?? question.status} · {question.attemptCount} intentos tuyos · {question.globalAttemptCount} globales</small>
                  </div>
                </div>
                <div className="bank-card-actions">
                  <Link className="primary-button" href={`/practice?source=real&mode=random&questionId=${question.id}`}>Practicar esta pregunta</Link>
                  <Link className="secondary-button" href={`/history#question-${question.id}`}>Ver historial</Link>
                </div>
              </article>
            )) : <p className="muted-copy">No hay preguntas para esos filtros.</p>}
          </section>

          <nav className="pagination-bar" aria-label="Paginación del banco">
            <button className="secondary-button" type="button" onClick={() => setPage((value) => Math.max(value - 1, 1))} disabled={payload.pagination.page <= 1}>Anterior</button>
            <span>Página {payload.pagination.page} / {payload.pagination.totalPages}</span>
            <button className="secondary-button" type="button" onClick={() => setPage((value) => Math.min(value + 1, payload.pagination.totalPages))} disabled={payload.pagination.page >= payload.pagination.totalPages}>Siguiente</button>
          </nav>
        </>
      )}
    </main>
  );
}
