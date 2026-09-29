# CX3 on Google AI Studio

Owner-confirmed primary host: Google AI Studio. Cloudflare Pages is not the target
for diagnosing this application. Google AI Studio's editor preview, its GitHub
working copy and a published Cloud Run revision are separate states.

## Synchronise the correct code

In the existing AI Studio app, use Settings > GitHub to confirm `warrens-alt/cx3`
and pull the current `main`. Preserve and reconcile unpushed AI Studio edits; do
not replace them blindly. Restart the preview after server/config changes. For
a published app, rebuild and redeploy that app through the existing Google
project. A successful GitHub/Cloudflare check is not proof of AI Studio sync or a
Google deployment. The current Google app URL must be obtained from this app's
Share/Deploy interface, not inferred from a historical CX2 or Pages link.

## Supported launch paths

| Environment | Launch | Boundary |
| --- | --- | --- |
| AI Studio development container | `npm run dev -- --port 3000` (use the host's actual port) | Express mounts API first; Vite supplies the frontend. |
| Host that directly launches Vite | `npx vite --host 0.0.0.0 --port 3000` | One lazy API instance per Vite host. |
| Built preview only | `npm run preview -- --host 0.0.0.0 --port 3000` after building | Uses the same API bridge and production guards. Not the production recommendation. |
| Published Cloud Run service | `npm run build`, then `npm start` | Executes `dist/server/server.mjs`, honours runtime `PORT`, binds `0.0.0.0`. |

The existing `gcp-build` script runs the production build. Compiled Node entry
points establish `NODE_ENV=production` before API initialisation, even if an old
local `.env` says development. Production never enables the development identity.
The preferred static directory is `dist/client`, not server bundle directories.

Vite development and built preview both mount the existing authenticated API.
Concurrent API requests reuse one initialisation instead of building a new
Express app and new guards for every request. A failed initialisation returns
JSON 503 until the runtime restarts, never HTML or generated warehouse records.
Unknown API paths stay JSON. Vite env files may supply documented server settings;
host-injected values take precedence, including deliberate empty values. No
server secret is copied to Vite `define` or exposed via a widened `envPrefix`.

## Authentication: choose the existing provider explicitly

For the current Firebase Google sign-in flow, configure the server setting:

```dotenv
CX_AUTH_MODE=firebase
CX_ALLOW_DEV_AUTH=false
ENABLE_CLI_SAMPLE_DATA=false
```

Production still defaults to IAP when `CX_AUTH_MODE` is unset. A normally published
Cloud Run app does not automatically acquire an IAP assertion just because it is
hosted by Google. Do not change the default or bypass authentication to hide a
configuration error. An intentionally IAP-protected deployment retains `iap`, its
approved audience and access policy. No cloud identity provider is changed here.

Firebase requires the intended project/database, deployed rules, an authorised
hostname, an active matching user profile and the existing admin marker where
applicable. A successful Google login is not warehouse permission.

## Server credentials

Manage sensitive values through AI Studio Settings > Secrets. For BigQuery use
the already approved `BIGQUERY_CREDENTIALS` JSON credential where this runtime
has no usable attached identity. On Cloud Run, the approved attached service
identity may provide Application Default Credentials instead. Do not paste
credentials into chat, source files, `VITE_*` variables or browser console code.
An authorised cloud owner must verify query-job and dataset/view read permissions;
this runtime repair grants no IAM roles or upstream access.

`GEMINI_API_KEY` enables the optional model service, not BigQuery. AI Studio may
provision it automatically. Exact source/table selection remains in CX3's server
contracts.

### Current master lead source gate

`default_tenant` continues to use `dashboards-422710.lead_ledger.clustered_lead_ledger`
when `CX_OPERATIONAL_RICH_VIEW_APPROVED` is absent or `false`. Setting the server-only
variable to the exact literal `true` selects
`dashboards-422710.lead_ledger.view_lead_ledger_using_open_leadger` for master
operational analytics only. Tenant-specific lead views and the source-compatible
LeadLedger export keep their own contracts.

This is deliberately not enabled by source freshness alone. The 29 Sep 2026 read-only
reconciliation found the richer view current through 2026-09-29, but its overlapping
1–26 Aug population differed materially from the historical clustered source. Enable
the gate only as an explicit reporting decision, then reconcile the selected cohort
across source, API and frontend before treating changed counts as business movement.
Invalid flag values fail closed. Do not put this variable in `VITE_*` configuration.

## Acceptance on the actual Google origin

Run `npm run deployment:check -- https://your-exact-google-app-origin` only on
the confirmed app origin. It sends credential-free API fetches, not browser
navigation requests. A platform-level login gate may prevent this external check;
that is not proof that the app API is absent.

Expect health JSON and rejection of anonymous analytics. Then sign in through
the approved application and run Settings diagnostics. Separately establish:

1. Correct AI Studio source revision and published runtime.
2. Correct authentication mode and active workspace authority.
3. A successful query of the workspace's configured BigQuery source.
4. Latest source event and ingestion evidence (not report generation time).
5. Equal scope/date basis across a bounded source/API/chart reconciliation.

A fetched cohort is not an activity-date report. No new polling, fake data,
metric definitions, production credentials or source mappings are introduced by
this runtime patch.

## Executable verification

`npm run test:google-runtime` runs credential-free local HTTP checks against
Express development, direct Vite development, Vite built preview, the compiled
Node bundle without NODE_ENV, and the unchanged IAP default. It checks health,
concurrent requests, anonymous/invalid identity rejection and frontend routes.
Run it after `npm run build`; the standard CI executes it. Unit tests cover one
initialisation, failure safety, exact API path matching and private env precedence.
These tests do not authenticate against the owner's live Google application or
certify warehouse freshness. No browser layout changes are part of this patch.

## References

- Google AI Studio full-stack runtime and server secrets: https://ai.google.dev/gemini-api/docs/aistudio-fullstack
- AI Studio GitHub two-way sync and Cloud Run publishing: https://ai.google.dev/gemini-api/docs/aistudio-build-mode
- Vite 6 server and preview middleware hooks: https://v6.vite.dev/guide/api-plugin
- Vite 6 env files and browser exposure: https://v6.vite.dev/guide/env-and-mode
