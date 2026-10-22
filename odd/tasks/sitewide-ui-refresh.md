# Sitewide UI refresh

## Objective and authorization
Deliver a squared, elegant, consistent interface across Home, bank, practice, exam, history, login, admin dashboard, and admin questions while preserving functionality and all three themes. User authorized local UI/UX changes only; backend and political brief behavior are excluded.

## Scope and delivery
Five coherent work units; forecast 650–1000 authored changed lines, excluding generated files. Advisory target approximately 400 lines per task, never a hard cap. Delivery strategy: stacked-to-main, sequential slices (prior user preference). No push or PR without explicit authorization. Branch: `codex/sitewide-ui-foundations`, based on the unpushed Home feed audit. RDD globally OFF: ordinary checks only.

## Tasks and routes
- [x] F1 Shared foundations — delegated writer; token/cascade research and analyzed CSS changes. Semantic 4/6/10px radii, restrained elevation, theme-aware text, visible keyboard focus. No responsive or navigation behavior changes.
- [ ] F2 Accessible navigation — delegated writer; shared component/CSS changes. Clear current route, keyboard access, mobile navigation without overflow.
- [ ] F3 Home and bank responsive layout — delegated writer; multiple page/layout changes. Preserve feed filters and bank actions, readable mobile hierarchy.
- [ ] F4 Practice and exam — delegated writer; related interaction/layout changes. Preserve session, answer, timer, and evaluation behavior; usable forms and action hierarchy.
- [ ] F5 History, authentication, and administration — delegated writer; related page/layout changes. Consistent feedback, readable lists/forms, retained administrative capabilities.

## Acceptance and checks
- Shared components use deliberate semantic radii; avatars/spinners remain circular.
- Classic, forest, and night retain coherent readable foreground/background combinations.
- Keyboard focus remains visible on links, buttons, admin inputs, and exam controls.
- Desktop/mobile layouts and route behavior are preserved; later tasks address existing overflow.
- Effective TDD: enabled by supplied AGENTS.md Strict TDD configuration. Runner: focused Node structural CSS assertions, then browser-computed styles where available. Record observed RED before CSS changes, GREEN, and refactor checks.
- Each unit runs `npm run typecheck`, `npx eslint src scripts`, and focused browser checks where feasible. `npm test` includes repository-wide lint with known pre-existing temporary JavaScript failures; report honestly.
- No TSX changes in F1; React checklist is loaded but not triggered.

## Progress and evidence
F1 complete: shared aliases, 4/6/10px geometry, restrained elevation, on-accent night contrast, surface-aware legacy controls, global focus-visible ring. Existing circular avatars/spinners unchanged. RED: semantic aliases and global focus assertion failed before CSS implementation. The circular assertion initially assumed 50%; corrected to the existing 999px invariant without source change. GREEN/refactor: focused Node tests 3/3, typecheck, scoped ESLint, and diff whitespace check pass.

Browser: Edge CLI (Chrome unavailable), public Home at 1440/390px in classic/forest/night: computed card radius 10px, foreground aliases defined; six screenshots at output/playwright/foundations-{theme}-{width}.png. Login input computed radius 4px and visible solid focus ring in three themes; screenshot foundations-login-focus.png. Device-pixel rounding reports 2.4px for CSS 3px outline; visible-ring check uses >=2px. Public API 401s and favicon 404 observed, no backend changes. Mobile sidebar positioning/overflow remains a later F2/F3 concern; no behavioral/responsive fixes in F1.

Full npm test: FAIL, 35 pre-existing no-require-imports errors and 1 unused-variable warning in tmp/**/*.js. No failures in scoped src/scripts lint. Protected admin/exam runtime not exercised without credentials; global focus coverage verified structurally. Next: F2 accessible navigation.

## Commit and slice evidence
Starting boundary: parent of the first foundations commit. F1 commit: recorded in git history as `style(ui): establish squared shared visual foundations` (this document is included in that commit). F1 authored diff: approximately 180 lines; first sequential slice, no remote operation. One conventional work-unit commit per completed task, tests/docs alongside changes, no AI attribution. Subsequent slices remain uncreated until authorized.
