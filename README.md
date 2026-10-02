# ConversionX / Offernet Operational Intelligence

React + Express analytics application backed by configured Google BigQuery sources.

## Primary host: Google AI Studio

CX3 is hosted through Google AI Studio. Use [the Google AI Studio runtime guide](docs/GOOGLE-AI-STUDIO.md) for preview startup, GitHub synchronisation, server secrets and Cloud Run publishing. Cloudflare instructions below are an optional alternative; a Pages check does not diagnose the Google-hosted app. A GitHub merge does not establish that the AI Studio working copy or its published revision has updated.

## Current trust boundary — 26 September 2026

The application intentionally separates **operational analytics** from **versioned evidence reporting**.

Operational analytics are useful for exploration and operational monitoring, but they are not independently reconciled or certified. The API stamps these responses `UNVERIFIED`. Media spend, CPC, CPM and CPL may be shown when they come from the configured marketing API-table contract and its declared spend grain passes validation. Budget is never substituted for spend. Cross-source attribution and profitability remain withheld unless their own explicit contracts are active.

The `/reports` area currently provides a tenant-scoped registry of immutable reporting releases. The metric contracts and release-manifest model are present, but the v2 report executor and replay engine are **not implemented in this repository revision**. Their endpoints therefore fail explicitly with `NOT_IMPLEMENTED` instead of returning placeholder results.

## Security

Production analytical access is fail-closed and the identity provider is explicit through `CX_AUTH_MODE`.

- Production defaults to `CX_AUTH_MODE=iap` when no mode is configured.
- IAP mode requires a signed Google IAP assertion, `IAP_AUDIENCE`, and `CX_ACCESS_POLICY_JSON`.
- `CX_AUTH_MODE=firebase` is supported for Google AI Studio / Cloud Run publishing and optional Cloudflare hosting. The API requires a Firebase bearer token, an active matching Firestore user profile, and the administrator marker for admin authority.
- Firebase mode does not trust decoded JWT claims by themselves: Firestore validates the bearer token and applies the deployed security rules before the analytical principal is created.
- A local development identity is available only when `CX_ALLOW_DEV_AUTH=true` and `NODE_ENV` is not `production`.
- Arbitrary BigQuery project/dataset/table browsing is disabled.
- Raw lead inspection and record-grain exports are administrator-only and flow through bounded, tenant-scoped analytical endpoints.
- New ordinary Firebase profiles remain pending until an existing administrator activates them. Ordinary administrator authority requires a verified identity, an active admin profile, and its matching authority marker.
- Promotion, suspension, demotion, and deletion update the profile and authority marker atomically. Bootstrap access is limited to the configured trusted UID or the configured bootstrap email with a verified email claim.
- The browser workspace list is sourced from the server-authorised tenant list; there is no compiled production fallback tenant.
- Shared-source aggregate queries apply mandatory tenant ownership predicates independently of optional user filters. Missing ownership mappings fail with HTTP 422.

Firestore access rules must be deployed separately to the intended Firebase project. Committing `firestore.rules`, building the application, and running emulator tests do not update deployed rules. In IAP mode, `CX_ACCESS_POLICY_JSON` remains the analytical tenant authority. In Firebase mode, the active Firestore profile and admin marker become the server-side workspace authority. See `.env.example`, `security_spec.md`, and `docs/SOURCE_API.md` for the configuration boundaries.

## Measurement

Canonical touchpoint terminology lives in `contracts/taxonomy.ts`. Frontend and backend modules re-export that contract rather than maintaining separate naming dictionaries.

Versioned evidence metric definitions live in `contracts/reporting.ts`. A published release is a structural reporting artifact; it is not by itself a statement that every upstream source is complete or financially reconciled.

Current live operational outputs that still depend on source semantics remain marked `NOT_VERIFIED` until source-owner reconciliation is completed.

The owner-supplied specification workbook has been checked against source contracts, all nine tenant operating configurations, API access controls and metric calculations. See [the workbook validation record](docs/WORKBOOK-VALIDATION.md) for corrections, intentional contract differences, regression coverage and remaining live-data checks. The workbook contains definitions, not transaction records, so this validation does not certify production totals.

CLI analytics follow the same fail-closed rule: imported reports are administrator-managed, production sample data is disabled by default, missing duration/lead-age fields remain unavailable, and matched-period comparisons are withheld unless a real comparable source population exists.

CLI CSV exports resolve the same live or imported source as the dashboard and apply dates, CLI/campaign/vendor filters, and literal CLI-or-campaign search before the export limit. JSON metadata and HTTP headers report row counts and truncation. Imported charts and lead-age summaries use the selected record population. Malformed CSV rows are rejected rather than shifting values between metric columns.

Cohort maturation uses the corresponding outcome timestamp. Missing outcome timestamps and cumulative revenue without dated revenue events produce unavailable maturation cells with an explanation. Operational filters that a report cannot apply return HTTP 422; supported dimensions are listed in `docs/IMPLEMENTATION-STATUS.md`.

## Build and verification

Use Node.js 22.

```bash
npm ci
npm run verify
```

`npm run verify` runs:

1. TypeScript type checking.
2. Contract/regression tests.
3. Generated route/API inventory freshness check.
4. Production client and server build.

CI executes the same repository checks, a separate Firestore emulator suite with Java 21, and a dependency audit. It does **not** claim to execute a live BigQuery reconciliation, Dataform warehouse build, or browser fixture suite because those assets are not present in this repository revision.

Common commands:

