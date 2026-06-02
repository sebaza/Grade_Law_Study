"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "./sidebar";

type HomeStats = {
  summary: {
    totalQuestions: number;
    practiced: number;
    mastered: number;
    needsReview: number;
    averageScore: number;
  };
  bySubject: Array<{ label: string; averageScore: number; attempts: number }>;
};

type HomeHistory = {
  attempts: Array<{
    id: string;
    score: number;
    postStatus: string;
    question: {
      statement: string;
      areaName: string;
      professorName: string;
    };
  }>;
};

const quickPracticeModes = [
  { label: "Por materia", value: "by_subject" },
  { label: "Por profesor", value: "by_professor" },
  { label: "Aleatorio", value: "random" },
] as const;

const quickDifficulties = [
  { label: "Todas", value: "" },
  { label: "Media", value: "medium" },
  { label: "Alta", value: "high" },
] as const;

const quickAreas = ["Derecho Procesal", "Derecho Civil", "Derecho Constitucional"];

const defaultWeakSubjects = [
  { name: "Actos procesales", area: "Derecho Procesal", progress: 42 },
  { name: "Bienes y derechos reales", area: "Derecho Civil", progress: 48 },
  { name: "Bases de la institucionalidad", area: "Derecho Constitucional", progress: 56 },
];

const defaultRecentAttempts = [
  { id: "1", subject: "Derecho Procesal - Actos procesales", professor: "Felipe Ortiz", score: "Pendiente", scoreClass: "warn" },
  { id: "2", subject: "Derecho Civil - Bienes", professor: "Stephanie Merlet", score: "Pendiente", scoreClass: "warn" },
  { id: "3", subject: "Derecho Constitucional", professor: "Mauricio Figueroa", score: "Pendiente", scoreClass: "warn" },
];

function scorePillClass(score: number) {
  if (score >= 85) return "strong";
  if (score >= 60) return "warn";
  return "danger";
}

function KpiSkeleton() {
  return (
    <article className="card kpi">
      <div className="skeleton" style={{ height: 14, width: "60%", marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 42, width: "40%", marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 12, width: "80%", marginBottom: 20 }} />
      <div className="skeleton" style={{ height: 14, width: "50%", marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }} />
    </article>
  );
}

