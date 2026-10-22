# Add new questions and surface them on Home

Recover the current unfinished work safely, add the next question set through a reproducible path, and show recently added questions on the authenticated Home dashboard.

## Current state

- Active isolated delivery branch: `codex/home-question-feed-search`; original dirty worktree remains untouched.
- The branch was created from `main` while the existing working tree was dirty; no pre-existing source change was staged or modified by this note.
- Two unrelated changes are already in progress and uncommitted:
  - Chilean political brief on Home: API, RSS/OpenAI generation, persistence, styling, Prisma model, and migration.
  - Evaluation scale extension with score `0` / level `Absent`.
- The political brief still needs an admin refresh control, concurrency protection for stale generation, and confirmation that `0004_political_briefs.sql` was applied.
- The `0` / `Absent` change must be reconciled with `docs/architecture-decisions.md`, which still documents the `10, 8, 6, 4, 2` scale.
- `src/lib/auth/admin.ts` currently permits any authenticated user when `ADMIN_EMAILS` is empty; this contradicts the prior recorded hardening and must be resolved before relying on admin-only question ingestion.

## Objective

1. Add the user's new questions without duplicating existing records.
2. Make the ingestion path reproducible for the expected batch size.
3. Add a compact Home module that surfaces new and highlighted questions for practice.

## Scope and decisions

| Topic | Current direction |
| --- | --- |
| Meaning of new | **Resolved:** global recency by `Question.createdAt`; no fixed 30-day cutoff. |
| Views | Two tabs: `Más recientes` (newest first) and `Destacadas` (existing bank priority order). |
| Authenticated experience | Full question rows, per-user `Realizada` marker when `attemptCount > 0`, and progressive loading. |
| Public experience | Aggregate counts by area for the selected view only; never expose question statements or per-user state. |
| Home placement | Add to both the public landing page and authenticated dashboard in `src/app/page.tsx`; keep separate from recent practice attempts. |
| Navigation | Reuse `/practice?source=real&mode=random&questionId=<id>`. |
| Data access | Add a lightweight Home query/API with stable ordering and bounded pagination; do not reuse the heavier faceted `/api/questions` request unchanged. |
| Search | Shared case-insensitive substring search across question statement, area, subject, subsubject, professor, active expected answer/model answer and rubric notes, key-point label/description, and common-error description. Exclude technical/internal identifiers, source references, ranking scores, attempts, and user state/scores. |
| Search semantics | Existing bank filters remain separate constraints ANDed with `q`; `q` matches any approved content field (OR). Home applies the same `q` under both views. Preserve ordering, pagination, active-question behavior, and response payloads; do not return answer/rubric text. Public Home remains aggregate-only by area. |
| Search strategy | Exact substring/contains semantics; no typo-tolerant or full-text ranking. No schema migration absent evidence it is required. |
| Delivery strategy | `ask-on-risk`; user selected `stacked-to-main`. Keep question ingestion separate from the cohesive Home + shared-search slice. Current module diffs are 20,588 authored lines for ingestion and 338 for Home/search; the ingestion review size remains a delivery risk. |
| TDD | Enabled by project instructions. Runner: `npm test` (typecheck and lint); add focused behavior tests if the selected implementation introduces testable query/domain logic. |

## Authorized scope

- The source implementation was previously blocked pending a product decision and supplied question set. Both conditions were satisfied: the user resolved the Home views on 2026-10-21 and the October question set is already imported.
- The user approved the implementation scope on 2026-10-21. Authorization covers only the Home recent/highlighted module and its read path/tests; it does not authorize remote writes, migrations, pushes, or unrelated cleanup.
- NQ-03B is explicitly authorized to add and execute a versioned importer against the existing project `DATABASE_URL`; authorization is limited to planning, applying, and verifying the 226 staged October questions in the already configured Supabase/Postgres database.
- Do not overwrite, discard, stage, or fold the existing political-brief or evaluation-scale changes into this feature.
- Push, pull request creation, database migration execution, and remote database writes require separate explicit authorization.

## Task checklist

- [x] **NQ-01 — Recover and document the repository state.**
  - Evidence: inspected Git status/diff, relevant schema/Home/admin authorization, and prior Engram observations.
  - Work-unit commit: `c32edf61` (`docs: record new questions home module plan`).
  - Route: delegated mapping because understanding required more than four files; parent performed structural readback.
