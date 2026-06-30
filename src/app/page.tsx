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

type OverviewResponse = {
  totalQuestions: number;
  subjectCount: number;
  professorCount: number;
  areaCount: number;
  byArea: Array<{ id: string; name: string; questionCount: number }>;
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
  if (score >= 60) return "strong";
  if (score >= 40) return "warn";
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

function HomeSkeleton() {
  return (
    <div className="home-skeleton" aria-busy="true" aria-label="Cargando tu tablero">
      <div className="home-kpi-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="card kpi skeleton-kpi" key={index}>
            <span className="skeleton skel-line short" />
            <span className="skeleton skel-line value" />
            <span className="skeleton skel-line tiny" />
          </div>
        ))}
      </div>
      <div className="home-focus-grid">
        <div className="practice-card-large wide-panel skeleton-panel">
          <span className="skeleton skel-line short" />
          <span className="skeleton skel-block" />
        </div>
        {Array.from({ length: 2 }).map((_, index) => (
          <div className="practice-card-large skeleton-panel" key={index}>
            <span className="skeleton skel-line short" />
            <span className="skeleton skel-line" />
            <span className="skeleton skel-line" />
            <span className="skeleton skel-line" />
          </div>
        ))}
      </div>
    </div>
  );
}

const landingFeatures = [
  { title: "Practica como en la comisión", body: "Responde por escrito o por voz y recibe una nota con rúbrica al instante." },
  { title: "Simulacro cronometrado", body: "Arma una ronda de 3 materias con tiempo por pregunta y veredicto final." },
  { title: "Repreguntas de comisión", body: "Cuando una respuesta queda corta, el evaluador repregunta como en el examen real." },
  { title: "Sigues tu avance", body: "Promedios por ramo, materias débiles y preguntas dominadas, todo guardado." },
];

function HomeLanding({ overview }: { overview: OverviewResponse | null }) {
  return (
    <>
      <section className="landing-intro">
        <p>
          Banco de preguntas reales del examen de grado con corrección automática.
          Practica, mide tu nivel por ramo y llega listo a la comisión.
        </p>
        {overview && (
          <div className="landing-stat-row">
            <div><strong>{overview.totalQuestions}</strong><span>preguntas</span></div>
            <div><strong>{overview.areaCount}</strong><span>ramos</span></div>
            <div><strong>{overview.subjectCount}</strong><span>materias</span></div>
            <div><strong>{overview.professorCount}</strong><span>profesores</span></div>
          </div>
        )}
      </section>

      <section className="landing-feature-grid">
        {landingFeatures.map((feature) => (
          <article className="practice-card-large landing-feature" key={feature.title}>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="practice-card-large landing-areas">
        <div className="section-heading-row">
          <h2>Preguntas por ramo</h2>
          <Link className="secondary-button" href="/questions">Ver banco completo</Link>
        </div>
        {overview && overview.byArea.length > 0 ? (
          <div className="landing-area-list">
            {overview.byArea.map((area) => (
              <Link className="landing-area-row" href={`/questions?area=${encodeURIComponent(area.name)}`} key={area.id}>
                <span>{area.name}</span>
                <strong>{area.questionCount}</strong>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyMetric>Estamos cargando el banco de preguntas.</EmptyMetric>
        )}
      </section>
    </>
  );
}

export default function HomePage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [history, setHistory] = useState<HomeHistory | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);
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
        setLoggedOut(true);
        const overviewResponse = await fetch("/api/public/overview", { signal: controller.signal });
        if (overviewResponse.ok) {
          setOverview(await overviewResponse.json() as OverviewResponse);
        }
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
            <p className="eyebrow">{loggedOut ? "Examen de grado · Derecho" : "Inicio"}</p>
            <h2>{loggedOut ? "Prepara tu examen con práctica real" : "Resumen de estudio"}</h2>
          </div>
          <div className="hero-action-stack">
            {loggedOut ? (
              <>
                <Link className="primary-button" href="/auth/login">Iniciar sesión</Link>
                <Link className="secondary-button" href="/questions">Explorar banco</Link>
              </>
            ) : (
              <>
                <Link className="primary-button" href="/practice">Practicar ahora</Link>
                <Link className="secondary-button" href="/questions">Explorar banco</Link>
              </>
            )}
          </div>
        </header>

        {isLoading && <HomeSkeleton />}

        {!isLoading && errorMessage && (
          <section className="practice-card-large empty-state">
            <h2>{errorMessage}</h2>
            <div className="inline-actions">
              <Link className="primary-button" href="/auth/login">Iniciar sesión</Link>
              <Link className="secondary-button" href="/questions">Ver banco</Link>
            </div>
          </section>
        )}

        {!isLoading && loggedOut && !errorMessage && <HomeLanding overview={overview} />}

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
                        <p>{attempt.question.subjectName} · {attempt.question.professorName}</p>
                      </div>
                      <span className={`score-pill ${scoreTone(attempt.score)}`}>{attempt.score}%</span>
                    </Link>
                  )) : (
                    <div className="empty-state-inline">
                      <p className="muted-copy">Aún no registras intentos.</p>
                      <Link className="primary-button" href="/practice">Practicar ahora</Link>
                    </div>
                  )}
                </div>
              </article>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
