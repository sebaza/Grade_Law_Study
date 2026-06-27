"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type PracticeQuestion = {
  id?: string;
  sourceReference: string | null;
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
  status?: string;
  attemptCount?: number;
  bestScore?: number;
};

type PracticeResponse = {
  mode: "demo" | "real";
  sessionId?: string;
  count: number;
  questions: PracticeQuestion[];
  facets: {
    areas: string[];
    subjects: string[];
    subsubjects: string[];
    professors: string[];
    difficulties: string[];
    questionTypes: string[];
  };
};

type EvaluationResponse = {
  status?: "evaluated";
  attemptId?: string;
  persisted?: boolean;
  evaluation: {
    totalScore: number;
    percentage: number;
    summary: string;
    rubric: Record<string, { score: number; level: string; feedback: string; impact: string }>;
    correctKeyPoints: string[];
    missingKeyPoints: string[];
    improvementRecommendation: string;
    modelAnswer: string;
  };
  adaptive?: {
    usedFollowUp: boolean;
  };
  note?: string;
};

type FollowUpResponse = {
  status: "requires_follow_up";
  followUp: {
    question: string;
    reason: string;
    targetCriteria: string[];
  };
  note?: string;
};

type TranscriptionResponse = {
  audioPath: string;
  transcription: string;
  editable: boolean;
  note: string;
};

const rubricLabels: Record<string, string> = {
  legalNorms: "Normas jurídicas",
  legalConcepts: "Conceptos técnico-jurídicos",
  practicalApplication: "Aplicación práctica",
  structureAndArgumentation: "Fundamentación y orden",
};

const practiceModeLabels = {
  random: "Aleatoria",
  by_subject: "Por materia",
  by_professor: "Por profesor",
  by_difficulty: "Por dificultad",
  review: "Para repaso",
  weak_questions: "Bajo desempeño",
  unpracticed: "No practicadas",
} as const;

const questionTypeLabels: Record<string, string> = {
  application: "Aplicación",
  case: "Caso práctico",
  comparison: "Comparación",
  definition: "Definición",
  general: "General",
  oral: "Oral",
};

type PracticeMode = keyof typeof practiceModeLabels;
type AnswerMode = "text" | "voice";
type RecordingTarget = "answer" | "followUp";

function getPracticeConfigFromUrl() {
  if (typeof window === "undefined") {
    return {
      source: "real" as const,
      mode: "random" as PracticeMode,
      filters: { area: "", subject: "", subsubject: "", professor: "", difficulty: "", questionType: "" },
    };
  }

  const params = new URLSearchParams(window.location.search);
  const source = params.get("source");
  const mode = params.get("mode");
  const difficulty = params.get("difficulty") ?? "";

  return {
    source: source === "demo" ? "demo" as const : "real" as const,
    mode: mode && mode in practiceModeLabels ? mode as PracticeMode : "random" as PracticeMode,
    filters: {
      area: params.get("area") ?? "",
      subject: params.get("subject") ?? "",
      subsubject: params.get("subsubject") ?? "",
      professor: params.get("professor") ?? "",
      difficulty: ["low", "medium", "high"].includes(difficulty) ? difficulty : "",
      questionType: params.get("questionType") ?? "",
    },
  };
}

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

