import test from "node:test";
import assert from "node:assert/strict";
import { getHomeQuestionOrder, parseHomeFeedRequest, summarizePublicAreas } from "./question-feed";

test("parses only supported view and bounds the feed page size", () => {
  assert.deepEqual(parseHomeFeedRequest(new URLSearchParams("view=recent&limit=999")), { view: "recent", limit: 20, cursor: null });
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
