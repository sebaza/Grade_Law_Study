import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

test("shared semantic colors and geometry are defined", () => {
  for (const token of ["foreground", "accent-strong", "on-accent", "radius-control", "radius-panel", "radius-card", "elevation-card"]) {
    assert.match(css, new RegExp(`--${token}:`), `${token} must be defined`);
  }
});

test("all native keyboard controls receive visible focus", () => {
  assert.match(css, /:is\(a, button, input, select, textarea, summary, \[tabindex\]\):focus-visible\s*\{[^}]*outline: 3px solid var\(--accent\)/);
});

test("circular affordances retain their geometry", () => {
  assert.match(css, /\.spinner\s*\{[^}]*border-radius: 999px/);
  assert.match(css, /\.avatar\s*\{[^}]*border-radius: 999px/);
});
