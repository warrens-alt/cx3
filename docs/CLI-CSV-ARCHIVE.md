# Private CLI CSV archive

This change implements an application-owned CSV archive. It does **not** connect to a dialler,
read a mailbox, reuse an admin password, change IAM, create a bucket or grant new access.
Only reports already authorised for the selected CX3 tenant may be imported.

## Operator workflow

Open CLI Performance > Import CSV. The dialog checks archive readiness and lists the latest
20 accepted uploads, their source reporting dates and inserted/duplicate row counts. Confirm
that the report is authorised for storage and belongs only to the selected client, then choose
a CSV. Use the daily **all-attempts** CLI export consistently; do not combine first-attempt-only
exports, different diallers, or different business definitions in the same archive.

Required canonical columns: `report_date`, `cli_number`, `campaign_code`, `total_calls`,
`contact_count`, `sale_count`. Optional aggregate columns are explicitly allowlisted in
`server/cliImports/archive.ts`. `phone_number` and `alt_dial` are not accepted as CLI aliases.
Unknown/customer-level columns are rejected. The client checkbox communicates the authorised
scope; server authentication, administrator role and tenant membership enforce access independently.

Uploads append new date/CLI/campaign/vendor rows. Identical rows, renamed files and reordered
files do not increase totals. Conflicting values for an existing key reject the **entire** upload
with HTTP 409; no automatic replacement or last-write-wins correction is provided. Unsplit and
vendor-split rows cannot overlap for the same date/CLI/campaign population. A corrected report
requires a separately reviewed reconciliation/change process, not deleting the whole archive.

The existing Clear Import operation **pauses** archived reporting and retains its history.
Reuploading an existing or new file resumes it without counting duplicates. Synthetic sample
loading is blocked in production and whenever private archive storage is enabled.

## Deployment configuration — not applied by this change

An authorised administrator must select/provision an approved private Google Cloud Storage bucket
and configure the backend environment:

```dotenv
CX_CLI_IMPORT_BUCKET=<approved-private-bucket>
# Optional on a runtime without Application Default Credentials; secret manager only:
CX_CLI_IMPORT_CREDENTIALS=<complete dedicated service-account JSON>
```

Do not put credentials in `VITE_*`, browser configuration, source control or this document.
When the credential variable is omitted, the Google Auth library uses the runtime's existing
Application Default Credentials. `BIGQUERY_CREDENTIALS` is deliberately not reused. This code
requests an OAuth scope but does not grant the identity any new permission.

The dedicated bucket must have **uniform bucket-level access enabled** and
**publicAccessPrevention explicitly set to enforced**. The adapter checks both before reading
or writing. Inherited public prevention alone does not pass this strict application check.
Keep bucket IAM limited to approved identities. The runtime requires `storage.buckets.get`
for the privacy check and `storage.objects.get`, `storage.objects.create` and
`storage.objects.delete` on the `cli-reports/v1/` object prefix (replacement requires delete).
It does not need object listing, IAM administration, dialler access or warehouse write access.
Have the owner apply these permissions through the normal approval process; none is deployed here.
Configure retention, versioning/soft-delete, region and lifecycle in accordance with the owner's
approved data policy. This application does not change those settings or promise legal compliance.

The same Node/Express backend already required by CX3 must run the API. A static-only Cloudflare
Pages deployment does not execute this persistence backend. Configure storage on the actual
API host, not just on a static frontend.

## Read and write routes

All routes remain behind the existing API identity and same-origin controls. The new boundary
runs before the old import handlers, repeats tenant membership checks before storage I/O and
requires an administrator for upload, pause and history.

- `POST /api/analytics/cli-performance/import`: existing `{csvText, filename, clientId}` shape;
  returns `insertedCount`, `duplicateCount`, `duplicate`, and private archive status.
- `GET /api/analytics/cli-performance/import/history?clientId=...`: admin-only storage status,
  explicit source reporting dates and latest 20 import receipts. `historyTruncated` signals more.
- `DELETE /api/analytics/cli-performance/import?clientId=...`: pause only; not destruction.
- `GET /api/analytics/cli-performance?clientId=...&startDate=...&endDate=...`: restores saved
  reports after a restart and uses the existing scoped analytics. Live warehouse CLI data,
  when available, retains its existing preference. It is not combined with imported counts.
- The existing CLI CSV export also restores the same saved source before filtering/exporting.

Imported responses remain `IMPORTED_REPORT`, not `LIVE_BIGQUERY`. The history's latest date is
from the CSV, not the upload time and not proof that every call/day has been received. Missing
dates are not zero-filled. Existing period-comparison withholding remains in place. For persistent
multi-day imports, active CLIs are counted distinctly; incomplete optional count coverage withholds
complete-period totals/rates rather than treating missing values as zero. Average lead age remains
a source-reported estimate, not a measured distribution or median.

## Durability and integrity

One bounded JSON snapshot is stored at a SHA-256-namespaced path for each canonical tenant.
Each contains normalized allowlisted source rows, the original file hash, canonical import IDs,
source filename, import timestamp, authenticated importer subject, reporting-date bounds and counts.
Raw customer exports and raw CSV files are not persisted. Google object generations and
`ifGenerationMatch` implement compare-and-swap: concurrent instances retry rather than overwrite
one another. Read/permission failures are errors, not empty archives. Imported rows are revalidated
before hydrating the existing derived in-process analytics cache. That cache is not the persistence
layer; every configured CLI read checks the private archive. In-process request serialization keeps
that compatibility cache stable during CLI reads/imports/exports.

Limits: 48 KiB per input CSV, 20,000 unique archived rows, 2,000 accepted imports, 8 MiB per tenant
snapshot, five bounded write attempts. Capacity failure never silently discards old data; arrange
a reviewed rollover. The import route allows 128 KiB of JSON transport overhead while other routes
retain their original 64 KiB body ceiling. No API to accept arbitrary storage URLs or bucket names
from a browser is provided.

## Verification

`tests/cli-archive.test.ts`: append, duplicate rows/files, conflicts, tenant isolation, concurrent
writes, bounded retries, pause/resume, CSV structure, reporting dates, rejected PII columns and
source percentage preservation. The in-memory backend is a **test double only**.

`tests/cli-archive-gcs.test.ts`: private-bucket requirements, forbidden/missing-object distinction,
required generation headers, conditional writes and bounded reads, using mocked HTTP responses.

`tests/cli-archive-http.test.ts`: authenticated/tenant/admin gates, case/trailing-slash handling,
explicit unconfigured failure, HTTP import/history/conflicts, restart hydration and pause/resume.
It uses synthetic identities/records and an injected archive backend; no production call is made.

Run `npm run verify` in the complete repository. Before enabling in production, separately verify
an approved bucket with the deployment identity, two-instance imports, restart persistence,
source-file reconciliation, and the rendered import dialog on desktop/mobile. Code/tests alone
are not evidence of a live deployment or current data access.