- [x] **NQ-02 — Resolve the product definition of `new`.**
  - Decision: use global `Question.createdAt` for `Más recientes`; do not impose an arbitrary time window. The user wants the stream to continue to older additions as they scroll.
  - Decision: provide a separate `Destacadas` view using the bank's existing `priorityScore`, `estimatedProbability`, and `createdAt` ordering.
  - Public display: both views return only aggregate counts by area, with no statement text, identifiers, or personal practice state.
  - Authenticated display: show complete question rows; indicate practiced only when the current user's `attemptCount > 0`.
  - Evidence: user confirmations in the Home-module discussion on 2026-10-21.
- [x] **NQ-03 — Validate and ingest the supplied question set.**
  - Acceptance: normalize professor/area/subject/subsubject, reject duplicates by `sourceReference` and content review, and preserve traceable source metadata.
  - Progress: normalized 226 questions into `data/staging/october-question-bank.staging.json`; no database write, canonical-seed update, or manifest update was performed.
  - Coverage: Civil 11/26/40, Constitutional 35/22/30, and Procedural 20/32/10 for first/second/third degree respectively; totals by degree are 66 first, 80 second, 80 third, and 0 pending.
  - Duplicate handling: removed one literally duplicated source block (`COMISION: Mauricio, Felipe, Aníbal — Segundo grado: Esteban Peredo`); retained two non-identical accounts of Dominique Luan's first-degree constitutional examination and flagged their semantic overlap for review.
  - Attribution review: corrected both first-degree constitutional source accounts to professor Dominique Luan and preserved the full Dominique Luan / Constanza Astudillo / Carlos Alarcón commission. On 2026-10-20, the user confirmed that ordered messages inherit the previous grade and professor/commission unless a new one is named. This resolved the seven second-degree Constitutional/Ley Zamudio records to Dominique Luan and the forty later standalone records to Tercer grado under the Mauricio Figueroa / Felipe Ortiz / Aníbal Chacama commission, assigning Constitutional to Mauricio Figueroa and Civil to Aníbal Chacama. The same date also records the 105 Esteban Peredo/Vidal commission assignments: Constitutional to Mauricio Figueroa, Civil to Aníbal Chacama, and Procedural to Felipe Ortiz.
  - Review placeholders: no professor or grade placeholders remain. Source answer hints remain metadata rather than unreviewed model answers or key points.
  - Validation: JSON parse passed; `questionCount` matches the array length; all `sourceReference` values are unique; required seed-compatible fields and enum values passed local structural validation; no exact duplicate statements remain.
  - Work-unit commit: `68a64424` (`data: stage october oral exam questions`).
  - Route: delegated writer because the batch requires non-trivial normalization and content review.
  - Legal review: completed for all 226 records against official sources. Every record now has a reviewed answer, key points, common errors, subject/subsubject taxonomy, review status, review notes, and official-source URLs. Historical `metadata.sourceAnswerNotes` values were retained unchanged.
  - Readiness: all 226 records are marked `reviewed`; 0 are marked `human_confirmation_required`. The 41 prior content ambiguities (25 Constitutional, 12 Civil, and 4 Procedural) were resolved through minimal conditional, self-contained, or doctrinally neutral reformulation without adding source facts. No professor, commission, or grade remains unresolved.
  - Upload result: completed through NQ-03B after separate remote authorization. The canonical seed and manifest remain unchanged.
  - Material corrections: constitutional amparo is filed before the competent Court of Appeals, not the Guarantee Court; subjective belief does not convert factual information into opinion; political impulse does not arise exclusively from the President; civil seller obligations include delivery/tradition and warranty; an unregistered property is not automatically State-owned; notification by publication does not follow automatically from a failed article 44 certification; and the five-day nullity rule must be distinguished from absolute lack of jurisdiction.
  - Legal-review validation: JSON parsed; 226/226 records matched the review mappings (87 Constitutional, 77 Civil, and 62 Procedural); all `sourceReference` and statement values are unique; all 226 records are `reviewed`; no model-answer or taxonomy placeholders remain; every record has at least one official-source URL; `sourceAnswerNotes` remained byte-for-byte equivalent under the ordered reference/value snapshot; exactly 105 records carry `user_confirmed_commission_assignment` and exactly 47 carry `user_confirmed_order_inheritance`. Strict TDD RED is not applicable because this work unit is a declarative data transformation with no dedicated behavioral runner; before/after structural validation is the verification boundary.
  - Legal-review work-unit commit: `9ca97baa` (`data: review october question bank`).
  - Commission-confirmation work-unit commit: `31ddd53f` (`data: confirm october exam commissions`).
  - Ordered-inheritance work-unit commit: `875bd445` (`data: inherit october question metadata`).
  - Legal-ambiguity resolution work-unit commit: `c70ce76f` (`data: resolve october legal ambiguities`).
