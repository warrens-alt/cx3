# UI, API and query surface coverage

Audit date: 21 September 2026. Every reachable React route in `src/App.tsx` and every Express endpoint mounted by `server.ts` is listed here. “Legacy” means intentionally available but not independently reconciled; it does not mean untested.

## Shared execution boundary

All analytical/reporting routes pass through generated request ID and browser-security middleware, the 64 KiB JSON body ceiling, signed IAP verification, explicit tenant policy, same-origin protection for unsafe methods, and the process-local concurrency limiter. `/api/health` is the only public API. Legacy responses add `X-Analytics-Status: LEGACY_UNVERIFIED`. API responses are private/no-store. Unknown APIs return 404 and `/api/bq/*` returns 410.

Legacy client scope is capture-date plus explicit filters. `useAnalyticsData` includes tenant, dates, filters and endpoint parameters in the query identity and uses the browser cancellation signal. Evidence Reports keep a separate fixed report request and do not inherit legacy URL filters.

## Reachable UI routes

| Route | Component/client path | API endpoint(s) | Server query/service | Source/evidence class |
| --- | --- | --- | --- | --- |
| `/` | redirect | — | — | Redirects to `/reports`. |
| `/reports` | `VersionedReports`, TanStack Query | catalogue; POST reports/replay/evidence | `ReportService` + `BigQueryReportRepository` | Published immutable v2 snapshots only; no legacy fallback. |
| `/visuals` | `VisualWorkspace`, `DataVisual` | selectable allowlisted legacy/source endpoints | Existing endpoint service; local response adapters only | Does not broaden/requery/redefine returned data. Legacy/source status retained. |
| `/overview` | `Overview`, `useAnalyticsData('overview')` | `GET /api/analytics/overview` | `getOverviewStats` | Legacy semantic layer; unverified. |
| `/insights` | `Insights` | `GET /api/analytics/insights` | `generateDriverInsights` | Legacy two-period semantic query; unverified. |
| `/explore` | `useExploreData` | `GET /api/analytics/explore` | `executeDynamicQuery` | Allowlisted metric/dimensions; local view operations; unverified. |
| `/routing` | `RoutingIntelligence` | routing | `getRoutingIntelligenceStats` | Legacy lead/vendor routing evidence; unverified. |
| `/consumers` | `ConsumerReentry` | consumers | `getConsumerReentryStats` | Legacy consumer aggregation; unverified. |
| `/acquisition` | `Acquisition` | acquisition | source metric service grouped by marketing channel | Marketing physical source; spend/ROAS/CPL intentionally null. |
| `/lead-performance` | `Funnel` | funnel and calls | `getFunnelStats`, `getCallPerformanceStats` | Legacy semantic layer; unverified. |
| `/speed-to-lead` | `SpeedToLead` | speed-to-lead | `getSpeedToLeadStats` | Legacy transaction timing; expected time source is not substituted for observed calls. |
| `/call-performance` | `CallPerformance` | calls | `getCallPerformanceStats` | Legacy lead/dialler/vendor populations; unverified. |
| `/cohorts` | `Cohorts` | cohorts | `getCohortStats` | Capture cohorts with explicit observation rules; unverified. |
| `/outcomes` | `Outcomes` | outcomes and outcomes-quality | two legacy outcome services | Sale/activation flags and recorded values; not certified collected cash. |
| `/sources` | `SourceAnalysis` | sources | `getSourcesStats` | Legacy source breakdown; unverified. |
| `/vetting` | `Vetting` | vetting | one `getVettingReport` source query | Explicit class/colour contract and internal reconciliation; live source still unverified. |
| `/quality` | `QualityVetting` | quality | `getQualityStats` | Legacy validation flags; unverified. |
| `/revetting` | `Revetting` | revetting | `getRevettingStats` | Legacy re-vetting view; unverified. |
| `/data-trust` | `DataTrust` | data-trust and multi-vendor | two legacy diagnostic services | Diagnostic evidence, not certification. |
| `/data-quality` | `DataQuality` | data-quality | `getDataHealthStats` | Legacy exception counts; groups may overlap. |
| `/data-coverage` | `DataCoverage` | source-coverage and source-metrics/:role | source catalogue/aggregate services | Inventory is admin-only; source queries are tenant scoped. |
| `/audit` | `DataAudit` | export JSON | `exportData` | Bounded legacy export with metadata; not a raw warehouse browser. |
| `/explorer` | `LeadExplorer` | leads, lead-timeline/:id, export | lead page/timeline/export services | Loaded record page, explicit limit/offset; legacy/unverified. |
| `/validation` | `AdminValidation` | validation | returns explicit `NOT_VERIFIED` state | Admin-only; no manufactured check result. |
| `/admin` | `Settings` | health | BigQuery connectivity check for selected configured table | Admin-only discovery/configuration surface. |
| unmatched | inline not-found state | none | none | Navigation remains available. |

The prior unmounted Assumptions, Ledger and User Journey pages were removed. They were unreachable, depended on private browser assumptions and called the retired `/api/bq` surface. There is now no reachable client reference to `/api/bq`.

## API inventory

