"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type PracticeQuestion = {
  id?: string;
  sourceReference: string | null;
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
  status?: string;
  attemptCount?: number;
  bestScore?: number;
};

type PracticeResponse = {
  mode: "demo" | "real";
  sessionId?: string;
  count: number;
  questions: PracticeQuestion[];
  facets: {
    areas: string[];
    professors: string[];
    difficulties: string[];
  };
};

type EvaluationResponse = {
  attemptId?: string;
  persisted?: boolean;
  evaluation: {
    totalScore: number;
    percentage: number;
    summary: string;
    rubric: Record<string, { score: number; level: string; feedback: string }>;
    correctKeyPoints: string[];
    missingKeyPoints: string[];
    improvementRecommendation: string;
    modelAnswer: string;
  };
  note?: string;
};

const rubricLabels: Record<string, string> = {
  legalNorms: "Normas jurídicas",
  legalConcepts: "Conceptos técnico-jurídicos",
  practicalApplication: "Aplicación práctica",
  structureAndArgumentation: "Fundamentación y orden",
};

const practiceModeLabels = {
  random: "Aleatoria",
  by_subject: "Por materia",
  by_professor: "Por profesor",
  by_difficulty: "Por dificultad",
  review: "Para repaso",
  weak_questions: "Bajo desempeño",
  unpracticed: "No practicadas",
} as const;

type PracticeMode = keyof typeof practiceModeLabels;

