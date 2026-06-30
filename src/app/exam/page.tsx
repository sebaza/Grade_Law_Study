"use client";

import Link from "next/link";
import { AppTopNav } from "../app-top-nav";
import { Spinner } from "../loading-spinner";
import { ProbabilityBadge, InfoHint } from "../question-badges";
import { useEffect, useMemo, useRef, useState } from "react";

type Difficulty = "low" | "medium" | "high";
type AnswerMode = "text" | "voice";
type RecordingTarget = "answer" | "followUp";

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
  sectionIndex?: number;
  sectionQuestionNumber?: number;
  sectionTitle?: string;
  focusSubsubjectName?: string;
};

type ExamSessionResponse = {
  sessionId: string;
  mode: "exam";
  config: {
    limit: number;
    perQuestionSeconds: number;
    totalSeconds: number;
    strategy: "balanced" | "priority" | "weak";
    topics: string[];
    topicProfessors: string[];
    questionsPerTopic: number | null;
  };
  facets: {
    areas: string[];
    professors: string[];
    professorsByArea: Record<string, string[]>;
    difficulties: Difficulty[];
  };
  questions: ExamQuestion[];
};

type EvaluationResponse = {
  status?: "evaluated";
  attemptId?: string;
  evaluation: {
    totalScore: number;
    percentage: number;
    summary: string;
    rubric: Record<string, { score: number; level: string; feedback: string; impact: string }>;
    correctKeyPoints: string[];
    missingKeyPoints: string[];
    conceptualErrors: string[];
    improvementRecommendation: string;
    modelAnswer: string;
  };
  adaptive?: {
    usedFollowUp: boolean;
  };
  academicProfile?: {
    professorName: string;
    areaName: string;
    source: "matrix-and-area-inferred" | "area-inferred";
    primaryCriteria: string[];
    guidance: string;
  };
};

type FollowUpResponse = {
  status: "requires_follow_up";
  followUp: {
    question: string;
    reason: string;
    targetCriteria: string[];
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
    subsubjectName: string;
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
    modelAnswer: string | null;
  }>;
  questions: Array<{
    id: string;
    statement: string;
    areaName: string;
    subjectName: string;
    subsubjectName: string;
    professorName: string;
    sectionIndex?: number;
    sectionQuestionNumber?: number;
    sectionTitle: string;
    focusSubsubjectName: string;
    answered: boolean;
    score: number | null;
    answerMode: AnswerMode | null;
    timeSeconds: number;
    postStatus: string;
    feedback: {
      summary: string;
      missingPoints: unknown;
      improvementSuggestions: string | null;
      modelAnswerSuggested: string | null;
    } | null;
    modelAnswer: string | null;
  }>;
};

type TranscriptionResponse = {
  audioPath: string;
  transcription: string;
  editable: boolean;
  note: string;
};

type SetupFacetsResponse = {
  facets: {
    areas: string[];
    professors: string[];
    professorsByArea: Record<string, string[]>;
    difficulties: Difficulty[];
  };
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

const rubricLabels: Record<string, string> = {
  legalNorms: "Normas jurídicas",
  legalConcepts: "Conceptos técnico-jurídicos",
  practicalApplication: "Aplicación práctica",
  structureAndArgumentation: "Fundamentación y orden",
};

const requiredTopicCount = 3;
const questionsPerTopic = 10;

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

function formatReviewList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return String(record.description ?? record.label ?? record.text ?? JSON.stringify(record));
      }

      return String(item);
    }).join("; ");
  }

  if (typeof value === "string") return value;
  if (value == null) return "";

  return JSON.stringify(value);
}

