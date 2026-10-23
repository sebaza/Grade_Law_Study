import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../../src/app/${file}`, import.meta.url), "utf8");
const css = read("globals.css");

test("bank filters wrap intrinsically rather than exceeding the capped container", () => {
  assert.match(css, /\.bank-filter-bar\s*\{[^}]*grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 220px\), 1fr\)\)/);
  assert.match(css, /\.bank-filter-bar > \*,[\s\S]*?min-width: 0;/);
  assert.match(css, /\.bank-filter-bar :is\(input, select\)\s*\{[^}]*min-width: 0;/);
});

test("Home reserves drawer clearance through the actual navigation breakpoint", () => {
  assert.match(css, /@media \(max-width: 1100px\)\s*\{\s*\.home-main-dashboard\s*\{\s*padding-top: 80px;/);
  assert.match(css, /\.home-compact-header\s*\{[^}]*flex-wrap: wrap;/);
  assert.match(read("page.tsx"), /<h1>\{loggedOut \? "Prepara tu examen con práctica real" : "Resumen de estudio"\}<\/h1>/);
});

test("bank filter dependencies, paging and navigation remain explicit", () => {
  const bank = read("questions/page.tsx");
  for (const marker of ['key === "area" ? { subject: "", subsubject: "" }', 'key === "subject" ? { subsubject: "" }', 'setPage(1)', 'limit: "20"', 'questionId=${question.id}', '/history#question-${question.id}']) {
    assert.ok(bank.includes(marker), marker);
  }
});

test("bank navigation and tooltips stay inside the page content", () => {
  assert.match(css, /\.question-bank-shell \.app-top-nav\s*\{[^}]*width: min\(1180px, 100%\)/);
  assert.match(css, /\.bank-question-card \.info-hint::after\s*\{[^}]*left: 18px;[^}]*right: 18px;/);
});
