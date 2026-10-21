import assert from "node:assert/strict";
import test from "node:test";

import {
  buildImportPlan,
  KNOWN_CONTENT_MATCH,
  validateStagingBatch,
  type ExistingQuestionSnapshot,
  type StagedQuestion,
} from "./staged-question-bank";

function question(index: number, overrides: Partial<StagedQuestion> = {}): StagedQuestion {
  return {
    sourceReference: `test:question:${index}`,
    statement: `Question ${index}?`,
    areaName: "Derecho Civil",
    subjectName: "Obligaciones",
    subsubjectName: "General",
    professorName: "Test Professor",
    difficulty: "medium",
    estimatedProbability: 0,
    priorityScore: 0,
    questionType: "oral",
    origin: "real_question",
    expectedAnswer: `Answer ${index}`,
    rubricNotes: "Reviewed.",
    keyPoints: [
      {
        label: "Point 1",
        description: `Key point ${index}`,
        weight: 1,
        isRequired: true,
        orderIndex: 0,
      },
    ],
    commonErrors: [{ description: `Error ${index}`, severity: "medium" }],
    metadata: { legalReviewStatus: "reviewed" },
    ...overrides,
  };
}

function batch(overrides: Partial<StagedQuestion> = {}) {
  return {
    questionCount: 226,
    questions: Array.from({ length: 226 }, (_, index) => question(index, index === 0 ? overrides : {})),
  };
}

function existingFrom(item: StagedQuestion, overrides: Partial<ExistingQuestionSnapshot> = {}): ExistingQuestionSnapshot {
  return {
    id: "existing-id",
    sourceReference: item.sourceReference,
    statement: item.statement,
    areaName: item.areaName,
    subjectName: item.subjectName,
    subsubjectName: item.subsubjectName,
    difficulty: item.difficulty,
    estimatedProbability: item.estimatedProbability,
    priorityScore: item.priorityScore,
    questionType: item.questionType,
    origin: item.origin,
    isActive: true,
    expectedAnswers: [
      {
        modelAnswer: item.expectedAnswer,
        rubricNotes: item.rubricNotes,
        version: 1,
        isActive: true,
      },
    ],
    keyPoints: item.keyPoints,
    commonErrors: item.commonErrors,
    professorNames: [item.professorName],
    ...overrides,
  };
}

test("validateStagingBatch accepts exactly 226 fully reviewed unique questions", () => {
  const result = validateStagingBatch(batch());
  assert.equal(result.length, 226);
});

test("validateStagingBatch rejects a question that is not reviewed", () => {
  const input = batch();
  (input.questions[0].metadata as Record<string, unknown>).legalReviewStatus =
    "human_confirmation_required";
  assert.throws(() => validateStagingBatch(input), /reviewed/);
});

test("validateStagingBatch rejects duplicate source references", () => {
  const input = batch();
  input.questions[1].sourceReference = input.questions[0].sourceReference;
  assert.throws(() => validateStagingBatch(input), /sourceReference/);
});

test("buildImportPlan classifies inserts and exact source-reference reruns", () => {
  const item = question(1);
  assert.equal(buildImportPlan([item], []).entries[0].action, "insert");
  assert.equal(buildImportPlan([item], [existingFrom(item)]).entries[0].action, "noop_source_match");
});

test("buildImportPlan blocks drift under an existing source reference", () => {
  const item = question(1);
  const plan = buildImportPlan([item], [existingFrom(item, { statement: "Changed statement" })]);
  assert.equal(plan.entries[0].action, "blocked_source_drift");
  assert.equal(plan.conflicts, 1);
});

test("buildImportPlan permits only the known Civil content match", () => {
  const known = question(1, {
    sourceReference: KNOWN_CONTENT_MATCH.sourceReference,
    statement: KNOWN_CONTENT_MATCH.statement,
    areaName: KNOWN_CONTENT_MATCH.areaName,
  });
  const existing = existingFrom(known, { sourceReference: "legacy:existing-question" });
  assert.equal(buildImportPlan([known], [existing]).entries[0].action, "noop_known_content_match");

  const other = question(2);
  const collision = existingFrom(other, { sourceReference: "legacy:other-question" });
  const blocked = buildImportPlan([other], [collision]);
  assert.equal(blocked.entries[0].action, "blocked_content_collision");
  assert.equal(blocked.conflicts, 1);
});
