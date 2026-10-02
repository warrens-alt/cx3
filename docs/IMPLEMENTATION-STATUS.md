# Implementation status — 2 October 2026

## Numerical accuracy and data-truthfulness hardening

This pass started after fetching `origin/main` and confirming
`fca6150b83c4c9e9f00a41cabe1104ea9bd7ae38`. Work is on local `main`; the older
local-main-only commit was preserved on `codex/preserved-main-before-numerical-hardening`.

- Temporal now consumes `operationalLeadCtes` rather than its broken parallel
  lifecycle definition. Capture, Delivery and First dial retain the same intake
  cohort, canonical timestamp parsing, explicit missing timestamp populations,
  unknown RPC and tenant timezone. Unsupported dimensions fail closed.
- Operating Controls and Attempt Coverage distinguish recorded zero from
  unrecorded/invalid cumulative counters. The counter is the maximum valid
  non-negative value. Qualified dialled denominator coverage is exposed alongside
  one/multi-call shares; 5+ no RPC requires explicitly false RPC.
- Metric registry `cx.metric.3.0.0` separates source-recorded events from qualified
  chronology. Delivery requires capture→delivery order; dial requires qualified
  delivery and ordered first dial. RPC uses qualified dial plus positive recorded
  evidence. Recorded sales and activations remain independent; no sale⇒RPC
  inference or billing/collection inference was added.
- Funnel conversion retains explicit intersections and `NON_NESTED` evidence.
  Queue, driver, record and evidence predicates remain aligned. Dossiers retain
  recorded dates, qualification and anomaly state. Data Confidence exposes the
  five chronology populations separately and still withholds an overall score.
- Source-recorded revenue keeps transaction identity, duplicate, conflict,
  currency and missing-value checks. Flat-source NUMERIC values avoid premature
  FLOAT64 conversion. Legacy analytical monetary paths retain unavailable rather
  than null→zero; expected activation-register revenue cannot fill recorded HLC
  gaps. Budget cannot become spend. Unsupported Commercial P&L remains unavailable.
- Unmounted `ExecutiveAnalyticsConsole.tsx` and `ExecutiveOverview.tsx` were deleted
  after checking consumers. Source inventory fallback counts were removed.
  Export evidence and metric inspectors distinguish mapping, business meaning,
  validation and reconciliation rather than conflating them.
- The read-only, opt-in `npm run reconcile:metrics -- --client … --start … --end …`
  harness independently calculates lifecycle, chronology, contact effort, revenue
  and timing. `--compare-service` compares listed stable counts with the service;
  `--dry-run` does not execute the service. Exact decimal strings are retained in
  the warehouse output; shared query guards enforce bounded read-only access.

**Live reconciliation not executed.** Production totals remain
`LIVE_RECONCILIATION_PENDING`. Owner approval of sale/activation meaning, tenant
source permissions, identity bridges, all-vendor activation coverage,
billing/collection/revenue certification and unconfigured marketing attribution
remain separate certification work. A passing code test or `APPROVED` mapping
is not a certified production total. See the revised
[numerical audit matrix](NUMERICAL-AUDIT-MATRIX.md) for definitions, denominators,
precision limits, source paths and harness usage.

Final verification completed on 2 October 2026:

| Executed command/check | Result |
| --- | --- |
| `npm ci` | Passed; 524 packages installed. |
| `npm run lint` | Passed on the settled source. |
| `npm test` | Passed: 1,085 passed, 0 failed, 1 skipped (before the last four review regressions). |
| `npm run docs:surfaces:check` | Passed. |
| `npm run build` | Passed; frontend, server and static warehouse catalogue artifacts generated. |
| `npm run verify` | **Passed**: lint, final full test suite, surface check and build; **1,089 passed, 0 failed, 1 skipped, 0 cancelled** (1,090 tests). |
| Required targeted numerical suites | 104 passed, 0 failed, 0 skipped; includes registry/workbook/lifecycle/contact/Temporal/Sales/Commercial/spend/Investigation/tenant/source/agent/Data Confidence. |
| Reconciliation harness tests | 10 passed, 0 failed, 0 skipped; compiler and fake-client execution only. Separate script TypeScript check passed. |
| Broad browser QA | 63 passed, 0 failed. |
| Focused numerical browser QA | 10 passed, 0 failed. |

The one skipped repository test is the Firestore access lifecycle suite, gated by
`FIRESTORE_EMULATOR_HOST`; no emulator was configured for this run. Overlapping
targeted runs are not added to the full-suite total. Initial stale assertions were
fixed and rerun; only the final counts above describe the completed revision.

Browser QA used the existing Playwright/Chromium runtime because the Browser
plugin/skill was not available. All payloads were explicitly synthetic. Broad QA
covered desktop 1440×1000, tablet 820×1180 and mobile 390×844 in light/dark themes.
Focused QA covered desktop/mobile Temporal event selection and CSV, vendor
controls, Investigation governance, Overview disclosure and Bars/Flow transition
evidence. Page identity, nonblank render, overlays, console and interaction checks
passed; screenshots were inspected. No production warehouse totals were used.

Evidence is stored outside Git in
`../numerical-hardening-evidence-2026-10-02/`: `convergence/results.json`,
`temporal-controls/results.json`, screenshots/CSV, and `verification/` command logs.
Build-time warehouse exports are static catalogue artifacts, not live reconciliation.
Earlier sections retain their original dated verification counts and scope.