export default function HomePage() {
  const [quickMode, setQuickMode] = useState<(typeof quickPracticeModes)[number]["value"]>("by_subject");
  const [quickArea, setQuickArea] = useState(quickAreas[0]);
  const [quickDifficulty, setQuickDifficulty] = useState<(typeof quickDifficulties)[number]["value"]>("");
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [history, setHistory] = useState<HomeHistory | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/practice/stats")
        .then((res) => (res.ok ? (res.json() as Promise<HomeStats>) : null))
        .catch(() => null),
      fetch("/api/practice/history?limit=3")
        .then((res) => (res.ok ? (res.json() as Promise<HomeHistory>) : null))
        .catch(() => null),
    ]).then(([statsData, historyData]) => {
      if (statsData) setStats(statsData);
      if (historyData) setHistory(historyData);
      setStatsLoading(false);
    });
  }, []);

  const quickStartHref = useMemo(() => {
    const params = new URLSearchParams({ source: "real", mode: quickMode });
    if (quickMode === "by_subject") params.set("area", quickArea);
    if (quickDifficulty) params.set("difficulty", quickDifficulty);
    return `/practice?${params.toString()}`;
  }, [quickArea, quickDifficulty, quickMode]);

  const kpis = useMemo(
    () => [
      {
        label: "Preguntas disponibles",
        value: stats ? stats.summary.totalQuestions.toString() : "—",
        note: "base generada desde fuentes",
        link: "Ver banco",
        href: "/admin/questions",
      },
      {
        label: "Practicadas",
        value: stats ? stats.summary.practiced.toString() : "—",
        note: stats ? `de ${stats.summary.totalQuestions} en el banco` : "pendiente de iniciar",
        link: "Ir a practicar",
        href: "/practice",
      },
      {
        label: "Dominadas",
        value: stats ? stats.summary.mastered.toString() : "—",
        note: "según rúbrica institucional",
        link: "Ver estadísticas",
        href: "/history#estadisticas",
      },
      {
        label: "Para repaso",
        value: stats ? stats.summary.needsReview.toString() : "—",
        note: "se actualiza con desempeño",
        link: "Practicar repaso",
        href: "/practice?mode=review",
      },
    ],
    [stats],
  );

  const weakSubjects = useMemo(() => {
    if (!stats?.bySubject?.length) return defaultWeakSubjects;
    return stats.bySubject
      .slice()
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 3)
      .map((s) => ({ name: s.label, area: `${s.attempts} intentos`, progress: Math.round(s.averageScore) }));
  }, [stats]);

  const recentAttempts = useMemo(() => {
    if (!history?.attempts?.length) return defaultRecentAttempts;
    return history.attempts.map((a) => ({
      id: a.id,
      subject: a.question.statement.length > 55
        ? `${a.question.statement.slice(0, 55)}...`
        : a.question.statement,
      professor: a.question.professorName,
      score: a.score > 0 ? `${a.score}%` : "Pendiente",
      scoreClass: a.score > 0 ? scorePillClass(a.score) : "warn",
    }));
  }, [history]);

  const rubricScore = stats?.summary.averageScore ?? 0;

  return (
    <main className="app-shell">
      <AppSidebar />

      <section className="main">
        <header className="topbar">
          <div>
            <h2>Buen día, futura abogada.</h2>
            <p>Practicá con preguntas ponderadas por profesor, materia y probabilidad de aparición.</p>
          </div>
          <div className="date-pill">Entrenamiento activo</div>
        </header>

        <section className="kpi-grid" aria-label="Resumen de avance">
          {statsLoading
            ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
            : kpis.map((kpi) => (
                <article className="card kpi" key={kpi.label}>
                  <p className="kpi-label">{kpi.label}</p>
                  <p className="kpi-value">{kpi.value}</p>
                  <p className="kpi-note">{kpi.note}</p>
                  <Link className="kpi-link" href={kpi.href}>
                    {kpi.link} →
                  </Link>
                </article>
              ))}
        </section>

        <section className="dashboard-grid">
          <div>
            <article className="card practice-card">
              <div className="practice-visual">
                <div>
                  <div className="icon-circle" style={{ margin: "0 auto 18px" }}>🎓</div>
                  <strong>Empezar práctica</strong>
                  <p>Simulá el examen oral y mejorá con cada intento.</p>
                </div>
              </div>
              <div className="practice-controls">
                <strong>¿Cómo querés practicar?</strong>
                <div className="segmented" role="group" aria-label="Modo de práctica rápida">
                  {quickPracticeModes.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      className={quickMode === mode.value ? "active" : ""}
                      onClick={() => setQuickMode(mode.value)}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <label>
                  Seleccioná una materia
                  <select
                    className="select-like native-select"
                    value={quickArea}
                    onChange={(event) => setQuickArea(event.target.value)}
                    disabled={quickMode !== "by_subject"}
                  >
                    {quickAreas.map((area) => (
                      <option key={area}>{area}</option>
                    ))}
                  </select>
                </label>
                <div className="segmented" role="group" aria-label="Dificultad de práctica rápida">
                  {quickDifficulties.map((difficulty) => (
                    <button
                      key={difficulty.label}
                      type="button"
                      className={quickDifficulty === difficulty.value ? "active" : ""}
                      onClick={() => setQuickDifficulty(difficulty.value)}
                    >
                      {difficulty.label}
                    </button>
                  ))}
                </div>
                <Link className="primary-button" href={quickStartHref}>
                  ▶ Comenzar práctica
                </Link>
              </div>
            </article>

            <article className="card panel attempts-card">
              <h3>Intentos recientes</h3>
              <div className="attempt-list">
                {recentAttempts.map((attempt) => (
                  <div className="attempt-row" key={attempt.id}>
                    <div className="icon-circle">📖</div>
                    <div>
                      <strong>{attempt.subject}</strong>
                      <br />
                      <span>{attempt.professor}</span>
                    </div>
                    <span className={`score-pill ${attempt.scoreClass}`}>{attempt.score}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div>
            <article className="card panel">
              <h3>Materias prioritarias</h3>
              <div className="weak-list">
                {weakSubjects.map((subject) => (
                  <div className="weak-row" key={subject.name}>
                    <div className="icon-circle">⚖</div>
                    <div>
                      <strong>{subject.name}</strong>
                      <br />
                      <span>{subject.area}</span>
                      <div className="progress-bar">
                        <span style={{ width: `${subject.progress}%` }} />
                      </div>
                    </div>
                    <strong>{subject.progress}%</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="card panel rubric-card">
              <h3>Desglose por rúbrica</h3>
              <div className="rubric-layout">
                <div className="score-ring">
                  <strong>{Math.round(rubricScore)}</strong>
                </div>
                <div className="rubric-list">
                  <div className="rubric-item">
                    <span>Normas jurídicas aplicables</span>
                    <strong>0 / 10</strong>
                  </div>
                  <div className="rubric-item">
                    <span>Conceptos técnico-jurídicos</span>
                    <strong>0 / 10</strong>
                  </div>
                  <div className="rubric-item">
                    <span>Aplicación práctica</span>
                    <strong>0 / 10</strong>
                  </div>
                  <div className="rubric-item">
                    <span>Fundamentación y orden</span>
                    <strong>0 / 10</strong>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
