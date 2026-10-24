# Book-inspired sitewide route refresh

## Objective and authorization
Carry the approved book-inspired editorial visual direction across every user-facing application route, including public and authenticated Home states, the question bank, practice, exam, history, login/signup, admin dashboard, and admin question editor. The user explicitly expanded scope to every route.

## Scope and constraints
- Route owners: `/`, `/questions`, `/practice`, `/exam`, `/history`, `/auth/login`, `/admin`, `/admin/questions`; include signed-in Home dashboard as well as the existing public Home landing.
- Existing public Home landing and shared Practice (Real and Demo) already have the book-inspired direction; retain and align them rather than regress them.
- Use restrained editorial hierarchy (chapter/section labels, considered typography, paper-like ruled surfaces and spacing) while keeping dense study data legible and operational controls obvious.
- Preserve all route behavior, forms, navigation, themes (classic/forest/night), auth/session and redirect semantics, API/data behavior, filters/pagination, question actions, exam timers/sessions/evaluation, history actions, and admin permissions/edit operations.
- No backend/data changes, authentication with credentials, submitting evaluations, protected writes, remote deployment, push, or PR. Local-only.
- Current branch: `codex/sitewide-ui-foundations`, non-default, ahead of origin; keep current branch.

## Work units and routes
Forecast: approximately 700–1100 authored changed lines across all work units, excluding generated files. Advisory target approximately 400 authored changed lines per unit, never a hard cap. Delivery strategy: `ask-on-risk`; no remote actions.

- [x] B1 — Apply editorial structure to signed-in Home and the public question bank. Route: delegated direct; trigger: multiple non-trivial pages, shared styles, and structural regression tests.
- [x] B2 — Apply the same book-inspired hierarchy to Exam setup, active session, and results without touching session behavior. Route: delegated direct; trigger: page/CSS/tests require analysis.
- [x] B3 — Apply the same book-inspired hierarchy to History states and Login/Signup. Route: delegated direct; trigger: two page owners, shared styles, regression tests.
- [x] B4 — Apply the same book-inspired hierarchy to protected Admin dashboard and question editor. Route: delegated direct; trigger: two page owners, shared styles, regression tests.
- Existing public Home work unit: `86fe784ac143c808ad8ba4a71544377d0d080cf2`; existing Practice work unit: `5965fae9f9a30bc17ddba2202858f4585515c3f4`. Practice browser verification is separately pending under `odd/tasks/practice-book-inspired.md`.

## Acceptance criteria
- All eight routes, including both signed-in and public Home branches, share a recognizable but restrained book/editorial design language.
- Existing Home landing and both Practice modes remain visually coherent with the expanded treatment.
- Page titles and section hierarchy are easy to scan; text remains readable at mobile through desktop widths; paper-like surfaces support, rather than obscure, controls and dense study content.
- All three themes remain legible; keyboard focus, mobile navigation clearance, accessible names/states, and responsive layouts remain intact.
- Forms, controls, route destinations, loading/error/empty states, authentication/API/session/data semantics remain unchanged.
- Protected content receives structural/layout QA only; do not use credentials or cause admin mutations.

## TDD and checks
- Strict TDD: enabled by supplied AGENTS.md. Before source changes, add targeted structural regression coverage and observe RED; implement; observe GREEN; refactor without changing semantics.
- Use the focused route structural suites under `scripts/ui/` relevant to each work unit; report exact commands and results.
- Run `npm run typecheck`, `npx eslint src scripts`, and `git diff --check` for each work unit.
- Browser-check public routes and Demo; check Real/protected shells without authentication when available. Exercise layout at 390px, ~714px, 860px, 1100px, and desktop and themes classic/forest/night. Do not start protected sessions or submit data.
- Browser verification availability must be confirmed. If unavailable, report the limitation; do not install a browser or improvise another control path.
- Full `npm test` has known unrelated baseline failures in `tmp/**/*.js`; do not change unrelated files.
- No RDD invocation while its effective mode is OFF.

