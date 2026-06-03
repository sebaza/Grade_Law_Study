"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AdminStatsResponse = {
  admin: {
    email?: string;
    restrictedByEmail: boolean;
  };
  summary: {
    totalUsers: number;
    activeUsers: number;
    totalQuestions: number;
    activeQuestions: number;
    totalAttempts: number;
    totalSessions: number;
    averageScore: number;
    totalTimeSeconds: number;
    mastered: number;
    needsReview: number;
    excluded: number;
    answered: number;
  };
  users: Array<{
    id: string;
    fullName: string | null;
    email: string | null;
    attempts: number;
    sessions: number;
    averageScore: number;
    totalTimeSeconds: number;
    practicedQuestions: number;
    mastered: number;
    needsReview: number;
    lastAttemptAt: string | null;
  }>;
  scoreTimeline: Array<{ day: string; averageScore: number; attempts: number }>;
  byArea: Array<{ label: string; averageScore: number; attempts: number }>;
  bySubject: Array<{ label: string; averageScore: number; attempts: number }>;
  bySubsubject: Array<{ label: string; averageScore: number; attempts: number }>;
  byProfessor: Array<{ label: string; averageScore: number; attempts: number }>;
  byDifficulty: Array<{ label: string; averageScore: number; attempts: number }>;
  questionsByOrigin: Array<{ label: string; count: number }>;
  difficultQuestions: Array<{
    questionId: string;
    statement: string;
    area: string;
    subject: string;
    subsubject: string;
    averageScore: number;
    attempts: number;
  }>;
};

const difficultyLabels: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const originLabels: Record<string, string> = {
  generated: "Generadas",
  manual: "Manuales",
  real_question: "Preguntas reales",
};

function formatDate(value: string | null) {
  if (!value) return "Sin intentos";
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  if (!seconds) return "0 min";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours <= 0) return `${minutes} min`;
  return `${hours}h ${minutes}m`;
}

function scoreTone(score: number) {
  if (score >= 85) return "strong";
  if (score >= 60) return "warn";
  return "danger";
}

function compactStatement(statement: string) {
  return statement.length > 130 ? `${statement.slice(0, 130)}...` : statement;
}

