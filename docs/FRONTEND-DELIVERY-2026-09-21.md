# ConversionX frontend delivery — 21 September 2026

## Scope and provenance

This is a refinement of the existing React/Vite application, not a replacement frontend or a warehouse reconciliation. The local starting commit was `1f8340d1e6291a7177e9ccd679c9c927755be641`. Remote main was fetched and remained `7285e7a4b9ae2a6e7c3008bbfc40cd6920691639`. The three earlier local audit commits were preserved. Work is isolated on `codex/frontend-refinement-20260921`.

The complete mounted route, tab, chart, table and detail inventory is in [FRONTEND-INVENTORY.md](FRONTEND-INVENTORY.md). The implementation deliberately preserves all 24 routes and shared page names. Shared changes apply across the app; this is not a claim that every hidden legacy tab has received an exhaustive interaction audit.

The frontend implementation and unit regressions are committed as `90ed0db6c759c610b4ffcc041f25f2afc745fbfa` (`feat: unify analytical frontend scope and interactions`). Browser verification is committed as `96ecf3840d3a1a2f6999d7a9ff72a09e026d8a3d` (`test: cover frontend scope, exact exports and responsive workflows`). Delivery documentation is retained in a following documentation commit.

A final one-attribute accessibility correction names the shared trend-chart measure selector: `21e397ac1712a82546ae105195452e4ab1cb8ebc` (`fix: name the trend chart measure selector`). It does not change layout, data requests or calculations. Matched timing evidence intentionally retains its earlier measured-build provenance; targeted Chromium/Firefox checks cover this final correction.

No warehouse SQL, metric definitions, denominators, attribution rules, source mappings, authentication policy, tenant grants, reporting contracts, package versions or lockfiles were changed in this frontend delivery. `node scripts/engine-stamp.cjs --check` passes without regenerating the engine hash.

## Implemented changes

### Workspace and reporting scope

- Reports do not mount until an authorised workspace configuration has loaded. Failed configuration no longer falls back to a default tenant. Retry aborts old work and clears analytical caches.
- An explicit `workspace` view parameter is checked against the authorised workspace list. Selection survives reload, copied Explore links and Back/Forward. Repeated, malformed and unauthorised workspace selections fail closed. A URL never grants workspace access.
- Workspace identity remains separate from vendor filters. Evidence/legacy navigation preserves workspace identity while keeping the two reporting-scope models separate.
- Observed 401 errors from shared analytical requests and Lead Records exports clear cached records and require a new access check. Endpoint-specific 403 errors remain local failures.
- Applied capture dates and actual filter selections stay visible with individual removal and clear actions. Shared filter descriptions preserve false, zero, numeric bounds and multi-selections. Checkbox toggles derive from the pending scope so same-tick edits cannot overwrite each other.
- Global scope edits produce navigable history and materialise default dates. Invalid/repeated/conflicting parameters are not silently broadened.
- Lead and consumer record identifiers remain session-only when selected through the filter context; their values are masked in scope summaries. Shared URLs containing such predicates are rejected. Explore sharing is disabled while private selections are active. This does not replace existing authorised record API contracts, which still identify the requested record in requests.

### Shared visual system and navigation

`src/styles/product.css` defines common canvas/surface/ink/border/accent/focus, radius, control-height, type, spacing, table-density and motion tokens. It loads after the base stylesheet; route-specific overrides have explicit product scope. Navy navigation, white/cool-neutral analytical surfaces, teal actions and existing semantic statuses remain intact.

Controls and table text generally use 13–14px; essential shared chart labels/captions are raised to 12px; primary touch targets use 44px. Comparable numbers retain tabular numerals. The mobile header supports workspace selection without overlapping the report. The application container does not hide page-level horizontal overflow to mask defects. Wide charts/tables keep their own scrolling boundaries.

The rendered all-route sweep found whole-main overflow in three mobile tab rows (Consumer Re-entry, Outcomes and Data Checks). Those rows, and the equivalent Lead Routing row, now wrap rather than widening or clipping the main content.

Existing navigation, command palette, density selection, skip link and native-dialog behaviours remain available. No new UI framework or font request was added.

### Analysis workflows