export default function PracticePage() {
  const [queryBootstrapped, setQueryBootstrapped] = useState(false);
  const [data, setData] = useState<PracticeResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("text");
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [pendingFollowUp, setPendingFollowUp] = useState<FollowUpResponse["followUp"] | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [followUpVoiceMessage, setFollowUpVoiceMessage] = useState("");
  const [followUpAudioUrl, setFollowUpAudioUrl] = useState<string | null>(null);
  const [sectionEvaluations, setSectionEvaluations] = useState<Record<number, EvaluationResponse>>({});
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState<RecordingTarget | null>(null);
  const [transcribingTarget, setTranscribingTarget] = useState<RecordingTarget | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [transcriptionDraft, setTranscriptionDraft] = useState("");
  const [practiceSource, setPracticeSource] = useState<"real" | "demo">("real");
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("random");
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [filters, setFilters] = useState({
    area: "",
    subject: "",
    subsubject: "",
    professor: "",
    difficulty: "",
    questionType: "",
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const config = getPracticeConfigFromUrl();

    queueMicrotask(() => {
      setPracticeSource(config.source);
      setPracticeMode(config.mode);
      setFilters(config.filters);
      setQueryBootstrapped(true);
    });
  }, []);

  function resetAnswerState() {
    setAnswer("");
    setEvaluation(null);
    setPendingFollowUp(null);
    setFollowUpAnswer("");
    setFollowUpVoiceMessage("");
    setVoiceMessage("");
    setSuccessMessage("");
    setTranscriptionDraft("");
    setAudioPath(null);
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
    setQuestionStartedAt(Date.now());
  }

  useEffect(() => {
    if (!queryBootstrapped) return;

    const controller = new AbortController();

    async function loadPractice() {
      setIsLoading(true);
      setErrorMessage("");

      const params = new URLSearchParams();
      if (filters.area) params.set("area", filters.area);
      if (filters.subject) params.set("subject", filters.subject);
      if (filters.subsubject) params.set("subsubject", filters.subsubject);
      if (filters.professor) params.set("professor", filters.professor);
      if (filters.difficulty) params.set("difficulty", filters.difficulty);
      if (filters.questionType) params.set("questionType", filters.questionType);

      const response = practiceSource === "demo"
        ? await fetch(`/api/practice/demo?${params.toString()}`, { signal: controller.signal })
        : await fetch("/api/practice/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              mode: practiceMode,
              limit: 10,
              filters: {
                area: filters.area || undefined,
                subject: filters.subject || undefined,
                subsubject: filters.subsubject || undefined,
                professor: filters.professor || undefined,
                difficulty: filters.difficulty || undefined,
                questionType: filters.questionType || undefined,
              },
            }),
          });

      if (controller.signal.aborted) return;

      if (response.status === 401) {
        setData(null);
        setErrorMessage("Para usar práctica real tenés que iniciar sesión. Podés seguir en modo demo mientras tanto.");
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setData(null);
        setErrorMessage(payload?.error ?? "No se pudo cargar la práctica.");
        setIsLoading(false);
        return;
      }

      const payload = await response.json() as PracticeResponse;
      setData(payload);
      setCurrentIndex(0);
      setAnswer("");
      setEvaluation(null);
      setPendingFollowUp(null);
      setFollowUpAnswer("");
      setFollowUpVoiceMessage("");
      setSectionEvaluations({});
      setVoiceMessage("");
      setTranscriptionDraft("");
      setAudioPath(null);
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
      setQuestionStartedAt(Date.now());
      setIsLoading(false);
    }

    loadPractice().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setErrorMessage(error instanceof Error ? error.message : "Error inesperado al cargar la práctica.");
      setIsLoading(false);
    });

    return () => controller.abort();
  }, [filters, practiceMode, practiceSource, queryBootstrapped]);

  useEffect(() => {
    return () => {
      stopMediaStream(mediaStreamRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (followUpAudioUrl) URL.revokeObjectURL(followUpAudioUrl);
    };
  }, [audioUrl, followUpAudioUrl]);

  const currentQuestion = data?.questions[currentIndex] ?? null;
  const sectionScores = useMemo(
    () => Object.values(sectionEvaluations).map((result) => result.evaluation.percentage),
    [sectionEvaluations],
  );
  const sectionSummary = useMemo(() => {
    if (!data || data.questions.length === 0 || sectionScores.length === 0) return null;

    const totalScore = sectionScores.reduce((sum, score) => sum + score, 0);

    return {
      average: Math.round(totalScore / sectionScores.length),
      lowest: Math.min(...sectionScores),
      highest: Math.max(...sectionScores),
      answeredCount: sectionScores.length,
      totalQuestions: data.questions.length,
      isComplete: sectionScores.length === data.questions.length,
    };
  }, [data, sectionScores]);
  const progress = useMemo(() => {
    if (!data || data.questions.length === 0) return 0;
    return Math.round(((currentIndex + 1) / data.questions.length) * 100);
  }, [currentIndex, data]);

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
      const prefix = isFollowUp ? "repregunta" : "respuesta";
      formData.append("audio", new File([blob], `${prefix}-${Date.now()}.${extension}`, { type: blob.type || "audio/webm" }));

      const response = await fetch("/api/transcriptions", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setIsTranscribing(false);
        setTranscribingTarget(null);
        setTargetVoiceMessage(`Error al transcribir: ${payload?.error ?? "No se pudo transcribir el audio. Intentá de nuevo."}`);
        return;
      }

      const payload = await response.json() as TranscriptionResponse;
      if (isFollowUp) {
        setFollowUpAnswer(payload.transcription);
        setFollowUpVoiceMessage(payload.note);
      } else {
        setAudioPath(payload.audioPath);
        setTranscriptionDraft(payload.transcription);
        setAnswer(payload.transcription);
        setVoiceMessage(payload.note);
      }
      setIsTranscribing(false);
      setTranscribingTarget(null);
    } catch {
      setIsTranscribing(false);
      setTranscribingTarget(null);
      setTargetVoiceMessage("Error al transcribir: no se pudo conectar. Intentá de nuevo.");
    }
  }

  async function startRecording(target: RecordingTarget = "answer") {
    if (practiceSource !== "real") {
      setErrorMessage("La respuesta por voz requiere práctica real e inicio de sesión.");
      return;
    }

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

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("Este navegador no permite grabar audio desde la página.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setErrorMessage("Este navegador no soporta MediaRecorder para grabar respuestas.");
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
        setErrorMessage("La grabación quedó vacía. Probá de nuevo acercándote al micrófono.");
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
      setFollowUpVoiceMessage("Grabando repregunta... respondé sólo el punto que te pidieron precisar.");
    } else {
      setVoiceMessage("Grabando... hablá claro y dejá pausas breves entre ideas.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  function clearVoiceAnswer() {
    resetAnswerState();
    setAnswerMode("text");
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
    if (!currentQuestion || !answer.trim()) return;
    if (pendingFollowUp && !followUpAnswer.trim()) return;

    setIsEvaluating(true);
    setErrorMessage("");

    const endpoint = practiceSource === "demo" ? "/api/evaluations/demo" : "/api/evaluations";
    const body = practiceSource === "demo"
      ? {
          sourceReference: currentQuestion.sourceReference,
          answer,
          followUp: pendingFollowUp
            ? {
                question: pendingFollowUp.question,
                answer: followUpAnswer,
              }
            : undefined,
          timeSeconds: Math.max(1, Math.round((Date.now() - questionStartedAt) / 1000)),
        }
      : {
          questionId: currentQuestion.id,
          sessionId: data?.sessionId,
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
        };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setErrorMessage(payload?.error ?? "No se pudo evaluar la respuesta.");
      setIsEvaluating(false);
      return;
    }

    const payload = await response.json() as EvaluationResponse | FollowUpResponse;
    if (payload.status === "requires_follow_up") {
      setPendingFollowUp(payload.followUp);
      setFollowUpAnswer("");
      setIsEvaluating(false);
      return;
    }

    setEvaluation(payload);
    setSectionEvaluations((current) => ({ ...current, [currentIndex]: payload }));
    setPendingFollowUp(null);
    setFollowUpAnswer("");
    setIsEvaluating(false);
  }

  function goToQuestion(index: number) {
    if (!data) return;
    const nextIndex = Math.min(Math.max(index, 0), data.questions.length - 1);

    setCurrentIndex(nextIndex);
    resetAnswerState();
    setEvaluation(sectionEvaluations[nextIndex] ?? null);
  }

  function previousQuestion() {
    goToQuestion(currentIndex - 1);
  }

  function nextQuestion() {
    goToQuestion(currentIndex + 1);
  }

  function repeatQuestion() {
    resetAnswerState();
    setSectionEvaluations((current) => {
      const next = { ...current };
      delete next[currentIndex];
      return next;
    });
  }

  async function updateQuestionState(status: "mastered" | "needs_review" | "excluded") {
    if (!currentQuestion?.id) {
      setErrorMessage("Las marcas de avance solo están disponibles en práctica real.");
      return;
    }

    const response = await fetch(`/api/questions/${currentQuestion.id}/state`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        isExcluded: status === "excluded",
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setErrorMessage(payload?.error ?? "No se pudo actualizar el estado de la pregunta.");
      return;
    }

    setSuccessMessage(status === "mastered"
      ? "Pregunta marcada como dominada."
      : status === "needs_review"
        ? "Pregunta marcada para repaso."
        : "Pregunta excluida del rotatorio.");
  }

  return (
    <main className="practice-shell">
      <aside className="practice-sidebar">
        <Link className="back-link" href="/">← Volver al inicio</Link>
        <h1>Práctica por texto</h1>
        <p>
          Entrená con práctica real para guardar sesiones, intentos y progreso.
          El modo demo sigue disponible para probar sin iniciar sesión.
        </p>

        <div className="mode-switch" aria-label="Tipo de práctica">
          <button type="button" className={practiceSource === "real" ? "active" : ""} onClick={() => setPracticeSource("real")}>Real</button>
          <button type="button" className={practiceSource === "demo" ? "active" : ""} onClick={() => setPracticeSource("demo")}>Demo</button>
        </div>

        {errorMessage && (
          <div className="notice-card">
            <p>{errorMessage}</p>
            {practiceSource === "real" && errorMessage.includes("iniciar sesión") && (
              <Link className="notice-link" href="/auth/login">Iniciar sesión</Link>
            )}
          </div>
        )}

        <div className="filter-stack">
          <label>
            Modo
            <select value={practiceMode} onChange={(event) => setPracticeMode(event.target.value as PracticeMode)} disabled={practiceSource === "demo"}>
              {Object.entries(practiceModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Área
            <select value={filters.area} onChange={(event) => setFilters((state) => ({ ...state, area: event.target.value, subject: "", subsubject: "" }))}>
              <option value="">Todas</option>
              {data?.facets.areas.map((area) => <option key={area}>{area}</option>)}
            </select>
          </label>
          <label>
            Materia
            <select value={filters.subject} onChange={(event) => setFilters((state) => ({ ...state, subject: event.target.value, subsubject: "" }))}>
              <option value="">Todas</option>
              {data?.facets.subjects.map((subject) => <option key={subject}>{subject}</option>)}
            </select>
          </label>
          <label>
            Submateria / temario
            <select value={filters.subsubject} onChange={(event) => setFilters((state) => ({ ...state, subsubject: event.target.value }))}>
              <option value="">Todas</option>
              {data?.facets.subsubjects.map((subsubject) => <option key={subsubject}>{subsubject}</option>)}
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
          <label>
            Tipo de pregunta
            <select value={filters.questionType} onChange={(event) => setFilters((state) => ({ ...state, questionType: event.target.value }))}>
              <option value="">Todos</option>
              {data?.facets.questionTypes.map((questionType) => (
                <option key={questionType} value={questionType}>{questionTypeLabels[questionType] ?? questionType}</option>
              ))}
            </select>
          </label>
        </div>
      </aside>

      <section className="practice-main">
        {isLoading && <div className="practice-card-large">Cargando preguntas...</div>}

        {!isLoading && !currentQuestion && (
          <div className="practice-card-large">
            {errorMessage
              ? errorMessage
              : "No hay preguntas para estos filtros. Probá con otro modo o sacá algún filtro."}
          </div>
        )}

        {!isLoading && currentQuestion && (
          <>
            <div className="practice-status">
              <span>
                {data?.mode === "real" ? "Sesión real" : "Modo demo"} · Pregunta {currentIndex + 1} de {data?.questions.length}
                {data?.sessionId ? ` · sesión ${data.sessionId.slice(0, 8)}` : ""}
              </span>
              <div className="practice-progress"><span style={{ width: `${progress}%` }} /></div>
            </div>

            {sectionSummary && (
              <article className={`practice-card-large section-average-card ${sectionSummary.isComplete ? "complete" : ""}`}>
                <div>
                  <span>{sectionSummary.isComplete ? "Seccion completa" : "Promedio parcial"}</span>
                  <h2>{sectionSummary.average}%</h2>
                  <p>
                    {sectionSummary.answeredCount}/{sectionSummary.totalQuestions} preguntas evaluadas.
                    {sectionSummary.isComplete
                      ? " Buenisimo: ahora mira el patron, no solo el numero."
                      : " El promedio final aparece al completar las 10."}
                  </p>
                </div>
                <div className="section-average-stats">
                  <div><strong>{sectionSummary.highest}%</strong><small>Mejor</small></div>
                  <div><strong>{sectionSummary.lowest}%</strong><small>Mas bajo</small></div>
                </div>
              </article>
            )}

            <article className="practice-card-large question-panel">
              <div className="question-meta">
                <span>{currentQuestion.areaName}</span>
                <span>{currentQuestion.subjectName}</span>
                <span>{currentQuestion.professorName}</span>
                <span>{currentQuestion.difficulty === "high" ? "Alta" : currentQuestion.difficulty === "medium" ? "Media" : "Baja"}</span>
                <span>{questionTypeLabels[currentQuestion.questionType] ?? currentQuestion.questionType}</span>
                <span>{currentQuestion.estimatedProbability}% prob.</span>
                {practiceSource === "real" && <span>{currentQuestion.attemptCount ?? 0} intentos</span>}
              </div>
              <h2>{currentQuestion.statement}</h2>
              <p>{currentQuestion.subsubjectName}</p>
            </article>

            <article className="practice-card-large answer-panel">
              <div className="answer-mode-tabs" aria-label="Modo de respuesta">
                <button
                  type="button"
                  className={answerMode === "text" ? "active" : ""}
                  onClick={() => {
                    if (isRecording) stopRecording();
                    setAnswerMode("text");
                  }}
                >Texto</button>
                <button type="button" className={answerMode === "voice" ? "active" : ""} onClick={() => setAnswerMode("voice")}>Voz</button>
              </div>

              {answerMode === "voice" && (
                <div className="voice-panel">
                  <div>
                    <strong>Respuesta oral</strong>
                    <p>Grabá tu respuesta, esperá la transcripción y corregí el texto antes de evaluar.</p>
                  </div>
                  <div className="practice-actions compact">
                    {!(isRecording && recordingTarget === "answer")
                      ? <button type="button" onClick={() => startRecording("answer")} disabled={isTranscribing || isRecording || practiceSource !== "real" || Boolean(pendingFollowUp)}>Grabar respuesta</button>
                      : <button type="button" onClick={stopRecording}>Detener grabación</button>}
                    <button type="button" className="secondary" onClick={clearVoiceAnswer} disabled={isRecording || isTranscribing}>Limpiar audio</button>
                  </div>
                  {audioUrl && <audio controls src={audioUrl} />}
                  {isTranscribing && transcribingTarget === "answer" && <p>Transcribiendo con OpenAI...</p>}
                  {voiceMessage && <p>{voiceMessage}</p>}
                  {practiceSource !== "real" && <p>La transcripción por voz requiere modo real e inicio de sesión.</p>}
                </div>
              )}

              <label>
                {answerMode === "voice" ? "Transcripción editable" : "Tu respuesta"}
                <textarea
                  value={answer}
                  disabled={Boolean(evaluation) || Boolean(pendingFollowUp)}
                  onChange={(event) => {
                    setAnswer(event.target.value);
                    if (answerMode === "voice") setTranscriptionDraft(event.target.value);
                  }}
                  placeholder={answerMode === "voice"
                    ? "Cuando termine la transcripción, corregí aquí errores de audio antes de evaluar."
                    : "Respondé como si estuvieras frente a la comisión: define, desarrolla, aplica y cerrá con orden."}
                />
              </label>
              {pendingFollowUp && (
                <div className="adaptive-follow-up">
                  <div>
                    <span>Repregunta de comisión</span>
                    <strong>{pendingFollowUp.question}</strong>
                    <p>{pendingFollowUp.reason}</p>
                    {pendingFollowUp.targetCriteria.length > 0 && (
                      <small>
                        Criterios apuntados:{" "}
                        {pendingFollowUp.targetCriteria.map((criterion) => rubricLabels[criterion] ?? criterion).join(", ")}
                      </small>
                    )}
                  </div>
                  <label>
                    Tu respuesta complementaria
                    <textarea
                      value={followUpAnswer}
                      onChange={(event) => setFollowUpAnswer(event.target.value)}
                      placeholder="Contestá esta repregunta de forma concreta. La nota sale después de combinar esta respuesta con la inicial."
                    />
                  </label>
                  <div className="voice-panel follow-up-voice-panel">
                    <div>
                      <strong>Responder repregunta por voz</strong>
                      <p>Grabá sólo el complemento que faltó; se transcribe acá arriba y después se evalúa la respuesta final completa.</p>
                    </div>
                    <div className="practice-actions compact">
                      {!(isRecording && recordingTarget === "followUp")
                        ? <button type="button" onClick={() => startRecording("followUp")} disabled={isTranscribing || isRecording || practiceSource !== "real"}>Grabar repregunta</button>
                        : <button type="button" onClick={stopRecording}>Detener repregunta</button>}
                      <button type="button" className="secondary" onClick={clearFollowUpVoiceAnswer} disabled={isRecording || isTranscribing}>Limpiar repregunta</button>
                    </div>
                    {followUpAudioUrl && <audio controls src={followUpAudioUrl} />}
                    {isTranscribing && transcribingTarget === "followUp" && <p>Transcribiendo repregunta con OpenAI...</p>}
                    {followUpVoiceMessage && <p>{followUpVoiceMessage}</p>}
                    {practiceSource !== "real" && <p>La transcripción por voz requiere modo real e inicio de sesión.</p>}
                  </div>
                </div>
              )}
              <div className="practice-actions">
                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={isEvaluating || isRecording || isTranscribing || !answer.trim() || Boolean(pendingFollowUp && !followUpAnswer.trim())}
                >
                  {isEvaluating
                    ? pendingFollowUp ? "Evaluando respuesta completa..." : "Analizando..."
                    : pendingFollowUp
                      ? practiceSource === "real" ? "Evaluar respuesta completa" : "Evaluar respuesta demo completa"
                      : practiceSource === "real" ? "Enviar respuesta" : "Enviar respuesta demo"}
                </button>
                <button type="button" className="secondary" onClick={repeatQuestion}>Repetir</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={previousQuestion}
                  disabled={isEvaluating || isRecording || isTranscribing || currentIndex === 0}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={nextQuestion}
                  disabled={isEvaluating || isRecording || isTranscribing || !data || currentIndex >= data.questions.length - 1}
                >
                  Siguiente
                </button>
              </div>
              {successMessage && (
                <div className="notice success">{successMessage}</div>
              )}
              {practiceSource === "real" && (
                <div className="practice-actions compact">
                  <button type="button" className="secondary" onClick={() => { setSuccessMessage(""); updateQuestionState("mastered"); }}>Marcar dominada</button>
                  <button type="button" className="secondary" onClick={() => { setSuccessMessage(""); updateQuestionState("needs_review"); }}>Mandar a repaso</button>
                  <button type="button" className="secondary danger" onClick={() => { setSuccessMessage(""); updateQuestionState("excluded"); }}>Excluir</button>
                </div>
              )}
            </article>

            {evaluation && (
              <article className="practice-card-large evaluation-panel">
                <div className="evaluation-header">
                  <div>
                    <span>{practiceSource === "real" ? "Resultado guardado" : "Resultado demo"}</span>
                    <h3>{evaluation.evaluation.percentage}%</h3>
                  </div>
                  <strong>{evaluation.evaluation.totalScore} / 40 puntos</strong>
                </div>
                <p>{evaluation.evaluation.summary}</p>

                <div className="rubric-grid">
                  {Object.entries(evaluation.evaluation.rubric).map(([key, value]) => (
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
                {evaluation.note && <small>{evaluation.note}</small>}
              </article>
            )}
          </>
        )}
      </section>
    </main>
  );
}
