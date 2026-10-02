# ConversionX frontend inventory and verification map

## Current frontend UX convergence — 2 October 2026

The convergence starting at `a12bc89` establishes **Area → Page → Scope → Answer →
Detail**. The sidebar contains seven business areas, with a 248px expanded view and
a persistent 60px icon rail. Contextual page tabs and overflow replace permanent
second-level sidebar links. Mobile keeps Overview, Journey, Contact, Investigate
and More in stable positions. Canonical route ownership, aliases, search and role
visibility come from `routeManifest.tsx`; Validation's frontend visibility now
matches its existing administrator-only backend gate.

`AnalyticsPageLayout` composes the shared header, scope, status and answer content.
Reporting, shell, visuals and Overview have explicit stylesheet owners; feature
styles retain their local layouts. Overview presents primary results before
supporting detail. Investigation and Record Explorer use a compact stage/context
layout and one responsive evidence subtree, preserving the existing analytical
models and scope boundaries.

The retired `Sidebar` and `SectionNavigation` components had no mounted consumers.
Five unused stylesheets were removed only after direct/indirect import, runtime,
fixture and tooling checks. `KpiCard` remains as a behaviour wrapper over the shared
metric styling; historical unmounted pages with fixture/source-test consumers
remain intentionally retained. See [design ownership and the cleanup audit](FRONTEND-DESIGN-ARCHITECTURE.md)
for the exact files, palette and pre-change CSS baseline.

This section supersedes older navigation/layout descriptions below. The generated
[surface inventory](SURFACE-INVENTORY.md) is authoritative for current mounted
routes. Final verification passed 1,026 repository tests (one emulator-only skip),
63 convergence browser scenarios and 17 Investigation scenarios. See the
[verification record](qa/frontend-convergence/README.md) for exact commands,
screenshots and sizes; earlier dated results apply to their original revisions.

## Current investigation workspace — 2 October 2026

The consolidation adds `InvestigationWorkflow` and `useInvestigationAnalysis` over
the existing scoped context. Both inbox and Record Explorer show six stage links
with text/ARIA current state, actual driver comparisons, narrowing, record/dossier
state, pin count and conclusion/unknown state. Header summaries reuse the existing
driver response; refresh, request cancellation, role changes and workspace changes
retain the analytical session boundary. Stage navigation is non-blocking, keyboard
operable and responsive at desktop/tablet/mobile widths. Quick starts now have one
focused domain component. Conclusions remain local analyst notes, not certification.

`/lead-engine` and its implementation are removed, with no alias or command-search
entry. `/validation` displays non-certified historical references and exports their
true status. Its warehouse catalogue is loaded only when selected. Access Control
uses five controlled domain views under `src/features/access`, with subscriptions
and mutations still centralized in UserManagement. The chart catalogue does not
present synthetic values as selected-workspace analytics.

See [the consolidation audit](CONSOLIDATION-AUDIT.md) and
[browser/repository QA](qa/consolidation/README.md) for this revision.

The investigation routes now share an analytical context and evidence workflow. This section supersedes the historical investigation/timeline and navigation descriptions below; the generated [surface inventory](SURFACE-INVENTORY.md) remains authoritative for mounted routes.

| Surface | Current implementation and interaction |
| --- | --- |
| `/investigate`, `/exceptions` | `Exceptions` is the Investigation inbox. Start from measured exceptions or supported metric changes; context, descriptive drivers, current concentration, evidence coverage, optional scoped AI and the local evidence tray remain together. |
| `/lead-explorer` and retained aliases | Record explorer uses `InvestigationRecordList` presets and factual inclusion reasons, with a persistent `LeadDossier`. Global filters, the original drill and additive segment scope are preserved. Pagination/selection reset on scope changes. |
| Selected lead dossier | Summary, Journey, Calls, Outcomes, Evidence and Source tabs. `LeadJourney`, `buildLedgerTimeline`, and `LeadSourceEvidence` are reused. Source access is admin-only; aggregate calls are explicitly not an attempt history. |
| `/data-integrity` | Data confidence retains investigation context and explains the tenant-owned source observation boundary. Contextual `EvidenceConfidence` uses the same existing API and status presentation. |
| `/lead-ledger` | Administrator source/analytical evidence remains available for compatibility and deeper inspection. Dossier source evidence reuses its formatting. |
| Shared drivers | `DriverAnalysis` renders matched dates, exact returned values, descriptive contribution bars and accessible exact tables. `RootCauseDrawer` delegates to it. Unsupported metrics, dates and record-search scopes do not receive fallback metric analysis. |
| Shared local evidence | `InvestigationEvidenceProvider` and `EvidenceTray` retain pin scope/provenance locally, clear across workspace/session boundaries, and use existing CSV export utilities. |
| Shared AI | `InvestigationAI` is an optional, scope-confirmed synthesis surface. Deterministic population results, validation, references and limitations remain visible. |