export default function ExamPage() {
  const [exam, setExam] = useState<ExamSessionResponse | null>(null);
  const [setupFacets, setSetupFacets] = useState<SetupFacetsResponse["facets"]>({
    areas: [],
    professors: [],
    professorsByArea: {},
    difficulties: ["low", "medium", "high"],
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [pendingFollowUp, setPendingFollowUp] = useState<FollowUpResponse["followUp"] | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [followUpVoiceMessage, setFollowUpVoiceMessage] = useState("");
  const [followUpAudioUrl, setFollowUpAudioUrl] = useState<string | null>(null);
  const [answerMode, setAnswerMode] = useState<AnswerMode>("text");
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationResponse>>({});
  const [finalResult, setFinalResult] = useState<FinishResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(900);
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [isStarting, setIsStarting] = useState(false);
  const [isLoadingFacets, setIsLoadingFacets] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState<RecordingTarget | null>(null);
  const [transcribingTarget, setTranscribingTarget] = useState<RecordingTarget | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcriptionDraft, setTranscriptionDraft] = useState("");
  const [settings, setSettings] = useState({
    topicOrder: Array.from({ length: requiredTopicCount }, () => ""),
    topicProfessors: Array.from({ length: requiredTopicCount }, () => ""),
    perQuestionSeconds: 900,
    strategy: "balanced" as keyof typeof strategyLabels,
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const currentQuestion = exam?.questions[currentIndex] ?? null;
  const currentEvaluation = currentQuestion ? evaluations[currentQuestion.id] : null;
  const answeredCount = useMemo(() => Object.keys(evaluations).length, [evaluations]);
  const progress = exam ? Math.round((answeredCount / exam.questions.length) * 100) : 0;
  const questionSections = useMemo(() => {
    if (!exam) return [];

    const sections = new Map<number, { title: string; focus: string; questions: ExamQuestion[] }>();

    exam.questions.forEach((question, index) => {
      const sectionIndex = question.sectionIndex ?? Math.floor(index / questionsPerTopic);
      const section = sections.get(sectionIndex) ?? {
        title: question.sectionTitle ?? question.areaName,
        focus: question.focusSubsubjectName ?? question.subsubjectName,
        questions: [],
      };
      section.questions.push(question);
      sections.set(sectionIndex, section);
    });

    return Array.from(sections.entries())
      .sort(([a], [b]) => a - b)
      .map(([sectionIndex, section]) => ({ sectionIndex, ...section }));
  }, [exam]);
  const finalReviewQuestions = useMemo(() => {
    if (!finalResult) return [];
    if (finalResult.questions?.length) return finalResult.questions;

    return finalResult.attempts.map((attempt, index) => ({
      id: attempt.questionId,
      statement: attempt.statement,
      areaName: attempt.areaName,
      subjectName: attempt.subjectName,
      subsubjectName: attempt.subsubjectName,
      professorName: attempt.professorName,
      sectionIndex: undefined,
      sectionQuestionNumber: index + 1,
      sectionTitle: attempt.areaName,
      focusSubsubjectName: attempt.subsubjectName,
      answered: true,
      score: attempt.score,
      answerMode: attempt.answerMode,
      timeSeconds: attempt.timeSeconds,
      postStatus: attempt.postStatus,
      feedback: attempt.feedback,
      modelAnswer: attempt.modelAnswer,
    }));
  }, [finalResult]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/exam/sessions")
      .then((response) => (response.ok ? (response.json() as Promise<SetupFacetsResponse>) : null))
      .then((payload) => {
        if (!cancelled && payload?.facets) {
          setSetupFacets(payload.facets);
        }
      })
      .catch(() => {
        if (!cancelled) setErrorMessage("No pude cargar las materias disponibles para el simulacro.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingFacets(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
      if (followUpAudioUrl) URL.revokeObjectURL(followUpAudioUrl);
    };
  }, [audioUrl, followUpAudioUrl]);

  function resetAnswerState(nextSeconds = exam?.config.perQuestionSeconds ?? settings.perQuestionSeconds) {
    setAnswer("");
    setPendingFollowUp(null);
    setFollowUpAnswer("");
    setFollowUpVoiceMessage("");
    setAnswerMode("text");
    setVoiceMessage("");
    setAudioPath(null);
    setTranscriptionDraft("");
    setRecordingTarget(null);
    setTranscribingTarget(null);
    setFollowUpAudioUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });
    setAudioUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });
    setSecondsLeft(nextSeconds);
    setQuestionStartedAt(Date.now());
  }

  function updateTopicOrder(index: number, value: string) {
    setSettings((current) => ({
      ...current,
      topicOrder: current.topicOrder.map((topic, topicIndex) => (topicIndex === index ? value : topic)),
      topicProfessors: current.topicProfessors.map((professor, professorIndex) =>
        professorIndex === index ? "" : professor,
      ),
    }));
  }

  function updateTopicProfessor(index: number, value: string) {
    setSettings((current) => ({
      ...current,
      topicProfessors: current.topicProfessors.map((professor, professorIndex) =>
        professorIndex === index ? value : professor,
      ),
    }));
  }

  function getAvailableTopicOptions(currentIndex: number) {
    const selectedElsewhere = new Set(
      settings.topicOrder.filter((topic, topicIndex) => topic && topicIndex !== currentIndex),
    );

    return setupFacets.areas.filter((area) => !selectedElsewhere.has(area));
  }

  function getAvailableProfessorOptions(index: number) {
    const topic = settings.topicOrder[index];
    if (!topic) return [];

    return setupFacets.professorsByArea[topic] ?? [];
  }

  async function startExam() {
    const topicOrder = settings.topicOrder.map((topic) => topic.trim()).filter(Boolean);
    const topicProfessors = settings.topicProfessors.map((professor) => professor.trim());

    if (topicOrder.length !== requiredTopicCount) {
      setErrorMessage("Elegí las 3 materias y su orden antes de iniciar. Sin estructura no hay simulacro real.");
      return;
    }

    if (topicProfessors.filter(Boolean).length !== requiredTopicCount) {
      setErrorMessage("Elegí un profesor para cada materia del simulacro.");
      return;
    }

    setIsStarting(true);
    setErrorMessage("");
    setFinalResult(null);
    setEvaluations({});
    setPendingFollowUp(null);
    setFollowUpAnswer("");

    const response = await fetch("/api/exam/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        limit: requiredTopicCount * questionsPerTopic,
        perQuestionSeconds: settings.perQuestionSeconds,
        strategy: settings.strategy,
        topicOrder,
        topicProfessors,
        questionsPerTopic,
        filters: {},
      }),
    });

    if (response.status === 401) {
      setErrorMessage("Para hacer un simulacro real necesitas iniciar sesión.");
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
    window.localStorage.setItem(
      "grade-law-study.exam.last-config",
      JSON.stringify({
        topicOrder,
        topicProfessors,
        perQuestionSeconds: settings.perQuestionSeconds,
        strategy: settings.strategy,
      }),
    );
    setCurrentIndex(0);
    resetAnswerState(payload.config.perQuestionSeconds);
    setIsStarting(false);
  }

  async function transcribeRecordedAudio(blob: Blob, target: RecordingTarget) {
    const isFollowUp = target === "followUp";
    const setTargetVoiceMessage = isFollowUp ? setFollowUpVoiceMessage : setVoiceMessage;

    setIsTranscribing(true);
    setTranscribingTarget(target);
    setTargetVoiceMessage("Transcribiendo audio en español...");
    setErrorMessage("");

    try {
      const extension = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      const formData = new FormData();
      const prefix = isFollowUp ? "repregunta-simulacro" : "simulacro";
      formData.append("audio", new File([blob], `${prefix}-${Date.now()}.${extension}`, { type: blob.type || "audio/webm" }));

      const response = await fetch("/api/transcriptions", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setTargetVoiceMessage(`Error al transcribir: ${payload?.error ?? "No se pudo transcribir el audio. Intentá de nuevo."}`);
        setIsTranscribing(false);
        setTranscribingTarget(null);
        return;
      }

      const payload = (await response.json()) as TranscriptionResponse;
      if (isFollowUp) {
        setFollowUpAnswer(payload.transcription);
        setFollowUpVoiceMessage("Transcripción de repregunta lista. Revísala antes de evaluar la respuesta completa.");
      } else {
        setAudioPath(payload.audioPath);
        setTranscriptionDraft(payload.transcription);
        setAnswer(payload.transcription);
        setVoiceMessage("Transcripción lista. Revísala antes de enviar.");
      }
      setIsTranscribing(false);
      setTranscribingTarget(null);
    } catch {
      setTargetVoiceMessage("Error al transcribir: no se pudo conectar. Intentá de nuevo.");
      setIsTranscribing(false);
      setTranscribingTarget(null);
    }
  }

  async function startRecording(target: RecordingTarget = "answer") {
    if (target === "answer" && pendingFollowUp) {
      setErrorMessage("La respuesta inicial ya quedó fijada para esta repregunta. Grabá el complemento en la repregunta.");
      return;
    }

    if (target === "followUp" && !pendingFollowUp) {
      return;
    }

    if (isRecording) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErrorMessage("Este navegador no permite grabar respuestas orales.");
      return;
    }

    setErrorMessage("");
    if (target === "followUp") {
      setFollowUpVoiceMessage("");
      setFollowUpAudioUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return null;
      });
    } else {
      setVoiceMessage("");
      setAudioPath(null);
      setTranscriptionDraft("");
      setAudioUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return null;
      });
    }

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
      setRecordingTarget(null);

      if (blob.size <= 0) {
        setErrorMessage("La grabación quedó vacía. Probá de nuevo.");
        return;
      }

      if (target === "followUp") {
        setFollowUpAudioUrl(URL.createObjectURL(blob));
      } else {
        setAudioUrl(URL.createObjectURL(blob));
      }
      void transcribeRecordedAudio(blob, target);
    };

    recorder.start();
    if (target === "answer") setAnswerMode("voice");
    setIsRecording(true);
    setRecordingTarget(target);
    if (target === "followUp") {
      setFollowUpVoiceMessage("Grabando repregunta... responde solo el punto que te piden precisar.");
    } else {
      setVoiceMessage("Grabando simulacro. Hablá claro, estructurado y sin leer.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  function clearFollowUpVoiceAnswer() {
    setFollowUpAnswer("");
    setFollowUpVoiceMessage("");
    setFollowUpAudioUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });
  }

  async function submitAnswer() {
    if (!exam || !currentQuestion || !answer.trim()) return;
    if (pendingFollowUp && !followUpAnswer.trim()) return;

    setIsEvaluating(true);
    setErrorMessage("");

    const response = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: currentQuestion.id,
        sessionId: exam.sessionId,
        answer,
        followUp: pendingFollowUp
          ? {
              question: pendingFollowUp.question,
              answer: followUpAnswer,
            }
          : undefined,
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

    const payload = (await response.json()) as EvaluationResponse | FollowUpResponse;
    if (payload.status === "requires_follow_up") {
      setPendingFollowUp(payload.followUp);
      setFollowUpAnswer("");
      setIsEvaluating(false);
      return;
    }

    setEvaluations((current) => ({ ...current, [currentQuestion.id]: payload }));
    setPendingFollowUp(null);
    setFollowUpAnswer("");
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
    <main className="exam-shell menu-with-top-nav">
      <AppTopNav />
      <header className="exam-hero">
        <div>
          <Link className="back-link" href="/">← Volver al inicio</Link>
          <p className="eyebrow">Modo simulacro</p>
          <h1>Simulacro de examen oral</h1>
          <p>
            Entrena bajo presión real: tiempo limitado, preguntas ponderadas
            y un veredicto final como el de la comisión.
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
            <p>Configurá materias, profesores, tiempo por pregunta y estrategia de selección.</p>
          </div>
          <div className="exam-topic-order">
            <div>
              <strong>Orden de materias y profesor por bloque</strong>
              <p>Elige 3 materias, asigna un profesor a cada una y define el tiempo de respuesta.</p>
            </div>
            <div className="exam-topic-grid">
              {settings.topicOrder.map((topic, index) => (
                <div className="exam-topic-block" key={index}>
                  <label>
                    Bloque {index + 1}: materia
                    <select
                      disabled={isLoadingFacets}
                      value={topic}
                      onChange={(event) => updateTopicOrder(index, event.target.value)}
                    >
                      <option value="">{isLoadingFacets ? "Cargando materias..." : "Seleccionar materia"}</option>
                      {getAvailableTopicOptions(index).map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Profesor
                    <select
                      disabled={isLoadingFacets || !topic}
                      value={settings.topicProfessors[index]}
                      onChange={(event) => updateTopicProfessor(index, event.target.value)}
                    >
                      <option value="">{topic ? "Seleccionar profesor" : "Primero elige materia"}</option>
                      {getAvailableProfessorOptions(index).map((professor) => (
                        <option key={professor} value={professor}>
                          {professor}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="exam-settings-grid">
            <label>
              Preguntas totales
              <input readOnly type="number" value={requiredTopicCount * questionsPerTopic} />
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
          </div>
          <button className="primary-button loading-inline" disabled={isStarting || isLoadingFacets} type="button" onClick={startExam}>
            {isStarting && <Spinner size={14} />}
            {isStarting ? "Iniciando..." : "Iniciar simulacro"}
          </button>
        </section>
      ) : null}

      {exam && currentQuestion && !finalResult ? (
        <section className="exam-layout">
          <aside className="exam-question-list card">
            <h2>Ronda</h2>
            {questionSections.map((section) => (
              <div className="exam-section-nav" key={section.sectionIndex}>
                <div>
                  <strong>{section.title}</strong>
                  <small>Foco: {section.focus}</small>
                </div>
                {section.questions.map((question) => {
                  const index = exam.questions.findIndex((candidate) => candidate.id === question.id);

                  return (
                    <button
                      className={`exam-step ${index === currentIndex ? "active" : ""} ${evaluations[question.id] ? "done" : ""}`}
                      key={question.id}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(index);
                        resetAnswerState();
                      }}
                    >
                      <span>{question.sectionQuestionNumber ?? index + 1}</span>
                      <strong>{difficultyLabels[question.difficulty]}</strong>
                      <small>{evaluations[question.id]?.evaluation.percentage ?? "Pendiente"}%</small>
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>

          <section className="exam-panel card">
            <div className="question-meta">
              <span>Bloque {(currentQuestion.sectionIndex ?? 0) + 1}</span>
              <span>
                Pregunta {currentQuestion.sectionQuestionNumber ?? currentIndex + 1}/
                {exam.config.questionsPerTopic ?? exam.questions.length}
              </span>
              <span>{currentQuestion.areaName}</span>
              <span>{currentQuestion.subjectName}</span>
              <span>{currentQuestion.professorName}</span>
              <span>Dificultad: {difficultyLabels[currentQuestion.difficulty]}</span>
              <ProbabilityBadge probability={currentQuestion.estimatedProbability} />
              <InfoHint text={`${currentQuestion.keyPointCount} puntos clave esperados en la respuesta.`} />
            </div>
            <h2>{currentQuestion.statement}</h2>
            <p className="muted-copy">
              Foco del bloque: {currentQuestion.focusSubsubjectName ?? currentQuestion.subsubjectName} · Pregunta:
              {" "}{currentQuestion.subsubjectName} · {currentQuestion.keyPointCount} puntos clave esperados
            </p>

            <div className="answer-mode-tabs" aria-label="Modo de respuesta">
              <button className={answerMode === "text" ? "active" : ""} type="button" onClick={() => setAnswerMode("text")}>Texto</button>
              <button className={answerMode === "voice" ? "active" : ""} type="button" onClick={() => setAnswerMode("voice")}>Voz</button>
            </div>

            {answerMode === "voice" ? (
              <div className="voice-panel">
                <strong>Respuesta oral</strong>
                <p>Graba, transcribe y corrige antes de enviar.</p>
                <div className="practice-actions compact">
                  {!(isRecording && recordingTarget === "answer") ? (
                    <button disabled={isTranscribing || isRecording || Boolean(currentEvaluation) || Boolean(pendingFollowUp)} type="button" onClick={() => startRecording("answer")}>
                      Grabar
                    </button>
                  ) : (
                    <button type="button" onClick={stopRecording}>Detener</button>
                  )}
                </div>
                {audioUrl ? <audio controls src={audioUrl} /> : null}
                {isTranscribing && transcribingTarget === "answer" ? <p className="loading-inline"><Spinner size={14} /> Transcribiendo tu audio...</p> : null}
                {voiceMessage ? <p>{voiceMessage}</p> : null}
              </div>
            ) : null}

            <label className="exam-answer">
              {answerMode === "voice" ? "Transcripción editable" : "Respuesta"}
              <textarea
                disabled={Boolean(currentEvaluation) || Boolean(pendingFollowUp)}
                rows={9}
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  if (answerMode === "voice") setTranscriptionDraft(event.target.value);
                }}
                placeholder="Responde como ante la comisión: definición, requisitos, norma, aplicación y cierre."
              />
            </label>

            {pendingFollowUp ? (
              <div className="adaptive-follow-up">
                <div>
                  <span>Repregunta de comisión</span>
                  <strong>{pendingFollowUp.question}</strong>
                  <p>{pendingFollowUp.reason}</p>
                  {pendingFollowUp.targetCriteria.length > 0 ? (
                    <small>
                      Criterios apuntados:{" "}
                      {pendingFollowUp.targetCriteria.map((criterion) => rubricLabels[criterion] ?? criterion).join(", ")}
                    </small>
                  ) : null}
                </div>
                <label>
                  Respuesta complementaria
                  <textarea
                    rows={5}
                    value={followUpAnswer}
                    onChange={(event) => setFollowUpAnswer(event.target.value)}
                    placeholder="Contestá concreto. La nota se genera recién con la respuesta inicial más este complemento."
                  />
                </label>
                <div className="voice-panel follow-up-voice-panel">
                  <strong>Responder repregunta por voz</strong>
                  <p>Grabá sólo el complemento que faltó; se transcribe arriba y después se evalúa la respuesta final completa.</p>
                  <div className="practice-actions compact">
                    {!(isRecording && recordingTarget === "followUp") ? (
                      <button disabled={isTranscribing || isRecording || Boolean(currentEvaluation)} type="button" onClick={() => startRecording("followUp")}>
                        Grabar repregunta
                      </button>
                    ) : (
                      <button type="button" onClick={stopRecording}>Detener repregunta</button>
                    )}
                    <button type="button" className="secondary" onClick={clearFollowUpVoiceAnswer} disabled={isRecording || isTranscribing}>
                      Limpiar repregunta
                    </button>
                  </div>
                  {followUpAudioUrl ? <audio controls src={followUpAudioUrl} /> : null}
                  {isTranscribing && transcribingTarget === "followUp" ? <p className="loading-inline"><Spinner size={14} /> Transcribiendo repregunta...</p> : null}
                  {followUpVoiceMessage ? <p>{followUpVoiceMessage}</p> : null}
                </div>
              </div>
            ) : null}

            {secondsLeft === 0 && !currentEvaluation ? (
              <div className="notice error">Tiempo agotado. Cierra la respuesta con lo que tengas y envíala.</div>
            ) : null}

            <div className="exam-actions">
              <button
                className="primary-button loading-inline"
                disabled={isEvaluating || isRecording || isTranscribing || !answer.trim() || Boolean(currentEvaluation) || Boolean(pendingFollowUp && !followUpAnswer.trim())}
                type="button"
                onClick={submitAnswer}
              >
                {isEvaluating && <Spinner size={14} />}
                {isEvaluating
                  ? pendingFollowUp ? "Evaluando respuesta completa..." : "Analizando..."
                  : pendingFollowUp ? "Evaluar respuesta completa" : "Enviar respuesta"}
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
                  {currentEvaluation.academicProfile ? (
                    <p className="muted-copy">
                      Perfil evaluador: {currentEvaluation.academicProfile.professorName} · énfasis en{" "}
                      {currentEvaluation.academicProfile.primaryCriteria
                        .map((criterion) => rubricLabels[criterion] ?? criterion)
                        .join(", ")}
                    </p>
                  ) : null}
                  <p>{currentEvaluation.evaluation.summary}</p>
                  <div className="rubric-grid">
                    {Object.entries(currentEvaluation.evaluation.rubric).map(([key, value]) => (
                      <div className="rubric-box" key={key}>
                        <span>{rubricLabels[key]}</span>
                        <strong>{value.score}/10 · {value.level}</strong>
                        <p>{value.feedback}</p>
                        <small>{value.impact}</small>
                      </div>
                    ))}
                  </div>
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
          <div className="exam-review-heading">
            <div>
              <h3>Pauta final por pregunta</h3>
              <p>Revisión por pregunta, desempeño y respuesta esperada.</p>
            </div>
          </div>
          <div className="attempt-history-list">
            {finalReviewQuestions.map((question) => (
              <article className="attempt-history-row exam-review-row" key={question.id}>
                <div>
                  <strong>
                    Bloque {(question.sectionIndex ?? 0) + 1}
                    {question.sectionQuestionNumber ? ` · Pregunta ${question.sectionQuestionNumber}` : ""}:{" "}
                    {question.statement}
                  </strong>
                  <p>
                    {question.sectionTitle} · {question.subjectName} · {question.subsubjectName} ·{" "}
                    {question.professorName}
                  </p>
                  <small>{question.feedback?.summary ?? "Sin respuesta evaluada."}</small>
                  <details className="exam-answer-key">
                    <summary>Ver pauta y faltantes</summary>
                    {question.feedback?.missingPoints ? (
                      <p><strong>Faltantes:</strong> {formatReviewList(question.feedback.missingPoints)}</p>
                    ) : null}
                    {question.feedback?.improvementSuggestions ? (
                      <p><strong>Cómo mejorar:</strong> {question.feedback.improvementSuggestions}</p>
                    ) : null}
                    <p><strong>Pauta esperada:</strong> {question.modelAnswer ?? "No hay pauta cargada para esta pregunta."}</p>
                  </details>
                </div>
                <span className={`score-pill ${(question.score ?? 0) >= 70 ? "strong" : "danger"}`}>
                  {question.answered ? `${question.score}%` : "Pendiente"}
                </span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
