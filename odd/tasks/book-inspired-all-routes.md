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
- [ ] B2 — Apply the same book-inspired hierarchy to Exam setup, active session, and results without touching session behavior. Route: delegated direct; trigger: page/CSS/tests require analysis.
- [ ] B3 — Apply the same book-inspired hierarchy to History states and Login/Signup. Route: delegated direct; trigger: two page owners, shared styles, regression tests.
- [ ] B4 — Apply the same book-inspired hierarchy to protected Admin dashboard and question editor. Route: delegated direct; trigger: two page owners, shared styles, regression tests.
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
- Begin B2: apply the shared editorial hierarchy to Exam setup, active session, and results without changing session behavior.
