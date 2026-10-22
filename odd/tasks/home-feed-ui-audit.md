# Home question feed UI audit

## Objective and scope
Improve the recent/featured Home module's hierarchy, clarity and accessible feedback without redesigning Home. Only the feed component, its CSS boundary and its offline regression harness are authorized. Political brief, evaluation, backend selection and authentication are excluded.

## Route and constraints
- Delegated direct writer: component, CSS and browser regression changes require coordinated analysis.
- Strict TDD: enabled by AGENTS instructions. Runner: offline Node/Playwright fixture plus `npm test` (TypeScript and ESLint).
- RDD: globally OFF; no review invocation. No push, PR or merge.
- Delivery: ask-on-risk; forecast approximately 150 authored changed lines, one coherent work-unit commit.
- Rollback boundary: Home feed component, scoped CSS changes, harness additions and this document only.

## Tasks
- [x] T1 Audit and improve module clarity/accessibility/responsiveness; prove RED then GREEN in the fixture, run npm test, inspect screenshots and commit the coherent unit.

## Acceptance and checks
- Recent/featured selection communicates actual view and retains search behavior.
- Public counts clearly describe a sample, not the whole bank.
- Empty/loading/error and completion marker remain understandable; pagination retains rows and normal page scrolling.
- Mobile layout has no horizontal overflow; focus and selected filters remain visible.
- Check `node --test scripts/smoke/home-question-feed.mjs`, `npx tsx --test src/lib/home/question-feed.test.ts`, `npm test`.

## Audit evidence
- `src/app/home-question-feed.tsx`: heading always says recent, including featured; public sample counts have no explanation; empty results are outside live feedback.
- `src/app/globals.css`: Home mobile area-list rule and media block are unclosed immediately before political-brief styles. Fix the Home boundary only.
- Existing fixture covers pagination retry, request races, public data, search, completion, mobile and focus; extend it rather than replacing behavior.

## Progress
- RED observed before implementation: browser fixture 4/7 passed; missing featured heading, marker explanation and live empty feedback failed.
- GREEN: browser fixture 7/7; focused feed query tests 6/6. Existing retry, pagination, abort-race, search, public privacy, practice URL and normal-scroll behavior retained.
- Visual QA: inspected 375px mobile, 1100px desktop and night screenshots under ignored `output/playwright/home-feed-*.png`; forest generated. No horizontal overflow or nested feed scroll. Fixture mocks API and blocks all non-local origins; no credentials or database used.
- Refactor: centralized empty feedback in the existing polite status region; no new dependencies or hooks. Native pressed filter buttons retained instead of incomplete ARIA tabs.
- `npm test`: TypeScript passed; global ESLint FAILED on 35 pre-existing CommonJS-import errors and one unused-variable warning in ignored `tmp/**/*.js`. Those files remain untouched. This is a known local verification limitation, not a passed suite.
- Commit evidence: `922388a70c12353f00d45db81aa1f0f0667aed7a` (`fix(home): clarify question feed views and responsive styles`).
- Scoped ESLint passed; full ESLint excluding the pre-existing ignored `tmp/**` passed. `git diff --check` passed.
- Running authored change count: under 150 lines including this document; no delivery split needed. RDD disabled/unmanaged.
- Remaining: live authenticated Next/API/database integration was not exercised; parent should report this limitation and the global lint failure.
