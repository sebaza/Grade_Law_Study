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
  assert.match(css, /\.history-student-shell \.app-top-nav\s*\{\s*width: min\(var\(--editorial-canvas\), 100%\)/);
  assert.match(css, /\.auth-form input\s*\{\s*min-height: 44px;/);
  assert.match(css, /\.history-student-shell \.question-risk-row\s*\{[^}]*width: min\(var\(--editorial-canvas\), 100%\)/);
});

test("history loading, access, empty, and populated views share an editorial hierarchy", () => {
  const page = read("history/page.tsx");
  const css = read("globals.css");

  assert.match(page, /menu-page-shell history-student-shell book-history-shell/);
  assert.match(page, /page-hero compact-hero history-editorial-hero/);
  assert.match(page, /practice-card-large empty-state history-access-chapter/);
  assert.match(page, /history-kpi-grid history-kpi-ledger/);
  assert.match(page, /history-grid history-chapter-grid/);
  assert.match(page, /practice-card-large history-attempts-chapter/);
  assert.match(page, /LoadingCard label="Cargando historial\.\.\."/);
  assert.match(page, /empty-state-inline/);
  assert.match(css, /\.book-history-shell \.history-editorial-hero h1\s*\{[^}]*font-family: Georgia/);
  assert.match(css, /\.history-kpi-ledger > article::before\s*\{[^}]*counter\(history-kpi, decimal-leading-zero\)/);
  assert.match(css, /\.history-chapter-grid > article::before\s*\{[^}]*counter\(history-chapter, decimal-leading-zero\)/);
  assert.match(css, /\.book-history-shell \.loading-card\s*\{[^}]*border-top:/);
});

test("login keeps its auth form while applying the book-inspired card hierarchy", () => {
  const page = read("auth/login/page.tsx");
  const css = read("globals.css");

  assert.match(page, /<main className="auth-shell book-auth-shell">/);
  assert.match(page, /<section className="auth-card auth-book-card">/);
  assert.match(page, /<p className="auth-book-kicker">Acceso a tu progreso<\/p>/);
  assert.match(page, /<form className="auth-form auth-book-form" onSubmit=\{submit\} aria-busy=\{isLoading\}>/);
  assert.match(css, /\.auth-book-card h1\s*\{[^}]*font-family: Georgia/);
  assert.match(css, /\.auth-book-form\s*\{[^}]*border-top:/);
});

test("history and login use the shared canvas while retaining form focus", () => {
  const css = read("globals.css");
  assert.match(css, /\.history-student-shell \.app-top-nav\s*\{\s*width: min\(var\(--editorial-canvas\), 100%\)/);
  assert.match(css, /\.book-page-open-section,[\s\S]*?\.book-history-shell \.history-chapter-grid > article[\s\S]*?\.book-history-shell \.question-risk-row[\s\S]*?\.admin-editorial-layout > \.admin-list-panel\s*\)\s*\{[^}]*border-radius: 0;[^}]*box-shadow: none;[^}]*background: transparent/);
  assert.match(css, /\.dashboard-kpi-ledger \.kpi,\s*\.book-history-shell \.history-kpi-ledger > article\s*\{[^}]*border: 0;[^}]*border-right: 1px solid var\(--border\);[^}]*background: transparent/);
  assert.match(css, /\.book-auth-shell \.auth-book-card\s*\{[^}]*max-width: min\(100%, 40rem\);[^}]*box-shadow: none/);
  assert.match(css, /\.auth-book-form\s*\{[^}]*background: var\(--surface\)/);
  assert.match(css, /\.book-auth-shell\s*\{[^}]*background: var\(--background\)/);
});

test("history and login clarify scan order and account intent", () => {
  const history = read("history/page.tsx");
  const login = read("auth/login/page.tsx");
  const css = read("globals.css");
  assert.match(history, /className="attempt-history-row rich-attempt-row history-attempt-scan"/);
  assert.match(history, /attempt-actions-stack history-attempt-actions/);
  assert.match(css, /\.history-attempt-scan \.history-attempt-actions \.score-pill\s*\{[^}]*justify-self: start/);
  assert.match(login, /className="auth-signin-action"/);
  assert.match(login, /className="secondary auth-signup-action"/);
  assert.match(login, /className="auth-signup-hint"/);
});
