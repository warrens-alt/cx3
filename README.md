# ConversionX / Offernet Operational Intelligence

React + Express analytics application backed by configured Google BigQuery sources.

## Current trust boundary — 26 September 2026

The application intentionally separates **operational analytics** from **versioned evidence reporting**.

Operational analytics are useful for exploration and operational monitoring, but they are not independently reconciled or certified. The API stamps these responses `UNVERIFIED`. Media spend, CPC, CPM and CPL may be shown when they come from the configured marketing API-table contract and its declared spend grain passes validation. Budget is never substituted for spend. Cross-source attribution and profitability remain withheld unless their own explicit contracts are active.

The `/reports` area currently provides a tenant-scoped registry of immutable reporting releases. The metric contracts and release-manifest model are present, but the v2 report executor and replay engine are **not implemented in this repository revision**. Their endpoints therefore fail explicitly with `NOT_IMPLEMENTED` instead of returning placeholder results.

## Security

Production analytical access is fail-closed.

- Signed Google IAP identity is required in production.
- `CX_ACCESS_POLICY_JSON` is the server-side tenant/role authority.
- A local development identity is available only when `CX_ALLOW_DEV_AUTH=true` and `NODE_ENV` is not `production`.
- Arbitrary BigQuery project/dataset/table browsing is disabled.
- Raw lead inspection flows through bounded, tenant-scoped analytical endpoints.
- New Firebase profiles remain pending until an existing administrator activates them.
- The browser workspace list is sourced from the server-authorised tenant list; there is no compiled production fallback tenant.

See `.env.example` for configuration.

## Measurement

Canonical touchpoint terminology lives in `contracts/taxonomy.ts`. Frontend and backend modules re-export that contract rather than maintaining separate naming dictionaries.

Versioned evidence metric definitions live in `contracts/reporting.ts`. A published release is a structural reporting artifact; it is not by itself a statement that every upstream source is complete or financially reconciled.

Current live operational outputs that still depend on source semantics remain marked `NOT_VERIFIED` until source-owner reconciliation is completed.

## Build and verification

Use Node.js 22.

```bash
npm ci
npm run verify
```

`npm run verify` runs:

1. TypeScript type checking.
2. Contract/regression tests.
3. Production client and server build.

CI executes the same repository checks and a dependency audit. It does **not** claim to execute a live BigQuery reconciliation, Dataform warehouse build, or browser fixture suite because those assets are not present in this repository revision.

Common commands:

- Development: `npm run dev`
- Tests: `npm test`
- Type checking: `npm run lint`
- Build: `npm run build`
- Production: `NODE_ENV=production npm start`

Production `npm start` runs the generated `dist/server/server.mjs` bundle. Generated server bundles are not committed to source control.

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
- add production IAP acceptance tests and live source-owner reconciliation evidence.

See `docs/IMPLEMENTATION-STATUS.md` for the current deployment boundary.


## Marketing spend contract

Marketing spend is sourced from the configured API table, currently `lead_ledger_platform_insights`.

The contract defines the client, date, channel, campaign, adset, impression, click, lead, spend and budget fields plus the allowed spend aggregation grain. Runtime schema inspection validates that contract; it does not decide business meaning.

Tenant mappings are deployment configuration:

```bash
CX_MARKETING_CLIENT_MAP_JSON='{"mtn":["<exact approved client_name>"]}'
```

Cross-source attribution is separately gated:

```bash
CX_MARKETING_ATTRIBUTION_JSON='{"mtn":{"marketingSourceField":"<approved field>","leadSourceField":"offershop_source"}}'
```

Do not activate attribution until the join values and coverage have been reconciled with the source owners. See `docs/MARKETING-CONTRACTS.md`.
