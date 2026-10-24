# Book-inspired public Home refresh

## Objective and authorization
Refine the logged-out public landing page at `/` into a more editorial, book-inspired experience that is easier to scan and less repetitive. The user explicitly authorized implementing the reviewed UI/UX changes in this project.

## Scope and constraints
- Scope only the logged-out `HomeLanding` experience. Preserve the authenticated study dashboard and its visual behavior.
- Keep all existing destinations, study content, question feed filters/interactions, theme behavior, responsive drawer clearance, and accessibility semantics.
- Reuse existing theme-aware aliases; avoid hard-coded theme colors and avoid forced page-turn/pagination interaction.
- No backend/data behavior, authentication, remote deployment, push, or PR.
- Current branch: `codex/sitewide-ui-foundations` (already non-default); no branch switch required.

## Work units and route
Forecast: approximately 180–300 authored changed lines, excluding generated files. Delivery strategy: `ask-on-risk`; local-only scope.

- [x] H1 — Redesign the public landing composition and add focused structural regression coverage in the same behavior commit. Route: delegated direct (single bounded writer); trigger: page, shared CSS, and tests are non-trivial files. Commit: `86fe784ac143c808ad8ba4a71544377d0d080cf2` (`style(ui): refresh public Home as an editorial study guide`).

## Acceptance criteria
- The public landing has one clear primary action and a visibly stronger editorial hierarchy.
- Repeated feature tiles no longer read as four equivalent generic cards; sections read as deliberate chapters/parts.
- Book-like styling remains subtle and legible; study actions and body copy remain clear at mobile and desktop widths.
- Classic, forest, and night themes remain readable; no horizontal overflow and the mobile navigation clearance invariant remains intact.
- Authenticated dashboard, feed behavior, routes, state, and data requests remain unchanged.

## TDD and checks
- Strict TDD: enabled by the supplied AGENTS.md instructions. Runner: `node --test scripts/ui/home-bank.test.mjs`.
- For each work unit, record observed RED before source changes, then GREEN and refactor evidence.
- Run `npm run typecheck`, `npx eslint src scripts`, and `git diff --check`.
- Browser-check the public landing at 390px, approximately 714px, tablet near 860px and 1100px, and desktop; inspect all three themes. Avoid protected/authenticated flows.
- Full `npm test` has known unrelated baseline failures in `tmp/**/*.js`; report if run, do not edit unrelated files.

## Progress and evidence
- Exploration confirmed `HomeLanding` is separate from the authenticated dashboard. Existing landing/feed actions and selectors are in `src/app/page.tsx` and `src/app/globals.css`; `scripts/ui/home-bank.test.mjs` is the focused structural suite.
- H1 implementation changes only the logged-out landing branch: the header receives a public-only class, the landing gains an editorial intro, the four feature items become an ordered chapter list with typographic numbering, and the areas section becomes a differentiated index. Existing login/question-bank destinations and public feed rendering remain unchanged; authenticated dashboard markup/state/data behavior and navigation spacing are untouched.
- TDD RED: before source edits, the new structural test failed because the public header class and ordered chapter-list contract were absent (4 passing, 1 failing). GREEN: `node --test scripts/ui/home-bank.test.mjs` — 5/5 pass after implementation.
- Verification: `npm run typecheck` — pass; `npx eslint src scripts` — pass; `git diff --check` — pass (Git emitted only expected LF-to-CRLF working-copy notices).
- Browser: public landing verified against local source at 390, 714, 860, 1100, and 1440px. Document/body scroll widths matched their client widths at every viewport; no horizontal overflow. Mobile menu opens with clear close control, contained theme controls, backdrop, and no CTA overlap. Hero, primary action, chapter-style features, and subject index were visually read back in classic, forest, and night themes; all remained legible. Local dev server stopped after verification; no authentication or protected flows used.
- Rollback boundary: revert the H1-specific changes in `src/app/page.tsx`, the logged-out landing selectors in `src/app/globals.css`, the H1 test in `scripts/ui/home-bank.test.mjs`, and this H1 evidence; prior Home/dashboard behavior and all earlier UI work remain intact.
- Work-unit commit: `86fe784ac143c808ad8ba4a71544377d0d080cf2` (`style(ui): refresh public Home as an editorial study guide`), covering the landing, structural regression test, and task document. The exact identity is recorded here in a follow-up closeout commit because a commit cannot embed its own hash in its tree.

## Relevant files
- `src/app/page.tsx` — public landing and authenticated Home branches.
- `src/app/globals.css` — landing layout/style rules and responsive breakpoints.
- `scripts/ui/home-bank.test.mjs` — Home and bank structural regression tests.