## Progress and evidence
- Read-only route map identified eight user-facing `page.tsx` routes. `/practice` is shared by Real and Demo. `/` contains separate logged-out landing and logged-in dashboard branches. `/questions` is public. `/exam` creates an authenticated session. `/history` requires auth for saved results. Admin routes enforce 401/403.
- Shared layout/navigation owners are `src/app/layout.tsx`, `src/app/app-top-nav.tsx`, `src/app/sidebar.tsx`, `src/app/theme-toggle.tsx`; global styles are in `src/app/globals.css`.
- Existing book-specific styling is concentrated on logged-out Home and Practice. Other routes are responsive/theme-aware but not editorial. No files were changed during route mapping.
- **B1 implementation:** Signed-in Home now uses a serif editorial hero, ledger-style KPI row, and numbered analytics chapters. The public bank now uses a serif hero, ruled summary, and numbered question chapters. Only styling hooks/classes were added; queries, filters, pagination, question actions, dashboard state/data, and navigation remain unchanged.
- **B1 TDD:** Added structural assertions first. RED observed with `node --test scripts/ui/home-bank.test.mjs` (exit 1; 5/7 passed; both new Home/bank assertions failed on absent editorial selectors). After implementation, the same command passed (7/7).
- **B1 checks:** `npm run typecheck` passed; `npx eslint src scripts` passed; `git diff --check` passed (Git emitted only CRLF normalization warnings for the touched test and CSS files).
- **B1 runtime QA:** Browser check unavailable: CUA reported no apps or browsers. No browser was installed or started, and no authentication or data actions were attempted. Responsive/theme/browser rendering remains unverified for B1.
- **B1 rollback boundary:** Revert the B1 source and regression changes in `src/app/page.tsx`, `src/app/questions/page.tsx`, `src/app/globals.css`, and `scripts/ui/home-bank.test.mjs`; the added task record evidence can be reverted independently without affecting prior Home/Practice work.
- **B1 behavior commit:** `efe23011` (`style(ui): extend editorial hierarchy to dashboard and bank`). This commit includes the B1 implementation, regression assertions, and task evidence above.
- **B2 implementation:** Added editorial styling hooks for Exam setup, active question/ronda, and final review. Serif headings, chapter/section numbering, ruled surfaces, and theme-variable-backed surfaces now give setup, active session, and result a consistent reading hierarchy. Only JSX classes and CSS changed; authentication/session APIs, timer, evaluation, answer state, and submission logic were untouched.
- **B2 TDD:** Added the structural assertion to `scripts/ui/practice-exam.test.mjs` first. RED observed with `node --test scripts/ui/practice-exam.test.mjs` (exit 1; 3/4 passed; the new assertion failed because the Exam hierarchy classes/selectors were absent). After implementation and correcting the assertion to target the page-scoped result CSS selector, the command passed (4/4).
- **B2 checks:** `npm run typecheck` passed; `npx eslint src scripts` passed; `git diff --check` passed (Git emitted only CRLF normalization warnings for touched files).
- **B2 runtime QA:** Browser check unavailable: CUA reported no apps or browsers. No browser was installed or started; no credentials, exam session, answer submission, or evaluation were used. Browser rendering across breakpoints/themes remains unverified.
- **B2 rollback boundary:** Revert only `src/app/exam/page.tsx`, the B2-scoped exam rules in `src/app/globals.css`, and the added Exam assertion in `scripts/ui/practice-exam.test.mjs`; this removes B2 without affecting the prior Home, bank, or Practice work.
- **B2 behavior commit:** `432b0b85` (`style(exam): add book-inspired exam chapters`). This commit includes the B2 implementation, regression assertion, and task evidence above.
- **B3 implementation:** Added a restrained editorial hero and chapter-numbered KPI/section hierarchy to History, including loading, login-required/error, empty, and populated states. Login/signup now uses a paper-like auth card, serif title, and labeled kicker. JSX changes are classes and presentation copy only; history fetching/actions, auth, redirects, validation, and form submissions are unchanged.
- **B3 TDD:** Added focused assertions to `scripts/ui/history-auth.test.mjs` first. RED observed with `node --test scripts/ui/history-auth.test.mjs` (exit 1; 3/5 passed; both new route hierarchy assertions failed because the requested classes/styles were absent). After implementation and adjusting a CSS-selector assertion to match the route-scoped rules, the focused command passed (5/5).
- **B3 checks:** `npm run typecheck` passed; `npx eslint src scripts` passed; `git diff --check` passed (Git emitted only CRLF normalization warnings for touched files).
- **B3 runtime QA:** Browser check unavailable: CUA reported no apps or browsers. No browser was installed or started; no login, history mutation, or auth action was attempted. Browser rendering across breakpoints/themes remains unverified.
- **B3 rollback boundary:** Revert `src/app/history/page.tsx`, `src/app/auth/login/page.tsx`, B3-scoped history/auth additions in `src/app/globals.css`, and B3 assertions in `scripts/ui/history-auth.test.mjs`; the earlier Home, bank, Practice, and Exam work remains intact.
- **B3 behavior commit:** `bb4fb44e` (`style(auth): add editorial hierarchy to history and login`). This commit includes the B3 implementation, regression assertions, and task evidence above.
- **B4 implementation:** Added a serif editorial hero, ruled KPI ledger, chapter-like analytics panels, and distinct editorial surfaces for the Admin question list/editor. Styling uses existing theme variables and preserves form controls, routes, permission checks, and data operations; no authentication or admin mutations were performed.
- **B4 TDD:** Added structural assertions first in `scripts/ui/admin.test.mjs`. RED observed with `node --test scripts/ui/admin.test.mjs` (exit 1; 3/4 passed; new hierarchy assertion failed because the classes were absent). Initial GREEN attempt exposed an over-specific test CSS expectation; corrected it to assert the actual chapter accent rule. Final focused command passed (4/4).
- **B4 checks:** `node --test scripts/ui/admin.test.mjs` passed (4/4); `npm run typecheck` passed; `npx eslint src scripts` passed; `git diff --check` passed (Git emitted CRLF normalization warnings for the touched test and CSS files).
- **B4 runtime QA:** Browser surfaces unavailable: CUA reported no apps or browsers. No browser was installed or started; no credentials, protected session, form submission, or admin content mutation were used. Visual rendering across themes/breakpoints remains unverified.
- **B4 rollback boundary:** Revert `src/app/admin/page.tsx`, `src/app/admin/questions/page.tsx`, the B4 editorial rules at the end of `src/app/globals.css`, and the B4 structural assertion in `scripts/ui/admin.test.mjs`; this removes B4 without changing B1–B3.
- **B4 behavior commit:** `335d3637475cefc07210d62fdf883e1002703583` (`style(admin): add editorial hierarchy to protected routes`). This commit includes B4 implementation, regression assertion, and task evidence above.
- **B5 implementation:** Added shared editorial canvas/copy-measure tokens (1360px canvas, 72ch reading measure), broadened route/navigation/list canvases, removed decorative radial menu/admin/auth backdrops, and applied one grouped open-section primitive across read-only landing summaries, dashboard analytics, question lists, practice question surfaces, exam results/navigation, history chapters/risk rows, and admin analytics/list. Converted Home/History KPIs to ruled ledgers, kept composer/editor/filter/auth controls surfaced, and aligned question/history text measures. Removed the signed-in Home 20px card override. No TSX or behavior changed; colors use existing theme variables.
- **B5 TDD:** Added cross-route structural assertions before CSS edits. RED observed with `node --test scripts/ui/home-bank.test.mjs scripts/ui/practice-exam.test.mjs scripts/ui/history-auth.test.mjs scripts/ui/admin.test.mjs` (exit 1; 20/24 passed; the four new assertions failed on absent shared canvas/open-surface rules). Additional KPI-ledger assertions RED in the focused Home/History run (12/14 passed before those CSS changes). During implementation, one assertion initially targeted a generic card selector rather than the route's `bank-chapter-card` hook; it was corrected to assert the grouped open-section primitive. Final suite GREEN (24/24).
- **B5 checks:** `node --test scripts/ui/home-bank.test.mjs scripts/ui/practice-exam.test.mjs scripts/ui/history-auth.test.mjs scripts/ui/admin.test.mjs` passed (24/24); `npm run typecheck` passed (exit 0); `npx eslint src scripts` passed (exit 0); `git diff --check` passed (exit 0; Git emitted only CRLF normalization warnings).
- **B5 runtime QA:** CUA browser inventory returned `apps: []`, `browsers: []`; no browser was installed or alternate UI used. Desktop 1440px and mobile rendering/theme behavior are therefore unverified; no authentication, protected data, or application behavior was exercised.
- **B5 rollback boundary:** Revert B5-only edits in `src/app/globals.css` and the new/updated assertions in `scripts/ui/home-bank.test.mjs`, `scripts/ui/practice-exam.test.mjs`, `scripts/ui/history-auth.test.mjs`, and `scripts/ui/admin.test.mjs`; no route/component behavior changed. B1–B4 remain intact.
- **B5 behavior commit:** pending.