function RankingChart({
  emptyText,
  items,
  labelMap = {},
  title,
}: {
  emptyText: string;
  items: Array<{ label: string; averageScore: number; attempts: number }>;
  labelMap?: Record<string, string>;
  title: string;
}) {
  const maxAttempts = Math.max(...items.map((item) => item.attempts), 1);

  return (
    <article className="practice-card-large admin-chart-card">
      <h2>{title}</h2>
      <div className="ranking-list">
        {items.length > 0 ? items.map((item) => (
          <div className="admin-chart-row" key={item.label}>
            <div>
              <strong>{labelMap[item.label] ?? item.label}</strong>
              <div className="progress-bar">
                <span style={{ width: `${Math.max((item.attempts / maxAttempts) * 100, 4)}%` }} />
              </div>
            </div>
            <span className={`score-pill ${scoreTone(item.averageScore)}`}>{item.averageScore}%</span>
            <small>{item.attempts} intentos</small>
          </div>
        )) : <p className="muted-copy">{emptyText}</p>}
      </div>
    </article>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadStats() {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/admin/stats", { signal: controller.signal });

      if (response.status === 401 || response.status === 403) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setErrorMessage(payload?.error ?? "Tenés que iniciar sesión como admin para ver el panel.");
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        setErrorMessage("No se pudieron cargar las estadísticas globales.");
        setIsLoading(false);
        return;
      }

      setStats(await response.json() as AdminStatsResponse);
      setIsLoading(false);
    }

    loadStats().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setErrorMessage(error instanceof Error ? error.message : "Error inesperado al cargar estadísticas.");
      setIsLoading(false);
    });

    return () => controller.abort();
  }, []);

  const weakestSubsubjects = useMemo(
    () => stats?.bySubsubject.slice().sort((a, b) => a.averageScore - b.averageScore).slice(0, 8) ?? [],
    [stats],
  );

  return (
    <main className="history-shell admin-dashboard-shell">
      <header className="history-hero">
        <div>
          <Link className="back-link" href="/">← Volver al inicio</Link>
          <p className="eyebrow">Panel admin · estadísticas globales</p>
          <h1>Uso real de la aplicación</h1>
          <p>
            Acá no miramos “sensaciones”: vemos usuarios, intentos, desempeño por área, materia,
            submateria del temario y preguntas que están haciendo daño.
          </p>
        </div>
        <div className="admin-hero-actions">
          <Link className="primary-button" href="/admin/questions">Administrar preguntas</Link>
          <Link className="secondary-button" href="/practice">Probar práctica</Link>
        </div>
      </header>

      {isLoading && <section className="practice-card-large">Cargando tablero admin...</section>}

      {!isLoading && errorMessage && (
        <section className="practice-card-large empty-state">
          <h2>{errorMessage}</h2>
          <p className="muted-copy">
            Si esperabas acceso admin, revisá `ADMIN_EMAILS`. Sin esa variable, el MVP trata a cualquier usuario autenticado como admin.
          </p>
          <Link className="primary-button" href="/auth/login">Iniciar sesión</Link>
        </section>
      )}

      {!isLoading && stats && (
        <>
          <section className="history-kpi-grid">
            <article className="card kpi">
              <p className="kpi-label">Usuarios</p>
              <p className="kpi-value">{stats.summary.totalUsers}</p>
              <p className="kpi-note">{stats.summary.activeUsers} con intentos registrados</p>
            </article>
            <article className="card kpi">
              <p className="kpi-label">Intentos</p>
              <p className="kpi-value">{stats.summary.totalAttempts}</p>
              <p className="kpi-note">{stats.summary.totalSessions} sesiones abiertas</p>
            </article>
            <article className="card kpi">
              <p className="kpi-label">Promedio global</p>
              <p className="kpi-value">{stats.summary.averageScore}%</p>
              <p className="kpi-note">{formatDuration(stats.summary.totalTimeSeconds)} de estudio acumulado</p>
            </article>
            <article className="card kpi">
              <p className="kpi-label">Banco activo</p>
              <p className="kpi-value">{stats.summary.activeQuestions}</p>
              <p className="kpi-note">{stats.summary.totalQuestions} preguntas totales</p>
            </article>
          </section>

          <section className="history-grid">
            <article className="practice-card-large">
              <h2>Evolución global</h2>
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

            <RankingChart
              emptyText="Sin intentos por área todavía."
              items={stats.byArea}
              title="Promedio por área"
            />

            <RankingChart
              emptyText="Sin intentos por materia todavía."
              items={stats.bySubject.slice(0, 8)}
              title="Promedio por materia"
            />

            <RankingChart
              emptyText="Sin intentos por submateria todavía."
              items={weakestSubsubjects}
              title="Submaterias más débiles"
            />

            <RankingChart
              emptyText="Sin intentos asociados a profesores todavía."
              items={stats.byProfessor.slice(0, 8)}
              title="Promedio por profesor"
            />

            <RankingChart
              emptyText="Sin intentos por dificultad todavía."
              items={stats.byDifficulty}
              labelMap={difficultyLabels}
              title="Dificultad"
            />
          </section>

          <section className="history-grid">
            <article className="practice-card-large">
              <h2>Origen del banco</h2>
              <div className="ranking-list">
                {stats.questionsByOrigin.map((origin) => (
                  <div className="ranking-row" key={origin.label}>
                    <span>{originLabels[origin.label] ?? origin.label}</span>
                    <strong>{origin.count}</strong>
                    <small>preguntas</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="practice-card-large">
              <h2>Usuarios con actividad</h2>
              <div className="attempt-history-list">
                {stats.users.length > 0 ? stats.users.map((user) => (
                  <article className="attempt-history-row" key={user.id}>
                    <div>
                      <strong>{user.fullName || user.email || `Usuario ${user.id.slice(0, 8)}`}</strong>
                      <p>
                        {user.practicedQuestions} preguntas practicadas · {user.mastered} dominadas · {user.needsReview} para repaso
                      </p>
                      <small>{formatDate(user.lastAttemptAt)} · {formatDuration(user.totalTimeSeconds)}</small>
                    </div>
                    <span className={`score-pill ${scoreTone(user.averageScore)}`}>{user.averageScore}%</span>
                  </article>
                )) : <p className="muted-copy">Todavía no hay usuarios registrados.</p>}
              </div>
            </article>
          </section>

          <section className="practice-card-large">
            <h2>Preguntas globalmente más difíciles</h2>
            <div className="question-risk-list">
              {stats.difficultQuestions.length > 0 ? stats.difficultQuestions.map((question) => (
                <article className="question-risk-row" key={question.questionId}>
                  <div>
                    <strong>{compactStatement(question.statement)}</strong>
                    <p>{question.area} · {question.subject} · {question.subsubject} · {question.attempts} intentos</p>
                  </div>
                  <span className={`score-pill ${scoreTone(question.averageScore)}`}>{question.averageScore}%</span>
                </article>
              )) : <p className="muted-copy">Cuando existan intentos, acá aparecen las preguntas donde los usuarios más tropiezan.</p>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