The context bar distinguishes reporting scope, global filters, investigation predicate and additive narrowing. Narrowing uses `segmentVendor`, `segmentSource`, `segmentGrade`, and delivery-to-first-dial `segmentLeadAge`; these are ANDed with existing globals and the original drill. Session-only dossier selection is not serialized as a lead ID. Back/forward navigation derives the context from the URL and stale responses are hidden for a different request/session.

The current area-only primary navigation is described above. Within Investigate,
the tabs are Investigation inbox, Record explorer (admin), and Data confidence;
Evidence & Audit is a contextual disclosure containing Evidence reports, Lead
ledger (admin), and Vendor evidence. `/exceptions` and existing record/trust aliases
remain compatible.

New focused regression coverage includes `investigation-drivers.test.ts` (exact metrics, matched comparison, narrowing, noncausal language and role-safe links), investigation model/reason tests, dossier interaction tests, navigation presentation, and the updated full frontend acceptance harness. Fixture tests are synthetic and do not establish live BigQuery correctness or production authentication.

## Historical frontend audit — 21 September 2026


Recorded 21 September 2026. The local frontend baseline was `1f8340d1e6291a7177e9ccd679c9c927755be641`, including the three previously committed audit changes above remote main `7285e7a4b9ae2a6e7c3008bbfc40cd6920691639`. This inventory describes mounted functionality, not a certification of warehouse results.

The browser flow under test is: a scoped route opens → meaningful fixture content renders → local chart/table or inspector controls change the intended view → exact values, query scope and focus are retained. The Browser plugin was not available; the pinned Playwright browser harness was used. No live warehouse data or authentication bypass is involved.

## Routes and analytical surfaces

All 24 mounted product routes are listed below. `/` redirects to `/reports`; an unmatched route has a recovery link to Evidence Reports. Titles below use the naming contract; some legacy page headings initially differed, a presentation issue rather than a route change.