export default function PracticePage() {
  const [data, setData] = useState<PracticeResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [practiceSource, setPracticeSource] = useState<"real" | "demo">("real");
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("random");
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [filters, setFilters] = useState({ area: "", professor: "", difficulty: "" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadPractice() {
      setIsLoading(true);
      setErrorMessage("");

      const params = new URLSearchParams();
      if (filters.area) params.set("area", filters.area);
      if (filters.professor) params.set("professor", filters.professor);
      if (filters.difficulty) params.set("difficulty", filters.difficulty);

      const response = practiceSource === "demo"
        ? await fetch(`/api/practice/demo?${params.toString()}`, { signal: controller.signal })
        : await fetch("/api/practice/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              mode: practiceMode,
              limit: 10,
              filters: {
                area: filters.area || undefined,
                professor: filters.professor || undefined,
                difficulty: filters.difficulty || undefined,
              },
            }),
          });

      if (controller.signal.aborted) return;

      if (response.status === 401) {
        setData(null);
        setErrorMessage("Para usar práctica real tenés que iniciar sesión. Podés seguir en modo demo mientras tanto.");
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setData(null);
        setErrorMessage(payload?.error ?? "No se pudo cargar la práctica.");
        setIsLoading(false);
        return;
      }

      const payload = await response.json() as PracticeResponse;
      setData(payload);
      setCurrentIndex(0);
      setAnswer("");
      setEvaluation(null);
      setQuestionStartedAt(Date.now());
      setIsLoading(false);
    }

    loadPractice().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setErrorMessage(error instanceof Error ? error.message : "Error inesperado al cargar la práctica.");
      setIsLoading(false);
    });

    return () => controller.abort();
  }, [filters, practiceMode, practiceSource]);

  const currentQuestion = data?.questions[currentIndex] ?? null;
  const progress = useMemo(() => {
    if (!data || data.questions.length === 0) return 0;
    return Math.round(((currentIndex + 1) / data.questions.length) * 100);
  }, [currentIndex, data]);

  async function submitAnswer() {
    if (!currentQuestion || !answer.trim()) return;

    setIsEvaluating(true);
    setErrorMessage("");

    const endpoint = practiceSource === "demo" ? "/api/evaluations/demo" : "/api/evaluations";
    const body = practiceSource === "demo"
      ? {
          sourceReference: currentQuestion.sourceReference,
          answer,
          timeSeconds: Math.max(1, Math.round((Date.now() - questionStartedAt) / 1000)),
        }
      : {
          questionId: currentQuestion.id,
          sessionId: data?.sessionId,
          answer,
          answerMode: "text",
          timeSeconds: Math.max(1, Math.round((Date.now() - questionStartedAt) / 1000)),
        };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setErrorMessage(payload?.error ?? "No se pudo evaluar la respuesta.");
      setIsEvaluating(false);
      return;
    }

    const payload = await response.json() as EvaluationResponse;
    setEvaluation(payload);
    setIsEvaluating(false);
  }

  function nextQuestion() {
    if (!data) return;
    setCurrentIndex((index) => Math.min(index + 1, data.questions.length - 1));
    setAnswer("");
    setEvaluation(null);
    setQuestionStartedAt(Date.now());
  }

  function repeatQuestion() {
    setAnswer("");
    setEvaluation(null);
    setQuestionStartedAt(Date.now());
  }

  async function updateQuestionState(status: "mastered" | "needs_review" | "excluded") {
    if (!currentQuestion?.id) {
      setErrorMessage("Las marcas de avance solo están disponibles en práctica real.");
      return;
    }

    const response = await fetch(`/api/questions/${currentQuestion.id}/state`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        isExcluded: status === "excluded",
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setErrorMessage(payload?.error ?? "No se pudo actualizar el estado de la pregunta.");
      return;
    }

    setErrorMessage(status === "mastered"
      ? "Pregunta marcada como dominada."
      : status === "needs_review"
        ? "Pregunta marcada para repaso."
        : "Pregunta excluida del rotatorio.");
  }

  return (
    <main className="practice-shell">
      <aside className="practice-sidebar">
        <Link className="back-link" href="/">← Volver al inicio</Link>
        <h1>Práctica por texto</h1>
        <p>
          Fase 5 conecta la práctica real con Supabase: sesiones, intentos y progreso.
          El modo demo queda disponible para probar sin iniciar sesión.
        </p>

        <div className="mode-switch" aria-label="Tipo de práctica">
          <button className={practiceSource === "real" ? "active" : ""} onClick={() => setPracticeSource("real")}>Real</button>
          <button className={practiceSource === "demo" ? "active" : ""} onClick={() => setPracticeSource("demo")}>Demo</button>
        </div>

        {errorMessage && (
          <div className="notice-card">
            <p>{errorMessage}</p>
            {practiceSource === "real" && errorMessage.includes("iniciar sesión") && (
              <Link className="notice-link" href="/auth/login">Iniciar sesión</Link>
            )}
          </div>
        )}

        <div className="filter-stack">
          <label>
            Modo
            <select value={practiceMode} onChange={(event) => setPracticeMode(event.target.value as PracticeMode)} disabled={practiceSource === "demo"}>
              {Object.entries(practiceModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Área
            <select value={filters.area} onChange={(event) => setFilters((state) => ({ ...state, area: event.target.value }))}>
              <option value="">Todas</option>
              {data?.facets.areas.map((area) => <option key={area}>{area}</option>)}
            </select>
          </label>
          <label>
            Profesor
            <select value={filters.professor} onChange={(event) => setFilters((state) => ({ ...state, professor: event.target.value }))}>
              <option value="">Todos</option>
              {data?.facets.professors.map((professor) => <option key={professor}>{professor}</option>)}
            </select>
          </label>
          <label>
            Dificultad
            <select value={filters.difficulty} onChange={(event) => setFilters((state) => ({ ...state, difficulty: event.target.value }))}>
              <option value="">Todas</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="low">Baja</option>
            </select>
          </label>
        </div>
      </aside>

      <section className="practice-main">
        {isLoading && <div className="practice-card-large">Cargando preguntas...</div>}

        {!isLoading && !currentQuestion && (
          <div className="practice-card-large">
            No hay preguntas para estos filtros. Probá con otro modo o sacá algún filtro.
          </div>
        )}

        {!isLoading && currentQuestion && (
          <>
            <div className="practice-status">
              <span>
                {data?.mode === "real" ? "Sesión real" : "Modo demo"} · Pregunta {currentIndex + 1} de {data?.questions.length}
                {data?.sessionId ? ` · sesión ${data.sessionId.slice(0, 8)}` : ""}
              </span>
              <div className="practice-progress"><span style={{ width: `${progress}%` }} /></div>
            </div>

            <article className="practice-card-large question-panel">
              <div className="question-meta">
                <span>{currentQuestion.areaName}</span>
                <span>{currentQuestion.professorName}</span>
                <span>{currentQuestion.difficulty === "high" ? "Alta" : currentQuestion.difficulty === "medium" ? "Media" : "Baja"}</span>
                <span>{currentQuestion.estimatedProbability}% prob.</span>
                {practiceSource === "real" && <span>{currentQuestion.attemptCount ?? 0} intentos</span>}
              </div>
              <h2>{currentQuestion.statement}</h2>
              <p>{currentQuestion.subsubjectName}</p>
            </article>

            <article className="practice-card-large answer-panel">
              <label>
                Tu respuesta
                <textarea
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Respondé como si estuvieras frente a la comisión: define, desarrolla, aplica y cerrá con orden."
                />
              </label>
              <div className="practice-actions">
                <button onClick={submitAnswer} disabled={isEvaluating || !answer.trim()}>
                  {isEvaluating ? "Evaluando..." : practiceSource === "real" ? "Evaluar y guardar intento" : "Enviar respuesta demo"}
                </button>
                <button className="secondary" onClick={repeatQuestion}>Repetir</button>
                <button className="secondary" onClick={nextQuestion}>Siguiente</button>
              </div>
              {practiceSource === "real" && (
                <div className="practice-actions compact">
                  <button className="secondary" onClick={() => updateQuestionState("mastered")}>Marcar dominada</button>
                  <button className="secondary" onClick={() => updateQuestionState("needs_review")}>Mandar a repaso</button>
                  <button className="secondary danger" onClick={() => updateQuestionState("excluded")}>Excluir</button>
                </div>
              )}
            </article>

            {evaluation && (
              <article className="practice-card-large evaluation-panel">
                <div className="evaluation-header">
                  <div>
                    <span>{practiceSource === "real" ? "Resultado guardado" : "Resultado demo"}</span>
                    <h3>{evaluation.evaluation.percentage}%</h3>
                  </div>
                  <strong>{evaluation.evaluation.totalScore} / 40 puntos</strong>
                </div>
                <p>{evaluation.evaluation.summary}</p>

                <div className="rubric-grid">
                  {Object.entries(evaluation.evaluation.rubric).map(([key, value]) => (
                    <div className="rubric-box" key={key}>
                      <span>{rubricLabels[key]}</span>
                      <strong>{value.score}/10 · {value.level}</strong>
                      <p>{value.feedback}</p>
                    </div>
                  ))}
                </div>

                <div className="feedback-columns">
                  <div>
                    <h4>Puntos correctos</h4>
                    {evaluation.evaluation.correctKeyPoints.length > 0
                      ? <ul>{evaluation.evaluation.correctKeyPoints.map((point) => <li key={point}>{point}</li>)}</ul>
                      : <p>No se detectaron puntos clave suficientes.</p>}
                  </div>
                  <div>
                    <h4>Puntos faltantes</h4>
                    {evaluation.evaluation.missingKeyPoints.length > 0
                      ? <ul>{evaluation.evaluation.missingKeyPoints.map((point) => <li key={point}>{point}</li>)}</ul>
                      : <p>No quedan puntos relevantes pendientes en esta pauta inicial.</p>}
                  </div>
                </div>

                <details>
                  <summary>Ver respuesta modelo inicial</summary>
                  <p>{evaluation.evaluation.modelAnswer}</p>
                </details>
                {evaluation.note && <small>{evaluation.note}</small>}
              </article>
            )}
          </>
        )}
      </section>
    </main>
  );
}