- [x] **NQ-03B — Import the reviewed October staging batch safely.**
  - Objective: provide a versioned, reproducible importer and load the 226 reviewed staging records into the configured project database.
  - Authorized scope: `scripts/import/staged-question-bank.ts`, its focused tests, the `package.json` command, this task document, and the remote plan/apply/verify operations against the existing `DATABASE_URL` only.
  - Route: delegated writer because implementation, focused tests, database planning, and remote verification span multiple non-trivial artifacts.
  - Import policy: support `validate`, `plan`, `apply`, and `verify`; plan is read-only; apply processes one question transaction at a time for `connection_limit=1`; reruns are idempotent; source-reference drift blocks. The user approved content no-ops for the existing Civil “¿Quiénes son impúberes?” and Constitutional “¿Cuáles son los límites de la soberanía?” records. Every other statement-and-area collision blocks.
  - Persistence: deterministically match or create area, subject, subsubject, and professor; persist the question, expected answer, key points, common errors, and professor link. Staging metadata remains versioned in JSON because the current schema has no metadata column for `questions`.
  - Checks: observe focused RED before implementation, then GREEN/refactor; run `validate`, read-only `plan`, confirmed `apply`, `verify`, a second idempotent `apply`, and `npm test`; verify 224 new source references plus two approved content matches. Do not change the canonical seed or manifest.
  - TDD evidence: RED observed with `npx tsx --test scripts/import/staged-question-bank.test.ts` because the importer module did not yet exist; GREEN observed with `npm run test:staged-question-bank` (6/6 passing).
  - Refactor evidence: removed an unused importer type; focused tests remained 6/6 GREEN, `npm run typecheck` passed, and scoped ESLint passed for the importer and its test.
  - Validation result: `validate` passed with 226 reviewed records and zero structural errors.
  - Initial plan result: blocked before apply with 223 inserts, 0 source-reference matches, 1 approved Civil content match, and 2 additional statement-and-area collisions. The collisions were “¿Qué son los apremios ilegítimos?” and “¿Cuáles son los límites de la soberanía?”, both in Derecho Constitucional and already present under `pasted-text-2026-06-27` source references.
  - Initial safety outcome: no remote mutation was attempted while those two collisions lacked an explicit resolution policy.
  - Full-check result: `npm test` reached a passing typecheck and then failed ESLint on 35 pre-existing `@typescript-eslint/no-require-imports` errors under `tmp/`; the scoped importer lint is clean and the out-of-scope files were not changed.
  - Collision decision: the user confirmed that “¿Cuáles son los límites de la soberanía?” is a second approved content no-op. The apremios question was reformulated as “¿Cómo tipifica el artículo 150 D del Código Penal los apremios ilegítimos y cómo se distinguen de la tortura?” and remains a new variant with its existing penal answer and distinction preserved.
  - Continuation TDD evidence: RED observed with the new sovereignty-policy test at 6/7 passing; GREEN and refactor completed at 7/7 passing, followed by passing typecheck and scoped ESLint.
  - Pre-apply database snapshot: 1,539 total questions and 0 staged October source references. Area totals were Civil 808, Constitutional 126, Penal 0, and Procedural 605; relevant professor-link totals were Aníbal Chacama 324, Carlos Alarcón 190, Felipe Ortiz 348, and Mauricio Figueroa 126.
  - First apply attempt: stopped safely with 0 committed question transactions because Prisma's default interactive-transaction timeout expired during the first remote taxonomy upserts. A read-only check confirmed 0 staged source references and 1,539 total questions afterward. The importer now supplies a bounded 60-second `maxWait`/`timeout`; no rollback or destructive recovery was needed.
  - Second apply attempt: the remote pooler reset the connection after 11 committed per-question transactions. Read-only recovery showed exactly those 11 source references, all in Derecho Constitucional and linked to Dominique Luan; the next plan was drift-free with 213 inserts, 11 exact source matches, two approved content no-ops, and zero conflicts.
  - Transaction refactor: collapsed taxonomy matching, question creation, reviewed content, and professor linking into one parameterized SQL CTE within each interactive transaction. This preserves one transaction per question while avoiding the remote round-trip pattern that timed out. Focused tests remained 7/7 GREEN, typecheck passed, and scoped ESLint passed.
  - Apply result: the safe continuation inserted the remaining 213 records. Together with the prior 11 commits, the batch created 224 new source references and retained the two approved existing-content no-ops; no conflict or source drift appeared.
  - Verify result: 226/226 staged records resolved exactly as 224 source-reference matches plus two approved content matches, with zero inserts and zero conflicts. The second confirmed apply inserted 0 records and reported the same 224/2 idempotent split.
  - Post-apply database snapshot: 1,763 total questions and 224 staged October source references. Batch area counts are Civil 76, Constitutional 86, and Procedural 62. Batch professor links are Aníbal Chacama 76, Carlos Alarcón 8, Dominique Luan 25, Felipe Ortiz 54, and Mauricio Figueroa 61. Global area totals are Civil 884, Constitutional 212, Penal 0, and Procedural 667; relevant professor-link totals are Aníbal Chacama 400, Carlos Alarcón 198, Dominique Luan 25, Felipe Ortiz 402, and Mauricio Figueroa 187.
  - Independent verification: PASS for commit scope, 226/226 database resolution, reviewed-content parity, relationships, historical no-op preservation, and idempotent rerun.
  - Work-unit commit: `b8927018` (`data: import october question batch`).
  - RDD assessment: `medium` with `slice_budget_reached`. The committed-only native lifecycle could not start because STATUS requested selection of unrelated untracked political-brief files despite projecting only the eight committed feature paths; stopped before START without including those files. Independent verification remains the completed check of record.
