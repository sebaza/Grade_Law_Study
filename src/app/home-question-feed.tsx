"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type FeedResponse = {
  view: "recent" | "featured";
  public: boolean;
  byArea?: Array<{ areaName: string; questionCount: number }>;
  questions?: Array<{ id: string; statement: string; areaName: string; subjectName: string; createdAt: string; completed: boolean }>;
  nextCursor?: string | null;
};

function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function HomeQuestionFeed({ isPublic }: { isPublic: boolean }) {
  const [view, setView] = useState<"recent" | "featured">("recent");
  const [searchTerm, setSearchTerm] = useState("");
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pageCursor, setPageCursor] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const activeRequest = useRef<AbortController | null>(null);

  function resetResults() {
    // Invalidate synchronously, including during the search debounce window.
    activeRequest.current?.abort();
    setIsLoading(true);
    setError("");
    setFeed(null);
    setCursor(null);
    setPageCursor(null);
  }

  function selectView(nextView: "recent" | "featured") {
    if (nextView === view) return;
    resetResults();
    setView(nextView);
  }

  useEffect(() => {
    const controller = new AbortController();
    activeRequest.current = controller;
    const query = new URLSearchParams({ view, limit: "3" });
    if (pageCursor) query.set("cursor", pageCursor);
    if (searchTerm.trim()) query.set("q", searchTerm.trim());
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/home/questions?${query}`, { signal: controller.signal });
        if (!response.ok) throw new Error("No se pudieron cargar las preguntas. Intenta de nuevo.");
        const result = await response.json() as FeedResponse;
        if (controller.signal.aborted) return;
        setFeed((previous) => pageCursor && previous && result.questions
          ? { ...result, questions: [...(previous.questions ?? []), ...result.questions] }
          : result);
        setCursor(result.nextCursor ?? null);
        setError("");
      } catch (loadError: unknown) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Error al cargar preguntas.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, pageCursor ? 0 : 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [view, searchTerm, pageCursor, retry, isPublic]);

  const emptyMessage = searchTerm.trim()
    ? "No encontramos preguntas. Prueba con otro término o borra la búsqueda."
    : "No hay preguntas disponibles en esta vista.";

  return (
    <section className="practice-card-large home-question-feed" aria-labelledby="home-question-feed-title" aria-busy={isLoading}>
      <div className="section-heading-row">
        <div><p className="eyebrow">Para practicar</p><h2 id="home-question-feed-title">Preguntas recién agregadas</h2></div>
      </div>
      <div className="home-question-search-field">
        <label htmlFor="home-question-search">Buscar preguntas</label>
        <input
          id="home-question-search"
          className="home-question-search"
          type="search"
          value={searchTerm}
          maxLength={200}
          aria-describedby="home-question-search-hint"
          onChange={(event) => { resetResults(); setSearchTerm(event.target.value); }}
          placeholder="Enunciado, materia, profesor o contenido…"
        />
        <p id="home-question-search-hint" className="muted-copy">Busca en ambas vistas por enunciado, materia, profesor o contenido.</p>
      </div>
      <div className="home-question-tabs" role="group" aria-label="Tipo de preguntas">
        <button type="button" aria-pressed={view === "recent"} onClick={() => selectView("recent")}>Más recientes</button>
        <button type="button" aria-pressed={view === "featured"} onClick={() => selectView("featured")}>Destacadas</button>
      </div>
      {feed && isPublic && (
        <div className="landing-area-list">
          {(feed.byArea ?? []).map((area) => <div className="landing-area-row" key={area.areaName}><span>{area.areaName}</span><strong>{area.questionCount}</strong></div>)}
          {!feed.byArea?.length && <p className="muted-copy">{emptyMessage}</p>}
        </div>
      )}
      {feed && !isPublic && (
        <div className="home-question-list">
          {(feed.questions ?? []).map((question) => (
            <article className="home-question-row" key={question.id}>
              <div className="home-question-content">
                <p className="home-question-meta">{question.areaName} · {question.subjectName} · <time dateTime={question.createdAt}>{shortDate(question.createdAt)}</time></p>
                <p className="home-question-statement">{question.statement}</p>
              </div>
              <div className="inline-actions">
                {question.completed && <span className="question-completed">✓ Realizada</span>}
                <Link className="secondary-button" href={`/practice?source=real&mode=random&questionId=${question.id}`}>Practicar</Link>
              </div>
            </article>
          ))}
          {!feed.questions?.length && <p className="muted-copy">{emptyMessage}</p>}
        </div>
      )}
      <div className="home-question-feedback" role="status" aria-live="polite">
        {isLoading && <p className="muted-copy">{feed ? "Cargando más preguntas…" : "Cargando preguntas…"}</p>}
      </div>
      {error && (
        <div className="home-question-error">
          <p role="alert">{error}</p>
          <button className="secondary-button" type="button" onClick={() => { setIsLoading(true); setError(""); setRetry((value) => value + 1); }}>Reintentar</button>
        </div>
      )}
      {!isPublic && cursor && !isLoading && !error && (
        <button className="secondary-button home-question-load-more" type="button" onClick={() => { setIsLoading(true); setError(""); setPageCursor(cursor); }}>Cargar más</button>
      )}
      {isPublic && <Link className="secondary-button home-question-login" href="/auth/login">Inicia sesión para practicar</Link>}
    </section>
  );
}
