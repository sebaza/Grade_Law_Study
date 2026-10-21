export type HomeQuestionView = "recent" | "featured";

export function parseHomeFeedRequest(params: URLSearchParams) {
  const rawLimit = Number(params.get("limit") ?? 3);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 20) : 3;
  const rawView = params.get("view");
  const view: HomeQuestionView = rawView === "recent" ? "recent" : "featured";
  const rawCursor = params.get("cursor");
  const [createdAt, id] = rawCursor?.split("|") ?? [];
  const cursor = createdAt && id && !Number.isNaN(Date.parse(createdAt)) ? { createdAt, id } : null;
  const query = params.get("q")?.trim().slice(0, 200) || undefined;
  return { view, limit, cursor, query };
}

export function getHomeQuestionOrder(view: HomeQuestionView) {
  return view === "recent"
    ? [{ createdAt: "desc" as const }, { id: "desc" as const }]
    : [{ priorityScore: "desc" as const }, { estimatedProbability: "desc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }];
}

export function summarizePublicAreas(questions: Array<{ area: { name: string } }>) {
  const counts = new Map<string, number>();
  for (const question of questions) counts.set(question.area.name, (counts.get(question.area.name) ?? 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b, "es")).map(([areaName, questionCount]) => ({ areaName, questionCount }));
}