- [x] **NQ-04 — Add a privacy-safe Home question feed API.**
  - Route: delegated direct; implementation requires a query/serialization path and focused tests across multiple files. Preserve the unrelated dirty worktree changes.
  - Acceptance: return active questions only; `recent` sorts by `createdAt DESC, id DESC`; `featured` uses `priorityScore DESC, estimatedProbability DESC, createdAt DESC, id DESC`; both are bounded and progressively pageable.
  - Acceptance: authenticated response includes the minimum question details needed for display/practice and a per-user `attemptCount > 0` flag; unauthenticated response contains only counts grouped by area for the first three results of the selected view, with no question identifiers or statements.
  - Checks: `npx tsx --test src/lib/home/question-feed.test.ts` observed RED before implementation (module missing), then GREEN (3/3). `npm run typecheck` passed; `npx eslint src/app/page.tsx src/app/api/home/questions/route.ts src/lib/home/question-feed.ts src/lib/home/question-feed.test.ts` passed. The first full-repo lint attempt was not clean: an initial feed effect pattern was fixed, and repo lint also reports pre-existing `tmp/**/*.js` `require()` errors. No database migration or remote write.
  - Work-unit commit: `c9ac75bd` (`feat(home): add privacy-safe question feed API`).
- [x] **NQ-05 — Integrate two Home views for authenticated and public users.**
  - Route: delegated direct; non-trivial UI and API integration span multiple files.
  - Acceptance: `Más recientes` and `Destacadas` tabs appear on both Home variants; public mode renders only aggregated counts and a sign-in/practice CTA, while authenticated mode renders complete rows, dates, area/subject, practice links, and a small `✓ Realizada` marker for attempted questions.
  - Acceptance: load three rows initially and append the next bounded page into the normal document flow (no nested scrolling); keep pagination separate per tab. Provide loading, empty, and recoverable error states; retain mobile reflow/accessibility.
  - Implementation: added a reusable Home feed component for both public and signed-in Home states, with independent view switching, initial three rows, progressive loading, loading/empty/error states, public area aggregates only, and attempted markers from the authenticated feed API.
  - Checks: `npm run typecheck` passed; `npx eslint src/app/page.tsx src/app/home-question-feed.tsx src/app/api/home/questions/route.ts src/lib/home/question-feed.ts src/lib/home/question-feed.test.ts` passed; focused feed tests passed 3/3. A local Playwright smoke in Edge passed with all `/api/**` requests mocked and non-local hosts blocked: public aggregates only, both views, search, authenticated completion marker, and progressive pagination. Fixture-only 401/503 responses for unrelated dashboard and political-brief APIs did not affect the feed. Tabs use native buttons with `aria-pressed`, avoiding incomplete ARIA tab semantics; clicking the active view is a no-op (prevents a stuck loading state).
  - Work-unit commit: `f2fdcb3d` (`feat(home): show recent and featured questions`). Only the isolated component and exact Home feed import/mount lines from the otherwise-dirty `page.tsx` were staged; unrelated political brief and CSS changes remain unstaged.
