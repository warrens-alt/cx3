# Visual Audit Evidence acceptance — 2 October 2026

Repository: `warrens-alt/cx3`, local `main`. Fetched baseline and remote `main`
were `e335ad582cd62cce0b57ee92de2b666a97ea5a41`; there were no later commits to
reconcile. Existing untracked `build/`, `dist/` and `out/` are excluded from Git.

## Scope and evidence boundaries

Shared trace, anatomy, coverage, qualification, comparison and dependency views
feed the existing canonical `InspectorHost`. Audit Mode retains normal reports
and adds consistent audit actions. Integrations cover Overview, Journey, Speed,
Sales, Commercial, Data Confidence, Investigation pins and selected Lead Journey
evidence. No backend, API, SQL, metric definitions, source mapping, analytical
formulas, lifecycle qualification or numerator/denominator semantics changed.

The operational contracts do not expose persisted independent reconciliation
history or independent audit observation events. No new history chart or synthetic
timeline is rendered. Source-owner business approval remains absent unless an
explicit comparison/approval model is supplied. Same-query marketing comparisons
remain delivery consistency, with exact signed differences. Missing exclusion
reason counts, field population counts, Speed RPC denominators and financial cost
inputs remain unavailable; no sample-derived completeness is claimed.

## Executed verification

Final command counts are recorded in `docs/IMPLEMENTATION-STATUS.md`. All required
commands were executed: `npm ci`, `npm run lint`, `npm test`,
`npm run docs:surfaces:check`, `npm run build` and `npm run verify`.
`npm ci` installed 524 packages without dependency/lockfile changes. The full suite
has one Firestore emulator-gated skip (`FIRESTORE_EMULATOR_HOST` not configured).
The final verify command reruns lint, the full suite, the surface inventory and
production frontend/server/static catalogue build. Build-time warehouse catalogue
exports are static assets, not live source reconciliation.

Final `verify`: **1,195 tests, 1,194 passed, 0 failed, 1 skipped, 0 cancelled**.
The four dedicated audit suites independently passed **51/51**, and the
Investigation workspace suite passed **19/19** after its scope-navigation request
was awaited before measuring audit-only requests. These overlapping runs are not
added to the full-suite total. Both browser runners passed all scenarios listed
below, with no page or console errors.

Dedicated audit tests cover independent dimensions, supplied zero/missing values,
non-nested activation/sale ratios, disjoint versus overlapping coverage, exact
signed decimal differences, tiny numeric precision, unsupported actions, lazy
masked previews, exact pin scopes, private share restrictions and record schema
boundaries. Existing rendered acceptance tests exercise keyboard focus, drawer
reopening, scoped navigation, viewer gates, Journey lens and real record audit.

## Browser acceptance

The Browser plugin was unavailable in this session. The existing Playwright and
Chromium runtime ran local synthetic acceptance fixtures using the final source
and production CSS; no dependencies were added. No production data was queried.

| Runner | Coverage | Completed scenarios |
| --- | --- | ---: |
| `scripts/check-frontend-convergence-browser.mjs` | 22 routes × 3 viewports × 2 themes, plus scope lifecycle and shell/access checks | 147 |
| `scripts/check-audit-evidence-browser.mjs` | Nine audit flows × 3 viewports × 2 themes, plus two viewer record gates | 56 |

Viewports: desktop **1440×1000**, tablet **820×1180**, mobile **390×844**. Themes:
light and dark. Focused flows cover Overview anatomy/trace/explicit preview,
Journey lens, missing Speed denominator, Sales evidence, Commercial spend/profit
dependencies, Data Confidence metric/source views, pinned Investigation scope,
selected Lead Journey evidence and seven explicit audit-state renderings.

Checks include route URL and document-title identity, nonblank page, absent Vite
overlay, document/drawer overflow, console/page errors, keyboard focus entry and
containment, Escape closure, return-to-trigger focus and exact record parameters.
Opening/closing evidence, toggling Audit Mode and changing the Journey lens add
no requests. Explicit admin preview makes one bounded existing request; viewer
access exposes neither preview nor records link. Screenshots were inspected for
readable connectors, technical values, status labels, light/dark contrast and
responsive layouts.

Initial browser runs exposed a real stretched-card hit area intercepting small
audit controls. Raising the control within the card fixed the interaction.
Runner-only assumptions about page titles, hidden responsive duplicates and HTML
boolean `open` attributes were corrected, then the complete matrix was rerun.
Screenshot review also caught an incorrect theme preference key in the new runner;
it now uses `cx-theme` and asserts `html[data-theme]` before screenshots. Actual
dark screenshots were regenerated and inspected after the full 56-scenario pass.
The final JSON is the authoritative result, not earlier failure screenshots.

Evidence is outside Git at `../visual-audit-evidence-2026-10-02/`:
`convergence/results.json`, `focused/results.json` and PNG screenshots. Command
logs are `../visual-audit-verify.log`, `../visual-audit-browser.log`,
`../visual-audit-convergence-browser.log` and the earlier individual command logs.

To reproduce with a configured Playwright installation:

```bash
CX_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CX_CHROMIUM_EXECUTABLE=/absolute/path/to/chromium \
CX_BROWSER_QA_OUTPUT=/absolute/path/outside/the/repository \
node scripts/check-audit-evidence-browser.mjs
```

Run `npm run build` first so the fixture uses current production CSS. Each result
is explicitly synthetic. Passing acceptance does not certify live production
totals, independent reconciliation or business meaning.
