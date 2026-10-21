# Add new questions and surface them on Home

Recover the current unfinished work safely, add the next question set through a reproducible path, and show recently added questions on the authenticated Home dashboard.

## Current state

- Branch: `codex/new-questions-home-module`.
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
3. Add a compact `New in the bank` module to Home with direct practice links.

## Scope and decisions

| Topic | Current direction |
| --- | --- |
| Meaning of new | **Open decision:** globally recent by `Question.createdAt`, or unseen/unpracticed per student. |
| Available data | Global recency works now with `createdAt`; per-student seen status requires new persistence. |
| Home placement | After dashboard KPIs and before the political brief in `src/app/page.tsx`. |
| Navigation | Reuse `/practice?source=real&mode=random&questionId=<id>`. |
| Data access | Prefer a lightweight recent-questions query/API; do not reuse the heavier faceted `/api/questions` request. |
| Delivery strategy | `ask-on-risk`. Forecast: likely below 400 authored changed lines if global recency is selected; per-student tracking may exceed it. |
| TDD | Enabled by project instructions. Runner: `npm test` (typecheck and lint); add focused behavior tests if the selected implementation introduces testable query/domain logic. |

## Authorized scope

- This document records recovered work and the proposed feature only.
- Source implementation is not authorized until the open product decision is answered and the question set is supplied.
- NQ-03B is explicitly authorized to add and execute a versioned importer against the existing project `DATABASE_URL`; authorization is limited to planning, applying, and verifying the 226 staged October questions in the already configured Supabase/Postgres database.
- Do not overwrite, discard, stage, or fold the existing political-brief or evaluation-scale changes into this feature.
- Push, pull request creation, database migration execution, and remote database writes require separate explicit authorization.

## Task checklist

- [x] **NQ-01 — Recover and document the repository state.**
  - Evidence: inspected Git status/diff, relevant schema/Home/admin authorization, and prior Engram observations.
  - Work-unit commit: `c32edf61` (`docs: record new questions home module plan`).
  - Route: delegated mapping because understanding required more than four files; parent performed structural readback.
- [ ] **NQ-02 — Resolve the product definition of `new`.**
  - Acceptance: choose global recency or per-student unseen status and record the display window/count.
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
- [ ] **NQ-04 — Expose a lightweight recent-questions read path.**
  - Acceptance: authenticated response returns only active questions, deterministic newest-first ordering, required display metadata, and a bounded result.
- [ ] **NQ-05 — Add the Home module.**
  - Acceptance: show 3–5 items with date, subject/professor, loading/empty/error states, and direct practice links.
- [ ] **NQ-06 — Verify and document the completed behavior.**
  - Acceptance: observe required RED/GREEN/REFACTOR evidence where applicable; run `npm test`; record any skipped or environmental checks.

## Existing backlog recovered

- [ ] Finish and separate the political-brief work before mixing it with this feature.
- [ ] Add the missing admin refresh UI for the political brief.
- [ ] Prevent duplicate concurrent OpenAI generation when the political brief cache is stale.
- [ ] Verify the political-brief database migration in the target Supabase environment.
- [ ] Reconcile the new `0` / `Absent` rubric with the documented architecture decision.
- [ ] Restore fail-closed admin authorization when `ADMIN_EMAILS` is empty.
- [ ] Decide whether recent direct-to-database question imports need a versioned, reusable importer and canonical seed synchronization.

## Progress

- Current step: NQ-03 and NQ-03B are complete. The reviewed October batch is loaded and independently repeatable through the versioned importer.
- Verification: focused RED/GREEN/refactor, staging validation, read-only plan, remote apply, exact verify, idempotent rerun, typecheck, and scoped lint passed. The import resolved 224 source references plus two approved existing-content no-ops with zero conflicts. Seed and manifest remain untouched.
- Next step: resolve NQ-02's definition of “new” before implementing the Home module.
