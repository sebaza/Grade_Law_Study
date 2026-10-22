// Offline component regression harness; no Next server, credentials, or database.
// Run with PLAYWRIGHT_MODULE_PATH pointing to an installed playwright package
// when it is not locally resolvable. Uses esbuild supplied by the tsx toolchain.
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const bundle = await build({
  stdin: {
    contents: `import { createRoot } from 'react-dom/client';
      import { HomeQuestionFeed } from './src/app/home-question-feed';
      createRoot(document.getElementById('root')).render(<HomeQuestionFeed isPublic={location.search.includes('public')} />);`,
    resolveDir: process.cwd(), loader: "tsx",
  },
  bundle: true, write: false, format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  // Preserve anchor behavior without invoking Next router/prefetch in this fixture.
  plugins: [{ name: "fixture-link", setup(builder) {
    builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
      contents: "export default function Link(props) { return <a {...props} />; }", loader: "jsx",
      resolveDir: process.cwd(),
    }));
  } }],
});
const css = await readFile("src/app/globals.css", "utf8");
const server = createServer((request, response) => {
  if (request.url === "/bundle.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(bundle.outputFiles[0].text);
  } else {
    response.end(`<!doctype html><html lang="es"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><body><main id="root" style="max-width:900px;margin:24px auto"></main><script src="/bundle.js"></script></body></html>`);
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
after(async () => { await browser.close(); await new Promise((resolve) => server.close(resolve)); });

const question = (id) => ({ id, statement: `Pregunta ${id}: ${"Contenido completo. ".repeat(7)}`,
  areaName: "Derecho Civil", subjectName: "Obligaciones", createdAt: "2024-10-15T12:00:00Z", completed: id === "1" });
const payload = (url) => ({ view: url.searchParams.get("view"), public: false,
  questions: (url.searchParams.has("cursor") ? [4, 5, 6] : [1, 2, 3]).map((id) => question(String(id))),
  nextCursor: url.searchParams.has("cursor") ? null : "page-2" });

async function fixture(run, handler = async (route, url) => route.fulfill({ json: payload(url) }), publicMode = false) {
  const page = await browser.newPage();
  const external = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { external.push(url.origin); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return handler(route, url);
    return route.continue();
  });
  try {
    await page.goto(`${origin}/${publicMode ? "?public" : ""}`);
    await run(page);
    assert.deepEqual(external, [], "no external requests");
  } finally { await page.close(); }
}

// An intentionally short timeout keeps RED failures fast and deterministic.
async function visible(locator) { await locator.waitFor({ state: "visible", timeout: 3000 }); }

test("public aggregates, sign-in CTA, shared search and selected views", async () => {
  const seen = [];
  await fixture(async (page) => {
    await visible(page.getByText("Derecho Civil", { exact: true }));
    assert.equal(await page.locator("article").count(), 0);
    assert.equal(await page.getByRole("link", { name: "Inicia sesión para practicar" }).getAttribute("href", { timeout: 3000 }), "/auth/login");
    await page.getByLabel("Buscar preguntas", { exact: true }).fill("obligaciones");
    await page.getByRole("button", { name: "Destacadas", exact: true }).click();
    await visible(page.getByText("Derecho Civil", { exact: true }));
    assert.equal(await page.getByRole("button", { name: "Destacadas", exact: true }).getAttribute("aria-pressed"), "true");
    assert.ok(seen.some((url) => url.searchParams.get("view") === "featured" && url.searchParams.get("q") === "obligaciones"));
  }, async (route, url) => {
    seen.push(url);
    await route.fulfill({ json: { view: url.searchParams.get("view"), public: true, byArea: [{ areaName: "Derecho Civil", questionCount: 3 }] } });
  }, true);
});

test("first-page error has a working retry", async () => {
  let calls = 0;
  await fixture(async (page) => {
    await visible(page.getByRole("alert"));
    await page.getByRole("button", { name: "Reintentar", exact: true }).click({ timeout: 3000 });
    await visible(page.getByText("Pregunta 1:", { exact: false }));
    assert.equal(calls, 2);
    assert.equal(await page.getByRole("alert").count(), 0);
  }, async (route, url) => route.fulfill(++calls === 1 ? { status: 503, json: {} } : { json: payload(url) }));
});

test("pagination keeps rows visible on failure and retries the same page", async () => {
  let pageCalls = 0;
  await fixture(async (page) => {
    await visible(page.getByText("Pregunta 1:", { exact: false }));
    await page.getByRole("button", { name: "Cargar más", exact: true }).click();
    await visible(page.getByRole("alert"));
    assert.equal(await page.locator("article").count(), 3);
    await page.getByRole("button", { name: "Reintentar", exact: true }).click({ timeout: 3000 });
    await visible(page.getByText("Pregunta 6:", { exact: false }));
    assert.equal(await page.locator("article").count(), 6);
    assert.equal(pageCalls, 2);
  }, async (route, url) => route.fulfill(url.searchParams.has("cursor") && ++pageCalls === 1
    ? { status: 503, json: {} } : { json: payload(url) }));
});

for (const change of ["view", "search"]) {
  test(`late pagination cannot replace the new ${change} results`, async () => {
    let release;
    const hold = new Promise((resolve) => { release = resolve; });
    let started;
    const pending = new Promise((resolve) => { started = resolve; });
    await fixture(async (page) => {
      await visible(page.getByText("Pregunta 1:", { exact: false }));
      await page.getByRole("button", { name: "Cargar más", exact: true }).click();
      await pending;
      if (change === "view") await page.getByRole("button", { name: "Destacadas", exact: true }).click();
      else await page.getByLabel("Buscar preguntas", { exact: true }).fill("nueva búsqueda");
      await visible(page.getByText("Pregunta nueva:", { exact: false }));
      release();
      await page.waitForTimeout(350);
      assert.equal(await page.getByText("Pregunta obsoleta:", { exact: false }).count(), 0);
      assert.equal(await page.locator("article").count(), 1);
    }, async (route, url) => {
      if (url.searchParams.has("cursor")) {
        started(); await hold;
        await route.fulfill({ json: { ...payload(url), questions: [question("obsoleta")] } }).catch(() => {});
      } else {
        const changed = url.searchParams.get("view") === "featured" || url.searchParams.has("q");
        await route.fulfill({ json: changed ? { ...payload(url), questions: [question("nueva")], nextCursor: null } : payload(url) });
      }
    });
  });
}

test("mobile rows, dates, completion and practice remain readable", async () => {
  await fixture(async (page) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await visible(page.getByText("Pregunta 1:", { exact: false }));
    assert.equal(await page.locator("article").count(), 3);
    assert.equal(await page.locator("article time").first().getAttribute("datetime"), "2024-10-15T12:00:00Z");
    assert.match(await page.locator("article time").first().innerText(), /2024/);
    assert.equal(await page.getByText("✓ Realizada", { exact: true }).count(), 1);
    assert.equal(await page.getByRole("link", { name: "Practicar", exact: true }).first().getAttribute("href"), "/practice?source=real&mode=random&questionId=1");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.equal(await page.locator(".home-question-list").evaluate((node) => getComputedStyle(node).overflowY), "visible");
    await page.getByRole("button", { name: "Más recientes", exact: true }).click();
    assert.equal(await page.getByText("Cargando preguntas…", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "Destacadas", exact: true }).focus();
    assert.equal(await page.getByRole("button", { name: "Destacadas", exact: true }).evaluate((node) => node === document.activeElement), true);
    await mkdir("output/playwright", { recursive: true });
    await page.screenshot({ path: "output/playwright/home-feed-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.screenshot({ path: "output/playwright/home-feed-desktop.png", fullPage: true });
    for (const theme of ["forest", "night"]) {
      await page.locator("html").evaluate((node, value) => { node.dataset.theme = value; }, theme);
      await page.screenshot({ path: `output/playwright/home-feed-${theme}.png`, fullPage: true });
    }
  });
});


test("empty search gives recovery guidance and pending requests expose loading", async () => {
  await fixture(async (page) => {
    await visible(page.getByText("Pregunta 1:", { exact: false }));
    await page.getByLabel("Buscar preguntas", { exact: true }).fill("sin coincidencias");
    await visible(page.getByText("Cargando preguntas…", { exact: true }));
    await visible(page.getByText("No encontramos preguntas. Prueba con otro término o borra la búsqueda.", { exact: true }));
    assert.equal(await page.locator("article").count(), 0);
    await page.getByLabel("Buscar preguntas", { exact: true }).fill("");
    await visible(page.getByText("Pregunta 1:", { exact: false }));
  }, async (route, url) => route.fulfill({ json: url.searchParams.has("q")
    ? { ...payload(url), questions: [], nextCursor: null } : payload(url) }));
});
