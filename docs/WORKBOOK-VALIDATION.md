# Workbook validation — 26 September 2026

Reference: `Untitled spreadsheet (25).xlsx`, supplied by the application owner. This review uses the workbook as a specification, not as executable instructions or proof of live data. The original workbook and its illustrative identity/contact values are not copied into the repository.

The five sheets contain **62 dictionary entries, 17 endpoint descriptions, 22 metric definitions, nine tenant configurations and eight governance rules**. They contain no business transaction extract with which to reconcile production totals. This pass validates repository configuration, query construction, response handling and rendered behaviour; live warehouse execution and source-owner reconciliation remain outstanding. Operational results retain their existing unverified status.

## Reference coverage

| Sheet and range | What was checked | Result and limits |
| --- | --- | --- |
| `1_Data_Dictionary!A5:G66` | Four physical source families, nested HLC fields, nullable counters, timestamp and validation-field types | Operational metrics normalize physical timestamp fields before aggregation. String validation flags accept recorded `0`/`false`; actual Boolean fields retain Boolean handling. The dictionary is partial: omitted call-source columns such as `vendor`, `call_start_date` and `dialer_lead_id` require runtime schema verification, not removal from application contracts. |
| `2_API_Endpoints!A5:G21` and `A2` | Routes, roles, scope selectors and cache durations | Added the documented `X-Client-Id` selector with the same server authorization as query/body selectors. Conflicts fail before analytical work. Removed nested OfferNet query retention so response-cache expiry governs freshness. Deliberate route/security differences are listed below. |
| `3_Metric_Definitions!A4:F25` | Lead grain, numerator/denominator, timestamps, missing evidence and cost semantics | Fixed duplicated snapshot aggregation, inconsistent backlog drill populations, rate denominators, missing-value rendering and latency populations. Platform CPL remains explicitly distinct from ledger CPL. |
| `4_Tenant_Config!A4:G12` | All nine source-table names, aliases, timezones and operating windows | Source tables and windows matched existing configuration; regression tests now protect those values and SQL parameter bindings. Workbook marketing client-name examples do not replace approved deployment mappings. |
| `5_Governance!A4:D11` | Query boundary, spend contract, cumulative calls, missing values, sentinel dates, administrator access and local time | Hardened the warehouse query boundary and missing-telemetry handling while preserving stronger existing tenant and record-access controls. The OAuth wording in GR-01 needs the clarification below. |

## Metric decisions and repairs

| Workbook metrics | Implementation and validation |
| --- | --- |
| M-01 through M-07 | Operational reports count a lead once after tenant/vendor/filter selection. Delivered and dialled mean a valid recorded timestamp, and RPC means recorded positive evidence. Delivery rate uses fetched leads, dial rate uses delivered leads, and contact rate uses dialled leads. Vendor reporting uses one record per lead/vendor. |
| M-08 through M-12 | Sale and activation timestamps are safely parsed; empty, malformed, 1900 and 1970 sentinel values are excluded consistently. Ratios preserve measured zero numerators and return unavailable for empty denominators. This follows GR-06 as well as the narrower example in M-08/M-11. Revenue is not independently reconciled by this workbook. |
| M-13 and M-14 | Delivery-to-dial latency is calculated once per lead, with negative and invalid intervals excluded. SLA percentages use valid nonnegative intervals within 900 seconds over delivered leads and are scaled by 100 for percentage display. Long valid intervals remain in percentile populations. Missing delivery-to-dial evidence cannot fall back to a different timing stage. |
| M-15 and M-16 | Call counts use the maximum nonnegative cumulative HLC counter per lead. Missing counters have a separate `Unrecorded` bucket. One-call share uses dialled leads. Five-plus/no-RPC requires explicit no-RPC evidence; a mixture of zero and unknown RPC observations remains unknown unless positive RPC evidence exists. |
| M-17 | Disposition coverage counts dialled leads with a recorded disposition once, using dialled leads as denominator. The exception count and corresponding record drill share the same selected lead population. |
| M-18 | Operating windows use tenant-local time and ISO weekdays, including Rewardsco Saturday. Missing capture time is a separate unrecorded population. The UI shows weekdays, hours and timezone. |
| M-19 | Overview/controls and raw-lead drills use the same sale-without-activation predicate. Age is completed days: `TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) > 14`, so 14 completed days is excluded and 15 is included. |
| M-20 and M-21 | Spend remains sourced from the approved marketing spend column at its validated grain; budget is excluded. Campaign summary totals cover the complete selected scope while campaign detail stays bounded with explicit truncation metadata. CPC uses full-scope spend/clicks. |
| M-22 | The workbook's formula uses ledger lead IDs, but its campaign endpoint explicitly describes **platform CPL**. Existing campaign CPL uses platform `actions_lead` events and is labelled accordingly. A reconciled ledger CPL requires approved cross-source cohort/join semantics; no value is fabricated from an unapproved join. |

Agent performance is an event-grain report, separate from the lead funnel. Missing dispositions, outcomes or durations make affected aggregates unavailable and expose field coverage. Recorded zero remains zero. Agent conversion uses sold RPC calls divided by RPC calls; all sale calls are retained as a separate count so sales without RPC cannot inflate that conversion rate. Its summary is explicitly labelled as covering the displayed roster, which is bounded to the 100 agent/vendor groups with the most calls.

Data-integrity checks count distinct leads and distinguish recorded invalid validation flags from unrecorded flags. A capture-date-filtered cohort cannot measure how many source records lacked a valid capture timestamp before filtering; that check now reports unavailable instead of a misleading zero discrepancy.