## Frontend UX convergence

The frontend convergence starts from PR #50 (`a12bc89`) and follows **Area → Page →
Scope → Answer → Detail**. Seven business areas share one route manifest, an
area-only sidebar with a persistent 60px icon rail, contextual page tabs/overflow,
and stable mobile destinations. The compact topbar retains workspace, search and
display preferences; Start a review and account actions remain available.

`AnalyticsPageLayout` and the shared header/scope primitives establish a consistent
page order. Overview prioritises outcomes and the primary trend before supporting
detail. Investigation and Record Explorer retain the six-stage workflow with a
compact context summary and one responsive evidence subtree. Existing models,
requests, predicates, exports and evidence limitations remain authoritative.

Styling now has explicit token, shell, reporting, visual, Overview and feature
owners. Five unreferenced stylesheets and the obsolete `Sidebar` and
`SectionNavigation` components are retired. Live rules from the older visual/scope
sheets were moved to their canonical owners. `KpiCard` deliberately retains its
definition, audit and analysis behaviour while sharing the metric visual shell.
Historical unmounted pages with fixture/source-test consumers remain in place.

Navigation area accents are separate from analytical series and evidence/status
colours. Validation's manifest gate now reflects its existing administrator-only
backend authority. This work does not change analytical calculations, backend
queries, source contracts, authentication or API response semantics.