- [x] **NQ-07 — Add shared broad question search to Home and the question bank.**
  - User decision: search all pedagogical/question-finding fields, not only statements. Keep exact case-insensitive substring semantics; do not introduce semantic/vector search.
  - Route: delegated direct; shared query where-building and its tests affect multiple non-trivial files. Preserve unrelated dirty worktree changes.
  - Acceptance: q searches question statement, area, subject, subsubject, professor, active expected answer/model answer and rubric notes, key-point label/description, and common-error description; technical/internal IDs, source references, ranking scores, attempts, and user states/scores are excluded.
  - Acceptance: q matches with OR across searchable fields and ANDs with existing independent bank filters; Home applies q to both recent and featured views. Preserve active-only filtering, existing sort/pagination, and response payloads; never serialize answer/rubric contents. Public Home returns only aggregate counts by area and no user-specific data.
  - Implementation: added a shared Prisma where-builder, OR-ed the approved searchable fields while retaining separate bank filters as AND constraints, wired `q` through the Home API and both Home views, and added a labeled debounced search input. The Home and bank response payloads remain unchanged and do not include answer/rubric contents.
  - TDD: RED observed after adding tests before the helper existed (`MODULE_NOT_FOUND: ./question-search`); GREEN/refactor observed with `npx tsx --test src/lib/home/question-feed.test.ts` (6/6).
  - Checks: `npm run typecheck` passed; `npx eslint src/app/home-question-feed.tsx src/app/api/home/questions/route.ts src/app/api/questions/route.ts src/lib/home/question-search.ts src/lib/home/question-feed.ts src/lib/home/question-feed.test.ts` passed. React checklist: field has an explicit label; request timer and fetch are cleaned up on dependency change/unmount; dependencies are primitive; no nested components or unnecessary memoization. No migration/remote operation.
  - Runtime harness: N/A; verification is query-builder unit tests plus static checks, and no live database/browser session was used.
  - Rollback boundary: remove the shared query helper/imports, Home query-input wiring, and the focused tests; preserve all other question-bank filters and existing result serialization.
  - Work-unit commit: `159bef0b` (`feat(search): broaden question bank and Home queries`).
- [x] **NQ-08 — Audit and improve the Home question-feed UI/UX.**
  - Objective: make the existing compact feed readable, actionable, and resilient without changing its data/privacy contract.
  - Authorized scope: isolated Home feed component/styles, focused offline regression harness, and this document; no remote/DB changes, unrelated files, push, PR, or merge.
  - Route: delegated direct; component request lifecycle, CSS, and regression coverage are multiple non-trivial files. Reading prepares the bounded writer's changes.
  - Acceptance: scoped responsive styles, visible selected views and keyboard focus, accessible search guidance, year-aware dates, real sign-in CTA, retry for first-page/pagination failures, preserved rows while appending, and cancellation/stale-response protection when changing search/view.
  - Preserve: public aggregate-only rendering, three initial rows, two views, shared search, completed marker, practice URLs, natural page scroll, empty/loading states.
  - TDD: strict enabled by project instructions; browser regression must fail before behavioral edits, then pass. Runner: fixture-only browser harness plus `npx tsx --test src/lib/home/question-feed.test.ts`, `npm run typecheck`, scoped ESLint, and `npm test`.
  - Forecast: one coherent UI/recovery work unit; advisory 400-line heuristic, not a reason to omit meaningful tests. Delivery remains stacked-to-main; parent handles integration.
  - Implementation: unified first-page, pagination, and retry fetching under one abortable effect; synchronous invalidation on view/search changes prevents stale pages during debounce. Pagination retains existing rows while loading/on failure. Added actual sign-in/retry actions, semantic year-aware dates, shared search guidance, visible selection/focus, and responsive theme-token styling.
  - TDD evidence: `node --test scripts/smoke/home-question-feed.mjs` observed RED before source edits (0/6 passing): missing sign-in link/retry/time, hidden rows after pagination error, and late pagination incorrectly appending obsolete rows after both view and search changes. GREEN after implementation: 6/6; supplemental empty/loading coverage and refactor: 7/7 passing.
  - Runtime harness: the same command passes 7/7 in local Edge with `PLAYWRIGHT_MODULE_PATH` selecting an already installed local Playwright package. It mounts the real component/CSS in a loopback-only fixture, substitutes Next Link with a native anchor, mocks every `/api/**` request, and aborts external origins. No Next server, credentials, live DB, authentication service, or remote operation. It verifies public aggregates, both views/shared search, initial three rows, retry, pagination retry, stale view/search responses, completion/practice URLs, year-aware dates, 375px no-overflow layout, normal scrolling, focus, and loading/empty recovery.
  - Visual QA: inspected generated mobile, desktop, and night-theme screenshots; forest screenshot also generated. Artifacts remain ignored under `output/playwright/home-feed-{mobile,desktop,forest,night}.png`.
  - Checks: focused query tests 6/6, `npm run typecheck`, `npx eslint src/app/home-question-feed.tsx scripts/smoke/home-question-feed.mjs`, `npm test`, and `git diff --check` passed in the isolated clean worktree. The original dirty root still has its historical ignored tmp lint failures; those files are absent here and were not modified.
  - React checklist: primitive effect dependencies, cleanup on dependency changes/unmount, no nested component definitions or gratuitous memoization, labeled search with associated hint, native pressed-state buttons, persistent live status and error alert, preserved full statements. Retry reuses the failing page cursor; active view is a no-op.
  - Delivery: one coherent UI/recovery work unit including the offline regression harness exceeds the advisory 400-line task heuristic; preserving meaningful regression coverage is preferable to artificial splitting. Parent owns final independent verification, native review assessment/consent, and local main integration. No push, PR, merge, or remote change performed.
  - Rollback boundary: this component's presentation/request-lifecycle changes, scoped CSS, regression harness, and NQ-08 tracking only; keep the feed API, shared search, ingestion, and unrelated work.

