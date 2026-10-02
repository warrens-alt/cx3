# Frontend design architecture and convergence audit

Recorded 2 October 2026 against the frontend convergence work starting at `a12bc89`
(PR #50). This document describes presentation ownership and the audited cleanup.
The generated [surface inventory](SURFACE-INVENTORY.md) remains the route/API map;
[implementation status](IMPLEMENTATION-STATUS.md) records analytical and deployment
boundaries.

## Canonical structure

**Area → Page → Scope → Answer → Detail** is the maintained reading order.

| Level | Responsibility | Canonical owner |
| --- | --- | --- |
| Area | Stable business destination and current location | `routeManifest.tsx`, `PrimaryNavigation`, `AppShell` |
| Page | Contextual destination, one title and useful actions | `AreaNavigation`, `AnalyticsPageLayout`, `PageHeader` |
| Scope | Workspace, period and applied filters, with explicit editing | `ReportingScopeBar`, existing filter contexts and editors |
| Answer | Principal supported measures and the main chart/table | Feature page, shared metric and reporting primitives |
| Detail | Supporting comparisons, records, definitions and evidence | Feature disclosures, inspectors and existing drawers |

`AnalyticsPageLayout` composes the title/actions, scope, status and content. It owns
no queries or analytical state. `OperationalPageHeader` adapts existing report
metadata/actions to `PageHeader`; `PageShell` supplies the page boundary. Local
section switches and disclosures retain their existing component/query lifetimes.

Overview leads with outcomes, performance and meaningful changes, followed by
attention and supporting detail. The Investigation and Record Explorer layouts
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

`tokens.css` defines deliberate light/dark variants. Area accents are applied in
navigation to the current marker, icon and restrained selected surface. Analytical
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
| `src/styles/shell.css` | App shell, sidebar/rail, topbar, breadcrumbs, contextual tabs/overflow, mobile navigation/drawer and command palette; imported by `AppShell`. |
| `src/styles/reporting.css` | Page/header layout, scope controls, shared metric/panel surfaces, sections, disclosures and table foundations. |
| `src/styles/visuals.css` | Shared plots, legends, tooltips and lifecycle visuals. |
| `src/styles/overview.css` | Overview composition and its local outcome, trend, attention and journey presentation. |
| Feature styles | Investigation workspace, ledger, audit evidence and domain visual layouts that have actual feature consumers. |
| `index.css`, `globals.css`, `product.css` | Retained application foundations and shared controls; canonical shell/reporting rules were extracted rather than layered over them. |
| Remaining integration styles | Existing guided/domain/cross-app rules with live consumers; they are not an alternative owner for canonical shell selectors. |

`main.tsx` loads the shared reporting, Overview and visual sheets. Feature imports
retain their specific styles. New rules should be added to the relevant owner;
adding another late global override recreates the cascade that this pass removes.

`UnifiedMetricCard` and `KpiCard` use the same metric surface vocabulary.
`KpiCard` is intentionally retained as a behaviour wrapper: its consumers still
need lazy definition/lineage and selected-population drawers, metadata and analysis
actions. Visual convergence does not justify dropping those interactions.

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
