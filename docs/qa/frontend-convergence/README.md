# Frontend convergence verification — 2 October 2026

This pass starts at `a12bc89` (PR #50). It changes frontend navigation, reading
order, typography and CSS ownership. The synthetic fixtures certify rendered
behavior under supplied inputs, not live warehouse data.

## Reproducible browser runs

The Browser skill/plugin was unavailable in this session. The existing optional
Playwright runtime was used without adding a package dependency. Both committed
runners build the real routed application with synthetic identity/API adapters
and the production global stylesheet. Run `npm run build` first, then:

```sh
CX_PLAYWRIGHT_MODULE=<absolute-path-to-existing-playwright/index.mjs> \
CX_CHROMIUM_EXECUTABLE=<absolute-path-to-existing-chromium> \
CX_BROWSER_QA_OUTPUT=<absolute-directory-outside-repository> \
node scripts/check-frontend-convergence-browser.mjs

CX_PLAYWRIGHT_MODULE=<absolute-path-to-existing-playwright/index.mjs> \
CX_CHROMIUM_EXECUTABLE=<absolute-path-to-existing-chromium> \
CX_BROWSER_QA_OUTPUT=<a-separate-absolute-directory-outside-repository> \
node scripts/check-investigation-browser.mjs
```

The convergence matrix covers Overview, Progression, Contact effort, Sales &
activation, Commercial overview, Investigation inbox, Record explorer, Data
confidence and Settings at **1440×1000**, **820×1180**, **390×844**, in both light and
dark themes. Its 54 route combinations assert canonical area ownership, exact
page heading, visible scope below the title, stable mobile navigation, and local
rather than document overflow. Business KPI values must not use a monospace face.

Seven interactions exercise the 60px desktop rail, mobile More/drawer focus,
command search across all 29 canonical destinations, scope/refresh request
counts, six truthful Investigation stages, one evidence subtree with preserved
notes/pins, and administrator route visibility. Two additional Access Control
checks inspect successful-empty directory/policy presentation in both themes
without submitting a mutation. Existing access tests separately cover failed
subscriptions and mutation contracts.

The existing 17-scenario Investigation suite exercises pin/dossier/evidence
behavior, scoped navigation, role/session changes, saved-workspace limitations,
refresh failures and long identifiers across responsive layouts.

The populated Journey, Contact and Sales payloads are copied from existing
contract fixtures in `tests/frontend/convergenceFixtures.ts`; only the disposition
workspace ID is adapted to the harness. Missing values, non-nested populations,
partial evidence and unverified states remain explicit. The fixture is never
imported by the production entry point.

## Final executed results

| Command / suite | Final result |
| --- | --- |
| `npm ci` | Passed: 524 packages installed, 525 audited, 0 vulnerabilities. |
| `npm run lint` | Passed, including final verify. |
| `npm test` (inside final `verify`) | **1,027 tests: 1,026 passed, 0 failed, 1 skipped**. The skip requires the separate emulator environment. |
| `npm run docs:surfaces:check` | Passed after regenerating canonical names, area ownership and administrative visibility. |
| `npm run build` | Passed: client, server entry points, static mirrors and warehouse reference export artifacts. |
| `npm run verify` | Passed the full types → tests → inventory → build chain. |
| `JAVA_HOME=<existing Java 21 runtime> npm run test:rules` | **10 passed, 0 failed, 0 skipped**. |
| `node scripts/check-frontend-convergence-browser.mjs` | **63 passed, 0 failed** (54 matrix + 7 interactions + 2 Access Control theme checks). |
| `node scripts/check-investigation-browser.mjs` | **17 passed, 0 failed**. |
| Browser errors / console warnings | **0 / 0**, Chromium **151.0.7922.34**. |
| `node scripts/smoke-production.mjs` | Passed for all 4 compiled server entry points. |
| `WRANGLER_SEND_METRICS=false npx --yes wrangler@4.142.0 deploy --dry-run --config wrangler.cloudflare.example.jsonc` | Passed; no deployment. |
| `WRANGLER_SEND_METRICS=false node scripts/check-cloudflare-local.mjs` | Passed local boot, assets, authentication and invalid-token checks; no live storage accessed. |
| `git diff --check` | Passed. |

Targeted suites are subsets of the final repository count and are not added to it.
The first full run found outdated isolated-router/search/shadow assertions; after
those were corrected, the final verify passed. One intermediate verify required
updating the Overview comparison-copy assertion. No failure is omitted from the
final counts. The filesystem sandbox initially blocked TSX local IPC; authorized
local subprocess/emulator/browser execution completed the required checks.

## Visual inspection

The Overview concept was used as a layout reference: restrained white sidebar,
neutral canvas, outcomes before trend/change and attention/response surfaces.
The written requirements and existing data contracts take precedence over image
mockup details. Four existing Overview outcomes were retained rather than adding
new measures to imitate the concept's five placeholders.

Representative desktop, tablet and mobile images were inspected for spacing,
title/scope order, metric typography, chart/semantic color separation, local table
scrolling, readable dark surfaces and fixed mobile navigation. The final runner
retains 15 screenshots plus `results.json`; the Investigation runner retains its
own screenshots and result file. Outputs are outside Git in the task's
`frontend-ux-evidence-2026-10-02` directory.

Visual QA found and fixed a real mobile overflow: absolutely positioned
screen-reader stage descriptions needed a positioned containing block inside
the horizontal workflow rail. It also exposed historical heading overrides,
Sales KPI monospace/narrow columns and fixed neutral colors on Access Control.
The final run includes these corrections. Initial failed assertions and artifacts
are diagnostic history, not successful verification evidence.

## Bundle and CSS measurement

| Measure | Before | After | Change |
| --- | ---: | ---: | ---: |
| Source CSS bytes | 371,437 | 281,863 | -24.12% |
| Built CSS, raw | 426,966 | 406,429 | -4.81% |
| Built CSS, gzip | 73,104 | 67,564 | -7.58% |
| Built JavaScript, raw | 2,848,463 | 2,838,081 | -0.36% |
| Built JavaScript, gzip | 774,879 | 773,700 | -0.15% |

`src/index.css` fell from 40,894 to 17,020 bytes; `product.css` from 106,589 to 68,480 bytes. The final build emits 98 assets.

The baseline and final measurements sum emitted `.css` and `.js` files separately
under `dist/assets`, including lazy chunks, and gzip each file individually using Python `gzip.compress` at level 9, matching the baseline.
Source CSS comparison uses `src/index.css` plus all `src/styles/*.css`, matching
the pre-edit audit. No runtime/package dependency was added. Route lazy imports,
query owners and hidden section lifetimes are retained.

## Preserved behavior and remaining frontend debt

There are no edits to server routes, SQL/BigQuery, API clients, analytics models,
shared analytical contracts, authentication, Firestore rules or saved-analysis
storage semantics. Scope changes use the existing filter/context paths. Only the
newly introduced Vetting and Consumer Re-entry scope editors defer filter-choice
lookup until opened; their initial pages add no choice request. Overview still
performs one eager summary request, with operating/commercial evidence requested
only on disclosure.

`KpiCard` keeps its lazy lineage/population drawers and is intentionally retained
alongside the common visual metric shell. `product.css` still owns live feature
compatibility selectors; the remaining domain/integration styles need incremental
route-level consolidation. Historical unmounted pages with source-test/fixture
consumers remain, including `ExecutiveOverview.tsx`. These are concrete retained
consumers, not a claim that every legacy selector or wrapper was removed.
