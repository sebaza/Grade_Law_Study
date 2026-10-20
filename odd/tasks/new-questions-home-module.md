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
- Do not overwrite, discard, stage, or fold the existing political-brief or evaluation-scale changes into this feature.
- Push, pull request creation, database migration execution, and remote database writes require separate explicit authorization.

## Task checklist

- [x] **NQ-01 — Recover and document the repository state.**
  - Evidence: inspected Git status/diff, relevant schema/Home/admin authorization, and prior Engram observations.
  - Work-unit commit: `c32edf61` (`docs: record new questions home module plan`).
  - Route: delegated mapping because understanding required more than four files; parent performed structural readback.
- [ ] **NQ-02 — Resolve the product definition of `new`.**
  - Acceptance: choose global recency or per-student unseen status and record the display window/count.
- [ ] **NQ-03 — Validate and ingest the supplied question set.**
  - Acceptance: normalize professor/area/subject/subsubject, reject duplicates by `sourceReference` and content review, and preserve traceable source metadata.
  - Route: pending batch size; use admin creation for a small set or add a versioned reusable importer for a batch.
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

- Current step: waiting for the definition of `new` and the new question content.
- Verification: documentation read back locally; no source checks were run because no source implementation was performed.
- Next step: answer NQ-02, then inspect the supplied question batch for NQ-03.
