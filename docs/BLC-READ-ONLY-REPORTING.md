# BLC read-only source reporting

This feature supplements Sales & activation with independently scoped BLC source evidence. It does not change the canonical operational-cohort model or treat independent sources as additive.

## UI and API

Open **Sales & activation → BLC source reporting → Open source report** in the BLC or explicitly authorised Offernet Master workspace. Queries run only when expanded. Dates and all structured global filters are preserved. The source selector changes the visible date basis; unsupported filters are rejected, not dropped. Refresh and JSON export belong to this source report, separately from the existing cohort workbook.

- `GET /api/analytics/blc/catalogue`: recorded source definitions, not a live access result.
- `GET /api/analytics/blc/report?clientId=ontact_blc&sourceId=journey&startDate=2026-09-01&endDate=2026-09-02`: selected source schema check plus one bounded aggregate query.

Both run inside the existing authentication, tenant, concurrency, audit and read-only BigQuery boundaries. Neither accepts user SQL, arbitrary table names, remote hosts or credentials. No direct Power BI request is added. No Rubix deals/create/update endpoint is called. Viewer responses omit query job identifiers. There is no record-level export.

## Source IDs and meanings

| Source ID | Physical object | Period field |
| --- | --- | --- |
| journey | dashboards-422710.lead_ledger.view_lead_ledger_blc_lead_submit_open | fetched |
| activationRegister | dashboards-422710.lead_ledger.tbl_blc_activations | date_created |
| activationBridge | dashboards-422710.lead_ledger.view_blc_activations | date_created |
| remoteActivations | dashboards-422710.lead_ledger.blc_remote_activations | date |
| waterfall | dashboards-422710.watfall_report.view_blc_waterfall_timeline | fetched |

The September 27 dictionary supplies 64 field entries across these five sources. The date_created fields are not certified activation timestamps. String dates use the existing UTC source parser and existing missing/sentinel handling. Distinct source references are not assumed to be unique people, cross-source identifiers or billable events. Money values and remote activation-unit fields are covered by nonblank-field counts only; no unvalidated sums or conversion rates are introduced.

The report requires metadata matching the recorded scalar field types, at most 366 inclusive days, and the tenant's existing warehouse read identity. It provides physical dated-row counts, distinct nonblank references, missing-reference rows, daily row counts, top-200 dimension groups with explicit truncation, and field coverage. Exact aggregate counts are transported as decimal strings. The maximum observed date is not a source-freshness certification. Query success is not reconciliation.

## Access and deployment

Use existing ADC or configured credentials on the server only. Existing maximum-bytes-billed and read-only query guards apply. If metadata or data reads fail, investigate the approved source/view and its dependency under the executing identity. Do not grant broad permissions, switch identities, bypass a restricted view, change IAM or fall back to another source automatically. A schema mismatch produces no data query. Failures have null metrics; a genuinely empty successful query has zero dated rows.

No historical July responses, agent names, customer records, Power BI resource keys or warehouse credentials are bundled into this feature. Its tests use synthetic values. Nothing in this implementation certifies live source access, business definitions, deployment or current data freshness.

## Verification

Run `npm run verify` and `npm run test:rules` under Node 22. Test unauthenticated and wrong-tenant requests, all five permitted source choices, missing dates, unsupported filters, metadata failure, schema drift, query failure, empty and populated results, tenant switching, refresh and export. Browser-check laptop/mobile layouts and keyboard operation. Confirm the API backend is actually deployed; a static-only frontend deployment cannot execute BigQuery queries.
