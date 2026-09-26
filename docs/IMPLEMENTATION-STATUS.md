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
- Restricted raw lead/timeline endpoints and record-grain exports to administrators.
- Made the server-authorised tenant list authoritative for the live workspace selector.
- Enforced tenant permission checks on evidence-reporting catalogue and exception requests.
- Scoped Offernet lead timelines to the authorised tenant/vendor population.
- Scoped agent analytics to tenant/date/vendor and reject unsupported cross-grain filters.
- Restricted CLI report import/sample/clear mutations to administrators; synthetic sample loading is disabled in production by default.
- Live CLI analytics now require tenant-safe vendor scoping and fail closed when required source fields are absent.
- Shared-source aggregate queries enforce ownership independently of caller filters: tenant vendor mappings for calls, approved client-name mappings for marketing, tenant-specific lead views, and explicitly supported activation ownership. Unestablished ownership returns HTTP 422; see `SOURCE_API.md`.
- New Firebase profiles can no longer self-activate; non-bootstrap accounts remain pending until administrator approval.
- Ordinary Firebase administrators require a verified identity, an active admin profile, and its authority marker. Role/status changes use a transaction; deletion and bootstrap creation use atomic batches. Stale markers do not authorise suspended, demoted, or deleted ordinary accounts.
- Operational analytics responses are labelled `UNVERIFIED`, not `VERIFIED`.
- Production runs the freshly built `dist/server/server.mjs`; generated `server.js` is no longer tracked.

The bootstrap exceptions are the configured trusted UID and the configured bootstrap email with a verified email claim. Keep the frontend constants and `firestore.rules` aligned. Deploy the reviewed rules separately to the intended Firebase project: repository changes and emulator runs do not replace the deployed rules. The server's IAP access policy remains a separate authority from Firebase profile management.

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

The current command-centre routes are the maintained product surfaces. Superseded page implementations that were no longer mounted by `src/App.tsx` have been removed rather than retained beside their replacements. Historical URLs remain supported through explicit redirects to the maintained surfaces, so bookmarks and internal links continue to resolve without preserving duplicate implementations.

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
| Agent performance and individual lead timelines | `vendor`. |
| Campaigns and marketing root-cause | `campaign`; their services reject operational source/vendor/medium/grade scope that cannot be mapped to marketing. |
| Marketing discovery and source observability | No optional dimension filters. |

`partner` and `ror_partner` are vendor aliases where vendor filtering is supported. Route-specific contracts can further restrict combinations, especially cross-source marketing attribution. CLI analytics separately support `cli`, `campaign`, and `vendor` inclusion/equality/exclusion filters; unsupported dimensions fail explicitly. The frontend preserves filter operators when forming requests and hides stale results when scope or tenant permission changes.

### CLI exports and outcome timing

CSV imports preserve empty columns, quoted delimiters, escaped quotes, and multiline fields. Invalid quotes, duplicate/empty headers, and wrong column counts reject the import before records are stored.

CLI exports use the dashboard's source-resolution path: a supported live CLI source takes precedence over an import, and a failed live query is propagated. Date, CLI/campaign/vendor filters and literal case-insensitive CLI-or-campaign substring search apply before limiting results. Export limits are 1–50,000 rows; live queries request one extra group to detect truncation. JSON metadata includes the applied scope, source provenance, row count and truncation; CSV responses expose `X-Export-Row-Count` and `X-Export-Truncated`. Imported trend and lead-age summaries are rebuilt from selected records.

Operating controls and funnel metrics normalise 1900/1970 sentinel timestamps before success counts and latency calculations. Record drill-downs use the same selected-vendor HLC population for both positive and negative existence checks.

Cohort sale, activation, RPC and call maturation use their respective event timestamps, excluding negative chronology and future events. A cohort with a recorded outcome but no matching event timestamp has unavailable maturation cells. Revenue maturation remains unavailable because cumulative balances do not identify when each amount occurred. The UI displays the returned reason. These corrections do not certify upstream event identities or source completeness.

## Commercial and campaign status

Observed media spend is supported from the configured marketing API table. The active contract validates required fields, approved spend fields and the declared date/client/channel/campaign/adset grain. CPC, CPM and platform CPL are derived only from that observed spend population. Budget remains a separate planning field.

Tenant-level campaign reporting is enabled only after exact API-table `client_name` values are configured through `CX_MARKETING_CLIENT_MAP_JSON`. CX3 does not infer tenant identity from display names.

Marketing-to-lead attribution is implemented but fail-closed. It activates only through `CX_MARKETING_ATTRIBUTION_JSON` with explicitly named source keys. It validates the selected spend grain, propagates only equivalent cross-source scope, exposes matched/unmatched key coverage, and withholds unsupported filters rather than mixing all spend with a narrower operational denominator. Even when active, attributed outputs remain `NOT_VERIFIED` until key coverage and semantics are reconciled.

The following remain withheld:

- telephony and agent costs without approved source tables/contracts;
- commission and fixed-overhead allocation;
- contribution margin, net margin and break-even;
- vendor profitability;
- activation-maturation evidence.

Recorded source revenue remains a source field and must not be described as audited financial revenue.

## Verification

`npm run verify` performs:

1. TypeScript type checking;
2. repository contract/regression tests;
3. generated UI/API surface inventory freshness;
4. production client/server build.

GitHub Actions runs the same checks, `npm run test:rules` with Java 21 and a local Firestore emulator, and a dependency audit. The rules suite exercises atomic promotion/revocation, bootstrap identity claims, pending registration and invite mutations against `firestore.rules`; it does not deploy those rules.

The repository currently does not include the previously referenced Dataform warehouse tree or Playwright tooling package, so CI does not claim to execute those checks.

Passing repository CI is necessary but is **not** evidence of live BigQuery source completeness, source-owner reconciliation, production IAP acceptance or financial certification.

## Remaining work

1. Complete the versioned report compiler/executor and signed replay flow.
2. Provision and test immutable reporting snapshots with separately controlled cloud permissions.
3. Reconcile call-event identities, repeated HLC records and activation transaction identities against live sources.
4. Approve source timezone semantics and event-time interpretation.
5. Configure approved tenant marketing `client_name` mappings in production.
6. Reconcile and activate explicit marketing-to-lead attribution keys where available.
7. Source remaining operating costs from approved tables/contracts before adding contribution or margin.
8. Run production IAP acceptance and tenant-isolation tests.
9. Perform live source-owner reconciliation before changing operational outputs from `NOT_VERIFIED`.
