# Frontend analytics integration — 29 September 2026

Baseline: `a8ee190cd62175100c8bfeefffd498855b8cafdf`.

## User-visible changes

The maintained router mounts one shared, collapsed **Analytics source evidence** panel for operational routes. Opening it reads the existing tenant-scoped source-observability endpoint. It adds no background polling, new source access, metric calculations or integration approvals. Fixed releases, administration and synthetic demo pages do not initiate these checks. Source evidence is intentionally workspace-wide; reporting dates and optional filters are not applied to source-wide observations.

The panel separates source-readable, empty-source, not-configured, mapping-required, access-denied, incomplete and unavailable states. It retains zero versus unknown counts, identifies future event timestamps and explicitly distinguishes event time, check time and ingestion time. An allowlisted response projection omits physical table names, raw errors and source records. Connectivity is never shown as proof of completeness or reconciliation. Source checks are independent of the current metric results.

Settings uses the existing identity-scoped query mechanism for one combined services check. It no longer performs duplicate warehouse health checks, keeps prior successful badges during refresh/failure, treats key presence as successful AI access, or invents latency, database provisioning, active-table counts and identity defaults. Theme and density preferences remain available; the scoped ledger link is administrator-only.

Commercial retains the existing API, filters, summary, matched-period changes, attribution coverage, charts, evidence table, CSV export, costs and withheld profitability section. Revenue, CPS, revenue/spend and attributed-count actions no longer open unrelated sale-rate or full-cohort decompositions. Only supported spend/CPL actions are offered under a compatible matched-period media scope. Matched-key charts exclude unmatched rows; table/export coverage and truncation remain explicit. Currency comes from the response/workspace rather than a fixed Rand prefix.

The light-theme RPC and sales series use higher-contrast shades. Category identities, dark-theme colors and the existing 3:1 regression threshold are unchanged.

## Verification

`tests/workspace-readiness.test.ts` checks response identity, malformed/failed envelopes, safe projection, duplicate source identities, unknown/zero values, status semantics, timestamps, latency and active-route integration. `tests/workspace-readiness-ui.test.ts` checks React-rendered card content, escaped source labels, empty evidence and anomalous dates.

These supplement the existing contrast, tenant/cache, route, metric, export and authentication tests. Use the repository CI/verification results for this commit as the authority on executed full-suite checks. Local syntax and standalone presenter tests are not a complete application build.

Rendered-browser acceptance should cover desktop and mobile: open/close/recheck source evidence; service failure following success; workspace changes during pending reads; null/zero populations; commercial drill targets and CSV scope; keyboard/focus, overflow and light/dark readability. React static rendering and source assertions are not full browser-interaction verification.

## Unchanged boundaries

No credentials, environment flags, IAM, Firebase rules, production deployment settings, upstream tables, source contracts, vendor ownership or commercial approvals are changed. The 63-column source-compatible LeadLedger export is unchanged. Live dialler state, event-level retry spacing, complete P&L/cash, approved targets and historical report execution still require their separately documented data and implementation work. This change does not implement all 90 dashboard requirements or certify production totals.