- **Data Explorer:** compact identity; expandable presets and query configuration; selected metric/dimension remain visible; secondary sort/sample/point/series controls behind Adjust visual; local search remains directly accessible. Sample threshold is explicitly a display filter, not a confidence test. All existing metric/dimension/secondary-dimension/chart/series/window/search/sort/page/inspector/export features remain.
- **Evidence Reports:** visible scope → run → inspect/export sequence; disabled run action has an associated reason; approved-release, calculation-check and source-completeness distinctions remain intact. No legacy fallback figures.
- **Vetting:** removes repeated hero/scope material; coherent readable controls, restrained summary row, stable category colours, exact-value alternatives and legible matrix/legend samples. All six analysis tabs are retained; class and colour remain separate axes.
- **Executive Overview:** four principal summaries precede the main capture-cohort trend. Delivery/activation/conversion details remain in a disclosure; the general returned-dataset explorer mounts on demand below the principal analysis. No metric was removed.
- **Visual Workspace:** source choices are grouped by purpose without dropping endpoints; compatible chart controls and precise source context remain.
- **Operational pages:** failed requests on cohorts, funnel, outcomes, sources, quality, routing, consumers, re-vetting, data checks, timestamps and insights have readable alerts and retry actions instead of empty/zero-looking success. Performance Changes preserves scope when opening Explore and describes association rather than causation. Data Quality says no critical issues were returned, rather than declaring ingestion healthy.
- **Configuration:** aborts obsolete health requests, identifies the actual workspace, provides retry, and distinguishes a connection check/source timestamp from ingestion completeness or reconciliation.

### Charts, tables, inspectors and exports

- Stable category identity distinguishes missing values, literal fallback labels, booleans and similarly labelled text. Colours derive from identity, not sorted position. Recognised named vetting colours retain their meanings.
- Shared chart toolbars provide lazy exact-value tables with precise decimal ordering, `aria-sort`, local search, 25-row initial pagination and explicit displayed/matching/all-loaded exports. The modal keeps its identity/close action reachable and restores focus.
- Generic visual charts have text-accessible legends and exact values, semantic heatmap controls, explicit local-selection copy and focus restoration. Downloaded object URLs are revoked.
- Lead Records defaults to an exact table, offers working local search and scoped pagination, and preserves the active tenant/dates/filters in its export and timeline requests. Its export states the 10,000-record API cap; it does not claim to export all warehouse records.
- Lead timelines and supporting-record inspectors are native dialogs with cancellation/error/retry states. Missing timeline events are not fabricated from another timestamp. Supporting records render 50 rows at a time; loaded CSV remains independent of page/visible columns. Response-generation time is not labelled source freshness.

## Design and fidelity record

The frontend design/testing and React skills guided shared component consistency, deferred work and rendered verification. A generated desktop/mobile concept explored a compact scope → builder → analysis → exact-values composition. It is a reference only, never a shipped screenshot or a source of production data.

Intentional differences from that concept preserve the actual product: the complete six-group navigation and existing icon system remain; no invented avatar is added; real returned API groups/precision warnings replace the concept's three explicitly synthetic design rows; query configuration can collapse on desktop as well as mobile; all existing report controls and material limitations remain available.

The fidelity review compares: (1) navy/white/teal palette, (2) readable heading/body/control hierarchy, (3) compact scope and progressive builder, (4) restrained analytical containers and exact-value access, (5) mobile containment/focus/target sizes, and (6) existing route names and controls. Functional evidence and visual evidence are separate; neither is described as full accessibility certification.

## Verification and limitations

Verification uses synthetic API interception in the existing isolated browser harness; production server security is not weakened. The Browser plugin was unavailable, so the pinned Playwright installation was used. Chrome DevTools MCP tracing was unavailable; local browser observations are not field Core Web Vitals, production INP or a Lighthouse score.

Measured results and publication status are recorded below. Representative failed checkpoints are retained as intermediate evidence, not counted as passing runs.

### Implementation checks

