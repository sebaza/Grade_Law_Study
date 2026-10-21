"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type FeedResponse = {
  view: "recent" | "featured";
  public: boolean;
  byArea?: Array<{ areaName: string; questionCount: number }>;
  questions?: Array<{ id: string; statement: string; areaName: string; subjectName: string; createdAt: string; completed: boolean }>;
  nextCursor?: string | null;
};

function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short" }).format(new Date(value));
}

export function HomeQuestionFeed({ isPublic }: { isPublic: boolean }) {
  const [view, setView] = useState<"recent" | "featured">("recent");
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPage(nextView: "recent" | "featured", nextCursor?: string | null, append = false) {
    setIsLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ view: nextView, limit: "3" });
      if (nextCursor) query.set("cursor", nextCursor);
      const response = await fetch(`/api/home/questions?${query}`);
      if (!response.ok) throw new Error("No se pudieron cargar las preguntas nuevas.");
      const result = await response.json() as FeedResponse;
      setFeed((previous) => append && previous && result.questions
        ? { ...result, questions: [...(previous.questions ?? []), ...result.questions] }
        : result);
      setCursor(result.nextCursor ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error al cargar preguntas.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ view, limit: "3" });
    fetch(`/api/home/questions?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar las preguntas nuevas.");
        return await response.json() as FeedResponse;
      })
      .then((result) => {
        setFeed(result);
        setCursor(result.nextCursor ?? null);
        setError("");
        setIsLoading(false);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Error al cargar preguntas.");
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [view]);

  return (
    <section className="practice-card-large home-question-feed" aria-labelledby="home-question-feed-title">
      <div className="section-heading-row">
        <div><p className="eyebrow">Para practicar</p><h2 id="home-question-feed-title">Preguntas recién agregadas</h2></div>
      </div>
      <div className="home-question-tabs" aria-label="Tipo de preguntas">
        <button type="button" aria-pressed={view === "recent"} onClick={() => { if (view !== "recent") { setIsLoading(true); setFeed(null); setView("recent"); } }}>Más recientes</button>
        <button type="button" aria-pressed={view === "featured"} onClick={() => { if (view !== "featured") { setIsLoading(true); setFeed(null); setView("featured"); } }}>Destacadas</button>
      </div>
      {isLoading && <p className="muted-copy" aria-live="polite">Cargando preguntas…</p>}
      {error && <p className="muted-copy" role="alert">{error}</p>}
      {!isLoading && !error && isPublic && (
        <div className="landing-area-list">
          {(feed?.byArea ?? []).map((area) => <div className="landing-area-row" key={area.areaName}><span>{area.areaName}</span><strong>{area.questionCount}</strong></div>)}
          {!feed?.byArea?.length && <p className="muted-copy">No hay preguntas disponibles en esta vista.</p>}
        </div>
      )}
      {!isLoading && !error && !isPublic && (
        <div className="home-question-list">
          {(feed?.questions ?? []).map((question) => (
            <article className="home-question-row" key={question.id}>
              <div><p className="muted-copy">{question.areaName} · {question.subjectName} · {shortDate(question.createdAt)}</p><p>{question.statement}</p></div>
              <div className="inline-actions">
                {question.completed && <span className="question-completed">✓ Realizada</span>}
                <Link className="secondary-button" href={`/practice?source=real&mode=random&questionId=${question.id}`}>Practicar</Link>
              </div>
            </article>
          ))}
          {!feed?.questions?.length && <p className="muted-copy">No hay preguntas disponibles en esta vista.</p>}
        </div>
      )}
      {!isPublic && cursor && !isLoading && !error && <button className="secondary-button" type="button" onClick={() => void loadPage(view, cursor, true)}>Cargar más</button>}
      {isPublic && <p className="muted-copy">Inicia sesión para ver y practicar las preguntas.</p>}
    </section>
  );
}