## Relevant files
- `src/app/page.tsx` — logged-out Home and authenticated dashboard.
- `src/app/questions/page.tsx` — public question bank.
- `src/app/practice/page.tsx` — shared Real/Demo practice.
- `src/app/exam/page.tsx` — exam setup/session/results.
- `src/app/history/page.tsx` — authenticated history.
- `src/app/auth/login/page.tsx` — login/signup.
- `src/app/admin/page.tsx` — protected dashboard.
- `src/app/admin/questions/page.tsx` — protected question editor.
- `src/app/globals.css` — global shared design and responsive rules.
- `scripts/ui/` — structural regression suites.

## Next step
- [x] B5 — Refine the existing all-route design for desktop-first humanist book reading: replace unnecessary card grammar with open, rule-separated editorial sections; establish a wider outer canvas with readable inner text measure; preserve boxed surfaces only for focused controls/composers. Apply shared CSS primitives consistently across all eight routes and all themes. Route: delegated direct; trigger: shared multi-route CSS and structural tests require cross-file analysis.
- B5 acceptance: At desktop widths, content uses available space more intentionally without stretching legal/question text beyond a comfortable measure; summaries, analytics, and read-only lists feel like a continuous page rather than stacks of cards; labels/headings retain clear scan hierarchy; interactive controls stay visually distinct; mobile and theme behavior remains intact; no functionality/auth/data changes.
- B5 TDD/checks: Extend focused structural tests first and observe RED, then implement and observe GREEN. Run affected `node --test scripts/ui/*.test.mjs` suites (at minimum home-bank, practice-exam, history-auth, admin), `npm run typecheck`, `npx eslint src scripts`, and `git diff --check`. Local desktop browser QA at 1440px and a mobile spot check if a browser surface is available; do not install one or use an alternate control path. **Complete:** focused suites and quality checks passed; browser surface unavailable.
- B5 TDD source: project instructions specify Strict TDD enabled; expected runner is Node's built-in test runner (`node --test`).
- B5 no-RDD constraint: RDD was OFF; no review or assessment was initiated.
- Existing B1–B4 work remains complete and unchanged; the current branch remains `codex/sitewide-ui-foundations`. No remote actions.
