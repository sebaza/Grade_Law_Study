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

test("public Home presents its study features as ordered editorial chapters", () => {
  const page = read("page.tsx");
  const landing = page.slice(page.indexOf("function HomeLanding"), page.indexOf("export default function HomePage"));

  assert.match(page, /className=\{loggedOut \? "home-compact-header public-home-header" : "home-compact-header dashboard-editorial-header"\}/);
  assert.match(landing, /<ol className="landing-feature-grid">/);
  assert.match(landing, /<li key=\{feature\.title\}>\s*<article className="landing-feature">/);
  assert.match(css, /\.home-compact-header\.public-home-header h1\s*\{[^}]*font-family:/);
  assert.match(css, /\.landing-feature-grid > li\s*\{[^}]*counter-increment:/);
  assert.match(css, /\.landing-feature-grid > li::before\s*\{[^}]*counter\(landing-chapter, decimal-leading-zero\)/);
  assert.match(css, /\.landing-feature-grid > li\s*\{[^}]*border-top:/);
  assert.match(page, /<Link className="primary-button" href="\/auth\/login">Iniciar sesión<\/Link>/);
  assert.match(page, /<Link className="secondary-button" href="\/questions">Explorar banco<\/Link>/);
});

test("signed-in Home has an editorial dashboard hierarchy distinct from the public landing", () => {
  const page = read("page.tsx");

  assert.match(page, /home-compact-header dashboard-editorial-header/);
  assert.match(page, /history-kpi-grid home-kpi-grid dashboard-kpi-ledger/);
  assert.match(page, /dashboard-analytics-grid home-focus-grid dashboard-chapters/);
  assert.match(css, /\.dashboard-editorial-header h1\s*\{[^}]*font-family:/);
  assert.match(css, /\.dashboard-kpi-ledger \.kpi-value\s*\{[^}]*font-family:/);
  assert.match(css, /\.dashboard-chapters\s*\{[^}]*counter-reset:/);
  assert.match(css, /\.dashboard-chapters > article::before\s*\{[^}]*counter\(dashboard-chapter, decimal-leading-zero\)/);
});

test("public question bank uses an editorial chapter hierarchy without replacing its controls", () => {
  const bank = read("questions/page.tsx");

  assert.match(bank, /page-hero compact-hero bank-editorial-hero/);
  assert.match(bank, /question-bank-list bank-chapter-list/);
  assert.match(bank, /bank-question-card bank-chapter-card/);
  assert.match(css, /\.bank-editorial-hero h1\s*\{[^}]*font-family:/);
  assert.match(css, /\.bank-chapter-list\s*\{[^}]*counter-reset:/);
  assert.match(css, /\.bank-chapter-card::before\s*\{[^}]*counter\(bank-chapter, decimal-leading-zero\)/);
  assert.match(css, /\.bank-filter-bar\s*\{[^}]*grid-template-columns:/);
});

test("bank filter dependencies, paging and navigation remain explicit", () => {
  const bank = read("questions/page.tsx");
  for (const marker of ['key === "area" ? { subject: "", subsubject: "" }', 'key === "subject" ? { subsubject: "" }', 'setPage(1)', 'limit: "20"', 'questionId=${question.id}', '/history#question-${question.id}']) {
    assert.ok(bank.includes(marker), marker);
  }
});

test("bank navigation and tooltips stay inside the page content", () => {
  assert.match(css, /\.question-bank-shell \.app-top-nav\s*\{[^}]*width: min\(var\(--editorial-canvas\), 100%\)/);
  assert.match(css, /\.bank-question-card \.info-hint::after\s*\{[^}]*left: 18px;[^}]*right: 18px;/);
});

test("editorial pages share a wider canvas and rule-led read-only sections", () => {
  assert.match(css, /--editorial-canvas:\s*1360px/);
  assert.match(css, /\.menu-with-top-nav > \.app-top-nav\s*\{[^}]*width: min\(var\(--editorial-canvas\), calc\(100vw - 32px\)\)/);
  assert.match(css, /\.book-page-open-section,[\s\S]*?\.dashboard-chapters > article[\s\S]*?\.bank-chapter-card[\s\S]*?\.admin-editorial-layout > \.admin-list-panel\s*\)\s*\{[^}]*border-radius: 0;[^}]*box-shadow: none;[^}]*background: transparent/);
  assert.match(css, /\.dashboard-kpi-ledger,\s*\.book-history-shell \.history-kpi-ledger\s*\{[^}]*gap: 0;[^}]*border-top: 1px solid var\(--border\);[^}]*border-bottom: 1px solid var\(--border\)/);
});