- A fresh `npm ci --ignore-scripts --no-audit` installed the unchanged application lockfile successfully (265 packages; the upstream `node-domexception` deprecation warning remains).
- `npm run verify` passed TypeScript, all **309** regression tests and the production client/server build after all final label corrections, including the trend-chart selector.
- `npm audit --audit-level=moderate` and `npm audit --prefix tooling --audit-level=moderate` each reported **zero known vulnerabilities**. This is an advisory-database result, not a security certification.
- `node scripts/engine-stamp.cjs --check` and `git diff --check` passed. No analytical files or fingerprint were modified.
- The final production entry is `index-C4FxmMY5.js`: 317.54 kB raw / 100.17 kB gzip. The paired measurements and 717-assertion suite used `index-BzXVGtCP.js`, before the one-attribute trend-selector correction. The largest shared chart chunk remains 372.75 / 109.86 kB; the new lazy exact-values module is 5.40 / approximately 2.30 kB. These are build asset sizes, not the complete network transfer for every route.

### Rendered regression coverage

| Check | Result | Actual coverage |
|---|---|---|
| `node tooling/browser/smoke.mjs` | **717/717 assertions passed** | Measured implementation build, before the final one-attribute accessibility correction; Chromium 140.0.7339.186; desktop 1440×1000 and mobile 390×844, with shared visual refinements also at 360×800 |
| Full `frontend-ux.mjs --mode after` sweep | **903/903 assertions passed**, 96 scenarios | All 24 routes at 390/1440; route failure states; core routes at 320, 360, 390, 768, 1024, 1440 and 1920px; computed 200% font-size simulation |
| Firefox core sweep | **88/88 assertions passed**, 8 scenarios | Firefox 141.0; Evidence Reports, Explore, Vetting and Visual Workspace at 390/1440 |
| Request-state subset of integrated smoke | **114 assertions passed** | Slow/malformed/failed/aborted work; scoped exports/timelines; authorised workspace reload/history/selection; permission recovery |
| Shared visual subset of integrated smoke | **102 assertions passed** | 1,000 loaded rows / 25 initial DOM rows; precise sorting; 50 displayed / 100 matching / 1,000 loaded CSV rows; local-only operations; focus; matching visible/accessibility labels |
| Final Overview accessible-name follow-up | **24/24 Chromium and 24/24 Firefox assertions passed** | Final `index-C4FxmMY5.js` build at 390/1440; exact named measure selector; no unnamed controls in the limited heuristic; change and restore measure |

The last full responsive and Firefox sweeps precede two visible-label corrections (`Search exact values` and `Search chart labels`), plus the later one-attribute trend-selector correction. The 717-assertion suite rechecked the two search controls, and matched runs cover their containing pages. The last trend-selector correction has its own targeted cross-browser checks. This boundary is recorded rather than implying every broad sweep was rerun after every copy edit. Subset counts are included in 717, not additional independent assertions to inflate the total.

Harness adaptations preserve meaningful assertions: disclosures are explicitly opened before operating moved controls; the intentional Lead Records table-first default is asserted before switching to Chart + table; preflight validation uses the specific status region when the same reason is also linked to a disabled button. No assertion was removed to conceal a product defect.

### Matched performance results

Five routes were measured before and after, at 390×844 and 1440×1000, three times per combination: **30 scenarios / 318 passing assertions for each build**. Conditions were the same machine, Chromium 140.0.7339.186, independent cold contexts, no CPU/network throttling, immutable production-client copies, loopback/no-store responses and identical synthetic fixtures. Other test/build jobs were stopped; background operating-system/user activity was not controlled. Figures below are medians, not production service-level guarantees.

| Measurement | Before → after | Interpretation |
|---|---|---|
| Overview initially loaded decoded JS | 852,546 → 783,985 bytes | 8.0% lower initial footprint; optional returned-data visual remains available on demand |
| Overview desktop DOM | 867 → 676 nodes | 22% fewer initial nodes |
| Overview mobile main scroll extent | 4,611 → 2,386px | 48% shorter initial layout |
| Explore mobile main scroll extent | 3,068 → 2,179px | 29% shorter |
| Explore mobile first chart position | y≈2,376 → y≈1,516px | About 860px earlier, still below the first viewport |
| Explore mobile CLS | 0.01687 → 0.00010 | Lower observed initial shift |
| Overview desktop CLS | 0.22910 → 0.00044 | Lower observed initial shift |
| Explore desktop chart-to-table automation stopwatch | 13.31 → 63.62ms | Regression; still local and bounded; not INP |
| Explore mobile chart-to-table automation stopwatch | 12.78 → 60.04ms | Regression; zero additional analytical requests |
| Other route initial decoded JS | +6,999 to +9,157 bytes | 0.8–2.1% higher; the added safeguards/controls have a cost |
| Initial decoded CSS | +12,605 bytes per measured route | Increase, not a bundle optimisation |

