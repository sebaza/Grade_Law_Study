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
- [x] T2 Strengthen visual hierarchy with individual question cards, area/date metadata, contextual practice actions and a themed filter control. Delegated direct: coordinated component/CSS/fixture changes. Preserved T1 behavior. Rollback: only T2 component/CSS/fixture changes.

## Acceptance and checks
- Recent/featured selection communicates actual view and retains search behavior.
- Public counts clearly describe a sample, not the whole bank.
- Empty/loading/error and completion marker remain understandable; pagination retains rows and normal page scrolling.
- Mobile layout has no horizontal overflow; focus and selected filters remain visible.
- Browser check requires an installed Playwright package. The bare `node --test scripts/smoke/home-question-feed.mjs` is unavailable in this checkout (`MODULE_NOT_FOUND: playwright`); Playwright is not a local dependency. All reported passing browser runs used this exact PowerShell invocation with an existing package, not the bare command:

```powershell
$env:PLAYWRIGHT_MODULE_PATH = 'C:\Users\seba_\AppData\Local\npm-cache\_npx\31e32ef8478fbf80\node_modules\playwright'
node --test scripts/smoke/home-question-feed.mjs
```

- That cache path exists on the tested machine but is not portable or guaranteed to survive cache cleanup. On another machine, explicitly point `PLAYWRIGHT_MODULE_PATH` to its installed Playwright package; do not report the fixture as passing when the prerequisite is missing. The fixture defaults to installed Microsoft Edge (`msedge`).
- Other checks: `npx tsx --test src/lib/home/question-feed.test.ts`, `npm test` (known global lint failure below), `npm run typecheck`, and `npx eslint . --ignore-pattern 'tmp/**'`.

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

## T2 visual pass
- Parent requested stronger visual styling after inspecting T1. Added accent module edge/eyebrow, segmented pressed filters, separate soft-surface question cards, area chips and date separators, themed outlined practice links, and practiced badges. Mobile actions align along the card footer; desktop actions form a compact right column.
- RED: fixture 6/7, card top border was `none`, expected `solid`. GREEN after styling: 7/7. Refactor retained the existing native buttons and shared theme tokens without new dependencies or behavioral state.
- Visual QA: inspected updated mobile (375px), desktop (1100px) and night screenshots. Forest generated. Fixture also checks 320px no-overflow. Long statements remain fully visible, deliberately increasing card height instead of truncating exam content.
- TypeScript and full ESLint excluding unchanged ignored `tmp/**` passed; global npm test limitation from T1 remains. No live backend check.
- Combined authored diff remains below 400 lines; no delivery split or RDD.
- Commit evidence: `7069c4f5` (`style(home): give question cards clearer visual hierarchy`).
