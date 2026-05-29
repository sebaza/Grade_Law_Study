"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type PracticeQuestion = {
  sourceReference: string;
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
};

type PracticeResponse = {
  count: number;
  questions: PracticeQuestion[];
  facets: {
    areas: string[];
    professors: string[];
    difficulties: string[];
  };
};

type EvaluationResponse = {
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
  note: string;
};

const rubricLabels: Record<string, string> = {
  legalNorms: "Normas jur?dicas",
  legalConcepts: "Conceptos t?cnico-jur?dicos",
  practicalApplication: "Aplicaci?n pr?ctica",
  structureAndArgumentation: "Fundamentaci?n y orden",
};

export default function PracticePage() {
  const [data, setData] = useState<PracticeResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [filters, setFilters] = useState({ area: "", professor: "", difficulty: "" });

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (filters.area) params.set("area", filters.area);
    if (filters.professor) params.set("professor", filters.professor);
    if (filters.difficulty) params.set("difficulty", filters.difficulty);

    fetch(`/api/practice/demo?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: PracticeResponse) => {
        setData(payload);
        setCurrentIndex(0);
        setAnswer("");
        setEvaluation(null);
      })

    return () => controller.abort();
  }, [filters]);

  const isLoading = !data;
  const currentQuestion = data?.questions[currentIndex] ?? null;
  const progress = useMemo(() => {
    if (!data || data.questions.length === 0) return 0;
    return Math.round(((currentIndex + 1) / data.questions.length) * 100);
  }, [currentIndex, data]);

  async function submitAnswer() {
    if (!currentQuestion || !answer.trim()) return;

    setIsEvaluating(true);
    const response = await fetch("/api/evaluations/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceReference: currentQuestion.sourceReference,
        answer,
      }),
    });

    const payload = await response.json() as EvaluationResponse;
    setEvaluation(payload);
    setIsEvaluating(false);
  }

  function nextQuestion() {
    if (!data) return;
    setCurrentIndex((index) => Math.min(index + 1, data.questions.length - 1));
    setAnswer("");
    setEvaluation(null);
  }

  function repeatQuestion() {
    setAnswer("");
    setEvaluation(null);
  }

  return (
    <main className="practice-shell">
      <aside className="practice-sidebar">
        <Link className="back-link" href="/">? Volver al inicio</Link>
        <h1>Pr?ctica por texto</h1>
        <p>Modo demo con el banco generado en Fase 3. Sirve para probar flujo sin Supabase ni OpenAI.</p>

        <div className="filter-stack">
          <label>
            ?rea
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

        {!isLoading && currentQuestion && (
          <>
            <div className="practice-status">
              <span>Pregunta {currentIndex + 1} de {data?.questions.length}</span>
              <div className="practice-progress"><span style={{ width: `${progress}%` }} /></div>
            </div>

            <article className="practice-card-large question-panel">
              <div className="question-meta">
                <span>{currentQuestion.areaName}</span>
                <span>{currentQuestion.professorName}</span>
                <span>{currentQuestion.difficulty === "high" ? "Alta" : currentQuestion.difficulty === "medium" ? "Media" : "Baja"}</span>
                <span>{currentQuestion.estimatedProbability}% prob.</span>
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
                  placeholder="Respond? como si estuvieras frente a la comisi?n: define, desarrolla, aplica y cerr? con orden."
                />
              </label>
              <div className="practice-actions">
                <button onClick={submitAnswer} disabled={isEvaluating || !answer.trim()}>
                  {isEvaluating ? "Evaluando..." : "Enviar respuesta"}
                </button>
                <button className="secondary" onClick={repeatQuestion}>Repetir</button>
                <button className="secondary" onClick={nextQuestion}>Siguiente</button>
              </div>
            </article>

            {evaluation && (
              <article className="practice-card-large evaluation-panel">
                <div className="evaluation-header">
                  <div>
                    <span>Resultado demo</span>
                    <h3>{evaluation.evaluation.percentage}%</h3>
                  </div>
                  <strong>{evaluation.evaluation.totalScore} / 40 puntos</strong>
                </div>
                <p>{evaluation.evaluation.summary}</p>

                <div className="rubric-grid">
                  {Object.entries(evaluation.evaluation.rubric).map(([key, value]) => (
                    <div className="rubric-box" key={key}>
                      <span>{rubricLabels[key]}</span>
                      <strong>{value.score}/10 ? {value.level}</strong>
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
                <small>{evaluation.note}</small>
              </article>
            )}
          </>
        )}
      </section>
    </main>
  );
}
