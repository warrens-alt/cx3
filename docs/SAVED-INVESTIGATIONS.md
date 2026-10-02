# Persistent personal investigation definitions

Saved investigations retain a named reporting scope, supported predicate, metric and additive
narrowing. They do not contain lead IDs, private search, record or event rows, evidence pins,
result counts, AI text or notes. Reopening a definition queries current observations through
the normal authorised analytics APIs. A saved definition is not an immutable evidence release.

The `/api/saved-analyses` API uses the existing authentication, same-origin mutation policy,
request limits and `private, no-store` response policy. Every read/write requires an explicit
`clientId` authorised for the authenticated principal. The server chooses the owner from that
principal; callers cannot supply another owner. Viewers may maintain their own definitions,
and saving a definition does not grant access to administrator-only records or source evidence.
IAP subjects and Firebase UIDs are separate authenticated identities; this feature does not
merge their saved definitions by email.

The durable collection uses a separate object namespace:
`saved-investigations/v1/<SHA-256 tenant>/<SHA-256 authenticated subject>.json`.
Each owner/workspace can save at most 100 definitions, and the collection is bounded at 512 KiB.
Both reads and writes revalidate the complete collection and its owner/tenant. Updates and
deletes require the last returned positive integer `revision`; stale requests receive HTTP 409.
Storage generation/ETag conditions protect concurrent instances. A failed condition triggers
at most five read/validate/retry attempts and never an unconditional replacement.

## Node and Google Cloud Storage

Select an approved private bucket explicitly using server-only configuration:

```dotenv
CX_SAVED_ANALYSES_STORAGE_PROVIDER=gcs
CX_SAVED_ANALYSES_BUCKET=<approved-private-bucket>
```

The runtime may use its approved Application Default Credentials. Where a dedicated service
account JSON is required, configure `CX_SAVED_ANALYSES_CREDENTIALS` as a server secret. Never
put it in frontend `VITE_*` variables or source control. The adapter does not borrow
`BIGQUERY_CREDENTIALS`, `CX_CLI_IMPORT_CREDENTIALS` or the CLI bucket configuration.

The service identity needs bucket-metadata read access and read/write access to the saved
object namespace. Each operation checks that the bucket has uniform bucket-level access and
public access prevention set to `enforced`. The application does not change bucket policy.
GCS writes use exact object-generation preconditions and set object cache metadata to
`private, no-store`.

## Cloudflare Workers and R2

The existing Worker entry point accepts an optional native R2 binding named `SAVED_ANALYSES`.
Bind an explicitly approved private bucket, then configure:

```dotenv
CX_SAVED_ANALYSES_STORAGE_PROVIDER=r2
CX_SAVED_ANALYSES_R2_PRIVATE_CONFIRMED=true
```

The binding can deliberately select the same approved private bucket used by another
application feature, since saved definitions have their own namespace, or a separate bucket.
There is no implicit fallback to `CLI_REPORTS`, GCS, or a memory store. Review the existing
Worker account, bindings and routes before changing deployment configuration.

Before setting the privacy confirmation, verify that the bucket has no public `r2.dev` URL
or public custom domain, and review other Workers that can access it. This configuration is
an owner attestation, not an account-policy inspection by the native binding. Keep public
access disabled after activation. R2 operations use the native binding with conditional
ETag writes; no R2 S3 token or Google credential is needed for saved definitions.

When no saved-storage configuration exists, authenticated list requests return
`configured: false` and an empty definition list; mutations fail with HTTP 503. Partial,
invalid, inaccessible or unsafe storage configuration fails explicitly. No request reports
a successful persistent save without a successful conditional storage write.

## API and verification

- `GET /api/saved-analyses?clientId=...` returns `{ configured, definitions, limit }` in `data`.
- `POST /api/saved-analyses` accepts `{ clientId, definition }` and returns the created definition.
- `PUT /api/saved-analyses/:id` accepts `{ clientId, definition, revision }` and returns the updated definition.
- `DELETE /api/saved-analyses/:id?clientId=...&revision=...` returns `{ deleted: true }`.

All responses use the existing `{ success, data }` or error envelope. Unknown request fields,
conflicting or repeated workspace parameters, private record/search fields and unsupported
predicates are rejected before storage access. A saved definition cannot move to another
owner or tenant through an update.

The repository, HTTP and provider tests use synthetic definitions and simulated conditional
storage. They verify scope/owner isolation, stale revisions, concurrent writes, new-instance
readback, strict stored-data validation, bounded reads and explicit configuration gates. They
do not establish that a deployed bucket exists, has correct privacy settings or is writable.
After activating an approved deployment, verify an authenticated save, reload in a fresh
session, rename, conflict response, delete and absence from a second user's list. No test
or deployment instruction here publishes saved definitions or provisions cloud resources.

Provider references: [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/),
[GCS generation preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions),
[GCS multipart uploads](https://docs.cloud.google.com/storage/docs/uploading-objects#rest-upload-objects).
