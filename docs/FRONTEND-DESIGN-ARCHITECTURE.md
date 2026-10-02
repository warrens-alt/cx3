# Frontend design architecture and convergence audit

Recorded 2 October 2026 against the frontend convergence work starting at `a12bc89`
(PR #50). This document describes presentation ownership and the audited cleanup.
The generated [surface inventory](SURFACE-INVENTORY.md) remains the route/API map;
[implementation status](IMPLEMENTATION-STATUS.md) records analytical and deployment
boundaries.

## Canonical structure

**Area → Page → Scope → Answer → Evidence** is the maintained reading order.

| Level | Responsibility | Canonical owner |
| --- | --- | --- |
| Area | Stable business destination and current location | `routeManifest.tsx`, `PrimaryNavigation`, `AppShell` |
| Page | Contextual destination, one title and useful actions | `AreaNavigation`, `AnalyticsPageLayout`, `PageHeader` |
| Scope | Workspace, period and applied filters, with explicit editing | `ReportingScopeBar`, existing filter contexts and editors |
| Answer | Principal supported measures and the main chart/table | Feature page, shared metric and reporting primitives |
| Evidence | Supporting comparisons, records, definitions and provenance | Feature disclosures, inspectors and existing drawers |

`AnalyticsPageLayout` composes the title/actions, scope, status and content. It owns
no queries or analytical state. `OperationalPageHeader` adapts existing report
metadata/actions to `PageHeader`; `PageShell` supplies the page boundary. Local
section switches and disclosures retain their existing component/query lifetimes.

Overview leads with outcomes, performance and meaningful changes, followed by
attention and supporting detail. The Investigation and Lead Evidence Population layouts
retain their six-stage workflow, with a compact context summary and one mounted
evidence subtree that adapts to the available width. These layouts reuse the
existing models, scope, predicates, export utilities and evidence states.

## Navigation and colour

The desktop sidebar contains only seven business areas. It is 248px expanded and
60px as an interactive icon rail; the collapsed preference persists locally.
Second-level destinations belong to the current area's contextual tabs and overflow.
Each canonical route has one area owner. Compatible URLs and search terms resolve
through the manifest instead of introducing duplicate navigation destinations.

The topbar provides area/page orientation, workspace selection, search and display
preferences. Start a review and account controls remain quiet sidebar actions.
The mobile bottom navigation is stable: Overview, Journey, Contact, Investigate,
More. More opens Sales, Commercial and Settings & Admin; the full navigation drawer
remains available. Accessible names, current state, focus and keyboard interactions
do not depend on expanded labels or colour alone.

| Area | Light-theme accent |
| --- | --- |
| Overview | `#2563EB` |
| Lead Journey | `#4F46E5` |
| Contact Centre | `#0F766E` |
| Sales & Activation | `#15803D` |
| Commercial | `#7C3AED` |
| Investigate | `#C2410C` |
| Settings & Admin | `#64748B` |

`tokens.css` defines deliberate light/dark variants. Area accents are small
orientation cues; selected pages use the shared cobalt underline. The sidebar
uses an independent graphite/silver palette in both themes. Analytical
series, lifecycle stages, favourable/unfavourable outcomes and validation states
keep separate data/status tokens. An area's accent must not recolour its charts or
imply that an unavailable result is healthy.

The route manifest supplies names, aliases, area membership and administrative
visibility to the sidebar, tabs, bottom navigation and command palette. Validation
is now marked administrator-only in that manifest, consistent with the existing
backend gate. Presentation visibility does not grant authority.

## Stylesheet and component ownership

| Owner | Maintained responsibility |
| --- | --- |
| `src/styles/tokens.css` | Theme, spacing, type, surface, navigation, data and semantic tokens; imported by `index.css`. |
| `src/components/ConversionXBrand.tsx` and `.css` | The supplied, unmodified PNG with proportional wordmark/symbol framing and silver display treatment for graphite surfaces. Navigation omits the tagline. |
| `src/styles/shell.css` | App shell, sidebar/rail, topbar, breadcrumbs, contextual tabs/overflow, mobile navigation/drawer and command palette; imported by `AppShell`. |
| `src/styles/reporting.css` | Page/header layout, scope controls, shared metric/panel surfaces, sections, disclosures and table foundations. |
| `src/styles/visuals.css` | Shared plots, legends, tooltips and lifecycle visuals. |
| `src/styles/overview.css` | Overview composition and its local outcome, trend, attention and journey presentation. |
| Feature styles | Investigation workspace, source evidence, audit evidence and domain visual layouts that have actual feature consumers. |
| `src/features/leadEvidence/leadEvidence.css` | Active Population/Source Evidence browser, canonical dossier and reused source/journey presentation. Duplicate Ledger/workspace stylesheet owners were retired after migration commit `4fd4703`. |
| `index.css`, `globals.css`, `product.css` | Retained application foundations and shared controls; canonical shell/reporting rules were extracted rather than layered over them. |
| Remaining integration styles | Existing guided/domain/cross-app rules with live consumers; they are not an alternative owner for canonical shell selectors. |

`main.tsx` loads the shared reporting, Overview and visual sheets. Feature imports
retain their specific styles. New rules should be added to the relevant owner;
adding another late global override recreates the cascade that this pass removes.

## ConversionX visual refinement — 2 October 2026

The refinement starts from `fe13490` on current main. It changes presentation
only. The display brand is ConversionX; source/vendor names, API identifiers,
routes and the seven area memberships remain unchanged. The supplied logo is
stored at `public/brand/conversionx-grey.png`. Wordmark and circuit-X crops use
SVG viewports with its native coordinates, retaining proportions and alpha.
The silver treatment lifts the dark part of the X on the graphite rail. The
tagline appears in access states, away from everyday analytical navigation.

Light reports use a pale neutral canvas, white surfaces, graphite ink and fine
hairlines; dark reports use graphite/charcoal surfaces and silver text. Cobalt
marks actions and selection. All six lifecycle identities remain separate from
status and area colour. Existing Public Sans, Plus Jakarta Sans and JetBrains
Mono fonts remain; mono is reserved for technical identifiers and source values.
Controls and panels use 4–8px radii, with elevation reserved for overlays.
Transitions are 150ms and respect reduced motion. The 248px sidebar and 60px
rail retain their behavior; desktop topbar/contextual navigation are 48/36px.

Overview presents one connected six-stage outcome strip using the existing
returned fetched, delivered, dialled, RPC, sale and activation measures. Its
trend and changes share a 68/32 surface before stacking; the original lifecycle
transition view stays mounted inside its disclosure. Missing intersections and
rates remain unavailable. Attention order, counts and severity are supplied
evidence; first-call response uses only returned compliance and percentiles.

Investigation uses a thin case/workflow rail and ruled evidence notebook. Lead
Evidence retains one Population or Source browser and one canonical Dossier.
The case header uses already-loaded identity facts, six underline tabs, flat
summary groups, a forensic Journey spine and separate original source rows.
Observation, mapping, coverage and independent verification remain distinct.
The audit drawer retains its portal, focus boundary and layer above sticky UI.

Shared rules were refined in their existing owners. Active legacy evidence-table
rules moved from `product.css` into `reporting.css`; repeated input-background
declarations were removed. No broad stylesheet purge occurred. The unmounted
historical Overview trend pair remains untouched because it has no active
consumer requiring this refinement.

The generated visual reference guides palette, typography, connected telemetry,
chart proportions, master/detail composition and ruled evidence. Existing labels,
controls, exact returned values, meaningful missing states and provenance take
precedence over generated sample content. No sample rows, fake rates, extra
filters, call histories, verification badges or financial conclusions were added.

`UnifiedMetricCard` and `KpiCard` use the same metric surface vocabulary.
`KpiCard` is intentionally retained as a behaviour wrapper: its consumers still
need lazy definition/lineage and selected-population drawers, metadata and analysis
actions. Visual convergence does not justify dropping those interactions.

The populated Process tab strip and diagram retain their own horizontal scroll
boundaries; the header actions and legend wrap on narrow screens. Qualification
controls use the same light/dark tokens as other reports. Wrapped Routing metric
values use the canonical metric typography. The area strip reveals its current
link through instant internal scrolling on route/width changes; route order,
link targets, workspace scope and request behavior remain unchanged.

### Refinement verification

All required commands completed successfully: `npm ci`, `npm run lint`,
`npm test`, `npm run docs:surfaces:check`, `npm run build` and `npm run verify`.
Final verification reports 1,238 tests: **1,237 passed, zero failed, one skipped**.
The existing Firestore access-lifecycle test requires its emulator and is the
single skip. The client/server build and warehouse schema export completed.

| Browser suite | Passing evidence |
| --- | --- |
| Frontend convergence | 249/249 checks: 23 route/compatibility views at five widths in both themes, plus lifecycle, shell and access interactions |
| Audit Evidence | 56/56 checks |
| Investigation | 17/17 checks |
| Lead Evidence workspace | 10/10 viewport/theme scenarios, 80 workflow checks, 50 screenshots |
| Dossier Journey | 6/6 scenarios |
| Case design and sticky positioning | 6/6 scenarios |
| Focused populated Routing/Process and current navigation | 24/24 scenarios against the final metric typography build |
| Mounted access states | 24/24 scenarios, including pending/error recovery and original callbacks |

Browser QA uses the existing local Playwright/Chromium runtime because the
Browser plugin is unavailable. Captures cover **1440, 1024, 820, 390 and 320px**
in light and dark. Manual review covers all 18 requested representative surfaces,
including Population, original Source fields and Dossier Summary/Journey/Audit.
Checks retain document/main overflow, internal wide-table scrolling, focus,
drawer layering, sticky scope and exact-value/request assertions. Final browser
suites report no runtime or console errors. Counts overlap and are not additive.

The fixtures are test-only and explicitly synthetic. Process observations match
the existing regression HTTP response across ten stages and 36 nodes. Routing
uses an explicit synthetic cohort grounded in its query contract, with unknown
financial and billable-sale values preserved. These tests establish presentation
and interaction behavior, not live warehouse completeness or production sign-in.
Detailed results and screenshots were written outside the Git repository in the
workspace's `conversionx-visual-qa-2026-10-02` directory.

## ConversionX theme consistency — 2 October 2026

This follow-up starts from `c47ac97` on main and completes the shared theme on
active application surfaces. Graphite/silver navigation, pale light and charcoal
dark reports, cobalt actions, the supplied logo, existing fonts and 4–8px radii
remain the design system. Shared neutral paint, selection, focus, error/success
states, controls, chart chrome and overlays now resolve through the existing
ConversionX tokens rather than fixed light-mode utility colours or literal
fallbacks. Ordinary analytical sections remain flat; elevation is reserved for
menus, tooltips and drawers.

The pass covers supporting records and metric lineage, Lead Evidence and export
preflight, saved investigations, Contact/Journey/Sales evidence, active vendor,
qualification, routing, agent, CLI, consumer, intake, validation, access-control,
AI and visual workspaces. Existing style owners retain their responsibilities;
there is no new blanket override sheet. Unmounted historical Contact, Funnel and
Speed intelligence components remain untouched because their active routes use
`ContactPage`, `JourneyPage` and `SpeedPage`.

All six lifecycle identities and the original eight visual/Vetting category hues,
order and category hashes remain distinct. Dark category variants raise contrast
without changing series membership. Cohorts retain the original six intensity
bins, scale, zero and unavailable distinctions; the pairs now follow the selected
theme. The continuous Vetting matrix retains its original intensity calculation,
alpha expression and threshold branch, with theme-aware teal and text paint.
Semantic status hues keep their meanings and readable text on tinted surfaces.
Settings thumbnails show the actual light/dark choices independently of the
currently selected theme, and the browser theme colour follows the canvas token.

Narrow intake source selectors and CLI source-gap messages wrap within their own
containers. Nested metric-lineage drawers rise above mobile navigation while
retaining their mounting, dismissal and focus behaviour. Coarse-pointer controls
retain 44px targets. Intake styles load through the application entry so direct
server-rendered component tests do not acquire a CSS module dependency.

The change does not alter routes, queries, API contracts, calculations,
denominators, filters, permissions, exports or session behaviour. Population and
Source remain distinct grains in one Lead Evidence workspace and the canonical
six-tab Dossier remains intact. AST comparison and focused behaviour tests check
that the component edits are presentation-only; the exceptions are theme paint,
stylesheet loading and display-brand spelling.

### Consistency verification

`npm run verify` completed successfully, including TypeScript lint, all tests,
the generated surface inventory check and production build. The suite reports
1,243 tests: **1,242 passed, zero failed, one skipped**. The existing Firestore
access-lifecycle test requires its emulator and remains the single skip. Client,
server and warehouse schema-export artifacts were built successfully.

Token regressions now check small status text at 4.5:1 on each reporting surface,
all six lifecycle and eight original visual category strokes at 3:1, emitted
selection utilities and both heatmap palettes through the full intensity range.
The existing CSS-ownership suite also rejects fixed paint in shared foundations.

Browser QA uses the existing local Playwright/Chromium runtime because the
Browser plugin is unavailable. The route matrix covers 1440, 1024, 820, 390 and
320px in both themes; targeted final-build checks cover the changed edge states.

| Browser suite | Passing evidence |
| --- | --- |
| Frontend convergence | 249 checks covered: 247 original passes plus two successful targeted rendered-state readiness retries; original results are preserved |
| Shared controls, supporting records, lineage, vendor inspection, Vetting and BLC diagnostics | 28/28 scenarios; the 320px lineage hit-test confirms mobile navigation stays below the drawer |
| Saved investigations, analytical/source export preflight, Contact evidence and continuous matrix | 40/40 checks in light/dark at 1440 and 390px |
| Settings, Cohorts, scope controls and touch targets | 10/10 width/theme scenarios |
| Utility and access states | 60/60 scenarios, combining passing baseline flows with four final CLI gap reruns at 320/390px in both themes |
| Investigation | 17/17 checks |
| Lead Evidence workspace | 10/10 scenarios, 80 workflow checks |

Actual rendered original category strokes measure a minimum 3.186:1 in light and
6.199:1 in dark. Cohort numeric labels measure at least 4.993:1; continuous matrix
labels measure at least 4.91:1 in light and 5.53:1 in dark, including cells around
the retained intensity threshold. Scope-apply and destructive-hover text retain
at least 6.018:1 and 6.493:1 respectively in the targeted rendered checks.
An additional 22/22 mobile matrix checks confirm internal horizontal scrolling
and readable threshold cells. Screenshots were manually reviewed for paint,
wrapping, clipping and readability. Final suites report zero runtime errors and
zero console warnings/errors. The two broad retries retain their original route,
scope, navigation, geometry and interaction assertions; only global network-idle
readiness was replaced with the actual populated matrix/roster state.

These checks use explicitly synthetic test fixtures and establish presentation
and retained interaction behaviour, not live warehouse completeness or production
sign-in. Evidence remains outside the repository in
`conversionx-theme-consistency-qa-2026-10-02`; suite counts overlap and are not
additive. Generated build and browser artifacts are not committed.

## Audit and retirement decisions

The pre-edit audit traced direct JS/TS imports, CSS `@import`, the application and
HTML/build entries, runtime/lazy imports, test/fixture entries and tooling. It also
compared the live shell and page primitives with their duplicate CSS selectors.

| Change | Consumer evidence and decision |
| --- | --- |
| Delete `navigation.css`, `theme.css`, `charts.css`, `operations.css`, `reportBrowsing.css` | Zero inclusion references across source, CSS imports, runtime/build entries, test fixtures and tooling. Historical mentions and tests asserting absence are not consumers. |
| Retire `Sidebar.tsx` | Unmounted predecessor; `AppShell` renders `PrimaryNavigation`. Relevant source/interaction checks now target the live implementation. |
| Retire `SectionNavigation.tsx` | No mounted consumers; obsolete no-op component. Contextual navigation belongs to `AreaNavigation`. |
| Consolidate `analyticsVisuals.css` and `visualRefinement.css` | Live chart rules moved into `visuals.css`; Overview/reporting/shell rules moved to their owners before the old sheets were removed. |
| Consolidate `scopeControls.css` | Scope styling moved into `reporting.css`, preserving the existing editor behaviour. |
| Retire historical executive analytics | `ExecutiveOverview.tsx` was the only runtime importer of `ExecutiveAnalyticsConsole.tsx`; neither had a mounted route or tooling/fixture importer. Source assertions now exercise `features/overview/OverviewPage.tsx` and its journey component, and both historical files are deleted. Other legacy implementations still require consumer checks before deletion. |

The cleanup does not claim that every legacy selector or compatibility component
has disappeared. Remaining consumers are preserved rather than silently weakening
tests or removing analytical capability.

## Lead Evidence ownership — 2 October 2026

The canonical `/lead-explorer` entry exports `LeadEvidenceWorkspace`. It composes
Population and Source Evidence through accessible URL-backed mode tabs, owns
session-local selection/focus, and mounts only the active population browser.
`LeadPopulationBrowser` owns analytical rows, preset columns, bounded pagination
and page evidence exports. `LeadSourceBrowser` owns original replica rows, source
coverage/mode/search, query provenance and complete-query exports. These response
models and evidence grains remain distinct.

Both browsers select `LeadDossier`, with Summary, Journey, Calls, Outcomes, Audit
and Source tabs. Reused `LeadJourney` and `LeadSourceEvidence` retain supplied
milestones and original records. Source-only selection requires explicit exact
analytical lookup before handoff; an identity match does not certify reconciliation.
Mode/preset changes are local presentation state, while dates, filters, case,
search and access boundaries fence stale selection and data.

The manifest has one **Lead Evidence** destination. `/lead-ledger` is a compatibility
redirect to `view=source`, retaining both original analytical `search` and copied
legacy `sourceSearch` when needed. Explorer aliases open `view=population`.
`view`, `preset`, `sourceSearch` and `sourceMode` never become global filters.
Supporting-record audit actions open Population; explicit source actions open
Source Evidence. Private manual searches cannot be shared or saved as definitions.
After migration commit `4fd4703`, the duplicate analytical Ledger page, old source
workspace, standalone Ledger/Investigation record stylesheets and unused router
import were retired. Source, journey, field-coverage, preflight, timeline and
download helpers remain active in the canonical workspace. See the
[consolidation map](LEAD-EVIDENCE-CONSOLIDATION.md).

## Size baseline and verification boundary

The recorded pre-change CSS baseline is:

| Measure | Before convergence | Final convergence |
| --- | ---: | ---: |
| Source CSS bytes | 371,437 | 281,863 |
| Built CSS, raw bytes | 426,966 | 406,429 |
| Built CSS, gzip bytes | 73,104 | 67,564 |

Repository/browser QA counts, screenshots and byte measurements are recorded in
[frontend convergence verification](qa/frontend-convergence/README.md). Synthetic fixtures verify presentation and interaction; they do not
certify live warehouse data or production authentication.

The convergence preserves unavailable, `PARTIAL` and `NOT_VERIFIED` states. Backend
queries, metric calculations, source contracts, authentication, investigation
predicates and API response semantics are outside this presentation change.

## Visual Audit Evidence — 2 October 2026

`InspectorHost` is the canonical Audit Evidence panel for metric, lifecycle,
commercial, integrity and pinned Investigation evidence. It composes shared
`EvidenceTrace`, `MetricAnatomy`, `EvidenceCoverage`, `EvidenceExclusions`,
`ReconciliationView` and `AuditDependencyMap` primitives. These receive explicit
presentation models and never fetch analytical data. `EvidenceMatrix` also
supports independent metric evidence dimensions and accessible exact text.

Evidence layers are **Observed → mapped → scoped → reproduced → independently
reconciled → business verified**, with independent partial, mismatch, not verified and unavailable
states. The arrow describes questions to inspect, not an automatic promotion.
A returned source aggregate and approved field mapping can coexist with absent
independent reconciliation and unapproved source business meaning. No combined
confidence score is calculated. Declared registry sources/fields are labelled
contract metadata, not measured physical-source field coverage.

The panel preserves the result's explicit tenant, dates, filters and saved case
narrowing. The Audit evidence action opens it in place. Existing dialog focus
trapping, Escape dismissal and return-to-trigger behavior remain canonical.
Audit Mode adds compact grain/date/definition affordances and a Journey evidence
lens without changing queries or the normal performance view.

All detail uses the response already returned until an administrator explicitly
chooses **Load supporting preview**. Only then is the existing `raw-leads` drill
requested at its existing ten-row minimum, displaying at most five masked rows,
with the exact supported drill and scope. Preview
identifiers are masked and never certify completeness. Full record inspection
uses existing analytical record authorization and predicate semantics. Private
search/identity-filter scope cannot be copied as a shareable audit link.

Coverage composition requires declared mutually exclusive populations at the
same grain and scope. Overlapping diagnostics and qualified/recorded populations
use separate bars; excluded totals are never inferred from unrelated counts.
Reconciliation distinguishes independent-source comparison, delivery consistency,
formula checks and business approval. Missing historical runs/events produce no
trend or timeline. Source observations in Data Confidence retain their tenant-wide
scope; their timestamps are not tied to component rendering or capture cohorts.

Audit layout uses existing tokens in light/dark themes. Ordered lineage nodes
have semantic text and keyboard actions; connectors are decorative. Mobile traces
are vertical, ratio populations stack, and comparison/record tables scroll inside
their own regions. Exact values and state names remain available without hover.

## Maturity ownership — 2 October 2026

The seven business areas and `routeManifest.tsx` remain authoritative. No primary
route, parallel Lead Evidence workspace or audit framework was added.
`ReportExecutionWorkspace` owns explicit immutable execution and `ReportReplay`
owns signed original/replayed comparison. They compose the existing
`InspectorHost`, `EvidenceTrace`, `MetricAnatomy`, `EvidenceMatrix` and
`ReconciliationView`. The old `EvidenceInspector` export is now a compatibility
adapter to that canonical host, retaining focus trapping, Escape and focus return.

Release identity, exact timestamp strings, source coverage and contract metadata
remain visible through cards/status strips and expandable technical detail. Exact
metric strings and components never pass through floating-point display conversion.
`reporting.css` also owns the existing Vendor/Commercial `.cx-ops-page` layouts,
with exact summary values wrapping and keyboard-focusable bounded table regions.
Wide evidence tables scroll internally; long hashes wrap at 320px. A successful
replay adds only `Reproduced for scope`; source reconciliation and business approval
remain not verified. Immutable inspectors direct users to signed replay because
ordinary scoped URLs cannot restore the full execution contract.

`LeadEvidenceSummary` supplies six literal lifecycle positions, source/vendor
context, supplied qualification/anomalies and aggregate call evidence. It never
turns aggregate call counters into attempt events. The existing Calls chronology
continues to show supplied event-level fields and unavailable positions. Dossier
Source uses a trace from original rows through available fields, identity and the
exact analytical relationship, with independent reconciliation always separate.

`ReconciliationReadiness` is a disclosure on the existing admin Validation page.
It prepares safely quoted harness commands and validates local JSON results;
there is no browser warehouse executor or invented persistence. Source/tenant/scope
changes clear local evidence. All states include text rather than colour alone.

Consumer-based retirement and intentionally retained reference implementations are
recorded in [the retirement audit](FRONTEND-RETIREMENT-2026-10-02.md). Current
repository and five-width light/dark browser results are recorded in
[the maturity QA record](CX3-MATURITY-PASS-2026-10-02.md); earlier counts above are
historical evidence, not production warehouse certification.
