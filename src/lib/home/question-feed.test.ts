import test from "node:test";
import assert from "node:assert/strict";
import { getHomeQuestionOrder, parseHomeFeedRequest, summarizePublicAreas } from "./question-feed";
import { buildQuestionSearchWhere } from "./question-search";

test("parses only supported view and bounds the feed page size", () => {
  assert.deepEqual(parseHomeFeedRequest(new URLSearchParams("view=recent&limit=999")), { view: "recent", limit: 20, cursor: null, query: undefined });
  assert.equal(parseHomeFeedRequest(new URLSearchParams("view=unknown&limit=0")).view, "featured");
});

test("uses deterministic ordering with id as the final tie breaker", () => {
  assert.deepEqual(getHomeQuestionOrder("recent"), [{ createdAt: "desc" }, { id: "desc" }]);
  assert.deepEqual(getHomeQuestionOrder("featured"), [{ priorityScore: "desc" }, { estimatedProbability: "desc" }, { createdAt: "desc" }, { id: "desc" }]);
});

test("public summary exposes only area names and counts", () => {
  const summary = summarizePublicAreas([
    { area: { name: "Civil" } }, { area: { name: "Civil" } }, { area: { name: "Procesal" } },
  ]);
  assert.deepEqual(summary, [{ areaName: "Civil", questionCount: 2 }, { areaName: "Procesal", questionCount: 1 }]);
  assert.equal(JSON.stringify(summary).includes("statement"), false);
});

test("search matches all approved question content fields with case-insensitive contains", () => {
  const where = buildQuestionSearchWhere("acción civil");
  assert.deepEqual(where.OR, [
    { statement: { contains: "acción civil", mode: "insensitive" } },
    { area: { name: { contains: "acción civil", mode: "insensitive" } } },
    { subject: { name: { contains: "acción civil", mode: "insensitive" } } },
    { subsubject: { name: { contains: "acción civil", mode: "insensitive" } } },
    { professors: { some: { professor: { name: { contains: "acción civil", mode: "insensitive" } } } } },
    { expectedAnswers: { some: { isActive: true, OR: [
      { modelAnswer: { contains: "acción civil", mode: "insensitive" } },
      { rubricNotes: { contains: "acción civil", mode: "insensitive" } },
    ] } } },
    { keyPoints: { some: { OR: [
      { label: { contains: "acción civil", mode: "insensitive" } },
      { description: { contains: "acción civil", mode: "insensitive" } },
    ] } } },
    { commonErrors: { some: { description: { contains: "acción civil", mode: "insensitive" } } } },
  ]);
});

test("blank search contributes no OR clause", () => {
  assert.deepEqual(buildQuestionSearchWhere("  "), {});
});

test("Home request trims and bounds the shared search query", () => {
  assert.equal(parseHomeFeedRequest(new URLSearchParams("q=%20Civil%20")).query, "Civil");
});
