"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const kpis = [
  { label: "Preguntas disponibles", value: "100+", note: "base inicial generada desde fuentes", link: "Ver banco", href: "/admin/questions" },
  { label: "Practicadas", value: "0", note: "pendiente de iniciar", link: "Ir a practicar", href: "/practice" },
  { label: "Dominadas", value: "0", note: "según rúbrica institucional", link: "Ver estadísticas", href: "/history#estadisticas" },
  { label: "Para repaso", value: "0", note: "se actualiza con desempeño", link: "Practicar repaso", href: "/practice?mode=review" },
];

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

const weakSubjects = [
  { name: "Actos procesales", area: "Derecho Procesal", progress: 42 },
  { name: "Bienes y derechos reales", area: "Derecho Civil", progress: 48 },
  { name: "Bases de la institucionalidad", area: "Derecho Constitucional", progress: 56 },
];

const recentAttempts = [
  { subject: "Derecho Procesal - Actos procesales", professor: "Felipe Ortiz", score: "Pendiente" },
  { subject: "Derecho Civil - Bienes", professor: "Stephanie Merlet", score: "Pendiente" },
  { subject: "Derecho Constitucional", professor: "Mauricio Figueroa", score: "Pendiente" },
];

export default function HomePage() {
  const [quickMode, setQuickMode] = useState<(typeof quickPracticeModes)[number]["value"]>("by_subject");
  const [quickArea, setQuickArea] = useState(quickAreas[0]);
  const [quickDifficulty, setQuickDifficulty] = useState<(typeof quickDifficulties)[number]["value"]>("");

  const quickStartHref = useMemo(() => {
    const params = new URLSearchParams({ source: "real", mode: quickMode });

    if (quickMode === "by_subject") params.set("area", quickArea);
    if (quickDifficulty) params.set("difficulty", quickDifficulty);

    return `/practice?${params.toString()}`;
  }, [quickArea, quickDifficulty, quickMode]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">⚖</div>
          <div>
            <h1>Grado<br />Derecho</h1>
            <p>Preparate. Exponé. Aprobá.</p>
          </div>
        </div>

        <nav className="nav" aria-label="Navegación principal">
          <Link className="nav-item active" href="/">⌂ Inicio</Link>
          <Link className="nav-item" href="/admin/questions">☰ Banco</Link>
          <Link className="nav-item" href="/practice">▷ Practicar</Link>
          <Link className="nav-item" href="/exam">◉ Simulacro</Link>
          <Link className="nav-item" href="/history#historial">↺ Historial</Link>
          <Link className="nav-item" href="/history#estadisticas">▥ Estadísticas</Link>
          <Link className="nav-item" href="/auth/login">◇ Ingresar</Link>
        </nav>

        <div className="sidebar-footer">
          <div className="avatar">AV</div>
          <div>
            <strong>Estudiante</strong><br />Examen de grado
          </div>
        </div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div>
            <h2>Buen día, futura abogada.</h2>
            <p>Practicá con preguntas ponderadas por profesor, materia y probabilidad de aparición.</p>
          </div>
          <div className="date-pill">Entrenamiento activo</div>
        </header>

        <section className="kpi-grid" aria-label="Resumen de avance">
          {kpis.map((kpi) => (
            <article className="card kpi" key={kpi.label}>
              <p className="kpi-label">{kpi.label}</p>
              <p className="kpi-value">{kpi.value}</p>
              <p className="kpi-note">{kpi.note}</p>
              <Link className="kpi-link" href={kpi.href}>{kpi.link} →</Link>
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
                    {quickAreas.map((area) => <option key={area}>{area}</option>)}
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
                <Link className="primary-button" href={quickStartHref}>▶ Comenzar práctica</Link>
              </div>
            </article>

            <article className="card panel attempts-card">
              <h3>Intentos recientes</h3>
              <div className="attempt-list">
                {recentAttempts.map((attempt) => (
                  <div className="attempt-row" key={attempt.subject}>
                    <div className="icon-circle">📖</div>
                    <div>
                      <strong>{attempt.subject}</strong><br />
                      <span>{attempt.professor}</span>
                    </div>
                    <span className="score-pill warn">{attempt.score}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div>
            <article className="card panel">
              <h3>Materias prioritarias según Excel</h3>
              <div className="weak-list">
                {weakSubjects.map((subject) => (
                  <div className="weak-row" key={subject.name}>
                    <div className="icon-circle">⚖</div>
                    <div>
                      <strong>{subject.name}</strong><br />
                      <span>{subject.area}</span>
                      <div className="progress-bar"><span style={{ width: `${subject.progress}%` }} /></div>
                    </div>
                    <strong>{subject.progress}%</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="card panel rubric-card">
              <h3>Desglose por rúbrica</h3>
              <div className="rubric-layout">
                <div className="score-ring"><strong>0</strong></div>
                <div className="rubric-list">
                  <div className="rubric-item"><span>Normas jurídicas aplicables</span><strong>0 / 10</strong></div>
                  <div className="rubric-item"><span>Conceptos técnico-jurídicos</span><strong>0 / 10</strong></div>
                  <div className="rubric-item"><span>Aplicación práctica</span><strong>0 / 10</strong></div>
                  <div className="rubric-item"><span>Fundamentación y orden</span><strong>0 / 10</strong></div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
