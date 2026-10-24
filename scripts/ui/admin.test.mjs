import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const dashboard = readFileSync('src/app/admin/page.tsx', 'utf8');
const editor = readFileSync('src/app/admin/questions/page.tsx', 'utf8');
const css = readFileSync('src/app/globals.css', 'utf8');
test('admin feedback, selection and keypoint controls are named', () => {
  assert.match(dashboard, /aria-label="Estudiante"/);
  assert.ok(!dashboard.includes('Eleg?'));
  assert.match(dashboard, /role="alert"/);
  assert.match(editor, /className="notice error" role="alert"/);
  assert.match(editor, /className="notice success" role="status"/);
  assert.match(editor, /aria-pressed=\{selectedId === question.id\}/);
  assert.match(editor, /aria-label=\{`Etiqueta del punto/);
  assert.match(editor, /aria-label=\{`Descripción del punto/);
});
test('admin layouts bound controls and use theme-aware editor panels', () => {
  assert.match(css, /\/\* Administration workspace refinement/);
  const scoped = css.split('/* Administration workspace refinement')[1];
  assert.match(scoped, /min-width: 0/);
  assert.match(scoped, /min-height: 44px/);
  assert.match(scoped, /\.keypoint-editor-row\s*\{[^}]*background: var\(--surface-soft\)/s);
  assert.match(scoped, /@media \(max-width: 1180px\)/);
  assert.match(scoped, /@media \(max-width: 540px\)/);
});
test('admin top navigation remains within its padded container', () => {
  assert.match(css, /\.admin-dashboard-shell > \.app-top-nav\s*\{[^}]*width: 100%/s);
});
test('admin routes expose an editorial hierarchy with theme-aware chapter surfaces', () => {
  assert.match(dashboard, /className="history-hero admin-editorial-hero"/);
  assert.match(dashboard, /className="history-kpi-grid admin-editorial-ledger"/);
  assert.match(dashboard, /className="history-grid admin-editorial-chapters"/);
  assert.match(editor, /className="admin-hero admin-editorial-hero"/);
  assert.match(editor, /className="admin-layout admin-editorial-layout"/);
  assert.match(editor, /className="admin-list-panel card admin-editorial-chapter"/);
  assert.match(editor, /className="admin-editor admin-editorial-chapter card"/);
  const scoped = css.split('/* Administration workspace refinement')[1];
  assert.match(scoped, /\.admin-editorial-hero[^}]*font-family:\s*Georgia/);
  assert.match(scoped, /\.admin-editorial-layout > \.admin-editorial-chapter[^}]*border-top:\s*2px solid var\(--accent/);
});
