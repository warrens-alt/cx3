# Evidence-reporting rebuild

The new default `/reports` page uses independently versioned metrics and read-only BigQuery snapshots. It never falls back to legacy calculations when a release is missing. See `docs/ACCURACY_V2.md` for the implemented scope, separate source/financial approvals and setup commands. Existing screens remain labelled unverified exploration. This change does not certify source data or provision cloud infrastructure.

`npm run verify` runs type checking, implementation tests and the production build. CI also compiles the Dataform graph and runs desktop/mobile browser tests against explicitly synthetic responses.

Audit and coverage records:

- `docs/AUDIT-2026-09-21.md` — remediation tracker, verification evidence, security/performance assessment and release boundary.
- `docs/SURFACE-COVERAGE.md` — every reachable UI route and API endpoint with its query/service lineage.
- `docs/SOURCE-METRIC-COVERAGE.md` — physical sources, required fields/types, v2 facts and all twelve approved metrics.

---

# ConversionX

React and Express reporting application backed by configured Google BigQuery sources.

## Current release status

The integrity patch adds authenticated API access, tenant permissions, scoped exports, corrected activation fallback, event-time cohorts and explicit unverified reporting states. It does not certify live warehouse accuracy or production readiness.

Read `docs/IMPLEMENTATION-STATUS.md` before deployment. Data APIs fail closed unless signed Google IAP authentication and an explicit access policy are configured. Raw warehouse browsing is disabled. Financial acquisition outputs and AI explanations are withheld pending verified input definitions.

## Setup

Use Node.js 22. Install locked dependencies with `npm ci`. Configure server-side warehouse credentials and the identity gateway as described in `.env.example`. Never put credentials in frontend code or version control.

- Development: `npm run dev`
- Tests: `npm test`
- Type checking: `npm run lint`
- Build: `npm run build`
- Dependency advisories: `npm audit`
- Production: `NODE_ENV=production npm start`

Only `dist/client` is publicly served. Backend artifacts are written to `dist/server`. `PORT` defaults to 3000. `/api/health` is public; analytical routes require verified identity and tenant access.

## Synthetic demo while authentication is being configured

Open `/overview?mode=demo`, or select **View demo data** on the workspace-access error screen. This is an explicitly separate, client-only experience using fictional July 2026 records. Its banner remains visible; it makes no analytics or BigQuery API requests and does not create an authenticated user or live tenant. Charts, filters, and record details describe only the synthetic scenario, not validated business results.

Use **Open live mode** to leave the demo. Mode changes reload the document so demo and live state are not mixed. Live routes still require the existing identity gateway and access policy. Demo is never selected automatically following an authentication error, and no server credentials or Cloud configuration are needed for it.

Warehouse joins, tariff contracts, timestamp interpretation, independent reconciliation and deployment checks remain outstanding. Consult the implementation-status document for the exact scope and limitations.
