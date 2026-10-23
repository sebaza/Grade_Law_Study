import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (file) => readFileSync(new URL(`../../src/app/${file}`, import.meta.url), "utf8");
test("navigation exposes the current page and theme state", () => {
  for (const file of ["sidebar.tsx", "app-top-nav.tsx"]) assert.ok(read(file).includes('aria-current={isActive ? "page" : undefined}'), file);
  assert.ok(read("theme-toggle.tsx").includes('aria-pressed={theme === item.id}'));
});
test("mobile drawer provides modal keyboard and scroll containment", () => {
  const sidebar = read("sidebar.tsx");
  for (const marker of ['aria-controls="app-sidebar"', 'aria-expanded={isOpen}', 'event.key === "Escape"', 'event.key !== "Tab"', 'document.body.style.overflow = "hidden"', 'trigger?.focus()', 'aria-modal={isOpen && isMobile ? true : undefined}']) assert.ok(sidebar.includes(marker), marker);
  assert.ok(read("globals.css").includes('visibility: hidden;'));
});
