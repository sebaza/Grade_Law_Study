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
  assert.match(css, /\.practice-shell \.app-top-nav,\s*\.exam-shell \.app-top-nav\s*\{\s*width: min\(1180px, 100%\)/);
  assert.match(css, /\.exam-clock-card\s*\{\s*background: var\(--surface-soft\);\s*color: var\(--ink\)/);
});