- [ ] **NQ-06 — Verify and document the completed behavior.**
  - Focused checks: `npx tsx --test src/lib/home/question-feed.test.ts` passed 6/6; `npm run typecheck` passed; feature-scoped ESLint passed; offline Playwright smoke passed for public/authenticated Home, tab switching, search, completion marker, and pagination.
  - Historical dirty-root full check: `npm test` typecheck passed, then repository ESLint failed on 35 pre-existing `@typescript-eslint/no-require-imports` errors and one unused-variable warning in unrelated `tmp/**/*.js` files. No feature file had a scoped ESLint violation.
  - Delivery: user selected module separation with Home + search together, ingestion separate, and stacked integration to `main`. Local worktrees are prepared as `codex/questions-ingestion` at `fab9e5a8` and `codex/home-question-feed-search` at `d7736912`; no push or PR was performed. The Home/search candidate is 338 authored lines and assessed `medium / under_budget`; ingestion is 20,588 lines and its native review was declined twice by the user; do not reopen it automatically.
  - Current isolated-worktree checks after NQ-08: browser regressions 7/7, query tests 6/6, typecheck, scoped ESLint, full `npm test`, and diff whitespace check passed. No tmp lint issue exists in this clean worktree; the dirty root remains untouched.
  - Remaining: parent independent verification, current Home/search review assessment/consent as applicable, and user-authorized local main integration. Ingestion review was declined twice; do not reopen it automatically. Do not include unrelated political-brief or evaluation changes.

## Existing backlog recovered

- [ ] Finish and separate the political-brief work before mixing it with this feature.
- [ ] Add the missing admin refresh UI for the political brief.
- [ ] Prevent duplicate concurrent OpenAI generation when the political brief cache is stale.
- [ ] Verify the political-brief database migration in the target Supabase environment.
- [ ] Reconcile the new `0` / `Absent` rubric with the documented architecture decision.
- [ ] Restore fail-closed admin authorization when `ADMIN_EMAILS` is empty.
- [ ] Decide whether recent direct-to-database question imports need a versioned, reusable importer and canonical seed synchronization.

## Progress

- Current step: NQ-08 UI/UX implementation and offline browser verification complete; NQ-06 remains open for parent verification/review and local integration.
- Verification: query tests 6/6, UI fixture regressions 7/7, typecheck, feature lint, and full `npm test` passed in this clean worktree. The original dirty-root check historically fails on unrelated ignored tmp files; they were not touched. Import resolved 224 source references plus two approved existing-content no-ops with zero conflicts. Seed and manifest remain untouched.
- Next step: parent verifies the UI work unit, applies current Home/search native assessment/consent if applicable, and handles local integration to main. Respect the two explicit ingestion-review declines; no remote delivery is authorized.