| Route | Surface, tabs and primary workflow | Charts and exact tables |
|---|---|---|
| `/reports` | Evidence Reports: scope, metrics, create/replay/cancel, definition, evidence, complete JSON export | Metric cards; grouped breakdown (`report.groups`); evidence record preview; snapshot/source/release context |
| `/explore` | Data Explorer: Lead supply, Capture trend, Sales efficiency, Class results presets; primary/secondary dimension; metric; chart mode; local search/sample/sort/page; share configuration; group inspector; loaded/matching CSV | Bar, column, line, area, doughnut, exact table (`explore.table`); comparison-series checkboxes; bounded point window |
| `/vetting` | Six tabs: Overview, Class Leads, Colour Leads, Class × Colour, Sources & Vendors, Timing & Coverage; class/colour/interval scope and display measure; JSON/scorecard exports | Full enumeration below; bounded scorecards (`vetting.scorecard`), class/colour matrix and source diagnostics |
| `/visuals` | Visual Workspace: API report/source → returned dataset → measure/dimension → visual; context disclosure | Shared visual explorer for every supported returned dataset; point list/inspector; displayed/matching CSV and SVG |
| `/overview` | Executive Overview (Legacy): scope and reconciliation limitation; lead/outcome/revenue summaries; measure selection; analyse changes | Daily Capture-Cohort Performance; Largest Sources by Lead Volume; API visual; analysis drawer comparison table |
| `/insights` | Performance Changes: measure and comparison-dimension selection | Source Contribution Waterfall exact change table (`comparison`) and shared returned-data visual |
| `/routing` | Lead Routing: Routing Depth & Journey Paths; Partner Handoff Matrix; Handoff Discrepancies | Depth (`routing.depth`), journey paths (`routing.paths`), partners (`routing.handoff`), missing-handoff records (`routing.missing`); each has shared visuals |
| `/consumers` | Consumer Re-entry: Volume Tiers Distribution; Sequential Entry Economics; High-Frequency Repeat Consumers | Tier (`consumers.tiers`), sequence (`consumers.sequence`), repeat sample (`consumers.sample`) tables with shared visuals |
| `/acquisition` | Acquisition & Media: source media metrics, financial limitations, channel breakdown | Media channel table (`media.groups`), metric-specific shared visuals; no fabricated spend/ROAS |
| `/lead-performance` | Lead Funnel: lead-stage cards, funnel, call-attempt outcome shares | Recorded Lead-Stage Counts funnel; RPC Share by Call-Attempt Band; Sale Share by Call-Attempt Band; API returned-data visual |
| `/speed-to-lead` | Delivery & First-Dial Timing: capture→delivery and delivery→first-dial means, interval outcomes | Transaction Rows by First-Dial Delay; Recorded Outcome Shares by Delay; exact `speed.bands` table |
| `/call-performance` | Call Performance: Call-Attempt Bands; First-Dial Timing; Vendor & Disposition Records; local vendor/disposition search | Recorded Outcomes by Call-Attempt Band; Lead Counts by Recorded Attempts; `calls.bands`, `calls.hourly`, `calls.weekdays`, `calls.vendors`, `calls.dispositions` tables |
| `/cohorts` | Lead Cohorts: maturity interpretation and funnel performance | Conversion Maturation Matrix (`cohorts.maturity`); Full Funnel Performance by Cohort (`cohorts.funnel`); returned-data visual |
| `/outcomes` | Sales, Activations & Recorded Revenue: Vendor Status Economics; Commercial Drop-Off Funnel; Macro Trends & Distribution | Vendor-status stacked bar; `outcomes.status` exact table; Full Commercial Conversion Funnel; Revenue Realization Trend; Revenue by Source; Revenue by Vendor |
| `/sources` | Lead Sources: volume, yield and full funnel comparison | Lead Volume by Source; Revenue Yield by Source; `sources.performance` exact table |
| `/quality` | Lead Validation & Vetting: validation flags, commercial grade breakdown, suppression reasons | Validation Flag Distribution; Recorded Validation Outcomes; `quality.grades`, `quality.reasons` exact tables |
| `/revetting` | Re-vetting: original/re-vetted counts, recorded outcomes and revenue-per-lead | Original vs Re-vetted Cohort Comparison (`revetting.comparison`); Vetting Score Tier Breakdown (`revetting.vetting`) |
| `/data-trust` | Data Checks: Vendor Telemetry Capability Matrix; Timing Inversion Audit; Multi-Vendor Co-Distribution | Vendor capabilities (`trust.capabilities`); timing anomaly counts; co-distribution table (`trust.multivendor`) |
| `/data-quality` | Data Quality & Timestamps: validation/timestamp status and detected anomalies | Detected Anomalies table (`quality.issues`) and shared visual |
| `/data-coverage` | Source Field Mappings: configured tables, populated-source query, unmapped tables, fact dependencies | `sources.coverage`, `sources.metrics`, `sources.dependencies`; unmapped-table metadata visual; explicit source query evidence |
| `/audit` | Source Record Exports: current scope, grain, JSON/CSV export intent | Export controls, no unrelated exploratory warehouse browser |
| `/explorer` | Lead Records: returned source records, exact selected lead timeline, scoped CSV | `records.leads` table and shared visual; Lead Timeline dialog |
| `/admin` | Configuration: server-side connection and pipeline status | Read-only health/configuration status; unavailable/error state; no browser credential editor |
| `/validation` | Reconciliation Status: independent-check status and limitations | `validation.checks` table and shared visual; no optimistic verification badge |

