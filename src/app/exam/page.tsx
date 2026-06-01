"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Difficulty = "low" | "medium" | "high";
type AnswerMode = "text" | "voice";

type ExamQuestion = {
  id: string;
  statement: string;
  areaName: string;
  subjectName: string;
  subsubjectName: string;
  professorName: string;
  difficulty: Difficulty;
  estimatedProbability: number;
  priorityScore: number;
  keyPointCount: number;
  attemptCount: number;
  bestScore: number;
};

type ExamSessionResponse = {
  sessionId: string;
  mode: "exam";
  config: {
    limit: number;
    perQuestionSeconds: number;
    totalSeconds: number;
    strategy: "balanced" | "priority" | "weak";
  };
  facets: {
    professors: string[];
    difficulties: Difficulty[];
  };
  questions: ExamQuestion[];
};

type EvaluationResponse = {
  attemptId?: string;
  evaluation: {
    totalScore: number;
    percentage: number;
    summary: string;
    rubric: Record<string, { score: number; level: string; feedback: string }>;
    correctKeyPoints: string[];
    missingKeyPoints: string[];
    conceptualErrors: string[];
    improvementRecommendation: string;
    modelAnswer: string;
  };
};

type FinishResponse = {
  sessionId: string;
  totalQuestions: number;
  answeredCount: number;
  averageScore: number;
  lowestScore: number;
  totalTimeSeconds: number;
  verdict: {
    status: "competent" | "needs_practice" | "incomplete";
    label: string;
    recommendation: string;
  };
  attempts: Array<{
    id: string;
    questionId: string;
    statement: string;
    areaName: string;
    subjectName: string;
    professorName: string;
    score: number;
    answerMode: AnswerMode;
    timeSeconds: number;
    postStatus: string;
    feedback: {
      summary: string;
      missingPoints: unknown;
      improvementSuggestions: string | null;
      modelAnswerSuggested: string | null;
    } | null;
  }>;
};

type TranscriptionResponse = {
  audioPath: string;
  transcription: string;
  editable: boolean;
  note: string;
};

const difficultyLabels: Record<Difficulty, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

const strategyLabels = {
  balanced: "Balanceado por áreas",
  priority: "Alta probabilidad",
  weak: "Materias débiles",
} as const;

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

