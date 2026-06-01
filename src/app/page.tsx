import Link from "next/link";

const kpis = [
  { label: "Preguntas disponibles", value: "100+", note: "base inicial generada desde fuentes", link: "Ver preguntas" },
  { label: "Practicadas", value: "0", note: "pendiente de iniciar", link: "Ir a practicar" },
  { label: "Dominadas", value: "0", note: "según rúbrica institucional", link: "Ver dominadas" },
  { label: "Para repaso", value: "0", note: "se actualiza con desempeño", link: "Ver repaso" },
];

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
          <a className="nav-item active" href="#">⌂ Inicio</a>
          <Link className="nav-item" href="/admin/questions">☰ Banco</Link>
          <Link className="nav-item" href="/practice">▷ Practicar</Link>
          <Link className="nav-item" href="/exam">◉ Simulacro</Link>
          <Link className="nav-item" href="/history">↺ Historial</Link>
          <Link className="nav-item" href="/history">▥ Estadísticas</Link>
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
          <div className="date-pill">Fase 1: base técnica</div>
        </header>

        <section className="kpi-grid" aria-label="Resumen de avance">
          {kpis.map((kpi) => (
            <article className="card kpi" key={kpi.label}>
              <p className="kpi-label">{kpi.label}</p>
              <p className="kpi-value">{kpi.value}</p>
              <p className="kpi-note">{kpi.note}</p>
              <a className="kpi-link" href="#">{kpi.link} →</a>
            </article>
          ))}
        </section>

        <section className="dashboard-grid">
          <div>
            <article className="card practice-card">
              <div className="practice-visual">
                <div>
                  <div className="icon-circle" style={{ margin: "0 auto 18px" }}>ðŸŽ“</div>
                  <strong>Empezar práctica</strong>
                  <p>Simulá el examen oral y mejorá con cada intento.</p>
                </div>
              </div>
              <div className="practice-controls">
                <strong>¿Cómo querés practicar?</strong>
                <div className="segmented">
                  <button className="active">Por materia</button>
                  <button>Por profesor</button>
                  <button>Aleatorio</button>
                </div>
                <label>
                  Seleccioná una materia
                  <span className="select-like">Derecho Procesal <span>⌄</span></span>
                </label>
                <div className="segmented">
                  <button className="active">Todas</button>
                  <button>Media</button>
                  <button>Alta</button>
                </div>
                <Link className="primary-button" href="/practice">▶ Comenzar práctica</Link>
              </div>
            </article>

            <article className="card panel attempts-card">
              <h3>Intentos recientes</h3>
              <div className="attempt-list">
                {recentAttempts.map((attempt) => (
                  <div className="attempt-row" key={attempt.subject}>
                    <div className="icon-circle">ðŸ“–</div>
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