Desktop LCP regressed: Evidence Reports **76→388ms**, Explore **80→712ms**, Vetting **124→396ms**, Visual Workspace **80→384ms**, Overview **116→388ms**. Mobile LCP also increased. No profiling trace establishes the cause; the new workspace gate is intentional but is not presented as proven attribution for these timings. LCP observes initially visible content, not readiness of every offscreen chart. Reports and Visual Workspace became taller, and mobile Vetting grew slightly. Further mobile simplification and initial-paint profiling remain worthwhile.

The result is a measurable improvement in selected rendering footprints, information hierarchy and interaction safety, **not an across-the-board speed improvement**. No field INP, production Core Web Vitals or Lighthouse result is claimed.

### Retained evidence

The sibling workspace directory `frontend-verification-2026-09-21/` contains `before/`, `after/`, `chromium-matrix/`, `firefox/`, `regression-evidence/`, `performance-summary.md` and raw result JSON. Screenshots, immutable asset snapshots and diagnostic records are intentionally not committed. The performance summary includes every measured route/viewport, all resource/latency regressions, exact conditions and matched desktop/mobile screenshot links.

### Accessibility checks and limits

Rendered checks exercise primary keyboard controls, native dialog focus containment, Escape and focus restoration, visible page identity, labels, reduced-motion mode, and table/chart containment. The exact-table and shared chart search controls now have matching visible and accessible names. Screenshot review examines overlap, wrapping, legibility and the retained hierarchy against the design concept.

Calculated token contrast ratios are: primary ink `#0f172a` on white **17.85:1**; secondary ink `#475569` on white **7.58:1**, or on `#f8fafc` **7.24:1**; white on the teal primary action `#0f766e` **5.47:1**; focus outline `#0d9488` on white **3.74:1**. These checks cover those colour pairs only, not every rendered state, translucent layer, disabled control or chart mark. Status/category meaning also remains available in text and exact tables.

Remaining qualification boundaries:

- No live warehouse reconciliation, commercial approval or production tenant permission audit was performed.
- Native Safari/iOS/WebKit, assistive-technology testing and native 400% browser zoom remain unverified unless explicitly listed in the final evidence. Narrow CSS viewports are only reflow surrogates.
- Computed-font doubling exercises fixed-pixel and inherited text at 200%; it is a simulation, not a native browser text-zoom certification.
- Automated labels/targets/focus/containment checks and screenshot inspection are not a WCAG 2.2 AA conformance statement. Some legacy controls and chart-specific visual details need a dedicated accessibility audit.
- Operational time-series calendar completion and analytical precision rules were not redefined. No client-side interpolation or invented missing-period zeroes were introduced.
- Larger text can increase scrolling; the changed UI is not claimed to improve every route's size or latency. Raw repeated-run measurements are retained for comparison.

## Rollback and publication

The GitHub account available to this task reports `pull: true`, `push: false` for `warrens-alt/Cx`. Local completion is separate from publication. No deployment configuration or production URL was established by this task; a successful push/CI run would not by itself prove deployment.

After fetching origin and confirming it was an ancestor of the tested local branch, a normal `git push origin HEAD:main` was attempted for the implementation and browser-regression commits. GitHub rejected it with **HTTP 403: permission denied to `warrenstear30-afk`**. No force-push, alternate identity, fork or production deployment was used. Remote main remains `7285e7a4b9ae2a6e7c3008bbfc40cd6920691639`.

The latest remote CI run, [35623890394](https://github.com/warrens-alt/Cx/actions/runs/35623890394), succeeded for that older remote-main SHA. It does **not** validate the new local commits. No new remote CI run was triggered by the failed publication. The inspected CI workflow performs validation and artifact collection, not a deployment job. Delivery remains local until an authorised writer publishes it; the documentation commit records this blocker and was not claimed as remotely published.

To roll back after an authorised merge, revert the frontend implementation commit(s) with ordinary `git revert`, preserving the preceding audit commits and any newer work. Do not hard-reset shared main or force-push. Before a later authorised publication, fetch origin, compare the then-current main, rerun verification if rebasing/cherry-picking, and publish through the repository's normal review process.