See [the design architecture and cleanup audit](FRONTEND-DESIGN-ARCHITECTURE.md) and
[current frontend inventory](FRONTEND-INVENTORY.md#current-frontend-ux-convergence--2-october-2026).
Final convergence verification passed: 1,026 repository tests (one emulator-only skip), 10 dedicated Firestore tests, 63 convergence browser scenarios and 17 Investigation scenarios. Source CSS fell 24.12%; built gzip CSS fell 7.58%. See [the QA record](qa/frontend-convergence/README.md).
The dated verification counts below describe their original revisions.

## Consolidation after the Investigation rebuild

The consolidation pass starts from PR #49 (`bc002ad`). The legacy `/lead-engine`
product surface and both unused Lead Engine packages are removed. Its historical
KPI, rate-card, quality and commercial values were not moved into another report.
The unused Cloud SQL user listing/synchronisation APIs and their sole helper were
also removed; Access Control continues to use Firebase/Firestore authority.

Validation now reports static comparison rows as `HISTORICAL_REFERENCE` and
`NOT_VERIFIED`. Every reference metric is non-certified, both verification timestamps
are null, and the selected request scope is separate from the unrecorded historical
measurement scope. UI and CSV carry the same boundary. Power BI query templates are
non-certified, and its unreconciled response uses `checkedAt` while `reconciledAt`
remains null. Live marketing schema inspection fails explicitly instead of
substituting saved catalogue columns. Production always rejects synthetic CLI
loading, including the former opt-in flag.

The reachable `/visuals` catalogue now has an explicit unavailable analytical state
instead of synthetic counts tied to the reporting period. The unused lazy entry for
the historical ExecutiveOverview/ExecutiveAnalyticsConsole was removed from the
production bundle; the maintained OverviewPage and its definitions are unchanged.

Investigation and Record Explorer share an active six-stage workspace header:
Signal → Diagnose → Segment → Records → Evidence → Conclusion. Stage links preserve
URL scope and use existing results; the header adds no analytical requests. It
shows actual comparisons, narrowing, record availability/dossier state, pin count
and analyst-note/unknown state. Current stage means navigation focus, not completed
verification. Driver refresh follows the current-view refresh action, with obsolete
responses fenced by scope/session and cancellation. Local selection also clears
on access changes. Evidence sufficiency remains explicitly unestablished.

UserManagement retains central Firestore subscriptions and mutations while its
directory, invites, policy drafts, audit log and access editor have focused view
modules. Invitations are now described accurately: registration still needs approval
and an invitation cannot grant administrator authority. Analytical request parsing
is shared in `server/analytics/requestScope.ts`; route order and admin gates remain.

Saved investigations continue to store definitions only. `.env.example` now documents
the explicit Node/GCS and Worker/R2 activation requirements; unconfigured storage is
a neutral deployment state. No storage, cloud infrastructure or IAM was provisioned.

See [the audit and consumer map](CONSOLIDATION-AUDIT.md),
[current verification](qa/consolidation/README.md), and
[saved-storage configuration](SAVED-INVESTIGATIONS.md). Earlier dated test counts below
describe their original revisions, not this consolidation's final result.

## Investigation workspace implementation

The maintained workflow is now **Signal → Diagnose → Segment → Records → Evidence → Conclusion**. `/investigate` and compatible `/exceptions` share the upgraded inbox, with URL-backed predicate/narrowing context, matched-period descriptive drivers, and contextual evidence confidence. The administrator record explorer provides compact field presets, structured factual inclusion reasons and a persistent six-tab lead dossier. Existing Lead Journey and Lead Ledger source formatting are reused rather than duplicated.

Navigation exposes Investigation inbox, Record explorer and Data confidence, followed by an Evidence & Audit group containing Evidence reports, Lead ledger and Vendor evidence. Administrator checks and historical URLs remain intact. Source-wide confidence checks disclose their observation boundary; retaining investigation context does not imply exact-cohort source certification.

The existing exception, record, root-cause, timeline and AI APIs share validated investigation qualification and additive vendor/source/grade/first-dial-age narrowing. Narrowing intersects global filters and the original drill. Root-cause metric IDs are exact and no unrelated metric falls back to sale rate. Exceptions retain current vendor/source concentration and matched capture-cohort snapshots; unsupported segment comparisons remain unavailable. Structured reasons come from the same predicate family used for inclusion. Missing call counters, outcomes, timestamps and commercial evidence are not converted to zero or fictional events.

A local evidence tray pins scope/provenance-bearing observations and exports with the existing CSV utilities. The follow-up saved-investigation phase adds personal definition CRUD and exact-scope reopening through a strict versioned extension of `savedAnalysis`; it does not persist the tray or analytical results. See [saved investigation definitions](SAVED-INVESTIGATIONS.md) for the required private storage configuration. Optional investigation AI displays its confirmed scope, source/model, supplied references and limitations; deterministic measurements stay primary. The standalone AI surface remains available.

Intentional boundaries in this revision:

- deterministic limit/offset pagination remains; no new keyset or unbounded population export;
- dossier lead IDs remain session state; private search/identity scope is not silently broadened to create a share link;
- evidence tray state remains local; personal saved investigation definitions use separately configured private storage, without a collaboration service or publication flow;
- exception grade/age and previous segment breakdowns remain unavailable because the existing API does not supply them;
- driver comparison requires explicit dates and is unavailable while record-text search is active;
- source confidence and arithmetic reconciliation do not promote `NOT_VERIFIED` to verified;
- call aggregates are not reconstructed as individual attempts, and prior capture-cohort backlogs are not reconstructed historical queue snapshots.

The investigation-workspace phase passed `npm run verify`: lint, 897 passing tests (0 failures; 1 existing Firestore-emulator test skipped), surface inventory and production build. Seventeen synthetic Chromium workflow checks passed with no page errors or console warnings at desktop, tablet and 390px mobile widths in both themes. See [verification notes and screenshots](qa/investigation-workspace/README.md). These checks do not establish analytical source certification. See [OfferNet analytics map](OFFERNET-ANALYTICS-MAP.md#investigation-workflow--2-october-2026) and [frontend inventory](FRONTEND-INVENTORY.md#current-investigation-workspace--2-october-2026) for the detailed contract.

The saved-investigation follow-up passed `npm run verify`: TypeScript, 946 tests (945 passing, zero failures and one existing Firestore-emulator skip), surface inventory and production build. A final stored-ID corruption regression was then added and all nine repository tests passed. Four production server entry points passed smoke checks; thirteen additional synthetic browser checks passed across both themes and three widths. See [saved-investigation verification](qa/saved-investigations/README.md). Private saved storage has not been provisioned, configured or deployed by this work.

## Deployment boundary

CX3 is an operational analytics application with an emerging evidence-reporting architecture. It is **not** currently certified as a fully reconciled reporting system.

Production analytical routes are fail-closed and use one explicit identity mode:

- production defaults to `CX_AUTH_MODE=iap` when the mode is unset;
- IAP mode requires `IAP_AUDIENCE`, a valid signed IAP assertion, and an explicit `CX_ACCESS_POLICY_JSON` tenant/role grant;
- `CX_AUTH_MODE=firebase` requires a valid Firebase bearer token, an active matching Firestore user profile, and the administrator marker for admin authority;
- all modes require server-side BigQuery credentials with only the access required by the application.

The only unauthenticated API route is `/api/health`.

A local development identity is available only when `NODE_ENV` is not `production` and `CX_ALLOW_DEV_AUTH=true`. Production never falls back to the development identity.

## Security changes in the current hardening revision

- Removed unrestricted BigQuery project, dataset, table and `SELECT *` preview endpoints.
- Converted Lead Ledger into an admin-only, tenant-scoped analytical record view.
- Restricted raw lead/timeline endpoints and record-grain exports to administrators.
- Made the server-authorised tenant list authoritative for the live workspace selector.
- Enforced tenant permission checks on evidence-reporting catalogue and exception requests.
- Scoped Offernet lead timelines to the authorised tenant/vendor population.
- Scoped agent analytics to tenant/date/vendor and reject unsupported cross-grain filters.
- Restricted CLI report import/sample/clear mutations to administrators; synthetic sample loading is always disabled in production.
- Live CLI analytics now require tenant-safe vendor scoping and fail closed when required source fields are absent.
- Shared-source aggregate queries enforce ownership independently of caller filters: tenant vendor mappings for calls, approved client-name mappings for marketing, tenant-specific lead views, and explicitly supported activation ownership. Unestablished ownership returns HTTP 422; see `SOURCE_API.md`.
- New Firebase profiles can no longer self-activate; non-bootstrap accounts remain pending until administrator approval.
- Ordinary Firebase administrators require a verified identity, an active admin profile, and its authority marker. Role/status changes use a transaction; deletion and bootstrap creation use atomic batches. Stale markers do not authorise suspended, demoted, or deleted ordinary accounts.
- Operational analytics responses are labelled `UNVERIFIED`, not `VERIFIED`.
- Production runs the freshly built `dist/server/server.mjs`; generated `server.js` is no longer tracked.

The bootstrap exceptions are the configured trusted UID and the configured bootstrap email with a verified email claim. Keep the frontend constants and `firestore.rules` aligned. Deploy the reviewed rules separately to the intended Firebase project: repository changes and emulator runs do not replace the deployed rules. IAP mode and Firebase mode intentionally use different server-side authority sources; the deployment must select one explicitly.

## Analytical trust changes

The hardening revision removes or withholds results that were not supported by validated evidence:

- no fixed enterprise data-health score or grade;
- no static discrepancy counts labelled as verified;
- no hard-coded temporal “best windows”;
- no static activation maturation curve;
- no fixed contact-fatigue/redial recommendation values;
- no AI fallback metrics or generative recommendations;
- no assumption that campaign `budget` is incurred spend;
- observed media spend is accepted only from the explicit marketing API-table contract and only when the contracted spend grain passes duplicate-grain validation;
- no R45/R14.50/overhead profitability model;
- no vendor contribution or margin derived from assumed unit costs;
- no arbitrary split-half “current vs previous” comparison;
- no synthetic CLI duration, lead-age distribution, median, or prior-period baseline when the source does not provide the required evidence.

Where the source supports an observed value, it is returned. Where a required contract is missing, the API returns `null`, `UNAVAILABLE`, `PARTIAL`, `NOT_VERIFIED`, or a 4xx/5xx response rather than manufacturing a number.


## Frontend consolidation

The current command-centre routes are the maintained product surfaces. Earlier
consolidation removed superseded pages after checking their consumers. Some
historical unmounted implementations remain because fixtures or source tests still
refer to them; the convergence pass does not treat absence from `src/App.tsx` alone
as deletion evidence. Historical URLs remain supported through explicit aliases
and redirects to the maintained surfaces.

`docs/SURFACE-INVENTORY.md` is generated from the current route and API sources, and `npm run verify` fails when that inventory is stale.

## Evidence reporting

`contracts/reporting.ts` defines the intended versioned evidence metric contract and `server/reporting/repository.ts` contains immutable snapshot verification logic.

However, the current repository does **not** contain a complete v2 report compiler/executor or replay engine. Therefore:

- `GET /api/reporting/catalogue` can inspect an authorised tenant's release registry when configured;
- report execution returns `501 NOT_IMPLEMENTED`;
- replay returns `501 NOT_IMPLEMENTED`;
- exceptions do not fabricate rules or PASS evidence when no approved release exists;
- release manifests are validated strictly before use.

Do not describe this repository revision as having completed reproducible evidence-report execution.

### Unsupported historical reporting scripts

These scripts are retained as unfinished design history. They are not wired into `package.json`, and `tsconfig.json` does not include the scripts directory. Passing `npm run verify` therefore does not establish that these entrypoints run.

| Script | Missing implementation or fixture |
| --- | --- |
| `scripts/ingest-canonical.ts` | `server/reporting/ingestion` and its `normalizeBatch` implementation. |
| `scripts/publish-release.ts` | `server/reporting/checks` (`releaseCheckQueries`) and `server/reporting/scope` (`isoTimestamp`). |
| `scripts/warehouse-reference.ts` | `compileReport`/`compileEvidence` exports from `server/reporting/query`, `server/reporting/scope` (`reportRequest`), and `tests/fixtures/reporting-reference.json`. |

Module loading fails before their planning or `--execute` guards. Do not use these scripts for ingestion, release publication, or warehouse validation. Restoring them requires the reviewed reporting implementation and fixtures. The supported read-only integration check is `npm run sources:check`; it does not ingest or publish data.

## Date and filter behaviour

- Operational reports default to all-time when no date scope is supplied.
- Date presets are generated dynamically from the current date.
- Vetting does **not** silently turn all-time into a 90-day period; it requires an explicit start and end date.
- Unsupported cross-grain filters fail explicitly instead of being silently ignored.

The `/api/analytics/offernet/*` adapter accepts one string equality value per supported dimension (`equals` or a one-element `in` list). Multiple values, comparison operators, conflicting aliases, and unsupported dimensions return HTTP 422. Remove a filter to select all values; a literal `all` condition is rejected.

| Operational report | Supported optional dimensions |
| --- | --- |
| Standard lead-based reports | `vendor`, `source`, `medium`, `grade`. |
| Agent performance | `vendor`, `agent`. |
| Individual OfferNet lead timelines | Capture-cohort dates, `vendor`, `source`, `medium`, `grade`, record search, supported drill predicates and additive investigation segments; exact scoped lead membership is required. Selected vendor segments also constrain displayed vendor source events. |
| Campaigns and marketing root-cause | `campaign`; their services reject operational source/vendor/medium/grade scope that cannot be mapped to marketing. |
| Marketing discovery and source observability | No optional dimension filters. |

`partner` and `ror_partner` are vendor aliases where vendor filtering is supported. Route-specific contracts can further restrict combinations, especially cross-source marketing attribution. CLI analytics separately support `cli`, `campaign`, and `vendor` inclusion/equality/exclusion filters; unsupported dimensions fail explicitly. The frontend preserves filter operators when forming requests and hides stale results when scope or tenant permission changes.

### CLI exports and outcome timing

CSV imports preserve empty columns, quoted delimiters, escaped quotes, and multiline fields. Invalid quotes, duplicate/empty headers, and wrong column counts reject the import before records are stored.

CLI exports use the dashboard's source-resolution path: a supported live CLI source takes precedence over an import, and a failed live query is propagated. Date, CLI/campaign/vendor filters and literal case-insensitive CLI-or-campaign substring search apply before limiting results. Export limits are 1–50,000 rows; live queries request one extra group to detect truncation. JSON metadata includes the applied scope, source provenance, row count and truncation; CSV responses expose `X-Export-Row-Count` and `X-Export-Truncated`. Imported trend and lead-age summaries are rebuilt from selected records.

Operating controls and funnel metrics normalise 1900/1970 sentinel timestamps before success counts and latency calculations. Record drill-downs use the same selected-vendor HLC population for both positive and negative existence checks.

Cohort sale, activation, RPC and call maturation use their respective event timestamps, excluding negative chronology and future events. A cohort with a recorded outcome but no matching event timestamp has unavailable maturation cells. Revenue maturation remains unavailable because cumulative balances do not identify when each amount occurred. The UI displays the returned reason. These corrections do not certify upstream event identities or source completeness.

## Commercial and campaign status

The marketing contract supports observed media spend only when the live table contains an approved observed-spend field and the declared date/client/channel/campaign/adset grain passes validation. The supplied 26 September 2026 schema contains `budget` but no observed-spend field, so total spend, CPC, CPM and spend-derived CPL are currently withheld. Budget remains a separate planning field and is never substituted for spend.

Tenant-level campaign reporting is enabled only after exact API-table `client_name` values are configured through `CX_MARKETING_CLIENT_MAP_JSON`. CX3 does not infer tenant identity from display names.

Marketing-to-lead attribution is implemented but fail-closed. It activates only through `CX_MARKETING_ATTRIBUTION_JSON` with explicitly named source keys. It validates the selected spend grain, propagates only equivalent cross-source scope, exposes matched/unmatched key coverage, and withholds unsupported filters rather than mixing all spend with a narrower operational denominator. Even when active, attributed outputs remain `NOT_VERIFIED` until key coverage and semantics are reconciled.

The following remain withheld:

- telephony and agent costs without approved source tables/contracts;
- commission and fixed-overhead allocation;
- contribution margin, net margin and break-even;
- vendor profitability;
- activation-maturation evidence.

Recorded source revenue remains a source field and must not be described as audited financial revenue.

## CX3 Phase 1.1 — Measured metric → overview → evidence → export workflow

CX3 Phase 1.1 establishes an end-to-end trace from measured metric definitions to executive overview widgets, drill-down evidence populations, and repeatable exports across three primary operational measures (Fetched leads, Delivered leads, Delivered / fetched):

1. **Authoritative Metric Path (`cx.metric.2.0.0`)**:
   - The authoritative metric registry (`contracts/metricRegistry.ts`) defines 15 distinct operational metric specifications with strict mathematical relationships (additive counts, percentage rate scalings, parent cohort denominators, observation cutoffs, and treatment of unknown values).
   - Definition approval (`mappingStatus: 'APPROVED'`) is strictly separated from runtime reconciliation (`reconciliationStatus: 'NOT_VERIFIED'`), removing unsupported blanket claims that every result is reconciled.
   - Re-exported via `server/analytics/index.ts` and served at `GET /api/analytics/metrics/registry` and `GET /api/analytics/metrics/authoritative`.
   - The client API `fetchAuthoritativeMetrics` in `src/lib/offernetClient.ts` enforces strict runtime envelope validation (explicit `success === true`, non-empty version matching `^cx\.metric\.\d+\.\d+\.\d+$`, non-negative integer `totalMetrics` matching dictionary count, and entry key-to-id integrity with required fields). Permissive fallbacks that manufactured success or version strings have been eliminated.
   - The Metric Definitions UI (`src/components/AnalyticsDefinitions.tsx`) and Overview "About this metric" drawers map domain metrics to authoritative contracts, rendering lineage drawers with counting grain, treatment of unknown, real response timestamps, and known limitations.

2. **Overview Evidence Navigation & Unified Journey**:
   - In `src/pages/ExecutiveOverview.tsx`, primary operational metrics (Fetched leads, Delivery rate, Dial coverage, Right-party contact, Lead-to-sale rate) provide an "About this metric" action displaying the metric definition and the context of the displayed result (including numerator and denominator counts).
   - "Delivery rate" explicitly labels its numerator inspection as Delivered leads and clarifies its Fetched leads denominator, providing direct admin links to each population.
   - For aggregate users without lead-level drill authority, navigation gracefully routes to corresponding aggregate views (`/funnel`, `/speed-to-lead`, `/contact-strategy`, `/sales-activation`).
   - Active client ID, date ranges, and dimension filters are preserved across transitions without state loss or cross-tenant leakage.
   - Duplicate waterfall and journey strip presentations have been consolidated into one unified lifecycle progression representation with stage and transition loss inspection links.

3. **Deduplicated Evidence Counting via Dedicated CTEs**:
   - In `server/analytics/investigation/records.ts`, `getRawLeads` refactors the query into dedicated CTEs:
     - `qualified_evidence` applies approved workspace, period, vendor, search, and drill predicates, keeping exactly one deterministic representative row per distinct lead via `QUALIFY ROW_NUMBER() OVER (PARTITION BY l.lead_id ORDER BY delivered DESC NULLS LAST, transaction_id ASC NULLS LAST) = 1`.
     - `evidence_stats` computes `SELECT COUNT(*) AS total_count FROM qualified_evidence`, guaranteeing that expanded transaction rows (e.g. multiple HLC rows per lead) do not inflate the total evidence count.
     - `evidence_page` applies `ORDER BY fetched_ts DESC NULLS LAST, lead_id ASC LIMIT ... OFFSET ...`.
     - The query returns both `total_count` and `evidence_rows` in a single execution.
   - Out-of-range offsets return the true `total_count` with an empty page, and genuinely empty populations return `totalCount = 0` and `rows = []`. Internal helper fields (`fetched_ts`, `full_evidence_total`) are stripped from public rows.
   - `LeadExplorerIntelligence.tsx` presents `X–Y of [Total]` records and provides a "Return to page 1" action when an out-of-range page is requested without clearing or broadening the selected scope.

4. **Export Fidelity & Traceability**:
   - Lead Explorer CSV export (`handleExportCsv`) dynamically evaluates whether the exported page is truncated against the total matching population (`data.totalCount != null ? data.rows.length < data.totalCount : data.rows.length >= pageSize`).
   - Metadata headers and export definitions accurately declare the applied client scope, date range, dimension filters, investigation predicate, and truncation status.

5. **Truthful Applied Filters & Strict Export Contract Enforcement**:
   - `server/offernetScope.ts` implements `canonicalOperationalFilters` and `normalizeOperationalParams` to ensure consistency between scalar dimension properties (`vendor`, `source`, `medium`, `grade`) and structured filters, normalizing aliases (`partner`, `ror_partner` to `vendor`) and rejecting conflicting representations before querying.
   - `buildOffernetQueryParams` in `server/api.ts` carries the canonical `effectiveFilters` into `scope.filters` and `params.filters`, ensuring that both `result.filters` and `metadata.appliedFilters` truthfully reflect the exact query scope that ran.
   - `buildLeadEvidenceExport` in `src/lib/analysisExport.ts` enforces the export contract without fabricating missing context: requires verified `totalCount`, `clientId`, and `definitionVersion`; validates complete page invariants (`result.rows.length === expectedPageRows`); preserves explicitly empty filters `{}` without substituting stale UI context; and preserves truthful nulls for unbounded dates and search.

### Requirement-to-Implementation-to-Verification Matrix

| Requirement | Implementation Artifacts | Verification Method |
| :--- | :--- | :--- |
| **Phase 1 Milestone Status** | `server/analytics/investigation/records.ts`, `src/lib/analysisExport.ts`, `src/pages/LeadExplorerIntelligence.tsx`, `tests/phase-1-1-metric-workflow.test.ts` | **IMPLEMENTATION ADVANCED / ACCEPTANCE DEFERRED**. Full pipeline, CTE deduplication, strict metadata contracts, and byte-level CSV verified across 408 tests. Rendered browser execution and live warehouse acceptance deferred. |
| **Authoritative Registry Endpoint** | `server/api.ts`, `contracts/metricRegistry.ts`, `server/analytics/index.ts` | `tests/authoritative-metrics.test.ts` (15 declared metrics, denominators, 401 unauthenticated check) |
| **Runtime-Validated Registry Client** | `src/lib/offernetClient.ts` (`fetchAuthoritativeMetrics`) | `tests/phase-1-1-metric-workflow.test.ts` (strict envelope validation, rejection of malformed payloads, cancellation) |
| **Deduplicated Evidence Counting** | `server/analytics/investigation/records.ts` (`qualified_evidence`, `evidence_stats`), `src/lib/offernet/types.ts` | `tests/phase-1-1-metric-workflow.test.ts` (CTE deduplication before count, multi-HLC handling, out-of-range offset totalCount) |
| **Complete Evidence Pages & Response Validation** | `server/analytics/investigation/records.ts` (aggregate envelope, integral total_count, unique lead IDs, count/offset invariants, strict complete page requirement `pageRows.length === expectedPageRows`) | `tests/phase-1-1-metric-workflow.test.ts` (two-of-eight and empty-of-eight rejection, safe integer/string/wrapper pagination) |
| **Overview Metric Lineage & About Action** | `src/pages/ExecutiveOverview.tsx`, `src/components/MetricLineageDrawer.tsx` | `tests/phase-1-1-metric-workflow.test.ts` (About metric action, numerator/denominator inspection, concrete timezone and timestamps) |
| **Pure Production Export Builder & Fixture Oracle** | `src/pages/LeadExplorerIntelligence.tsx` (`handleExportCsv`), `src/lib/analysisExport.ts` (`buildLeadEvidenceExport`) | `tests/phase-1-1-metric-workflow.test.ts` (10-lead and 55-lead complete fixture oracles, exact ID sets, tie-break ordering, complete/partial population labelling, result context audit headers) |
| **Preserve Applied Filters & Enforce Export Contract** | `server/offernetScope.ts`, `server/api.ts`, `server/analytics/investigation/records.ts`, `src/lib/analysisExport.ts` | `tests/phase-1-1-metric-workflow.test.ts` (truthful applied-filter metadata across endpoint/service/CSV, alias normalization, conflict rejection, strict export contract without fabricated context) |
| **Phase 2.1: Vendor Dispositions & Contact Outcomes** | `contracts/vendorDispositions.ts`, `server/analytics/contact/dispositions.ts`, `src/pages/ContactStrategyIntelligence.tsx`, `src/lib/analysisExport.ts` | `tests/analytics/vendor-dispositions.test.ts` (11 tests: lead-status pair grain, multi-vendor isolation, activity states, status conflict resolution, call mode tenant ownership, URL synchronization, and breakdown export) |

## CX3 Phase 2.1 — Vendor dispositions and contact outcomes

Phase 2.1 transforms Contact centre / Vendor dispositions into an operational, auditable report answering vendor outcome distribution, missing/unmapped feedback, raw telemetry codes, and supporting record evidence:

1. **Direct Navigation & Shareable URL Routing**:
   - `/vendor-dispositions` is directly reachable and synchronized via URL query parameters (`tab=vendor_dispositions`, `mode`, `vendor`, `group`).
   - Deep-linking preserves active tab, reporting mode, selected vendor filter, and outcome group without altering defaults for existing bookmarks.

2. **Reporting Header & Methodology Drawer**:
   - Title: *Vendor dispositions.* Subtitle clearly communicates mode semantics in one plain sentence.
   - Reuses global client, date, vendor, and source filters.
   - Context strip explicitly displays concrete timezone (`Africa/Johannesburg`), date basis (`lead_capture_cohort` vs `call_start_date`), counting unit (`lead_vendor_pairs` vs `dialler_records`), taxonomy version (`cx.dispositions.1.1.0`), and genuine evaluation timestamp.
   - Comprehensive "About this report" drawer encapsulates methodology (counting grains, multi-vendor pairs, recency rules, activity states, and commercial flag independence) instead of overwhelming the view with warnings.

3. **Strict Reporting Modes & Safe Gating**:
   - **Recorded lead status (`lead_status`)**: Current recorded status of the selected intake cohort, counted by lead–vendor pair after deterministic HLC reconciliation.
   - **Call outcomes (`call_records`)**: Outcomes on recorded calls during the call-date period, counted by verified call events or explicitly labelled dialler records.
   - Changes in denominator and date basis are explicitly disclosed. When tenant call table configuration is absent, the mode is safely gated with `unavailableReason` without unsafe synthetic fallbacks.

4. **Summary Strip with Inspectable Ratios**:
   - Five mode-appropriate operational measures: Reporting population, Observed call activity, Disposition coverage %, Missing dispositions, and Unmapped dispositions.
   - Each rate includes inspectable numerator and denominator counts. Real zero remains zero; unavailable remains unavailable.
   - Commercial measures (RPC, Reported Sales, Callbacks) are displayed as distinct, non-exclusive indicators.

5. **Outcome Comparison Horizontal Stacked Bar Chart**:
   - Aggregates one cell per vendor and approved outcome group before charting (multiple raw codes in the same group are added, not overwritten).
   - Dual view modes: Percentage view (% of dialled base) and Count view (volume) using the same population.
   - Manageable default (top 8 vendors by volume) with an explicit "Show all vendors" toggle that never truncates totals or exports.
   - Consistent, legible group colours from `APPROVED_DISPOSITION_GROUPS`. Raw counts and percentages in tooltips.
   - Clicking any bar or group triggers a real drill-down into the selected vendor and outcome group.

6. **Feedback Coverage & Integrity**:
   - Compact visual comparison bar and metric cards distinguishing recorded mapped feedback, recorded unmapped feedback, missing feedback, and unresolved conflicts (`CONFLICTING_EVIDENCE`).
   - Unmapped codes are classified as part of recorded feedback and not double-counted.
   - Activity states (explicit zero-call pairs and unrecorded activity) are segregated outside the dialled population.

7. **Sortable Vendor Governance Table**:
   - Sortable columns: Vendor, Population & Counting Unit, Observed Call Activity, Disposition Coverage %, Missing Count, Unmapped Count, Reported Sales, and Callbacks.
   - Deep inspection button per row opening the Selected-Vendor Drawer.

8. **Selected-Vendor Detail Drawer**:
   - Accessible slide-over drawer (`useDialogAccessibility`) with keyboard focus management and Esc dismiss.
   - Displays vendor summary statistics, grouped outcome pills (clickable for instant filtering), and an exact raw-code breakdown table with search, group filter, and mapping status badges (`APPROVED`, `UNMAPPED`, `MISSING`, `CONFLICTING`).
   - Authorised record evidence action: Administrator users can inspect matching records directly in Lead Explorer (`/lead-explorer?vendor=...`) preserving period and workspace scope; non-admin users and call mode display honest boundary caveats.
   - Dedicated "Export raw codes (CSV)" action for the selected vendor.

9. **Export Traceability & CSV Safety**:
   - Export actions on summary table, outcome comparison, and vendor breakdown via `downloadDispositionExportCsv`.
   - Every export carries full audit columns: Scope client, Period start/end, Reporting mode, Date basis, Counting grain, Total population, Denominator definition, Applied filters, Truncation indicator, Taxonomy version, User identity/role context, and Timestamp.
   - Uses `serializeCsv` to sanitize formula injection characters (`=`, `+`, `-`, `@`) and RFC 4180 quote escaping.

## Phase 1 Deferred Acceptance & Environment Limitations

The user has prioritized Phase 2.1 implementation. Phase 1 remains marked **IMPLEMENTATION ADVANCED / ACCEPTANCE DEFERRED**:

1. **Rendered Browser Acceptance**: Automated end-to-end browser execution (Playwright / Chromium / Puppeteer) is deferred because headless browser binaries and packages are not installed in the local container environment.
2. **Actual Browser Download Verification**: File saving/download trigger verified through byte-level serialization and in-memory Blob generation; OS file system download verification remains deferred to environment with browser runtime.
3. **Live BigQuery Source Certification**: SQL compilation, query parametrization, CTE deduplication, and mock boundaries are verified. Live Cloud BigQuery execution remains `NOT RUN` pending authorized cloud access.

## Verification

`npm run verify` performs:

1. TypeScript type checking;
2. repository contract/regression tests;
3. generated UI/API surface inventory freshness;
4. production client/server build.

GitHub Actions runs the same checks, `npm run test:rules` with Java 21 and a local Firestore emulator, and a dependency audit. The rules suite exercises atomic promotion/revocation, bootstrap identity claims, pending registration and invite mutations against `firestore.rules`; it does not deploy those rules.

The repository currently does not include the previously referenced Dataform warehouse tree or Playwright tooling package, so CI does not claim to execute those checks.

Passing repository CI is necessary but is **not** evidence of live BigQuery source completeness, source-owner reconciliation, production acceptance of the selected authentication mode or financial certification.

## CX3 Reliability, Reporting Correctness & Acceptance Testing — 27 September 2026

This release hardens operational reliability, permission isolation, and reporting fidelity end-to-end:

1. **Analytical Session Boundary & Permission Isolation**:
   - `src/lib/analyticalSession.ts` implements a stable, non-secret access boundary key (`computeAnalyticalSessionKey`) tracking signed-in identity (`uid`), effective role, account status (`active`/`pending`/`suspended`), tenant entitlements (`allowedTenants`), and administrator marker status.
   - Routine token refresh or last-login updates do not reset the analytical session.
   - On logout, identity replacement, access revocation, account suspension, or administrator demotion:
     - All in-flight React Query queries are cancelled (`queryClient.cancelQueries()`).
     - All retained React Query caches are wiped (`queryClient.clear()`).
     - OfferNet response cache is cleared (`invalidateOffernetCache()`).
     - Session generation increments, causing late-resolving responses from obsolete sessions to be discarded without populating the cache.
   - Every analytical query family (`useOperationalData`, `useOperatingControls`, `useAnalyticsData`, `VersionedReports`, `useEvidenceWorkspace`, `GlobalFilter`) includes `getAnalyticalSessionKey()` in its `queryKey`.
   - `ClientContext` subscribes to analytical session changes, aborting active workspace queries and reloading the server-authorised client list.
   - On workspace change, record-selection parameters (`search`, `leadId`, `page`, `drill`, `drillValue`, `inspectVendor`, `inspectGroup`) are purged.

2. **Elimination of Authentication Dead Ends**:
   - `src/lib/AuthContext.tsx` explicitly tracks `accessState` (`INITIAL_LOADING`, `SIGNED_OUT`, `ACTIVE`, `PENDING`, `SUSPENDED`, `MISSING_PROFILE`, `SERVICE_FAILURE`, `REVOKED`), `authError`, and `retryAuth`.
   - `src/components/AuthGate.tsx` replaces the indefinite fallback spinner with distinct, accessible UI states (`role="alert"`), each offering actionable `Retry` and `Sign out` controls.
   - Profile/access service errors display clear, non-secret messages while keeping analytical access strictly blocked.
   - `retryAuth()` safely re-runs access resolution without leaking snapshot listeners or introducing race conditions.
   - Ordinary viewers without administrator markers are distinguished from service failures.

3. **Lead Ledger Unknowns Preservation & Audit Exports**:
   - In `src/pages/LeadLedger.tsx`, `handleExportCsv` no longer converts missing/null values into false/invalid/zero placeholders.
   - Unknown `valid_idno` and `phone_valid` are exported as `'Unknown'` (preserving `'Valid (1)'` and `'Invalid (2)'` for observed values).
   - Unknown `dialled`, `contacted`, `sale`, and `activated` are exported as `'UNKNOWN'`.
   - Missing `total_calls` is preserved as an empty string (not `0`).
   - Exports use `downloadAnalysisCsv` to attach full audit metadata (`Scope client`, `Period start`, `Period end`, `Filters`, `Validation status`, `Date basis`, `Metric definitions`, `Detail truncated`).
   - Ledger table UI displays `'—'` for unrecorded calls and status fields.

4. **Scope-Preserving Navigation**:
   - `src/app/navigation/ScopePreservingRedirect.tsx` now allows exploration and pagination parameters (`search`, `drill`, `drillValue`, `page`, `pageSize`, `leadId`) for `/lead-ledger` as well as `/lead-explorer`.

5. **Versioned Report Executor Presentation**:
   - `src/pages/VersionedReports.tsx` presents an explicit status badge (`Executor: Deferred (501)`) and header communicating that full versioned report compilation and evidence replay are deferred to Milestone 2, while retaining fail-closed 501 HTTP responses.

6. **Automated Verification**:
   - Comprehensive test suites in `tests/analytical-session-isolation.test.ts` (9 tests) and `tests/auth-dead-ends.test.ts` (5 tests) verify all required session-isolation transitions, recovery states, and export invariants.

## Remaining work

1. Complete the versioned report compiler/executor and signed replay flow.
2. Provision and test immutable reporting snapshots with separately controlled cloud permissions.
3. Reconcile call-event identities, repeated HLC records and activation transaction identities against live sources.
4. Approve source timezone semantics and event-time interpretation.
5. Configure approved tenant marketing `client_name` mappings in production.
6. Reconcile and activate explicit marketing-to-lead attribution keys where available.
7. Source remaining operating costs from approved tables/contracts before adding contribution or margin.
8. Run production acceptance and tenant-isolation tests for the selected `CX_AUTH_MODE` (IAP or Firebase).
9. Perform live source-owner reconciliation before changing operational outputs from `NOT_VERIFIED`.
