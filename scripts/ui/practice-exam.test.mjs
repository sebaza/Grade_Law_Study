import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../../src/app/${file}`, import.meta.url), "utf8");

test("practice and exam selection controls expose their state", () => {
  for (const file of ["practice/page.tsx", "exam/page.tsx"]) {
    const page = read(file);
    assert.match(page, /aria-pressed=\{answerMode === "text"\}/);
    assert.match(page, /aria-pressed=\{answerMode === "voice"\}/);
    assert.match(page, /role="group" aria-label="Modo de respuesta"/);
  }
  assert.match(read("practice/page.tsx"), /aria-pressed=\{practiceSource === "demo"\}/);
  assert.match(read("exam/page.tsx"), /aria-current=\{index === currentIndex \? "step" : undefined\}/);
});

test("study layouts constrain controls and wrap actions", () => {
  const css = read("globals.css");
  assert.match(css, /\.exam-actions\s*\{\s*display: flex;\s*flex-wrap: wrap;/);
  assert.match(css, /\.practice-main,\s*\.exam-shell :is\(section, aside, label\)\s*\{\s*min-width: 0;/);
  assert.match(css, /\.practice-shell \.app-top-nav,\s*\.exam-shell \.app-top-nav\s*\{\s*width: min\(var\(--editorial-canvas\), 100%\)/);
  assert.match(css, /\.exam-clock-card\s*\{\s*background: var\(--surface-soft\);\s*color: var\(--ink\)/);
});

test("real and demo practice share an editorial chapter hierarchy", () => {
  const page = read("practice/page.tsx");
  const css = read("globals.css");

  assert.match(page, /<main className="practice-shell menu-with-top-nav book-study-shell">/);
  assert.match(page, /<p className="practice-section-kicker">Configura tu recorrido<\/p>/);
  assert.match(page, /<span className="practice-chapter-label">Pregunta de estudio<\/span>/);
  assert.match(css, /\.practice-shell\.book-study-shell \.practice-sidebar h1\s*\{[^}]*font-family: Georgia/);
  assert.match(css, /\.practice-shell\.book-study-shell \.question-panel h2\s*\{[^}]*font-family: Georgia/);
  assert.match(css, /\.practice-shell\.book-study-shell \.practice-card-large\s*\{[^}]*box-shadow: none/);
  assert.match(css, /\.practice-shell\.book-study-shell \.mode-switch button\.active\s*\{[^}]*background: var\(--surface\)/);
});

test("exam setup, active session, and result use a book-inspired reading hierarchy", () => {
  const page = read("exam/page.tsx");
  const css = read("globals.css");

  assert.match(page, /<main className="exam-shell menu-with-top-nav book-exam-shell">/);
  assert.match(page, /<header className="exam-hero book-exam-hero">/);
  assert.match(page, /className="exam-setup card exam-editorial-section exam-setup-chapter"/);
  assert.match(page, /<section className="exam-layout exam-active-chapters">/);
  assert.match(page, /className="exam-panel card exam-chapter-panel exam-answer-chapter"/);
  assert.match(page, /className="exam-result card exam-editorial-section exam-result-chapter"/);
  assert.match(css, /\.book-exam-hero h1\s*\{[^}]*font-family: Georgia/);
  assert.match(css, /\.exam-editorial-section::before\s*\{[^}]*counter\(exam-chapter, decimal-leading-zero\)/);
  assert.match(css, /\.exam-active-chapters > \.exam-chapter-panel::before\s*\{[^}]*counter\(exam-section, decimal-leading-zero\)/);
  assert.match(css, /\.exam-answer-chapter > h2\s*\{[^}]*font-family: Georgia/);
  assert.match(css, /\.book-exam-shell \.exam-result-grid div\s*\{[^}]*border-top:/);
});

test("practice and exam separate reading surfaces from focused answer controls", () => {
  const css = read("globals.css");
  assert.match(css, /\.book-page-open-section,[\s\S]*?\.practice-shell\.book-study-shell \.question-panel[\s\S]*?\.book-exam-shell \.exam-result[\s\S]*?\)\s*\{[^}]*border-radius: 0;[^}]*box-shadow: none;[^}]*background: transparent/);
  assert.match(css, /\.practice-shell\.book-study-shell \.answer-panel\s*\{[^}]*border-radius: var\(--radius-panel\);[^}]*background: var\(--surface\)/);
  assert.match(css, /\.book-exam-shell \.exam-answer-chapter\s*\{[^}]*background: var\(--surface\)/);
  assert.match(css, /\.menu-with-top-nav > \.app-top-nav\s*\{[^}]*width: min\(var\(--editorial-canvas\), calc\(100vw - 32px\)\)/);
});
