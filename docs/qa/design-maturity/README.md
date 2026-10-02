# Design maturity verification — 2 October 2026

The phase started from `6629b339e38cf05d555ad2cb10cccc9e2fd95fd3` on `main`.
`origin/main` was fetched before editing and again before committing; both checks
matched that commit, with no intervening visual commits to reconcile.

## Presentation changes

| Area | Result |
| --- | --- |
| Visual hierarchy | Connected telemetry, a primary analytical composition, and quieter exact-evidence disclosures replace repeated equal-weight panels. |
| Duplicated UI | Journey's six large cards were removed; the lifecycle hero owns stage populations, while the original metric values and denominators remain in a six-row disclosure. Sales, Acquisition and Reconciliation also shed repeated values. |
| Surfaces | Unboxed canvas and navigation; restrained analytical frames; elevation for focused views, drawers and popovers. The analytical dot canvas is local and disappears in print. |
| Telemetry | Overview, Contact, Speed, Sales, Commercial, Data Confidence and specialist summaries use the shared rail. |
| Charts | Shared `ChartFrame`, `ChartTooltip`, quiet actions, token colors and focus controls replace legacy chart wrappers/tooltips. |
| Linked interaction | Vendor bars/matrix/table, Contact bucket/table, Sales segment/table and Temporal cell/row/column selection remain local. Filtering and inspection stay explicit actions. |
| Journey | One continuous six-stage path, persistent selected state, qualified intersections, visible non-nested warnings, responsive vertical mode and request-free focus. |
| Speed and Temporal | Latency distribution leads into an unboxed percentile instrument. Supplied percentile markers retain their exact positions with collision lanes. Temporal retains 168 cells, operating-window boundaries and a persistent selected-window summary. |
| Investigation | Actual case identity, returned affected count, label-only narrowing when counts are absent, and a compact persistent workflow above the evidence workbench. |
| Commercial | Marketing, matched operations, matched revenue and separate cohort revenue have explicit lineage boundaries. Missing costs stay unavailable and profit stays not calculable. |
| Lead Ledger | Aligned UTC time column, event spine, existing elapsed labels, and chronology warnings directly beside affected events. |
| Audit Mode | Metric IDs, supplied versions, sources, validation and response-generation metadata use a consistent technical label treatment. Response generation never claims source freshness. Required warnings remain visible. |
| Scope and focus | One mounted scope editor becomes compact on desktop/tablet and publishes its measured height. Mobile scrolls normally. Focus preserves chart nodes and local state, traps focus, supports nested inspectors, and restores focus on Escape. |
| Specialists | Qualification, Cohorts, Agent activity, Caller ID, Routing, Consumer re-entry, Reconciliation and Warehouse use the shared presentation system. Classification and local roster restrictions remain visible in focused context. |

The shell now positions its main scroll area relatively. This contains absolute
screen-reader labels that previously enlarged the document and allowed
`scrollIntoView` to move the entire shell. Browser assertions verify zero outer
document scrolling, opaque compact scope, and case/evidence alignment below it.

## CSS ownership and size

Reporting owns migrated scope/query controls; shared visuals own chart and
segmented controls; operating controls have their own stylesheet. Contact and
Temporal foundations moved out of `product.css`, `journeyContactVisuals.css` and
`timeAgentCampaignVisuals.css` into their feature owner. Qualification's existing
compatibility rules moved to its feature stylesheet. Superseded definitions were
removed, including old dark segmented-control colors and duplicate chart rules.

| Source CSS | Before | After |
| --- | ---: | ---: |
| `product.css` | 68,555 bytes / 1,837 lines | 56,966 bytes / 1,542 lines |
| `reporting.css` | 23,209 bytes | 28,233 bytes |
| `visuals.css` | 24,648 bytes | 34,565 bytes |
| All source CSS | 357,087 bytes | 377,311 bytes |

`product.css` is about 17% smaller. Total source CSS grows about 5.7% because the
phase adds focus, selection, instrumentation and responsive states. These are
source-file measurements, not compressed network transfer sizes. Remaining
legacy styles were not mechanically rewritten.

## Executed verification

| Command or suite | Result |
| --- | --- |
| `npm ci` | Passed. |
| `npm run lint` | Passed. |
| `npm test` | 1,140 tests: **1,139 passed, 0 failed, 1 skipped**. |
| `npm run docs:surfaces:check` | Passed. |
| `npm run build` | Passed: client, server, static mirrors and warehouse reference export. |
| `npm run verify` | Passed the complete types → tests → inventory → build chain. |
| Expanded convergence browser suite | **147/147 passed**, 172 screenshots, zero runtime errors and zero console warnings/errors. |
| Contact / Speed / Temporal / Caller ID browser suite | **24/24 passed**, plus **2/2** mobile Temporal geometry checks. |
| Sales / Vendor / Acquisition / Commercial browser suite | **24/24 passed**. |
| Consumer / Reconciliation supplemental browser suite | **12/12 passed**. |
| Final Qualification chart-type, scope and supplied timing checks | **6/6 passed**. |
| Case browser suite | **6/6 passed**. |
| Ledger browser suite | **6/6 passed**. |
| Existing Investigation workflow suite | **17/17 passed**. |