## API compatibility and security

All analytical routes still require authenticated server-side tenant authorization. `X-Client-Id` selects a workspace; it grants no access. Matching canonical aliases are accepted (`blc`/`ontact_blc`, `bizvoip`/`vodacom_bizvoip`); conflicting query, body or header selectors return HTTP 400. Unauthorized tenants return HTTP 403.

Most described endpoints use `/api/analytics/offernet/<path>` as the workbook states. These differences are retained and documented rather than introducing duplicate endpoints:

| Workbook description | Current application contract |
| --- | --- |
| `/exceptions` | The Exceptions UI uses overview/operating-controls results and the existing bounded record drills. There is no dedicated `/offernet/exceptions` endpoint. |
| `/lead-timeline` | `/api/analytics/offernet/lead-timeline/:leadId`, administrator only. |
| `/cli-performance` | `/api/analytics/cli-performance`, with a 30-second cache rather than 60 seconds. |
| `/export`, “All Roles” | `/api/analytics/export`. Record-grain exports are administrator only, consistent with GR-07. Aggregate CLI export retains its existing tenant-scoped role policy. |
| No cache for raw leads, timelines and marketing discovery | Server caches remain bounded at 30 seconds for raw leads and 60 seconds for OfferNet timelines/discovery, keyed by authenticated principal, role, tenants and scope. Analytical HTTP responses retain private/no-store browser policy. |

Previously, OfferNet's response cache expired after 60 seconds but the underlying single-flight query cache could reuse results for 120 seconds. Equivalent tenant-selector URLs could also give an ageing inner result a fresh outer TTL. OfferNet now retains results only in its response cache; the inner layer deduplicates concurrent work without retaining completed results. Fake-clock HTTP regressions prove expiry and prevent the equivalent-selector refresh problem, while a concurrent-request test protects work deduplication.

Source-observability queries follow the same ownership boundaries as analytical reports. A missing shared-call vendor mapping withholds the call freshness result; a separate activation table is queried only for its configured owner scope or the authorized master scope. Source errors return fixed diagnostics rather than raw SDK messages.

## Governance interpretation

- **GR-01:** Application-generated warehouse SQL must be a single `SELECT` or `WITH` query. The guard skips SQL comments and quoted literals before rejecting write/procedure/script statements, multiple statements and permanent destination/write options. It also retains query billing limits. This is an application boundary, not a replacement for IAM. The SDK's query-job path uses `jobs.insert`, whose documented accepted OAuth scopes do **not** include `bigquery.readonly`. Deploy with project-level `roles/bigquery.jobUser` and source-dataset `roles/bigquery.dataViewer`, withholding data-edit/owner permissions. Deployed credential privileges were not verified in this pass. See [Google jobs.insert documentation](https://docs.cloud.google.com/bigquery/docs/reference/rest/v2/jobs/insert) and [permissions for running queries](https://docs.cloud.google.com/bigquery/docs/running-queries).
- **GR-02 / GR-03:** Existing spend-column and unique-grain gates remain in force. Workbook client-name examples do not approve tenant marketing ownership mappings or cross-source attribution.
- **GR-04:** Cumulative counters are maximized at the selected lead grain, then aggregated. The UI does not attribute a sale to a specific attempt from a cumulative count.
- **GR-05:** Unknown telemetry remains unavailable. A partially observed total is identified separately rather than presented as a complete total. Query failure also remains an error, not an empty successful dataset.
- **GR-06:** Both sentinel years and parse failures are handled before stage/latency aggregation.
- **GR-07:** Administrator-only raw records, timelines and record exports remain enforced despite the broader export-role description elsewhere in the workbook.
- **GR-08:** All nine operating configurations use `Africa/Johannesburg`, parameterized operating times and ISO weekdays. Tests check actual SQL query bindings in addition to static configuration.

## Verification and remaining evidence

Regression suites cover synthetic repeated HLC snapshots, zero/unknown telemetry, selected-vendor drills, sentinel dates, invalid/negative intervals, empty denominators, completed-day boundaries, agent outcome coverage, tenant aliases and authorization, cache expiry, query write rejection, full-scope campaign summaries, and source-check error redaction. Submitted-query tests inspect production SQL and response mapping; they do **not** execute SQL against BigQuery.

Browser validation uses the actual frontend with a temporary local authentication fixture and intercepted synthetic APIs, including desktop/mobile layouts, unknown versus zero display, duration labels, operating weekdays, platform CPL and agent RPC conversion. Fixtures are outside application source, and no production authentication bypass is added.

`npm run verify` checks TypeScript, the repository regression suite, generated surface inventory and production builds. CI separately runs the Firestore emulator suite and dependency audit. Browser evidence is a local audit artifact rather than a claimed CI job.

The source-check command was repaired to start reliably, reject missing/duplicate/unknown arguments, require a valid bounded date interval of at most 366 inclusive days, and avoid returning raw SDK diagnostics. An authorized environment can use it for a subsequent live check:

```bash
npm run sources:check -- --tenant mtn --start 2026-09-01 --end 2026-09-07
```

Run `npm run sources:check -- --help` for the supported contract. Live checks require the actual approved tenant mappings and source credentials. They were not run during this workbook-only validation. Source-owner review must still confirm the physical schema, call/lead joins, source ownership, revenue semantics and any ledger CPL calculation before results can be represented as reconciled business evidence.