### Vetting charts and scorecards

Overview contains Class lead distribution, Colour lead distribution, Capture and vetting coverage trend, Class outcome comparison and Colour outcome comparison. Class Leads and Colour Leads each contain the selected classification mix, Downstream evidence by classification, current-vs-previous mix, Selected classification over time and a complete classification scorecard. Class × Colour contains the keyboard-selectable matrix and full cross-tab scorecard. Sources & Vendors contains Segment × class performance and Segment × colour performance plus both exact scorecards. Timing & Coverage contains Capture-to-vetting delay, Class timestamp quality, Colour timestamp quality, source-quality diagnostics, Raw class results and Raw colour-vetting results scorecards. Definitions/source-fields/query evidence is a disclosure shared by every tab.

Vetting charts support bar/column and only compatible line/area/pie/doughnut modes; exact category controls provide non-tooltip access. The matrix selects both classifications; chart category controls select their stated classification. Those are server-scope changes, unlike chart mode, point limits or local scorecard search/page.

## Shared shell, dialogs and detail surfaces

The shell provides desktop/collapsed navigation, mobile Navigation dialog, Quick navigation command palette, skip link, breadcrumb, workspace identity, table density, global legacy query scope, filter disclosure and route/loading/error boundaries. Six navigation groups are Overview, Operations, Commercial, Analysis, Data Trust & Quality and System. Tenant identity remains separate from vendor filtering.

Dialog/detail surfaces:

- Native `Modal`: mobile Navigation, Quick navigation, loading-search boundary, chart-adjustment dialog, Explore group details. Each opening and closing must retain useful focus; dialogs must exclude background interaction.
- `DataAuditDrawer`: selected-population records, grain controls, exact JSON/CSV actions and shared record visual/table (`legacy.audit`).
- `MetricLineageDrawer`: definition/formula/grain/time/journey/source evidence from KPI information controls.
- `AnalyseDrawer`: current/previous segment contribution and dimension selection (`comparison`).
- `LeadTimelineModal`: selected lead identity and actual returned vendor transaction chronology.
- Evidence Reports: inline metric-definition panel, evidence record inspector and report-query context. These are not all modal dialogs and should not be labelled as such in test evidence.
- Shared visual point inspector: exact selected value, optional same-unit comparison and supporting-record action; exact plotted-point disclosure; advanced visual controls; full-screen state.

## Shared chart/table implementations

`DataVisual` selects semantic datasets from a returned API response. `VisualTable` adds Chart + table / Chart only / Table only views to existing semantic tables. `VisualExplorer` owns local measure, dimension, mode, search, ordering, comparison, point limit/window, exact exports and point inspection. `VisualPlot` renders bar, column, line, area, donut, scatter or heatmap only where compatible. Data access and analytical definitions remain upstream.

Dedicated components are `TrendChart`, `HorizontalBarChart`, `DiminishingReturnsChart`, `DistributionBar`, `FunnelWaterfall`, `MetricCompositionDonut`, `ComboChart`, `ScatterPlot`, `ExploreChart` and `VettingChart`. Some are reusable implementations rather than unique mounted routes. `ChartToolbar` supplies matching visual adjustment, records and full-screen actions. Exact table variants include the shared `VisualTable`, `ReportBreakdown`, Explore paginated results, Vetting scorecards/matrix, evidence preview and source-record inspector.

## Baseline observations and implementation priorities

1. Keep workspace access and changed-scope results truthful; repair record-export/timeline scope and stale-response handling. Error states must not resemble legitimate empty/zero results.
2. Reduce repeated scope/hero/control layers. At 390px the baseline Explore first viewport ended at its first measure control; the main visual was below multiple control layers. Baseline Vetting had approximately 5,429px of internally scrolling content at 390px and its first chart began near the bottom of the 1,000px desktop viewport.
3. Consolidate typography, mobile targets, tokens and active-scope summaries. Preserve all analytical meanings and useful controls, using clearly labelled disclosures for advanced display settings.
4. Use stable category identity/colours, exact-value alternatives and consistent table disclosure. Local chart, search and pagination must not rerun analytical requests.
5. Apply shared changes across all routes and test explicit failures, responsive containment, dialog focus and large precise values. Broadly mounted styling is not evidence that every hidden tab was interaction-tested.

