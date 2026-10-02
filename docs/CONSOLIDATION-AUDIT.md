# Consolidation audit — 2 October 2026

The read-only audit began after fetching `origin/main` at
`bc002ad2912b5aee02688b097323d9b64e9253d4` (PR #49). The implementation uses
`codex/consolidation-hardening` in the existing free checkout; a different local
`main` checkout contains an unrelated commit and was preserved. No cloud resources,
IAM or deployed configuration were changed.

## Reference and runtime map

| Area | Classification before editing | Decision |
| --- | --- | --- |
| `src/leadEngine/**` | Reachable legacy UI; sole external entry was the lazy `/lead-engine` route in `AppRouter`. Six files imported one another; no reusable external utility consumer. | Delete the package and route. Unknown legacy URLs now reach the normal not-found page. |
| `server/leadEngine/**` | Six unmounted historical files; no external imports or router mount. Included hard-coded lead totals, commercial assumptions, quality volumes and vendor rankings. | Delete the entire package. Do not transfer its values. |
| Route manifest, navigation, command search | No Lead Engine entry or alias; only the router still exposed it. | Add regression coverage for absence; regenerate the surface inventory. |
| Legacy acceptance test and audit prose | Test/documentation describing the old route as reachable. | Replace the expectation and explicitly mark historical evidence as retired. |
| `validationUnavailable()` | Mounted production response returning seven static reference comparisons as current verification. | Keep the reference values, label all as `HISTORICAL_REFERENCE` / `NOT_VERIFIED`, null verification timestamps and historical tenant scope. |
| `/validation` metadata and CSV | Claimed selected warehouse lineage for static reference evidence; CSV preserved misleading verification claims. | Separate request provenance from measurement scope and export the actual non-certified boundary. |
| `getReconciliationValidation` in `server/bigquery/queries.ts` | Unimported historical function with fallback values, generated reconciliation time and manufactured cross-layer agreement. | Delete after confirming its definition was its only reference. |
| `GET /api/users`, `POST /api/users/sync` | Mounted authenticated Cloud SQL APIs, no consumer; GET lacked an admin restriction and POST trusted body UID/email. | Remove both APIs and their sole `src/db/users.ts` helper. Keep SQL schema/history. |
| Firebase/Firestore Access Control | Mounted authority path; subscriptions in UserManagement, mutations in AuthContext/authAdministration, rules and server identity checks. | Preserve authority, subscriptions and mutation semantics; extract controlled presentation components. |
| Saved investigations | Mounted, strict private definition CRUD with conditional revision writes and explicit GCS/R2 configuration. | Preserve repository/API contract; document supported variables and activation requirements. |
| Investigation | Mounted queue/driver/record/source requests; URL-backed population/narrowing; dossier selection in React state; session-scoped pins/notes. | Add a presentational workflow over existing results and session guards, plus explicit driver refresh and access-bound selection clearing. |
| Power BI capability/reconciliation response | Mounted template list labelled VERIFIED; unreconciled response used a generated `reconciledAt`. | Templates are NOT_VERIFIED; `reconciledAt` is null and request timing is named `checkedAt`. |
| Marketing schema inspection | Mounted live lookup silently substituted saved catalogue columns on an inspection failure. | Return an explicit 503 and leave no false contract cache entry; a retry can recover. |
| `/visuals` | Mounted chart catalogue generated synthetic weekly business counts, claimed a selected date range and labelled sales verified. | Remove generated points, selected-scope implication and false verification wording; show the unconnected analytical state. |
| Legacy ExecutiveOverview / ExecutiveAnalyticsConsole | Historical code; the page had an unused lazy declaration but no mounted route. Only that historical page imports the console's synthetic assumptions. | Remove the unused lazy bundle entry; retain historical source and tests. Maintained `/overview` remains unchanged. |
| CLI benchmark samples | Admin/development UI labels samples synthetic. The mounted archive guard already rejects production, but the later analytics handler had a weaker environment-flag exception. | Make the secondary handler reject production unconditionally too; verify both guards even with the old flag set. |

## Targeted data-truthfulness search

The audit searched `src`, `server` and `contracts` for hard-coded lead/commercial
values, margins, revenue, vendor rankings, mock/synthetic data, fallback and
placeholder data, static VERIFIED claims, generated verification timestamps,
record endpoints and body-based identity. Test fixture values were classified
separately from runtime values.

Remaining numerical configuration includes query/pagination limits, time buckets,
explicit operational thresholds, schema identities and metric definitions. Those
are configuration or definitions, not observed performance. Historical schema
catalogues remain useful as explicitly labelled references; they do not establish
live source availability. Real measured zeroes remain distinct from missing data.
The schema export build compiles these registered references; it is not a live
warehouse reconciliation.

`tests/frontend/**` and the browser fixture builder are test-only imports. The
browser regression uses a visible synthetic banner and intercepts every analytical
request. No fixture is introduced into the production application by this work.

## Preserved controls and evidence boundaries

- Production authentication, same-origin checks, authorised workspaces and all
  record/timeline administrator gates remain intact. Removed APIs still pass
  through authentication before the unknown-endpoint response.
- Local development auth grants administrator capability only for explicit
  `CX_DEV_ROLE=admin`; other values fail closed to viewer capabilities.
- Saved definitions retain scope/predicate/narrowing only. They cannot save lead
  IDs, rows, private search, pins, conclusions, analyst notes, AI responses or counts.
- The workflow header makes no analytical request. Existing parent requests and
  the driver feed its summary. Scope/session/role keys fence late responses, and
  refreshing the current view refreshes its active driver without a second queue query.
- Pins retain original scope; notes never promote validation status or certify
  sufficiency. Source-wide evidence still discloses its wider observation boundary.
- CI remains unchanged: types, repository tests, surface generation, production
  build/HTTP smoke, Google runtime, Firestore emulator and dependency audit. The
  separate Worker workflow retains the pinned credential-free dry run and local smoke.

See [the final QA record](qa/consolidation/README.md) for executed commands and
counts. Local tests do not establish live BigQuery reconciliation, deployed rules,
production saved storage, production GCP/Cloudflare configuration or commercial certification.