- Development: `npm run dev`
- Tests: `npm test`
- Firestore rules and access lifecycle tests (Java 21 required): `npm run test:rules`
- Type checking: `npm run lint`
- Build: `npm run build`
- Production: `NODE_ENV=production npm start`

Production `npm start` runs the generated `dist/server/server.mjs` bundle. Generated server bundles are not committed to source control.

The rules runner starts a local Firestore emulator for the isolated `demo-cx3-access` project. Its first run downloads the pinned official emulator JAR; subsequent runs reuse the verified cache. Plain `npm test` skips emulator cases when `FIRESTORE_EMULATOR_HOST` is absent. See `security_spec.md` for the runner's prerequisites and scope.

## Cloudflare production

For a Cloudflare deployment that uses the existing Firebase Google sign-in, configure the Worker/runtime with:

```bash
NODE_ENV=production
CX_AUTH_MODE=firebase
BIGQUERY_CREDENTIALS='<complete service-account JSON>'
BIGQUERY_MAX_BYTES_BILLED=1000000000
CX_MARKETING_SPEND_FIELD_JSON=
ENABLE_CLI_SAMPLE_DATA=false
```

The deployed hostname must also be present in Firebase Authentication **Authorized domains**. AI Studio secrets and Cloudflare Worker secrets are separate stores; configure the production values in Cloudflare as well. `BIGQUERY_PROJECT_ID` and `BIGQUERY_DATASET` are not runtime inputs in this repository revision because the approved project/dataset/table identities live in the server-side source contract.

If deploying behind Google IAP instead, use `CX_AUTH_MODE=iap` with `IAP_AUDIENCE` and `CX_ACCESS_POLICY_JSON`; do not enable both identity models implicitly.

## Saved investigation storage

Saved investigations store personal definitions and rerun current observations when opened.
They exclude records, lead IDs, private search text, evidence pins, conclusions and results.
Storage remains explicitly unconfigured until the deployment selects an approved private backend.
The Investigation workspace remains usable in that state.

For Node/Google Cloud, set `CX_SAVED_ANALYSES_STORAGE_PROVIDER=gcs` and
`CX_SAVED_ANALYSES_BUCKET`. Use the approved runtime identity or the dedicated server secret
`CX_SAVED_ANALYSES_CREDENTIALS`; never put credentials in `VITE_*` variables.
The bucket must enforce public access prevention and uniform bucket-level access.
For the optional Cloudflare runtime, use `CX_SAVED_ANALYSES_STORAGE_PROVIDER=r2`, an explicit native `SAVED_ANALYSES`
binding and `CX_SAVED_ANALYSES_R2_PRIVATE_CONFIRMED=true` after reviewing bucket privacy.
There is no memory, CLI-storage or warehouse-credential fallback and no automatic provisioning.
See [.env.example](.env.example) and [activation and verification requirements](docs/SAVED-INVESTIGATIONS.md).

## Demo mode

`/overview?mode=demo` is a separate client-only synthetic workspace. It does not make live analytics or BigQuery requests and should never be interpreted as validated business performance.

## Known remaining work

The main remaining trust work is:

- complete and independently test the versioned report compiler/executor and replay token flow;
- provision and validate immutable reporting snapshots outside this repository;
- reconcile call-event joins, activation identities and timestamp semantics against live sources;
- approve exact tenant-to-`client_name` mappings through `CX_MARKETING_CLIENT_MAP_JSON` for tenant-level campaign reporting;
- activate and reconcile `CX_MARKETING_ATTRIBUTION_JSON` only after marketing/lead join-key semantics are source-owner approved;
- source telephony, commission and overhead costs from approved tables/contracts before restoring full profitability metrics;
- add production acceptance tests for each deployed auth mode (IAP and/or Firebase) and live source-owner reconciliation evidence.

See `docs/IMPLEMENTATION-STATUS.md` for the current deployment boundary.

The historical `scripts/ingest-canonical.ts`, `scripts/publish-release.ts`, and `scripts/warehouse-reference.ts` depend on reporting modules or fixtures absent from this revision. They are unsupported, including their planning/dry-run paths, and are not deployment commands. Their missing dependencies and supported alternatives are recorded in `docs/IMPLEMENTATION-STATUS.md`.


## Marketing spend contract

Marketing spend is sourced from the configured API table, currently `lead_ledger_platform_insights`.

The contract defines the client, date, channel, campaign, adset, impression, click, lead and budget fields plus candidate observed-spend fields and the allowed spend aggregation grain. The supplied 26 September 2026 marketing schema contains `budget` but no observed-spend column, so total spend and spend-derived metrics remain unavailable. Runtime schema inspection will enable them only if a separately approved observed-spend field later exists.

Tenant mappings are deployment configuration:

```bash
CX_MARKETING_CLIENT_MAP_JSON='{"mtn":["<exact approved client_name>"]}'
```

Cross-source attribution is separately gated:

```bash
CX_MARKETING_ATTRIBUTION_JSON='{"mtn":{"marketingSourceField":"<approved field>","leadSourceField":"offershop_source"}}'
```

Do not activate attribution until the join values and coverage have been reconciled with the source owners. Attribution validates the approved spend grain, exposes matched/unmatched key coverage, and withholds operational filters that cannot be represented equivalently on the marketing side. See `docs/MARKETING-CONTRACTS.md`.

The September 2026 expansion adds matched-period lifecycle diagnostics, source/grain metadata, exception drill-downs, and spend reconciliation across the existing domains. See [Analytics expansion and validation boundaries](docs/ANALYTICS-EXPANSION-2026-09-26.md) for metric coverage, calculation methods, acceptance fixtures, and remaining source-owner approvals.
