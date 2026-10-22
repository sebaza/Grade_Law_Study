# Sitewide UI refresh

## Objective and authorization
Deliver a squared, elegant, consistent interface across Home, bank, practice, exam, history, login, admin dashboard, and admin questions while preserving functionality and all three themes. User authorized local UI/UX changes only; backend and political brief behavior are excluded.

## Scope and delivery
Six coherent work units; forecast 650–1000 authored changed lines, excluding generated files. Advisory target approximately 400 lines per task, never a hard cap. Delivery strategy: stacked-to-main, sequential slices (prior user preference). No push or PR without explicit authorization. Branch: `codex/sitewide-ui-foundations`, based on the unpushed Home feed audit. RDD globally OFF: ordinary checks only.

## Tasks and routes
- [x] F1 Shared foundations — delegated writer; token/cascade research and analyzed CSS changes. Semantic 4/6/10px radii, restrained elevation, theme-aware text, visible keyboard focus. No responsive or navigation behavior changes.
- [x] F2 Accessible navigation — delegated writer; shared component/CSS changes. Clear current route, keyboard access, mobile navigation without overflow.
- [x] F3 Home and bank responsive layout — delegated writer; multiple page/layout changes. Preserve feed filters and bank actions, readable mobile hierarchy.
- [x] F4 Practice and exam — delegated writer; related interaction/layout changes. Preserve session, answer, timer, and evaluation behavior; usable forms and action hierarchy.
- [x] F5a History and authentication — delegated writer; two analyzed pages and scoped CSS. Accessible feedback/forms, stable attempt and question anchors, responsive lists.
- [ ] F5b Administration — delegated writer; pending dashboard/questions layouts and retained administrative capabilities.

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

Full npm test: FAIL, 35 pre-existing no-require-imports errors and 1 unused-variable warning in tmp/**/*.js. No failures in scoped src/scripts lint. Protected admin/exam runtime not exercised without credentials; global focus coverage verified structurally. Next: F4 Practice/exam layout.

## Commit and slice evidence
Starting boundary: parent of the first foundations commit. F1 commit: `c1a2b847bb9bf99134442a20ba584bfe9b11e21b` — `style(ui): establish squared shared visual foundations`. F1 authored diff: 164 additions; first sequential slice, no remote operation. One conventional work-unit commit per completed task, tests/docs alongside changes, no AI attribution. Subsequent slices remain uncreated until authorized.


## F2 navigation evidence
Route: delegated writer; four analyzed shared source files, scoped to navigation only. Both navs expose aria-current; theme group exposes aria-pressed. Mobile drawer now has controlled dialog semantics, initial focus, Tab wrapping, Escape dismissal, focus restoration, inert background content, and body scroll locking with cleanup. Closed mobile drawer is visibility-hidden (not keyboard reachable); open trigger is hidden. Top-nav links wrap instead of hidden horizontal scrolling; compact squared geometry and 44px link targets. Auth and route destinations unchanged.

RED: both navigation structural tests failed before implementation. GREEN/refactor: five total UI tests pass; typecheck and scoped ESLint pass without warnings. Browser exposed that transitioning visibility delayed initial focus; removed visibility transition and retained transform animation, with requestAnimationFrame focus. React checklist: effects clean up events/overflow/inert/frame, viewport external store subscribes safely, refs captured for cleanup, no data-flow/auth changes.

Edge browser: mobile 390x844 initial focus, reverse/forward Tab wrapping, Escape, focus restore, inert/scroll restoration pass; theme pressed state and captures for classic/forest/night pass. Desktop 1440x900 current Home state passes; bank mobile current-route and top-nav no-horizontal-overflow pass. Captures: output/playwright/navigation-mobile-{Clásico,Bosque,Noche}.png, navigation-desktop.png, navigation-bank-mobile.png. Full npm test still fails only existing tmp JS lint (35 errors, 1 warning). Protected auth/admin flows not exercised. RDD OFF, no remote work. F2 commit identity follows below after source commit.
`84525dd0d8ca6ef3999bd2be6ad0edc12562ef93` — `feat(ui): make shared navigation keyboard accessible`; 160 additions, 6 deletions. Cumulative foundations/navigation source+test+task work remains below 400 authored lines.

