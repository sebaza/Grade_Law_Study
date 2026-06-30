"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "./sidebar";

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
};

type HomeHistory = {
  attempts: Array<{
    id: string;
    createdAt: string;
    score: number;
    question: {
      id: string;
      statement: string;
      areaName: string;
      subjectName: string;
      professorName: string;
      state: { status: string; attemptCount: number; bestScore: number; averageScore: number; isExcluded: boolean } | null;
    };
  }>;
};

function scoreTone(score: number) {
  if (score >= 85) return "strong";
  if (score >= 60) return "warn";
  return "danger";
}

function formatDuration(seconds: number) {
  if (!seconds) return "0 min";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours <= 0) return `${minutes} min`;
  return `${hours}h ${minutes}m`;
}

function compactStatement(statement: string, limit = 110) {
  return statement.length > limit ? `${statement.slice(0, limit)}...` : statement;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short" }).format(new Date(value));
}

function EmptyMetric({ children }: { children: React.ReactNode }) {
  return <p className="muted-copy">{children}</p>;
}

export default function HomePage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [history, setHistory] = useState<HomeHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      setIsLoading(true);
      setErrorMessage("");

      const [statsResponse, historyResponse] = await Promise.all([
        fetch("/api/practice/stats", { signal: controller.signal }),
        fetch("/api/practice/history?limit=6", { signal: controller.signal }),
      ]);

      if (statsResponse.status === 401 || historyResponse.status === 401) {
        setErrorMessage("Iniciá sesión para ver tu avance.");
        setIsLoading(false);
        return;
      }

      if (!statsResponse.ok || !historyResponse.ok) {
        setErrorMessage("No se pudo cargar tu tablero de estudio.");
        setIsLoading(false);
        return;
      }

      setStats(await statsResponse.json() as StatsResponse);
      setHistory(await historyResponse.json() as HomeHistory);
      setIsLoading(false);
    }

    loadDashboard().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setErrorMessage(error instanceof Error ? error.message : "Error inesperado al cargar inicio.");
      setIsLoading(false);
    });

    return () => controller.abort();
  }, []);

  const weakSubjects = useMemo(
    () => stats?.bySubject.slice().sort((a, b) => a.averageScore - b.averageScore) ?? [],
    [stats],
  );
  const strongSubjects = useMemo(
    () => stats?.bySubject.slice().sort((a, b) => b.averageScore - a.averageScore) ?? [],
    [stats],
  );
  const maxTimelineAttempts = Math.max(...(stats?.scoreTimeline.map((point) => point.attempts) ?? [1]), 1);

  return (
    <main className="app-shell home-dashboard-shell">
      <AppSidebar />

      <section className="main home-main-dashboard">
        <header className="home-compact-header">
          <div>
            <p className="eyebrow">Inicio</p>
            <h2>Resumen de estudio</h2>
          </div>
          <div className="hero-action-stack">
            <Link className="primary-button" href="/practice">Practicar ahora</Link>
            <Link className="secondary-button" href="/questions">Explorar banco</Link>
          </div>
        </header>

        {isLoading && <section className="practice-card-large">Cargando tablero...</section>}

        {!isLoading && errorMessage && (
          <section className="practice-card-large empty-state">
            <h2>{errorMessage}</h2>
            <div className="inline-actions">
              <Link className="primary-button" href="/auth/login">Iniciar sesión</Link>
              <Link className="secondary-button" href="/questions">Ver banco</Link>
            </div>
          </section>
        )}

        {!isLoading && stats && history && (
          <>
            <section className="history-kpi-grid home-kpi-grid">
              <article className="card kpi">
                <p className="kpi-label">Promedio general</p>
                <p className="kpi-value">{stats.summary.averageScore}%</p>
                <p className="kpi-note">{stats.summary.attemptCount} intentos</p>
              </article>
              <article className="card kpi">
                <p className="kpi-label">Tiempo de estudio</p>
                <p className="kpi-value">{formatDuration(stats.summary.totalTimeSeconds)}</p>
                <p className="kpi-note">{stats.summary.sessionCount} sesiones</p>
              </article>
              <article className="card kpi">
                <p className="kpi-label">Preguntas practicadas</p>
                <p className="kpi-value">{stats.summary.practiced}</p>
                <p className="kpi-note">{stats.summary.attemptCount} respuestas</p>
              </article>
              <article className="card kpi">
                <p className="kpi-label">Dominadas</p>
                <p className="kpi-value">{stats.summary.mastered}</p>
                <p className="kpi-note">{stats.summary.needsReview} para repaso</p>
              </article>
            </section>

            <section className="dashboard-analytics-grid home-focus-grid">
              <article className="practice-card-large wide-panel">
                <div className="section-heading-row">
                  <h2>Uso por día</h2>
                  <Link className="secondary-button" href="/history">Ver historial</Link>
                </div>
                {stats.scoreTimeline.length > 0 ? (
                  <div className="usage-chart">
                    {stats.scoreTimeline.map((point) => (
                      <div className="usage-day" key={point.day}>
                        <span className="usage-score" style={{ height: `${Math.max(point.averageScore, 6)}%` }} />
                        <span className="usage-attempts" style={{ height: `${Math.max((point.attempts / maxTimelineAttempts) * 100, 8)}%` }} />
                        <small>{shortDate(point.day)}</small>
                      </div>
                    ))}
                  </div>
                ) : <EmptyMetric>Todavía no hay intentos suficientes.</EmptyMetric>}
              </article>

              <article className="practice-card-large compact-panel">
                <h2>Promedio por ramo</h2>
                <div className="ranking-list roomy-list">
                  {stats.byArea.length > 0 ? stats.byArea.map((area) => (
                    <div className="ranking-row" key={area.label}>
                      <span>{area.label}</span>
                      <strong>{area.averageScore}%</strong>
                      <small>{area.attempts} intentos</small>
                    </div>
                  )) : <EmptyMetric>Sin intentos por ramo.</EmptyMetric>}
                </div>
              </article>

              <article className="practice-card-large tall-panel compact-panel">
                <h2>Materias débiles</h2>
                <div className="ranking-list roomy-list">
                  {weakSubjects.length > 0 ? weakSubjects.map((subject) => (
                    <div className="ranking-row weakness-row" key={subject.label}>
                      <span>{subject.label}</span>
                      <strong>{subject.averageScore}%</strong>
                      <small>{subject.attempts} intentos</small>
                    </div>
                  )) : <EmptyMetric>Sin datos todavía.</EmptyMetric>}
                </div>
              </article>

              <article className="practice-card-large tall-panel compact-panel">
                <h2>Materias fuertes</h2>
                <div className="ranking-list roomy-list">
                  {strongSubjects.length > 0 ? strongSubjects.map((subject) => (
                    <div className="ranking-row strength-row" key={subject.label}>
                      <span>{subject.label}</span>
                      <strong>{subject.averageScore}%</strong>
                      <small>{subject.attempts} intentos</small>
                    </div>
                  )) : <EmptyMetric>Sin datos todavía.</EmptyMetric>}
                </div>
              </article>

              <article className="practice-card-large compact-panel">
                <h2>Promedio por profesor</h2>
                <div className="ranking-list roomy-list">
                  {stats.byProfessor.length > 0 ? stats.byProfessor.map((professor) => (
                    <div className="ranking-row" key={professor.label}>
                      <span>{professor.label}</span>
                      <strong>{professor.averageScore}%</strong>
                      <small>{professor.attempts} intentos</small>
                    </div>
                  )) : <EmptyMetric>Sin intentos por profesor.</EmptyMetric>}
                </div>
              </article>

              <article className="practice-card-large compact-panel">
                <h2>Preguntas recientes</h2>
                <div className="attempt-history-list compact-attempts">
                  {history.attempts.length > 0 ? history.attempts.map((attempt) => (
                    <Link className="attempt-history-row clickable-attempt" href={`/practice?source=real&mode=random&questionId=${attempt.question.id}`} key={attempt.id}>
                      <div>
                        <strong>{compactStatement(attempt.question.statement)}</strong>
                        <p>{attempt.question.subjectName} ? {attempt.question.professorName}</p>
                      </div>
                      <span className={`score-pill ${scoreTone(attempt.score)}`}>{attempt.score}%</span>
                    </Link>
                  )) : <EmptyMetric>Sin intentos recientes.</EmptyMetric>}
                </div>
              </article>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