## Repeatable verification

`tooling/browser/frontend-ux.mjs` serves a specified production **client** build on loopback and intercepts every API request with isolated, labelled synthetic fixtures. Baseline assets were preserved outside the repository at `/private/tmp/cx-frontend-baseline-1f8340d-dist/client`. The harness shares vetted fixture builders with the existing regression suite; those builders are exported without changing existing assertions.

```sh
node tooling/browser/frontend-ux.mjs --mode baseline --dist /private/tmp/cx-frontend-baseline-1f8340d-dist/client
node tooling/browser/frontend-ux.mjs --mode after
node tooling/browser/frontend-ux.mjs --mode after --quick --widths 390,1440 --repeat 3 --output /private/tmp/cx-frontend-ux-after-matched
node tooling/browser/frontend-ux.mjs --mode after --browser firefox --widths 390,1440 --quick
node tooling/browser/frontend-ux.mjs --mode after --browser webkit --widths 390,1440 --quick
```

Artifacts default to `cx-frontend-ux-{mode}-{browser}/` beneath the platform temporary directory (`os.tmpdir()`), making the runner portable across local machines and CI. No screenshot, trace or customer dataset belongs in source control. `--output` may preserve an individual run. Every run copies its production client assets to an immutable artifact snapshot so concurrent builds cannot delete its route chunks. The `/private/tmp` baseline and output paths in the commands above describe this local audit machine, not a required CI filesystem layout. `--quick` tests only four representative routes (override with `--routes`); the default also covers every route at 390/1440, route failures and a 200% font-resize simulation. The simulation snapshots all existing HTML/SVG computed font sizes before doubling each once, including fixed-pixel text. It is more representative than changing the root font alone, but remains **a simulation, not native browser text zoom**. Core routes cover 320, 360, 390, 768, 1024, 1440 and 1920 CSS pixels. A 320px viewport is a reflow surrogate, **not proof of actual 400% browser-zoom behaviour**.

The harness records page identity, main content, route/framework errors, document horizontal overflow, runtime errors, console diagnostics, request counts, DOM/SVG nodes, decoded route resource sizes and local browser PerformanceObserver observations. It also reports a deliberately limited DOM-label heuristic and below-44px control counts; neither is an automated accessibility certification. Core interaction checks use 1,000 returned groups, bounded initial 25-row tables, local-only chart/search controls, exact group inspection, Escape and focus restoration, command palette and mobile-navigation focus containment. Existing `smoke.mjs` remains the deeper contract suite for chart compatibility, exact decimals, exports, invalid/repeated scope parameters, back/reload state, cancellation, malformed responses and selected tabs.

Local timings are unthrottled laboratory observations on one machine with a fresh browser context and `Cache-Control: no-store`, not production INP or field Core Web Vitals. The first eight-route baseline passed 62 assertions; subsequent comprehensive results and delivery results must be read from their generated `results.json`, not inferred from this initial check. Synthetic reports validate implementation behaviour only: no live tenant permission, warehouse reconciliation, production deployment or commercial approval is certified.

## Completed verification addendum

Measured implementation commit: `90ed0db6c759c610b4ffcc041f25f2afc745fbfa`. Measured production entry: `index-BzXVGtCP.js`. The complete Chromium matrix passed **903/903 assertions over 96 scenarios**; Firefox 141.0 passed **88/88 over eight representative desktop/mobile scenarios**. The integrated Chromium suite passed **717/717**. Its request-state and visual-refinement result files are subsets, not additional assertions. The matrix and Firefox run preceded two visible-label corrections; the integrated suite and paired measurements used the measured build.

