# Frontend analytics integration — 29 September 2026

Baseline: `a8ee190cd62175100c8bfeefffd498855b8cafdf`. Review and integration: PR #24.

## User-visible changes

The maintained router mounts one shared, collapsed **Analytics source evidence** panel for operational routes. Opening it reads the existing tenant-scoped source-observability endpoint. It adds no background polling, new source access, metric calculations or integration approvals. Fixed releases, administration and synthetic demo pages do not initiate these checks. Source evidence is intentionally workspace-wide; reporting dates and optional filters are not applied to source-wide observations.

The panel separates source-readable, empty-source, not-configured, mapping-required, access-denied, incomplete and unavailable states. It retains zero versus unknown counts, identifies future event timestamps and explicitly distinguishes event time, check time and ingestion time. An allowlisted response projection omits physical table names, raw errors and source records. Connectivity is never shown as proof of completeness or reconciliation. Source checks are independent of current metric results.

Settings uses the existing identity-scoped query mechanism for one combined services check. Previous results are hidden during refresh and after failure. It no longer performs duplicate warehouse health checks, treats key presence as successful AI access, or invents latency, database provisioning, active-table counts and identity defaults. Theme and density preferences remain available; the scoped ledger link is administrator-only.

Commercial retains the existing API, filters, summary, matched-period changes, attribution coverage, charts, evidence table, CSV export, costs and withheld profitability section. Revenue, CPS, revenue/spend and attributed-count actions no longer open unrelated sale-rate or full-cohort decompositions. Only supported spend/CPL actions are offered under a compatible matched-period media scope. Matched-key charts exclude unmatched rows; table/export coverage and truncation remain explicit. Currency comes from the response/workspace rather than a fixed Rand prefix.

The light-theme RPC and sales series use higher-contrast shades. Category identities, dark-theme colors and the existing 3:1 regression threshold are unchanged.

## Verification

`tests/workspace-readiness.test.ts` adds 10 checks for response identity, malformed/failed envelopes, safe projection, duplicate source identities, unknown/zero values, status semantics, timestamps, latency and active-route integration. `tests/workspace-readiness-ui.test.ts` adds three React-rendered markup checks for card content, escaped source labels, empty evidence and anomalous dates. These supplement the existing contrast, tenant/cache, route, metric, export and authentication tests.

Use the final PR/commit CI results as the authority for full-suite TypeScript, regression, inventory, production build, HTTP smoke, Firestore emulator and dependency-audit execution. Earlier failures were investigated rather than bypassed. The generated inventory must match the current source tree; the fixture workflow can export the generator's output for comparison without changing source control.

### Executed rendered-browser component checks

An isolated fixture from commit `eb04aec8f04cfcd19ac9b3c1b9b593d616445fc4` was built by GitHub Actions and downloaded for Chromium/Playwright testing. The actual readiness panel, source cards, Settings, useOperationalData, React Query and analytical-session cache code were used. Only authentication/client/filter/theme/density contexts and network responses were explicitly synthetic. No customer data or credentials were used.

Browser plugin was absent. Regular Playwright used the installed Chromium. Localhost navigation was denied by the environment (`ERR_BLOCKED_BY_ADMINISTRATOR`), so the fixture was rendered from local artifact bytes in an offline `about:blank` document with a MemoryRouter. No network or browser security policies were changed. This is component-level browser verification, not production navigation or full-app authentication testing.

All 11 executed check groups passed at desktop 1440×1000 and mobile 390×844:

1. Initial operational fixture renders; no source query before disclosure.
2. Keyboard disclosure renders readable, empty, missing-mapping and unconfigured states, with zero/unknown distinction and a scope-preserving evidence link.
3. Failed source refresh removes the previous successful result.
4. Workspace switch during a pending request cannot display previous-workspace evidence.
5. Mobile source panel has no page-wide horizontal overflow.
6. Collapse removes evidence details.
7. Settings retains genuine zero latency and reports an AI failure despite a configured key.
8. Theme selection and table-density controls respond.
9. A Settings failure after success leaves no stale success badge.
10. Retry restores the appropriate measured service result.
11. No JavaScript page errors, error/warning console entries or framework error overlay occurred.

Screenshots were inspected locally and kept outside source control. The fixture workflow builds a reusable test artifact; it does not itself claim to execute these browser checks. Commercial browser layout/export interactions, full production shell rendering and live warehouse reconciliation remain separate acceptance work.

## Unchanged boundaries

No credentials, environment flags, IAM, Firebase rules, production deployment settings, upstream tables, source contracts, vendor ownership or commercial approvals are changed. The 63-column source-compatible LeadLedger export is unchanged. Live dialler state, event-level retry spacing, complete P&L/cash, approved targets and historical report execution still require their separately documented data and implementation work. This change does not implement all 90 dashboard requirements or certify production totals.