export default function ExamPage() {
  const [exam, setExam] = useState<ExamSessionResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("text");
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationResponse>>({});
  const [finalResult, setFinalResult] = useState<FinishResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(900);
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [isStarting, setIsStarting] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcriptionDraft, setTranscriptionDraft] = useState("");
  const [settings, setSettings] = useState({
    limit: 3,
    perQuestionSeconds: 900,
    strategy: "balanced" as keyof typeof strategyLabels,
    difficulty: "",
    professor: "",
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const currentQuestion = exam?.questions[currentIndex] ?? null;
  const currentEvaluation = currentQuestion ? evaluations[currentQuestion.id] : null;
  const answeredCount = useMemo(() => Object.keys(evaluations).length, [evaluations]);
  const progress = exam ? Math.round((answeredCount / exam.questions.length) * 100) : 0;

  useEffect(() => {
    if (!exam || finalResult || currentEvaluation) return;
    if (secondsLeft <= 0) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentEvaluation, exam, finalResult, secondsLeft]);

  useEffect(() => {
    return () => {
      stopMediaStream(mediaStreamRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  function resetAnswerState(nextSeconds = exam?.config.perQuestionSeconds ?? settings.perQuestionSeconds) {
    setAnswer("");
    setAnswerMode("text");
    setVoiceMessage("");
    setAudioPath(null);
    setTranscriptionDraft("");
    setAudioUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });
    setSecondsLeft(nextSeconds);
    setQuestionStartedAt(Date.now());
  }

  async function startExam() {
    setIsStarting(true);
    setErrorMessage("");
    setFinalResult(null);
    setEvaluations({});

    const response = await fetch("/api/exam/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        limit: settings.limit,
        perQuestionSeconds: settings.perQuestionSeconds,
        strategy: settings.strategy,
        filters: {
          difficulty: settings.difficulty || undefined,
          professor: settings.professor || undefined,
        },
      }),
    });

    if (response.status === 401) {
      setErrorMessage("Para hacer un simulacro real tenés que iniciar sesión.");
      setIsStarting(false);
      return;
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setErrorMessage(payload?.error ?? "No se pudo iniciar el simulacro.");
      setIsStarting(false);
      return;
    }

    const payload = (await response.json()) as ExamSessionResponse;
    setExam(payload);
    setCurrentIndex(0);
    resetAnswerState(payload.config.perQuestionSeconds);
    setIsStarting(false);
  }

  async function transcribeRecordedAudio(blob: Blob) {
    setIsTranscribing(true);
    setVoiceMessage("Transcribiendo audio en español...");
    setErrorMessage("");

    try {
      const extension = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      const formData = new FormData();
      formData.append("audio", new File([blob], `simulacro-${Date.now()}.${extension}`, { type: blob.type || "audio/webm" }));

      const response = await fetch("/api/transcriptions", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setVoiceMessage(`Error al transcribir: ${payload?.error ?? "No se pudo transcribir el audio. Intentá de nuevo."}`);
        setIsTranscribing(false);
        return;
      }

      const payload = (await response.json()) as TranscriptionResponse;
      setAudioPath(payload.audioPath);
      setTranscriptionDraft(payload.transcription);
      setAnswer(payload.transcription);
      setVoiceMessage("Transcripción lista. Revisala antes de enviar, como corresponde.");
      setIsTranscribing(false);
    } catch {
      setVoiceMessage("Error al transcribir: no se pudo conectar. Intentá de nuevo.");
      setIsTranscribing(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErrorMessage("Este navegador no permite grabar respuestas orales.");
      return;
    }

    setErrorMessage("");
    setVoiceMessage("");
    setAudioPath(null);
    setTranscriptionDraft("");
    setAudioUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      setErrorMessage("No se pudo acceder al micrófono. Revisá permisos del navegador.");
      return;
    }

    const mimeType = getSupportedAudioMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaStreamRef.current = stream;
    mediaRecorderRef.current = recorder;
    audioChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      stopMediaStream(stream);
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      setIsRecording(false);

      if (blob.size <= 0) {
        setErrorMessage("La grabación quedó vacía. Probá de nuevo.");
        return;
      }

      setAudioUrl(URL.createObjectURL(blob));
      void transcribeRecordedAudio(blob);
    };

    recorder.start();
    setAnswerMode("voice");
    setIsRecording(true);
    setVoiceMessage("Grabando simulacro. Hablá claro, estructurado y sin leer.");
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  async function submitAnswer() {
    if (!exam || !currentQuestion || !answer.trim()) return;

    setIsEvaluating(true);
    setErrorMessage("");

    const response = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: currentQuestion.id,
        sessionId: exam.sessionId,
        answer,
        answerMode,
        transcription: answerMode === "voice" ? transcriptionDraft || answer : undefined,
        audioPath: answerMode === "voice" ? audioPath ?? undefined : undefined,
        timeSeconds: Math.max(1, Math.round((Date.now() - questionStartedAt) / 1000)),
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setErrorMessage(payload?.error ?? "No se pudo evaluar esta respuesta.");
      setIsEvaluating(false);
      return;
    }

    const payload = (await response.json()) as EvaluationResponse;
    setEvaluations((current) => ({ ...current, [currentQuestion.id]: payload }));
    setIsEvaluating(false);
  }

  function goNext() {
    if (!exam) return;
    setCurrentIndex((index) => Math.min(index + 1, exam.questions.length - 1));
    resetAnswerState();
  }

  async function finishExam() {
    if (!exam) return;
    setIsFinishing(true);
    setErrorMessage("");

    const response = await fetch(`/api/exam/sessions/${exam.sessionId}/finish`, { method: "POST" });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setErrorMessage(payload?.error ?? "No se pudo cerrar el simulacro.");
      setIsFinishing(false);
      return;
    }

    const payload = (await response.json()) as FinishResponse;
    setFinalResult(payload);
    setIsFinishing(false);
  }

  return (
    <main className="exam-shell">
      <header className="exam-hero">
        <div>
          <Link className="back-link" href="/">← Volver al inicio</Link>
          <p className="eyebrow">Fase 9 · Modo simulacro</p>
          <h1>Simulacro de examen oral</h1>
          <p>
            Acá no venimos a jugar con botoncitos. Venimos a entrenar presión: tiempo limitado,
            preguntas ponderadas y veredicto final tipo comisión.
          </p>
        </div>
        <div className="exam-clock-card">
          <span>{exam && !finalResult ? formatTimer(secondsLeft) : "—"}</span>
          <strong>{exam ? `Pregunta ${currentIndex + 1}/${exam.questions.length}` : "Sin iniciar"}</strong>
          <p>{answeredCount} respuestas evaluadas · {progress}% completado</p>
        </div>
      </header>

      {errorMessage ? (
        <div className="notice error">
          {errorMessage} {errorMessage.includes("iniciar sesión") ? <Link href="/auth/login">Ir al login</Link> : null}
        </div>
      ) : null}

      {!exam ? (
        <section className="exam-setup card">
          <div>
            <h2>Configurar simulacro</h2>
            <p>
              Para MVP usamos sesiones reales de práctica por debajo. Es arquitectura sana: una sola fuente de verdad
              para intentos, feedback y progreso.
            </p>
          </div>
          <div className="exam-settings-grid">
            <label>
              Cantidad de preguntas
              <input
                min="1"
                max="12"
                type="number"
                value={settings.limit}
                onChange={(event) => setSettings((current) => ({ ...current, limit: Number(event.target.value) }))}
              />
            </label>
            <label>
              Minutos por pregunta
              <input
                min="1"
                max="15"
                type="number"
                value={Math.round(settings.perQuestionSeconds / 60)}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, perQuestionSeconds: Number(event.target.value) * 60 }))
                }
              />
            </label>
            <label>
              Estrategia
              <select
                value={settings.strategy}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, strategy: event.target.value as keyof typeof strategyLabels }))
                }
              >
                {Object.entries(strategyLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Dificultad
              <select
                value={settings.difficulty}
                onChange={(event) => setSettings((current) => ({ ...current, difficulty: event.target.value }))}
              >
                <option value="">Todas</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="low">Baja</option>
              </select>
            </label>
          </div>
          <button className="primary-button" disabled={isStarting} type="button" onClick={startExam}>
            {isStarting ? "Iniciando..." : "Iniciar simulacro"}
          </button>
        </section>
      ) : null}

      {exam && currentQuestion && !finalResult ? (
        <section className="exam-layout">
          <aside className="exam-question-list card">
            <h2>Ronda</h2>
            {exam.questions.map((question, index) => (
              <button
                className={`exam-step ${index === currentIndex ? "active" : ""} ${evaluations[question.id] ? "done" : ""}`}
                key={question.id}
                type="button"
                onClick={() => {
                  setCurrentIndex(index);
                  resetAnswerState();
                }}
              >
                <span>{index + 1}</span>
                <strong>{question.areaName}</strong>
                <small>{evaluations[question.id]?.evaluation.percentage ?? "Pendiente"}%</small>
              </button>
            ))}
          </aside>

          <section className="exam-panel card">
            <div className="question-meta">
              <span>{currentQuestion.areaName}</span>
              <span>{currentQuestion.subjectName}</span>
              <span>{currentQuestion.professorName}</span>
              <span>{difficultyLabels[currentQuestion.difficulty]}</span>
              <span>{currentQuestion.estimatedProbability}% prob.</span>
            </div>
            <h2>{currentQuestion.statement}</h2>
            <p className="muted-copy">{currentQuestion.subsubjectName} · {currentQuestion.keyPointCount} puntos clave esperados</p>

            <div className="answer-mode-tabs" aria-label="Modo de respuesta">
              <button className={answerMode === "text" ? "active" : ""} type="button" onClick={() => setAnswerMode("text")}>Texto</button>
              <button className={answerMode === "voice" ? "active" : ""} type="button" onClick={() => setAnswerMode("voice")}>Voz</button>
            </div>

            {answerMode === "voice" ? (
              <div className="voice-panel">
                <strong>Respuesta oral</strong>
                <p>Grabá, transcribí y corregí antes de enviar. La IA evalúa texto, no intenciones.</p>
                <div className="practice-actions compact">
                  {!isRecording ? (
                    <button disabled={isTranscribing || Boolean(currentEvaluation)} type="button" onClick={startRecording}>
                      Grabar
                    </button>
                  ) : (
                    <button type="button" onClick={stopRecording}>Detener</button>
                  )}
                </div>
                {audioUrl ? <audio controls src={audioUrl} /> : null}
                {voiceMessage ? <p>{voiceMessage}</p> : null}
              </div>
            ) : null}

            <label className="exam-answer">
              {answerMode === "voice" ? "Transcripción editable" : "Respuesta"}
              <textarea
                disabled={Boolean(currentEvaluation)}
                rows={9}
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  if (answerMode === "voice") setTranscriptionDraft(event.target.value);
                }}
                placeholder="Respondé como si estuvieras frente a la comisión: definición, requisitos, norma, aplicación y cierre."
              />
            </label>

            {secondsLeft === 0 && !currentEvaluation ? (
              <div className="notice error">Tiempo agotado. Cerrá la respuesta con lo que tengas y enviá.</div>
            ) : null}

            <div className="exam-actions">
              <button
                className="primary-button"
                disabled={isEvaluating || !answer.trim() || Boolean(currentEvaluation)}
                type="button"
                onClick={submitAnswer}
              >
                {isEvaluating ? "Evaluando..." : "Enviar respuesta"}
              </button>
              {currentEvaluation && currentIndex < exam.questions.length - 1 ? (
                <button className="secondary-button" type="button" onClick={goNext}>Siguiente pregunta</button>
              ) : null}
              {answeredCount > 0 ? (
                <button className="secondary-button" disabled={isFinishing} type="button" onClick={finishExam}>
                  {isFinishing ? "Cerrando..." : "Cerrar simulacro"}
                </button>
              ) : null}
            </div>

            {currentEvaluation ? (
              <section className="exam-feedback">
                <div className="score-ring"><strong>{currentEvaluation.evaluation.percentage}</strong></div>
                <div>
                  <h3>Feedback de comisión</h3>
                  <p>{currentEvaluation.evaluation.summary}</p>
                  <div className="feedback-columns">
                    <div>
                      <h4>Puntos correctos</h4>
                      <ul>
                        {currentEvaluation.evaluation.correctKeyPoints.map((point) => <li key={point}>{point}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h4>Faltantes</h4>
                      <ul>
                        {currentEvaluation.evaluation.missingKeyPoints.map((point) => <li key={point}>{point}</li>)}
                      </ul>
                    </div>
                  </div>
                  <p><strong>Recomendación:</strong> {currentEvaluation.evaluation.improvementRecommendation}</p>
                </div>
              </section>
            ) : null}
          </section>
        </section>
      ) : null}

      {finalResult ? (
        <section className="exam-result card">
          <p className="eyebrow">Resultado final</p>
          <h2>{finalResult.verdict.label}</h2>
          <div className="exam-result-grid">
            <div><span>{finalResult.averageScore}%</span><strong>Promedio</strong></div>
            <div><span>{finalResult.lowestScore}%</span><strong>Puntaje más bajo</strong></div>
            <div><span>{finalResult.answeredCount}/{finalResult.totalQuestions}</span><strong>Respondidas</strong></div>
            <div><span>{Math.round(finalResult.totalTimeSeconds / 60)}m</span><strong>Tiempo usado</strong></div>
          </div>
          <p>{finalResult.verdict.recommendation}</p>
          <div className="attempt-history-list">
            {finalResult.attempts.map((attempt) => (
              <article className="attempt-history-row" key={attempt.id}>
                <div>
                  <strong>{attempt.statement}</strong>
                  <p>{attempt.areaName} · {attempt.subjectName} · {attempt.professorName}</p>
                  <small>{attempt.feedback?.summary}</small>
                </div>
                <span className={`score-pill ${attempt.score >= 70 ? "strong" : "danger"}`}>{attempt.score}%</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
