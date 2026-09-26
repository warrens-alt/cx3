# Implementation status — 26 September 2026

## Deployment boundary

CX3 is an operational analytics application with an emerging evidence-reporting architecture. It is **not** currently certified as a fully reconciled reporting system.

Production analytical routes are fail-closed and require:

- a configured Google IAP audience;
- a valid signed IAP assertion;
- an explicit `CX_ACCESS_POLICY_JSON` tenant/role grant;
- server-side BigQuery credentials with only the access required by the application.

The only unauthenticated API route is `/api/health`.

A local development identity is available only when `NODE_ENV` is not `production` and `CX_ALLOW_DEV_AUTH=true`. Production never falls back to the development identity.

## Security changes in the current hardening revision

- Removed unrestricted BigQuery project, dataset, table and `SELECT *` preview endpoints.
- Converted Lead Ledger into an admin-only, tenant-scoped analytical record view.
- Restricted raw lead/timeline endpoints to administrators.
- Made the server-authorised tenant list authoritative for the live workspace selector.
- Enforced tenant permission checks on evidence-reporting catalogue and exception requests.
- Scoped Offernet lead timelines to the authorised tenant/vendor population.
- Scoped agent analytics to tenant/date/vendor and reject unsupported cross-grain filters.
- New Firebase profiles can no longer self-activate; non-bootstrap accounts remain pending until administrator approval.
- Operational analytics responses are labelled `UNVERIFIED`, not `VERIFIED`.
- Production runs the freshly built `dist/server/server.mjs`; generated `server.js` is no longer tracked.

## Analytical trust changes

The hardening revision removes or withholds results that were not supported by validated evidence:

- no fixed enterprise data-health score or grade;
- no static discrepancy counts labelled as verified;
- no hard-coded temporal “best windows”;
- no static activation maturation curve;
- no fixed contact-fatigue/redial recommendation values;
- no AI fallback metrics or generative recommendations;
- no assumption that campaign `budget` is incurred spend;
- no R45/R14.50/overhead profitability model;
- no vendor contribution or margin derived from assumed unit costs;
- no arbitrary split-half “current vs previous” comparison.

Where the source supports an observed value, it is returned. Where a required contract is missing, the API returns `null`, `UNAVAILABLE`, `PARTIAL`, `NOT_VERIFIED`, or a 4xx/5xx response rather than manufacturing a number.

## Evidence reporting

`contracts/reporting.ts` defines the intended versioned evidence metric contract and `server/reporting/repository.ts` contains immutable snapshot verification logic.

However, the current repository does **not** contain a complete v2 report compiler/executor or replay engine. Therefore:

- `GET /api/reporting/catalogue` can inspect an authorised tenant's release registry when configured;
- report execution returns `501 NOT_IMPLEMENTED`;
- replay returns `501 NOT_IMPLEMENTED`;
- exceptions do not fabricate rules or PASS evidence when no approved release exists;
- release manifests are validated strictly before use.

Do not describe this repository revision as having completed reproducible evidence-report execution.

## Date and filter behaviour

- Operational reports default to all-time when no date scope is supplied.
- Date presets are generated dynamically from the current date.
- Vetting does **not** silently turn all-time into a 90-day period; it requires an explicit start and end date.
- Unsupported cross-grain filters fail explicitly instead of being silently ignored.

## Commercial and campaign limitations

The following remain withheld until approved contracts are implemented:

- incurred media spend;
- CPL/CPC derived from incurred spend;
- telephony and agent unit costs;
- platform/fixed overhead allocation;
- contribution margin and break-even;
- vendor profitability;
- tenant-to-marketing-client campaign mappings;
- activation-maturation evidence.

Recorded source revenue can still be displayed as a source field, but it must not be described as audited financial revenue.

## Verification

`npm run verify` performs:

1. TypeScript type checking;
2. repository contract/regression tests;
3. production client/server build.

GitHub Actions runs the same checks plus a dependency audit.

The repository currently does not include the previously referenced Dataform warehouse tree or Playwright tooling package, so CI does not claim to execute those checks.

Passing repository CI is necessary but is **not** evidence of live BigQuery source completeness, source-owner reconciliation, production IAP acceptance or financial certification.

## Remaining work

1. Complete the versioned report compiler/executor and signed replay flow.
2. Provision and test immutable reporting snapshots with separately controlled cloud permissions.
3. Reconcile call-event identities, repeated HLC records and activation transaction identities against live sources.
4. Approve source timezone semantics and event-time interpretation.
5. Implement approved commercial/spend/rate-card contracts.
6. Add approved tenant-to-marketing-client mappings.
7. Run production IAP acceptance and tenant-isolation tests.
8. Perform live source-owner reconciliation before changing operational outputs from `NOT_VERIFIED`.