## F3 Home and bank evidence
Route: delegated writer; analyzed Home, questions page, and shared CSS; changes remain presentation-only. Home now has a page-level h1, balanced wrapping header, responsive action alignment, and 80px drawer clearance through the actual 1100px navigation breakpoint. Existing late Home padding had overridden the earlier shared mobile clearance at 861–1100px. Bank filters use intrinsic auto-fit tracks rather than eight fixed minimum tracks exceeding the 1180px cap; zero-min-width controls and 44px targets preserve readable inputs. Tablet uses two columns below 860px, single-column below 540px. Bank card action separators, reading line-height, summary/pagination wrapping, and full-width mobile actions reinforce hierarchy. Query construction, filter dependencies, paging, public/auth routes, feed, and political brief behavior are unchanged; questions/page.tsx required no edit.

RED: two initial regression assertions failed before source edits; a further bank nav/tooltip containment assertion failed after browser evidence. GREEN/refactor: all nine focused UI tests pass. Typecheck, scoped ESLint src/scripts, and git diff --check pass. Full npm test still fails only pre-existing tmp JS lint: 35 errors and one warning. React checklist: no hooks, effects, fetching, state, imports, or component boundaries changed; only the Home heading element changed.

Edge live public Home/bank: requested widths 390, 980, 1100, 1181, 1440 (Windows scaling reports 1182 for requested 1181). Home title remains below the 56px hamburger bottom at all mobile-nav widths; bank controls remain within the filter container. Browser also exposed nav width based on viewport instead of enclosing padding and invisible centered InfoHint pseudo-elements contributing overflow. Scoped bank nav width and card-bounded tooltip positioning fix both without hiding/clipping content. Final scrollWidth equals clientWidth at every tested bank width; Home has no overflow. Classic/forest/night at 390 and 1440 all pass overflow checks and persist themes across navigation. Visual readback: mobile bank/Home, desktop Home/night bank, focused mobile tooltip. Real bank interactions verified area selection, blank dependent subject, search requests preserving area, clear reset to page=1 with no filters, next page 2 and previous page 1, retained practice questionId links, keyboard-visible tooltip opacity=1 with no horizontal overflow. Authenticated Home dashboard was not exercised without credentials; its shared layout is covered structurally. No backend changes, remote operation, push/PR, or RDD invocation.

Captures (local, ignored): output/playwright/home-bank-{home,bank}-classic-{390,980,1100,1181,1440}.png; home-bank-{home,bank}-{forest,night}-{390,1440}.png; home-bank-bank-tooltip-mobile.png. Full npm test log: output/playwright/home-bank-npm-test.txt. F3 source commit identity is recorded after the work-unit commit.

`3100f756794081822c309a383682fd19f2d0cee0` — `fix(ui): make Home and question bank responsive`; 169 additions, 5 deletions (174 authored lines). Sequential F3 slice; F1/F2 remain intact. Next: F4 Practice/exam.


## F4 Practice and exam evidence
Route: delegated writer; analyzed two interaction pages and shared CSS. Presentation-only: calmer question typography, bounded controls, wrapped action groups with separators and 44px targets, compact mobile padding, two-column tablet filters, theme-aware clock card and squared topic blocks. Source and answer modes now expose aria-pressed in labeled groups; current exam question exposes aria-current=step. All hooks, API calls, handlers, session/authentication, timer and evaluation logic are unchanged.

RED: both new structural assertions failed before edits (selection semantics and resilient layout). GREEN/refactor: all 11 UI structural tests pass; npm run typecheck, npx eslint src scripts, and git diff --check pass. npm test fails on the same baseline tmp JavaScript lint: 35 errors and one warning. React checklist: no effects/state/data fetching/component boundaries changed; native labeled controls and existing handlers retained.

