"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StatsResponse = {
  summary: {
    totalQuestions: number;
    practiced: number;
    pending: number;
    mastered: number;
    needsReview: number;
    excluded: number;
    answered: number;
    inPractice: number;
    attemptCount: number;
    sessionCount: number;
    averageScore: number;
    totalTimeSeconds: number;
    progressPercentage: number;
  };
  scoreTimeline: Array<{ day: string; averageScore: number; attempts: number }>;
  bySubject: Array<{ label: string; averageScore: number; attempts: number }>;
  byArea: Array<{ label: string; averageScore: number; attempts: number }>;
  byProfessor: Array<{ label: string; averageScore: number; attempts: number }>;
  difficultQuestions: Array<{ questionId: string; statement: string; subject: string; averageScore: number; attempts: number }>;
  recentSessions: Array<{
    id: string;
    mode: string;
    startedAt: string;
    totalQuestions: number;
    averageScore: number;
    totalTimeSeconds: number;
    attemptCount: number;
  }>;
};

type HistoryResponse = {
  attempts: Array<{
    id: string;
    sessionId: string | null;
    createdAt: string;
    answerMode: "text" | "voice";
    score: number;
    timeSeconds: number;
    postStatus: string;
    hasTranscription: boolean;
    question: {
      statement: string;
      areaName: string;
      subjectName: string;
      professorName: string;
      difficulty: "low" | "medium" | "high";
      estimatedProbability: number;
    };
    feedback: {
      summary: string;
      improvementSuggestions: string | null;
    } | null;
  }>;
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

export default function HistoryPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setErrorMessage("");

      const [statsResponse, historyResponse] = await Promise.all([
        fetch("/api/practice/stats", { signal: controller.signal }),
        fetch("/api/practice/history?limit=30", { signal: controller.signal }),
      ]);

      if (statsResponse.status === 401 || historyResponse.status === 401) {
        setErrorMessage("Para ver historial y estadísticas tenés que iniciar sesión.");
        setIsLoading(false);
        return;
      }

      if (!statsResponse.ok || !historyResponse.ok) {
        setErrorMessage("No se pudo cargar el historial.");
        setIsLoading(false);
        return;
      }

      setStats(await statsResponse.json() as StatsResponse);
      setHistory(await historyResponse.json() as HistoryResponse);
      setIsLoading(false);
    }

    load().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setErrorMessage(error instanceof Error ? error.message : "Error inesperado al cargar historial.");
      setIsLoading(false);
    });

    return () => controller.abort();
  }, []);

  const strongestSubjects = useMemo(() => stats?.bySubject.slice(0, 4) ?? [], [stats]);
  const weakSubjects = useMemo(() => stats?.bySubject.slice().sort((a, b) => a.averageScore - b.averageScore).slice(0, 4) ?? [], [stats]);

  return (
    <main className="history-shell">
      <header className="history-hero">
        <div>
          <Link className="back-link" href="/">← Volver al inicio</Link>
          <h1>Historial y estadísticas</h1>
          <p>Seguimiento real de sesiones, intentos, materias débiles y evolución de desempeño.</p>
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

      {!isLoading && stats && history && (
        <>
          <section className="history-kpi-grid">
            <article className="card kpi">
              <p className="kpi-label">Avance general</p>
              <p className="kpi-value">{stats.summary.progressPercentage}%</p>
              <p className="kpi-note">{stats.summary.practiced} de {stats.summary.totalQuestions} preguntas practicadas</p>
            </article>
            <article className="card kpi">
              <p className="kpi-label">Promedio</p>
              <p className="kpi-value">{stats.summary.averageScore}%</p>
              <p className="kpi-note">{stats.summary.attemptCount} intentos registrados</p>
            </article>
            <article className="card kpi">
              <p className="kpi-label">Dominadas</p>
              <p className="kpi-value">{stats.summary.mastered}</p>
              <p className="kpi-note">{stats.summary.needsReview} necesitan repaso</p>
            </article>
            <article className="card kpi">
              <p className="kpi-label">Tiempo de estudio</p>
              <p className="kpi-value">{Math.round(stats.summary.totalTimeSeconds / 60)}</p>
              <p className="kpi-note">minutos en {stats.summary.sessionCount} sesiones</p>
            </article>
          </section>

          <section className="history-grid">
            <article className="practice-card-large">
              <h2>Evolución de acierto</h2>
              {stats.scoreTimeline.length > 0 ? (
                <div className="timeline-chart">
                  {stats.scoreTimeline.map((point) => (
                    <div className="timeline-bar" key={point.day}>
                      <span style={{ height: `${Math.max(point.averageScore, 4)}%` }} />
                      <small>{point.averageScore}%</small>
                    </div>
                  ))}
                </div>
              ) : <p className="muted-copy">Todavía no hay intentos suficientes para graficar evolución.</p>}
            </article>

            <article className="practice-card-large">
              <h2>Materias débiles</h2>
              <div className="ranking-list">
                {weakSubjects.length > 0 ? weakSubjects.map((subject) => (
                  <div className="ranking-row" key={subject.label}>
                    <span>{subject.label}</span>
                    <strong>{subject.averageScore}%</strong>
                    <small>{subject.attempts} intentos</small>
                  </div>
                )) : <p className="muted-copy">Aún no hay materias con intentos.</p>}
              </div>
            </article>

            <article className="practice-card-large">
              <h2>Materias fuertes</h2>
              <div className="ranking-list">
                {strongestSubjects.length > 0 ? strongestSubjects.map((subject) => (
                  <div className="ranking-row" key={subject.label}>
                    <span>{subject.label}</span>
                    <strong>{subject.averageScore}%</strong>
                    <small>{subject.attempts} intentos</small>
                  </div>
                )) : <p className="muted-copy">Todavía no hay datos para comparar.</p>}
              </div>
            </article>

            <article className="practice-card-large">
              <h2>Promedio por profesor</h2>
              <div className="ranking-list">
                {stats.byProfessor.length > 0 ? stats.byProfessor.slice(0, 6).map((professor) => (
                  <div className="ranking-row" key={professor.label}>
                    <span>{professor.label}</span>
                    <strong>{professor.averageScore}%</strong>
                    <small>{professor.attempts} intentos</small>
                  </div>
                )) : <p className="muted-copy">Sin intentos asociados a profesores todavía.</p>}
              </div>
            </article>
          </section>

          <section className="practice-card-large">
            <h2>Preguntas con más errores</h2>
            <div className="question-risk-list">
              {stats.difficultQuestions.length > 0 ? stats.difficultQuestions.map((question) => (
                <article className="question-risk-row" key={question.questionId}>
                  <div>
                    <strong>{question.statement}</strong>
                    <p>{question.subject} · {question.attempts} intentos</p>
                  </div>
                  <span className={`score-pill ${scoreTone(question.averageScore)}`}>{question.averageScore}%</span>
                </article>
              )) : <p className="muted-copy">Cuando existan intentos, acá aparecerán las preguntas más difíciles.</p>}
            </div>
          </section>

          <section className="practice-card-large">
            <h2>Intentos recientes</h2>
            <div className="attempt-history-list">
              {history.attempts.length > 0 ? history.attempts.map((attempt) => (
                <article className="attempt-history-row" key={attempt.id}>
                  <div>
                    <div className="question-meta">
                      <span>{attempt.question.areaName}</span>
                      <span>{attempt.question.professorName}</span>
                      <span>{attempt.answerMode === "voice" ? "Voz" : "Texto"}</span>
                      <span>{formatDuration(attempt.timeSeconds)}</span>
                    </div>
                    <strong>{attempt.question.statement}</strong>
                    <p>{attempt.feedback?.summary ?? "Sin feedback guardado."}</p>
                    <small>{formatDate(attempt.createdAt)}</small>
                  </div>
                  <span className={`score-pill ${scoreTone(attempt.score)}`}>{attempt.score}%</span>
                </article>
              )) : <p className="muted-copy">Todavía no hay intentos guardados.</p>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
