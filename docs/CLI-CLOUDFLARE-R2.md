# CLI reports on Cloudflare Workers + R2

This is the Cloudflare alternative to the Google Cloud Storage activation instructions.
It keeps the existing application, Firebase sign-in, client scopes, CSV validators, archive
schema, history, duplicate/conflict rules and reporting/export APIs. There is no dialler
connection, mailbox collector, Google Storage login or R2 S3 credential in this implementation.
Existing BigQuery and Firebase services are not removed or migrated.

## What the code adds

- `server/cliImports/r2.ts`: native Worker R2 adapter with bounded reads, tenant-namespaced
  keys, archive validation and atomic conditional writes using ETags. Failed conditions retry
  through the existing archive logic; there are no unconditional replacement writes.
- `server/cloudflare/worker.ts`: mounts the existing Express API and injects the R2 backend.
  Non-API GET/HEAD requests use the separate `ASSETS` binding. API errors never become SPA HTML.
- `wrangler.cloudflare.example.jsonc`: explicit opt-in configuration, not an automatic
  change to any deployed account. There is deliberately no new root `wrangler.jsonc`.
- Regression tests and a credential-free Wrangler dry-run/local-runtime smoke workflow.

The Node/AI Studio entry points retain their existing GCS default. Only the new Cloudflare
entry point selects R2. No source is copied between storage providers, and existing archives
are not erased. Do not switch a populated production archive without a reviewed migration.

## Activation in the existing Cloudflare account

1. Complete Cloudflare's normal login and human verification yourself. Do not put credentials
   in chat or source control. Verify the intended account and existing `cx3` Worker before
   changing settings. A failed public-site fetch is not proof of the Worker's account state.
2. Under R2 object storage, select or create the approved private bucket. `cx3-cli-reports`
   is the proposed name, not a claim that it exists. Keep the public `r2.dev` development URL
   disabled and attach no public custom domain. Review every other Worker bound to the bucket.
   Retention, region and billing must follow the owner's approved policy; this code changes none.
3. Bind that bucket to the actual Worker with variable name **`CLI_REPORTS`**. A plain text
   bucket name is not a native binding. Do not bind the bucket as frontend static assets.
4. Copy `wrangler.cloudflare.example.jsonc` to the gitignored `wrangler.cloudflare.local.jsonc`
   and reconcile the Worker name, account, bucket and all existing bindings/vars/routes with
   the actual deployment. Do not overwrite an existing deployment configuration blindly.
   The example preserves dashboard text vars with `keep_vars`, but it is not a backup of
   bindings, routes, services or secret configuration.
5. Use the following Worker text variables:

```dotenv
CX_CLI_STORAGE_PROVIDER=r2
CX_CLI_R2_PRIVATE_CONFIRMED=true
CX_AUTH_MODE=firebase
CX_ALLOW_DEV_AUTH=false
ENABLE_CLI_SAMPLE_DATA=false
```

Set `CX_CLI_R2_PRIVATE_CONFIRMED=true` only after step 2. The example deliberately starts false.
This is an explicit owner attestation; the R2 binding cannot inspect account-level public URL,
custom-domain or IAM settings. It is NOT the same as GCS's runtime bucket-policy inspection.
The app does not expose a direct bucket-object download/list endpoint. Privacy settings must
remain controlled by the bucket owner; do not enable public access later.

No `CX_CLI_IMPORT_BUCKET`, `CX_CLI_IMPORT_CREDENTIALS`, Cloudflare API token or R2 access key
is needed inside this Worker for CLI storage. Keep the existing, separately authorised
`BIGQUERY_CREDENTIALS`/Firebase setup needed by the rest of CX3. Do not copy those secrets into
`VITE_*`, the config file or assets. Cloudflare sign-in and deployment authority remain necessary.

## Build and deploy

Run in an authorised development environment with Node 22:

```bash
npm ci
npm run verify
npx --yes wrangler@4.142.0 deploy --dry-run --config wrangler.cloudflare.local.jsonc
# After reviewing the target account, bindings, privacy settings and existing production config:
npx --yes wrangler@4.142.0 deploy --config wrangler.cloudflare.local.jsonc
```

The build command produces the frontend and server. Only `dist/client` is published as static
assets. The Worker executes `server/cloudflare/worker.ts`; do not deploy the Node/Vite startup
file as a static site. The compatibility date includes Node HTTP and environment support,
and `NODE_ENV` is fixed to production in this build so development identity cannot be enabled.
Do not use `--remote` for tests. No workflow added here deploys to production or creates buckets.

## First authenticated verification

Sign into the deployed app as an already approved CX3 administrator. Open CLI Performance
and Import CSV. The existing history endpoint checks binding access and returns actionable
configuration errors. It does not prove write permission or complete historical coverage.

Upload one approved all-attempts daily CLI report to its correct tenant, reconcile the file's
counts and reporting date, then upload it again: it must insert zero additional rows. Reload
or read from a fresh Worker instance and confirm the saved rows and source date remain.
Do not infer a tenant from a report without a vendor field; confirm its ownership before upload.
Use only one dialler/report population and consistent source definitions per archive.

Imported data is still `IMPORTED_REPORT`; the existing live warehouse preference remains.
This does not create live dialler synchronisation. No email automation is enabled.

## Verification boundaries

`tests/cli-archive-r2.test.ts` uses an in-memory simulation of native R2 conditional operations
and synthetic data. It tests concurrency, duplicates, conflicts, persistence across adapter
instances, tenant isolation, malformed data, read-size bounds and explicit configuration gates.
`tests/cloudflare-routing.test.ts` checks API-vs-asset routing and error handling.
`node scripts/check-cloudflare-local.mjs` boots the actual Worker with local emulated bindings,
checks its health and frontend assets, and verifies unauthenticated/invalid-token rejection.
This is runtime HTTP smoke coverage, not visual browser QA or a successful production import.

Live Cloudflare account access, actual bucket privacy, authorised import, two deployed-instance
writes, persisted readback and source-data reconciliation must be verified separately. A passing
CI run or merged PR is not proof that any cloud resource exists or that production is active.

## Provider references

- Cloudflare R2 Workers API and conditional operations: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- R2 Worker bindings: https://developers.cloudflare.com/r2/api/workers/workers-api-usage/
- Public bucket controls: https://developers.cloudflare.com/r2/buckets/public-buckets/
- Express on Workers: https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/
