"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppTopNav } from "../app-top-nav";

type HistoryResponse = {
  attempts: Array<{
    id: string;
    sessionId: string | null;
    createdAt: string;
    answerMode: "text" | "voice";
    rawAnswer: string | null;
    transcription: string | null;
    score: number;
    timeSeconds: number;
    postStatus: string;
    hasTranscription: boolean;
    question: {
      id: string;
      statement: string;
      areaName: string;
      subjectName: string;
      subsubjectName: string;
      professorName: string;
      difficulty: "low" | "medium" | "high";
      estimatedProbability: number;
      state: {
        status: string;
        attemptCount: number;
        bestScore: number;
        averageScore: number;
        isExcluded: boolean;
      } | null;
    };
    feedback: {
      summary: string;
      improvementSuggestions: string | null;
      modelAnswerSuggested?: string | null;
    } | null;
  }>;
};

const statusLabels: Record<string, string> = {
  pending: "Inicial",
  in_practice: "En práctica",
  answered: "Practicada",
  mastered: "Dominada",
  needs_review: "Repaso",
  excluded: "Excluida",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  if (!seconds) return "0 min";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes <= 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

function scoreTone(score: number) {
  if (score >= 85) return "strong";
  if (score >= 60) return "warn";
  return "danger";
}

function compactAnswer(answer: string | null) {
  if (!answer) return "Sin respuesta guardada.";
  return answer.length > 260 ? `${answer.slice(0, 260)}...` : answer;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [pendingQuestionId, setPendingQuestionId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/practice/history?limit=100", { signal: controller.signal });

      if (response.status === 401) {
        setErrorMessage("Para ver historial tenés que iniciar sesión.");
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        setErrorMessage("No se pudo cargar el historial.");
        setIsLoading(false);
        return;
      }

      setHistory(await response.json() as HistoryResponse);
      setIsLoading(false);
    }

    loadHistory().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setErrorMessage(error instanceof Error ? error.message : "Error inesperado al cargar historial.");
      setIsLoading(false);
    });

    return () => controller.abort();
  }, []);

  const uniqueQuestions = useMemo(() => {
    const byQuestion = new Map<string, HistoryResponse["attempts"][number]>();
    history?.attempts.forEach((attempt) => {
      const existing = byQuestion.get(attempt.question.id);
      if (!existing || new Date(attempt.createdAt) > new Date(existing.createdAt)) {
        byQuestion.set(attempt.question.id, attempt);
      }
    });
    return Array.from(byQuestion.values());
  }, [history]);

  const masteredQuestions = useMemo(
    () => uniqueQuestions.filter((attempt) => attempt.question.state?.status === "mastered"),
    [uniqueQuestions],
  );
  const practicedQuestions = useMemo(
    () => uniqueQuestions.filter((attempt) => (attempt.question.state?.attemptCount ?? 0) > 0),
    [uniqueQuestions],
  );

  async function returnToInitialPull(questionId: string) {
    setPendingQuestionId(questionId);
    setActionMessage("");

    const response = await fetch(`/api/questions/${questionId}/state`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending", isExcluded: false }),
    });

    if (!response.ok) {
      setActionMessage("No se pudo restaurar la pregunta.");
      setPendingQuestionId(null);
      return;
    }

    setHistory((current) => current
      ? {
          attempts: current.attempts.map((attempt) => attempt.question.id === questionId
            ? {
                ...attempt,
                question: {
                  ...attempt.question,
                  state: {
                    ...(attempt.question.state ?? { attemptCount: 0, bestScore: 0, averageScore: 0, isExcluded: false }),
                    status: "pending",
                    isExcluded: false,
                  },
                },
              }
            : attempt),
        }
      : current);
    setActionMessage("Pregunta restaurada.");
    setPendingQuestionId(null);
  }

  return (
    <main className="menu-page-shell history-student-shell">
      <AppTopNav />

      <header className="page-hero compact-hero">
        <div>
          <p className="eyebrow">Historial</p>
          <h1>Historial de práctica</h1>
        </div>
        <Link className="primary-button" href="/practice">Practicar ahora</Link>
      </header>

      {isLoading && <section className="practice-card-large">Cargando historial...</section>}

      {!isLoading && errorMessage && (
        <section className="practice-card-large empty-state">
          <h2>{errorMessage}</h2>
          <p>El historial pertenece a una estudiante autenticada. Sin login no hay progreso que proteger.</p>
          <Link className="primary-button" href="/auth/login">Iniciar sesión</Link>
        </section>
      )}

      {!isLoading && history && (
        <>
          <section className="history-kpi-grid">
            <article className="card kpi">
              <p className="kpi-label">Intentos registrados</p>
              <p className="kpi-value">{history.attempts.length}</p>
              <p className="kpi-note">respuestas guardadas</p>
            </article>
            <article className="card kpi">
              <p className="kpi-label">Preguntas practicadas</p>
              <p className="kpi-value">{practicedQuestions.length}</p>
              <p className="kpi-note">preguntas únicas con intentos</p>
            </article>
            <article className="card kpi">
              <p className="kpi-label">Dominadas</p>
              <p className="kpi-value">{masteredQuestions.length}</p>
              <p className="kpi-note">según estado actual</p>
            </article>
            <article className="card kpi">
              <p className="kpi-label">Última actividad</p>
              <p className="kpi-value small-kpi-value">{history.attempts[0] ? formatDate(history.attempts[0].createdAt) : "—"}</p>
              <p className="kpi-note">último intento guardado</p>
            </article>
          </section>

          {actionMessage && <p className="form-message success">{actionMessage}</p>}

          <section className="history-grid">
            <article className="practice-card-large">
              <h2>Preguntas dominadas</h2>
              <div className="question-risk-list">
                {masteredQuestions.length > 0 ? masteredQuestions.map((attempt) => (
                  <article className="question-risk-row" key={attempt.question.id}>
                    <div>
                      <strong>{attempt.question.statement}</strong>
                      <p>{attempt.question.subjectName} · mejor {attempt.question.state?.bestScore ?? 0}% · {attempt.question.state?.attemptCount ?? 0} intentos</p>
                    </div>
                    <Link className="secondary-button" href={`/practice?source=real&mode=random&questionId=${attempt.question.id}`}>Reintentar</Link>
                  </article>
                )) : <p className="muted-copy">Todavía no marcaste preguntas como dominadas.</p>}
              </div>
            </article>

            <article className="practice-card-large">
              <h2>Preguntas practicadas</h2>
              <div className="question-risk-list">
                {practicedQuestions.length > 0 ? practicedQuestions.slice(0, 12).map((attempt) => (
                  <article className="question-risk-row" key={attempt.question.id}>
                    <div>
                      <strong>{attempt.question.statement}</strong>
                      <p>{statusLabels[attempt.question.state?.status ?? "pending"] ?? attempt.question.state?.status} · promedio {Math.round(attempt.question.state?.averageScore ?? 0)}%</p>
                    </div>
                    <button className="secondary-button" type="button" disabled={pendingQuestionId === attempt.question.id} onClick={() => returnToInitialPull(attempt.question.id)}>
                      {pendingQuestionId === attempt.question.id ? "Moviendo..." : "Restaurar"}
                    </button>
                  </article>
                )) : <p className="muted-copy">Todavía no hay preguntas practicadas.</p>}
              </div>
            </article>
          </section>

          <section className="practice-card-large" id="historial">
            <h2>Intentos y respuestas</h2>
            <div className="attempt-history-list">
              {history.attempts.length > 0 ? history.attempts.map((attempt) => (
                <article className="attempt-history-row rich-attempt-row" id={`question-${attempt.question.id}`} key={attempt.id}>
                  <div>
                    <div className="question-meta">
                      <span>{attempt.question.areaName}</span>
                      <span>{attempt.question.subjectName}</span>
                      <span>{attempt.question.professorName}</span>
                      <span>{attempt.answerMode === "voice" ? "Voz" : "Texto"}</span>
                      <span>{formatDuration(attempt.timeSeconds)}</span>
                    </div>
                    <Link className="history-question-link" href={`/practice?source=real&mode=random&questionId=${attempt.question.id}`}>
                      {attempt.question.statement}
                    </Link>
                    <div className="answer-review-box">
                      <strong>Tu respuesta</strong>
                      <p>{compactAnswer(attempt.transcription ?? attempt.rawAnswer)}</p>
                    </div>
                    <p>{attempt.feedback?.summary ?? "Sin feedback guardado."}</p>
                    {attempt.feedback?.improvementSuggestions && <small>Mejora sugerida: {attempt.feedback.improvementSuggestions}</small>}
                    <small>{formatDate(attempt.createdAt)} · {statusLabels[attempt.question.state?.status ?? attempt.postStatus] ?? attempt.postStatus}</small>
                  </div>
                  <div className="attempt-actions-stack">
                    <span className={`score-pill ${scoreTone(attempt.score)}`}>{attempt.score}%</span>
                    <Link className="secondary-button" href={`/practice?source=real&mode=random&questionId=${attempt.question.id}`}>Reintentar</Link>
                    <button className="secondary-button" type="button" disabled={pendingQuestionId === attempt.question.id} onClick={() => returnToInitialPull(attempt.question.id)}>
                      Restaurar
                    </button>
                  </div>
                </article>
              )) : <p className="muted-copy">Todavía no hay intentos guardados.</p>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