The skipped test is the existing Firestore access lifecycle suite that requires
its emulator environment. One existing access-page test was made deterministic:
it now waits for React's passive subscription cleanup before asserting that all
subscriptions closed. The production access implementation was not changed.

Nineteen added regression tests cover lifecycle selection, Journey deduplication,
zero versus unavailable evidence, truthful audit metadata, immutable inputs,
local cross-highlighting, Temporal crosshairs, focus/state preservation, inline
timeline anomalies, exact sticky scope, and equivalent theme token identities.
Browser checks additionally cover specialist primitives and focus context,
restricted Agent inspection, local search, scope/request invariance and keyboard
focus restoration.

## Browser coverage and evidence

The matrix runs at **1440×1000**, **820×1180** and **390×844**, in both light and dark
themes. Its 147 checks comprise 132 route/theme/viewport combinations, six
lifecycle/focus/sticky interaction cases, and nine shell/access cases. Chromium
version was `151.0.7922.34`.

Routes: Overview, Progression, Contact effort, Response speed, Temporal, Sales,
Vendor quality, Acquisition, Commercial, Investigation, Record explorer, Lead
Ledger, Data Confidence, Settings, Qualification, Cohorts, Agent activity, Caller
ID, Routing, Consumer re-entry, Reconciliation and Warehouse.

Browser plugin tools were unavailable, so the existing optional Playwright
runtime was used without installing a browser dependency. The committed runners
build the actual routed application with isolated test identity/API adapters and
the production stylesheet. After `npm run build`:

```sh
export CX_PLAYWRIGHT_MODULE="<existing-playwright-module>"
export CX_CHROMIUM_EXECUTABLE="<existing-chromium-executable>"

CX_BROWSER_QA_OUTPUT="<outside-repository>/matrix" node scripts/check-frontend-convergence-browser.mjs
CX_BROWSER_QA_OUTPUT="<outside-repository>/case" node --import tsx scripts/check-case-design-browser.mjs
CX_BROWSER_QA_OUTPUT="<outside-repository>/workflow" node scripts/check-investigation-browser.mjs
CX_BROWSER_QA_OUTPUT="<outside-repository>/ledger" node scripts/check-ledger-visual-browser.mjs
```

Session evidence is outside the repository at
`/Users/warrenstear/Documents/ChatGPT/CX3/design-maturity-evidence-2026-10-02`.
The authoritative expanded matrix record is `matrix-verified/results.json`.
Earlier `matrix` records and `failure-*` captures are diagnostic history, not the
final result. Supplementary records live under `contact-temporal`, `outcomes` and
`case-evidence`; final Qualification control/timing checks are in
`qualification-final/results.json`.

Screenshots were visually inspected in both themes, including Journey,
Response Speed, Temporal selection, Commercial focus, Vendor selection, the
sticky case header, mobile ledger anomalies and specialist mobile layouts.
Tests assert containment in local scroll regions rather than hiding evidence
to eliminate overflow.

These are **synthetic acceptance fixtures, not live warehouse validation**.
`secondaryMaturityFixtures.ts` reuses existing test evidence for Qualification,
Cohorts, Caller ID and the saved Warehouse catalogue. Qualification's existing
fixture supplies aggregate counts but no grouped rows, so its grouped charts
retain their honest empty state. Six final cases also inspect its existing
supplied timing values and verify Pie, Bar, Line and Donut selected controls
without changing scope, requests or aggregate evidence. Routing and Reconciliation also exercise
unavailable states where suitable populated fixture evidence was absent. No
group counts were invented from aggregate totals.

## Analytical integrity

No analytical definitions, API contracts, BigQuery queries, source mappings,
numerators, denominators, tenant-isolation rules, lifecycle qualification,
investigation predicates, validation states, attribution or commercial formulas
were changed. The final diff leaves `contracts/`, `server/`, `src/lib/`,
`src/hooks/`, feature model files and package manifests unchanged.

Shared-adapter review and frozen-input regression tests found no new mutation
of returned objects. New sorting for percentile label placement operates on
copies and changes geometry only. Unavailable values remain distinct from zero;
CLI zero bars no longer receive a forced visible width. Test fixtures are not
imported by production entry points. Generated `build/`, `dist/` and `out/`
directories remain outside the commits.
