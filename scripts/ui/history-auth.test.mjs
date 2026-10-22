import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path) => readFileSync(new URL(`../../src/app/${path}`, import.meta.url), "utf8");
test("history uses unique attempt anchors and one legacy question target", () => {
  const page = read("history/page.tsx");
  assert.match(page, /id=\{`attempt-\$\{attempt.id\}`\}/);
  assert.match(page, /uniqueQuestions.find\(\(latest\) => latest.question.id === attempt.question.id\)\?\.id === attempt.id/);
  assert.match(page, /role="status"/);
  assert.match(page, /role="alert"/);
});
test("login supports autofill and validates signup before authentication", () => {
  const page = read("auth/login/page.tsx");
  assert.match(page, /name="email" autoComplete="username"/);
  assert.match(page, /name="password" autoComplete="current-password"/);
  assert.match(page, /event.currentTarget.form\?\.reportValidity\(\)/);
  assert.match(page, /role="status" aria-live="polite"/);
});
test("history and auth retain bounded responsive layouts", () => {
  const css = read("globals.css");
  assert.match(css, /\.history-student-shell \.app-top-nav\s*\{\s*width: min\(1180px, 100%\)/);
  assert.match(css, /\.auth-form input\s*\{\s*min-height: 44px;/);
  assert.match(css, /\.history-student-shell \.question-risk-row\s*\{\s*border-radius: var\(--radius-panel\)/);
});