Edge public/demo at 390/768/1440 in classic/forest/night: 18 route/theme/viewport combinations pass no-horizontal-overflow and bounded-control assertions. Visual readback: desktop practice and mobile night exam setup. Practice interaction checks: typing enables submit, text/voice roundtrip retains answer, demo recording stays disabled, next resets answer, previous navigation works, textarea focus has a solid 3px outline. Exam setup checks: choosing a topic enables its professor, prevents duplicate topics, time and strategy remain editable; clock radius is 10px. No evaluation submitted, recording started, protected exam session or authenticated results exercised. Initial matrix captured facet-loading controls; exam screenshots refreshed after facets loaded and setup interactions. Only favicon 404 observed. Direct dataset assignment exercised all three CSS themes, not theme-button persistence (already verified F3).

Captures (ignored): output/playwright/practice-exam-{practice,exam}-{classic,forest,night}-{390,768,1440}.png and practice-exam-answer-focus.png. Baseline log: output/playwright/practice-exam-npm-test.txt. Rollback boundary: F4 scoped CSS block, selection ARIA attributes in practice/exam, its regression test and task evidence; F1-F3 independent. No remote work, push/PR, or RDD. Next: F5 history/authentication/administration.
`739c5fc6805f173275fe0d61056fb9c7065c016b` — `style(ui): refine practice and exam study interfaces`; 227 additions, 10 deletions (237 authored lines). Sequential F4 slice; F1-F3 preserved. Browser and dev server stopped after checks.


## F5a History and authentication evidence
Route: delegated writer; analyzed history/login and scoped shared CSS. F5 split into F5a history/auth and pending F5b administration before source edits. F1-F4 preserved. History rows and action groups wrap, long content is bounded, squared row panels and calmer question typography retain hierarchy; unauthenticated feedback aligns with the page container and uses neutral Spanish guidance. Login has more restrained heading scale, bounded 44px inputs, wrapping actions, theme-aware feedback and compact mobile spacing.

Fixed duplicate history IDs: each attempt now has a stable attempt-{id} anchor, and existing question-{id} links resolve to exactly one latest attempt per question. History errors announce as alerts, action messages use neutral live status rather than success styling even on failure. Login exposes busy/status semantics, named username/current-password autofill, and signup now runs existing native required/email/minLength validation before calling the unchanged authentication function. Supabase calls, redirects, auth state, data APIs and credentials remain unchanged. React checklist: no new hooks/effects or data fetching; existing labels/handlers retained.

RED: all three new structural assertions failed before edits. GREEN/refactor: 14/14 UI structural tests pass; npm run typecheck, npx eslint src scripts, and git diff --check pass. Full npm test fails only baseline tmp JavaScript lint: 35 errors and one warning; log output/playwright/history-auth-npm-test.txt.

Edge browser: public login and unauthenticated history at 390/768/1440 in classic/forest/night pass no-horizontal-overflow (18 combinations). Login empty and malformed signup input remains invalid, no authentication POST emitted, username autocomplete and visible solid focus outline verified. Additional browser-only synthetic history response with two attempts for one question verifies unique attempt anchors and a single legacy question anchor; all nine theme/viewport combinations pass no-overflow with long content. Synthetic fixtures do not authenticate or write data. Real authenticated history, restore mutations, actual login/signup/logout and admin flows are not exercised without credentials. Direct dataset theme assignment tests CSS rather than theme button persistence. Visual readback: mobile night login, desktop unauthenticated history, long mobile night synthetic history. Favicon 404 and expected history 401 observed.

Captures ignored: output/playwright/history-auth-{auth-login,history}-{classic,forest,night}-{390,768,1440}.png, history-auth-fixture-{classic,forest,night}-{390,768,1440}.png, history-auth-login-validation.png. Server and browser stopped. No push/PR, remote work or RDD. Next: F5b administration. Commit evidence follows after work-unit commit.
`e5e3558eb42aaa9739b3755bf74e331ee04b0da1` — `style(ui): refine history and authentication interfaces`; 160 additions, 11 deletions (171 authored lines). Sequential F5a slice; F5b remains pending.