A later one-attribute accessibility correction names Overview's existing `TrendChart` measure selector: commit `21e397ac1712a82546ae105195452e4ab1cb8ebc`, production entry `index-C4FxmMY5.js`. Targeted Overview checks passed **24/24 in Chromium and 24/24 in Firefox**, each at 390 and 1440px. They explicitly assert zero unnamed main-content controls in the limited heuristic, exactly one combobox named “Daily Capture-Cohort Performance measure”, and successful measure selection followed by restoration. Opt in with `--routes /overview --widths 390,1440 --quick --check-overview-accessibility`. The original performance figures below remain tied to the earlier measured build; no full matrix or paired-timing rerun was performed for the one-attribute fix.

Matched measurements used Chromium 140.0.7339.186 with three independent cold contexts per route/viewport, for five routes at 390×844 and 1440×1000. Both before and after runs passed **318/318 assertions over 30 scenarios**. Overview's initial decoded JavaScript fell 852,546 → 783,985 bytes, desktop DOM 867 → 676 nodes and mobile scroll extent 4,611 → 2,386px. Mobile Explore scroll extent fell 3,068 → 2,179px. However, median LCP increased across these measured routes, most other route JavaScript grew 7–9KB, and CSS grew 12,605 decoded bytes. This is **not an application-wide speed improvement claim**. Explore's local table-switch stopwatch increased from approximately 13ms to 60–64ms while still issuing no analytical query; it is not production INP.

Durable, uncommitted evidence is stored outside the repository in the sibling `frontend-verification-2026-09-21` directory: `before/`, `after/`, `chromium-matrix/`, `firefox/`, `regression-evidence/`, `accessibility-followup/` and `performance-summary.md`. The summary includes all timing/resource regressions, matched screenshot links, browser versions, per-run evidence, inaccessible/unmeasured areas and native zoom/screen-reader limitations. The route runner accepts `--source-commit` to record the exact supplied build provenance; it never assumes the current checkout represents an external baseline snapshot.

## Saved investigation definitions

`SavedInvestigations` is a compact inbox disclosure, loaded only when opened. `savedInvestigationModel` projects exact supported scope into a strict versioned definition and builds a fresh URL when reopening it. `savedInvestigations` uses the existing authenticated fetch layer and validates returned workspace/revision/schema before displaying or applying a response. Session/workspace transitions abort requests and clear component state; reporting-scope changes invalidate pending action feedback. Name/save/open/rename/delete controls include distinct unavailable, loading, empty, failure and conflict states, responsive forms and status announcements. Evidence pins and notes remain separate local state.

## Visual Audit Evidence — current shared ownership, 2 October 2026

- `shared/evidence/InspectorHost.tsx`: canonical Audit Evidence panel; result,
  independent evidence dimensions, metric anatomy, declared lineage, supplied
  coverage/qualification/dependencies, reconciliation boundary and record actions.
- `shared/evidence/auditPanelModel.ts`: conservative defaults from registered
  definitions and supplied response content; never invents API endpoints,
  independent comparisons, excluded populations or history.
- `shared/evidence/{EvidenceTrace,MetricAnatomy,EvidenceCoverage,EvidenceExclusions,ReconciliationView,AuditDependencyMap}.tsx`:
  request-free shared visuals with exact accessible values and explicit states.
- `shared/evidence/SupportingRecordPreview.tsx`: administrator-only, user-triggered,
  five-row existing record drill. Masked identifiers and sample limitations.
- `shared/evidence/auditPresentation.ts`: explicit saved scope/narrowing overrides,
  destination policies and private-scope sharing protection.
- `UnifiedMetricCard` and `AuditEvidenceButton`: consistent Audit evidence control.
  Existing value-click inspectors remain usable in normal presentation.

Overview, Journey, Response Speed, Sales and Commercial pass available populations
into shared models. Data Confidence connects declared metric/source dependencies,
measured integrity and definitions without introducing a new navigation layer.
Pinned Investigation evidence retains its saved case scope; selected Lead Ledger
record evidence reuses `LeadJourney`. See [visual audit boundaries](AUDIT-EVIDENCE.md).
