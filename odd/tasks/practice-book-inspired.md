# Book-inspired Practice refresh

## Objective and authorization
Carry the approved book-inspired visual direction from the public Home into the full `/practice` experience, including both Real and Demo modes. The user explicitly chose both modes.

## Scope and constraints
- Apply the visual refresh to the shared Practice page and both modes; preserve the Real/Demo switch and all existing functionality.
- Preserve auth/session behavior, demo and real endpoints, question/filter state, voice/text answer flows, follow-up evaluation, grading, question navigation, and manual review actions.
- Keep question and answer text highly readable; reuse theme-aware tokens and retain responsive navigation clearance, keyboard focus, and accessible labels/state.
- No backend/data changes, login or credential entry, remote deployment, push, or PR.
- Current branch: `codex/sitewide-ui-foundations`; it is non-default and already contains the previous Home work. No branch switch required.

## Work unit and route
Forecast: approximately 250–400 authored changed lines, excluding generated files. Delivery strategy: `ask-on-risk`; local-only scope.

- [x] P1 — Restyle the shared Practice experience with a cohesive editorial/book-inspired hierarchy across Real and Demo, and add focused structural regression coverage in the same behavior commit. Route: delegated direct (single bounded writer); trigger: JSX, shared CSS, and regression tests are non-trivial files. Commit evidence: pending final identity recording.

## Acceptance criteria
- The practice screen visually belongs with the book-inspired Home while retaining clear page, question, answer, and result hierarchy.
- Both Real and Demo modes use the same design system, including the mode selector, setup/filters, question and answer area, evaluation result, and follow-up UI.
- Existing controls, accessibility state, destinations, loading/error states, and API/data semantics remain unchanged.
- Classic, forest, and night remain readable, including question/answer long text; 390px through desktop has no horizontal overflow or clipped controls.
- Mobile navigation clearance and visible keyboard focus remain intact.

## TDD and checks
- Strict TDD: enabled by the supplied AGENTS.md instructions. Runner: `node --test scripts/ui/practice-exam.test.mjs`.
- Record observed RED for the new regression assertion before source edits, then GREEN and refactor evidence.
- Run `npm run typecheck`, `npx eslint src scripts`, and `git diff --check`.
- Browser-check `/practice` in public Demo mode across 390, ~714, 860, 1100, and desktop widths and all three themes. Check Real-mode presentation without authenticating; note if protected content prevents visual verification.
- Full `npm test` has known unrelated baseline failures in `tmp/**/*.js`; report if run and do not change unrelated files.

## Progress and evidence
- Exploration confirmed Real and Demo are modes of the same route and share the question, answer, and evaluation components. `src/app/practice/page.tsx` owns markup/state and `src/app/globals.css` owns page styles.
- P1 adds the same `book-study-shell` style boundary around the shared route for both modes. Editorial treatment includes a practice-book kicker, journey setup label, in-progress status, question chapter marker, readable serif question display, calm ruled panels, and clearer answer/evaluation hierarchy. Theme-sensitive colors use existing aliases; desktop/mobile drawer and content-grid rules are unchanged. Existing state handlers, endpoints, mode controls, filters, session semantics, voice/text flow, evaluation and follow-up logic, navigation, and question-state actions were not edited.
- TDD RED: with only the new regression assertion added, `node --test scripts/ui/practice-exam.test.mjs` returned 2 passing, 1 failing because the shared chapter hierarchy was absent. After implementation, the first GREEN attempt exposed an over-broad test expectation (surface color applies to the active mode tab, not every mode button); the selector assertion was corrected without changing implementation. Final GREEN: `node --test scripts/ui/practice-exam.test.mjs` — 3/3 pass.
- Verification: `npm run typecheck` — pass; `npx eslint src scripts` — pass; `git diff --check` — pass (Git emitted only expected LF-to-CRLF working-copy notices).
- Browser: local dev server started. Playwright CLI could not launch because Chrome is not installed at the expected path; the CUA Edge browser provider was unavailable. No viewport/theme check was possible; no browser installation, authentication, credentials, or evaluation submission was attempted.
- Authored diff: 240 changed lines across page, CSS, and structural test (209 CSS additions, 9 page additions/1 deletion, 13 test additions), below the advisory forecast range.
- Rollback boundary: revert the `book-study-shell` and chapter/presentation markup in `src/app/practice/page.tsx`, the scoped `.practice-shell.book-study-shell` rules in `src/app/globals.css`, the new P1 assertion in `scripts/ui/practice-exam.test.mjs`, and this P1 evidence. The prior Home refresh and earlier practice/exam behavior remain intact.
- Commit identity: pending until the P1 work-unit commit is created.

## Relevant files
- `src/app/practice/page.tsx` — shared Real/Demo practice route, question/answer flow, and results.
- `src/app/globals.css` — practice layout, controls, and responsive styles.
- `scripts/ui/practice-exam.test.mjs` — practice/exam structural regression suite.