| Method/path | Authorisation | Validation/cache/limits | Consumer and result status |
| --- | --- | --- | --- |
| `GET /api/health` | Public | No warehouse call | Liveness only: `{status:'ok'}`; not readiness or data validation. |
| `GET /api/reporting/catalogue` | Authenticated + tenant | Strict tenant identifier; no-store | Evidence Reports and lineage. Returns unavailable when no configured/published release. |
| `POST /api/reporting/reports` | Authenticated + tenant from request | Strict body/scope/metrics/date/currency/filter contract; concurrency + BigQuery byte cap | Creates signed snapshot-bound result. |
| `POST /api/reporting/replay` | Authenticated; token subject/tenant/permission rebound | Token signature/expiry/release/snapshot checks | Exact report replay/revalidation. |
| `POST /api/reporting/evidence` | Authenticated; same signed execution | Selected metric/group only; explicit 50k ceiling | Evidence preview/export. |
| `GET /api/analytics/clients` | Authenticated | Returns only granted configured tenants | Workspace selection. A failure is now explicit in the UI. |
| `GET /api/analytics/health` | Authenticated + tenant | Configured lead table only | Admin settings health display. |
| `GET /api/analytics/discovery` | Admin + tenant | Configured datasets only | Discovery diagnostics. |
| `GET /api/analytics/validation` | Admin + tenant | No fabricated query | Explicit unavailable validation result. |
| `GET /api/analytics/parameter-coverage` | Admin + tenant | Live schema-derived mapping status | Admin/Visual Workspace diagnostic. |
| `GET /api/analytics/source-coverage` | Admin + tenant | All configured dataset/table/schema calls; incomplete inventory stays incomplete | Data Coverage/Visual Workspace. |
| `GET /api/analytics/metric-lineage` | Authenticated + tenant | Code/release-declared lineage only | Lineage drawer; relationships, not measured values. |
| `GET /api/analytics/source-metrics/:role` | Authenticated + tenant | Five-role allowlist, explicit ≤366-day range, mapped filters only, 5,002-row response guard | Data Coverage/Visual Workspace; source-date diagnostic. |
| `GET /api/analytics/acquisition` | Authenticated + tenant | Marketing role, grouped channel, same bounds | Acquisition; financial outputs withheld. |
| `GET /api/analytics/vetting` | Authenticated + tenant | Exact parameter allowlist, source schema checks, group/reconciliation limits | Vetting workspace. |
| `GET /api/analytics/{overview,funnel,quality,sources,timeseries}` | Authenticated + tenant | Validated scope; principal-scoped 120s cache | Legacy UI/Visual Workspace. |
| `GET /api/analytics/{data-quality,calls,call-performance,speed-to-lead,outcomes,routing,consumers,outcomes-quality,revetting,data-trust,vendor-coverage,hlc-coverage,filter-options}` | Authenticated + tenant | Advanced filters rejected for mixed-grain reports; principal-scoped cache | Legacy UI/Visual Workspace. |
| `GET /api/analytics/multi-vendor` | Authenticated + tenant | Validated scope/cache | Data Trust/Visual Workspace. |
| `GET /api/analytics/cohorts` | Authenticated + tenant | Allowlisted cohort/metric parameters/cache | Cohort UI. |
| `GET /api/analytics/leads` | Authenticated + tenant | Limit 1–1,000; offset ≤100,000; cache | Lead Explorer. |
| `GET /api/analytics/lead-timeline/:leadId` | Authenticated + tenant | Lead ID scalar length ≤100; cache | Lead detail modal. |
| `GET /api/analytics/export` | Authenticated + tenant | Grain/format/filter allowlists; 1–50,000 rows; CSV neutralisation; audit record | Audit/Explorer/record drawers. |
| `GET/POST /api/analytics/{explore,insights,drivers}` | Authenticated + tenant | Allowlisted metric/dimensions; GET cache, POST same-origin | Explore/Insights; legacy/unverified. |
| `POST /api/analytics/explain` | Authenticated + tenant | Always 422 | AI explanations deliberately disabled. |
| any `/api/bq/*` | Authenticated | Always 410 | Arbitrary warehouse browsing retired. |
| unknown `/api/*` | Authenticated | 404 | No SPA fallback for API typos. |

## Frontend state and export behaviour

- Loading, error, retry, cancellation, empty and unavailable states are distinct. Changing a scope hides stale results. Browser cancellation does not claim to cancel a BigQuery job already running.
- Null/blank/malformed values do not become zero. Large integer/decimal strings are compared, sorted, formatted and exported without conversion to IEEE-754 numbers. Chart coordinates alone are approximate.
- Search, table pagination, sort, point windows and many chart selections operate on the already received response and do not issue analytical queries. Export labels distinguish loaded, matching and plotted subsets.
- Evidence JSON excludes the signed replay token. CSV exports neutralise spreadsheet formula prefixes. Server exports are bounded and report truncation/count metadata.
- Native page routes are lazy-loaded. Global filters are lazy-loaded only when opened; chart modules are split. Error boundaries preserve shell navigation.

## Verification coverage and limits

The 291 Node tests cover scope validation, SQL parameterisation, tenant isolation, cache identity, exact precision, release immutability, ingestion identity, source API compilation, Vetting reconciliation, labels, visual adapters, exports and the new HTTP guards. The 491 browser assertions cover the principal user flows at 1440×1000 and 390×844 plus a 1280-wide authentication-failure state.

Not covered by this evidence: real IAP assertions, live BigQuery SQL, real schema/row counts, production network latency, multi-instance concurrency, deployment headers at the edge, assistive-technology manual testing, source-owner reconciliation or a production URL.
