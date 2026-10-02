# Versioned report execution and replay

Implemented during the 2 October 2026 maturity pass from baseline
`fa9a93d3d14ef3164f4bc45b29a0dbec95fed24d`. This document describes the implemented
reader and signed replay protocol, not a claim that production releases exist.

## Execution boundary

`POST /api/reporting` now executes the **approved immutable aggregate output**
attached to an existing reporting release. It uses the existing metric definitions
in `contracts/reporting.ts`; there is no second metric registry, operational
fallback, arbitrary SQL endpoint, or browser-selected warehouse identifier.

The baseline contains semantic metric definitions, release metadata and snapshot
checks, but lacks the canonical fact schema, fact-query compiler, ingestion and
publication checks. Reconstructing joins from operational tables would invent an
unapproved mapping. Consequently, the supported execution contract is an explicit
optional `release.execution` descriptor. Releases without it return structured
`NOT_SUPPORTED` results with null metric values. Registered metrics unsupported by
the descriptor and incomplete required sources return unavailable metric rows.

This reader does not create aggregate tables, ingest facts, provision datasets,
publish a release, approve source meanings, or independently reconcile totals.
An external, source-owner-approved publication process must supply the immutable
output and its provenance. The historical `ingest-canonical.ts`,
`publish-release.ts`, `warehouse-reference.ts` and `engine-stamp.cjs` entrypoints
remain unsupported: required ingestion/check/compiler/fixture/warehouse inputs
are still absent. The added `scope.ts` does not restore those pipelines.

## Release requirements

The existing `ReleaseManifest` remains authoritative. Execution requires:

- Explicit authorised tenant and release ID; the release must be `PUBLISHED`.
- The current `MODEL_VERSION` and `METRIC_VERSION` from the existing contract.
- Nonempty structural checks, each with `PASS` and a job reference. This is a
  publication gate; it does not independently certify source/business meaning.
- All six fact snapshots (`leads`, `deliveries`, `calls`, `sales`, `activations`,
  `commercial`), all three provenance snapshots (`records`, `batches`,
  `contracts`), and the aggregate execution snapshot.
- Existing source owner/contract/approval references and explicit source coverage
  for every fact. For a metric value to be checked, every required source must be
  `COMPLETE`, start no later than the selected UTC start date, and be complete
  through the requested observation cutoff. `PARTIAL` stays partial and its value
  is withheld. `UNAVAILABLE` stays unavailable. Vendor filters/grouping also
  require delivery coverage, including for fetched leads: the existing metric
  definition uses recorded delivery episodes to establish vendor membership.
- Matching BigQuery metadata: every table must be a read-only `SNAPSHOT` in
  `CX_REPORTING_DATASET`, with the exact declared creation and snapshot times.
  Snapshot identity comparison retains sub-millisecond precision.

Add the following descriptor to an approved, otherwise complete manifest. The
identifiers below are placeholders, not production configuration or a publication
command:

```json
{
  "execution": {
    "contractVersion": "cx.reporting.aggregate-snapshot.1",
    "snapshot": {
      "table": "approved_project.approved_reporting.approved_result_snapshot",
      "createdAt": "2026-10-02T10:00:00.000Z",
      "snapshotTime": "2026-10-02T09:00:00.000Z"
    },
    "definitionHash": "<64-character REPORT_DEFINITION_HASH>",
    "supportedMetrics": ["fetched_leads"],
    "supportedDateBases": ["capture_cohort"],
    "supportedGroupings": ["none"],
    "supportedFilters": ["source", "vendor"]
  }
}
```

The definition hash is `REPORT_DEFINITION_HASH` exported from
`server/reporting/fingerprint.ts`: SHA-256 of canonical JSON containing
`{metricVersion: METRIC_VERSION, modelVersion: MODEL_VERSION, metrics: METRICS}`.
Canonical JSON recursively sorts object keys, preserves array order and uses
standard JSON scalar encoding. The authorised catalogue also exposes the current
reader's definition hash. Publication must independently review the actual
definition and approved calculations; copying a hash is not approval.

The release's existing `engineHash` identifies its original publisher. The reader
adds an explicit generation contract and definition fingerprint instead of
pretending that the stale, unsupported historical engine-stamp pipeline ran.
Different definitions, schema or rounding semantics require a new supported
contract version and a new immutable release.

## Aggregate snapshot schema

The reader executes a fixed single `SELECT` with bound tenant, release, scope-hash
and metric-ID parameters. No query is assembled from client identifiers. These
columns must exist in the registered aggregate snapshot:

| Column | Storage type | Required meaning |
| --- | --- | --- |
| `tenant_id` | STRING | Exact authorised tenant ID |
| `release_id` | STRING | Exact immutable release ID |
| `scope_hash` | STRING | SHA-256 of the canonical scope described below |
| `metric_id` | STRING | ID in the existing `METRICS` registry and release allowlist |
| `definition_version` | STRING | Exact release/current `METRIC_VERSION` |
| `unit` | STRING | Registered `records`, `percent` or `currency` |
| `grain` | STRING | Exact registered metric grain |
| `date_basis` | STRING | Exact requested `capture_cohort` or `event_date` |
| `is_total` | BOOL | True for the one required metric total |
| `group_key` | STRING, nullable | Null for totals; a nonempty exact group value for grouped rows |
| `value` | STRING, nullable | Plain finite decimal string; counts are nonnegative integer strings |
| `numerator` | STRING, nullable | Exact contracted numerator; nonnegative integer except commercial deltas |
| `denominator` | STRING, nullable | Nonnegative integer for ratios; null for non-ratios |
| `completeness` | STRING | `COMPLETE`, `PARTIAL` or `UNAVAILABLE` |
| `reason` | STRING, nullable | Supplied evidence limitation, at most 1,000 characters |

Each selected executable metric requires exactly one total row for the exact
scope. Duplicate metric/group identities, missing totals, cross-tenant rows,
mismatched scope/definition/unit/grain, unsafe numbers and excess rows fail closed.
`grouping: "none"` forbids group rows. A grouped row requires an explicit nonempty
group key of at most 256 characters; this version does not invent labels for
missing group values.

Counts and non-ratio values must equal their numerator exactly. Ratio values must
equal `100 × numerator / denominator`, rounded once to nine decimal places, using
exact decimal arithmetic. This defines the aggregate output serialization; it
does not change the registered numerator or denominator. A zero denominator has
null value and is unavailable. Ratios cannot have a numerator greater than their
contracted denominator. Incomplete snapshot rows must have null value, numerator
and denominator. Source coverage can withhold a metric even if the aggregate
table contains a number. Missing evidence is never converted to zero.

The query requests at most 101 rows to detect the 100-row ceiling. More than 100
rows, extra API pagination, or more than 100 final rows after unavailable metrics
are included causes a failure; no truncated report is presented as complete.
Decimal fields are bounded at 80 characters. Narrow the metric selection or
grouping when the result is too large.

## Request and scope hash

`VersionedReportRequest` has the following required shape:

```json
{
  "contractVersion": "cx.report-request.1",
  "tenantId": "approved_tenant",
  "releaseId": "approved_release",
  "startDate": "2026-09-01",
  "endDate": "2026-09-30",
  "observationCutoff": "2026-10-01T00:00:00.000Z",
  "dateBasis": "capture_cohort",
  "grouping": "none",
  "currency": "ZAR",
  "metrics": ["fetched_leads"],
  "filters": {}
}
```

Dates are UTC, ordered, inclusive and bounded to 366 days. The cutoff must be an
explicit UTC ISO timestamp and cannot exceed the immutable release cutoff. An
earlier event cutoff does not reproduce an earlier knowledge state: select its
earlier immutable release for that purpose. The reader normalizes millisecond
timestamp formatting before hashing.

Only source, vendor and medium equality/inclusion lists are recognized, and only
when declared by the release. Each list has 1–20 nonempty strings, at most 128
characters per value, without control characters or leading/trailing whitespace.
Values are deduplicated and sorted; metric selections are sorted and cannot
contain duplicate or unknown IDs. Unknown fields, private record identity/search
scope, unsupported filters, SQL, project, dataset and table parameters are
rejected. Removing a filter must be an explicit user decision.

The authoritative normalizer is `reportRequest` in `server/reporting/scope.ts`.
`reportScopeHash(normalizedRequest)` removes **only** `metrics` and `releaseId`,
then hashes the canonical JSON of every remaining request field. Tenant,
contract version, dates, cutoff, date basis, grouping, currency and all filters
therefore participate in the hash. Release and metric identity are separate
mandatory SQL predicates. An external publisher should use these exact helpers
from the reviewed revision rather than reimplementing an approximate hash.

The supported scopes must be materialized by the approved publisher. An absent
scope/metric total is an explicit 422 error, not a query against current
operational data.

## API and operational configuration

- `GET /api/reporting/catalogue?tenantId=...` selects the latest published release.
- Add `&releaseId=...` to inspect one exact historical release.
- `POST /api/reporting` returns an `EvidenceReportResult` in the standard
  `{success: true, data: ...}` envelope.
- `POST /api/reporting/replay` accepts the signed descriptor described below.
- Catalogue and exception queries reject unknown or repeated identity fields.

Configure `CX_REPORTING_DATASET` with the approved `project.dataset` and the
existing server-side BigQuery identity. The runtime needs permission to create
bounded query jobs and read the release registry, snapshots and their metadata.
It does not need DDL/DML, table creation/deletion, snapshot publication, export
destinations, IAM modification or operational-table access for this reader.
A billed-byte ceiling is mandatory through the shared read-only query guard.
`BIGQUERY_MAX_BYTES_BILLED` configures it, defaulting to 1,000,000,000 bytes;
callers cannot raise or disable that ceiling. Deployment IAM remains necessary
because application checks are not a substitute for cloud permissions.

The existing API stack enforces authentication, tenant grants, mutation-origin
validation, private/no-store caching and per-subject/global analytical concurrency.
A disconnected browser does not release a slot until its analytical work ends.
Multi-instance deployments still require their existing upstream shared quota.
The reader does not expose record-level data, and no supporting-record endpoint
is added; operational records cannot certify an immutable aggregate.

For an operator using an already-authorized local development server, save a
request containing the real approved tenant/release and exact published scope
to `request.json`, then run this read-only HTTP request:

```sh
curl --fail-with-body --silent --show-error \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://127.0.0.1:3000' \
  --data-binary @request.json \
  http://127.0.0.1:3000/api/reporting
```

This example neither activates development authentication nor bypasses production
IAP/Firebase. A production call must use the deployment's existing approved
authentication mechanism and permitted origin. Never place credentials in the
request JSON, URL, repository, or `VITE_*` variables.

## Evidence response and replay

Results include exact values, numerators/denominators, definitions, source coverage,
snapshot identities, manifest/scope/result hashes, generation contract, job and
bounded query evidence. `CHECKED` describes contract-consistent aggregate output.
Independent reconciliation and business meaning remain `NOT_VERIFIED`.
The stable result hash excludes delivery time, execution/query IDs and signatures;
these operational fields may vary between reproducible executions.

Set the existing server-only `CX_REPORT_SIGNING_KEY` through deployment secret
management to at least 32 random bytes (maximum accepted encoding length 4,096
bytes). No browser configuration contains the key. Missing/weak configuration
keeps report execution available with `token: null` and
`replay.status: NOT_CONFIGURED`.

Available immutable results receive a bounded HMAC-SHA256 descriptor using
canonical JSON and base64url encoding. It contains original aggregate rows,
original request, result digest, complete manifest digest, snapshot identity,
definition/generation versions, issuance and expiry. It contains no secret,
unrestricted SQL or raw lead identities. The descriptor is signed, not encrypted:
aggregate values and selected source/vendor scope are readable by its holder.
Current authentication and tenant authority remain required to replay it.

Tokens expire after 30 days. Key rotation invalidates existing tokens. Payloads
larger than 40,000 bytes are not signed and return `NOT_REPLAYABLE`; tokens are
bounded to 56,000 bytes at validation. No token/result persistence is silently
created. Save the returned JSON/token in an approved evidence location if future
reproduction is needed.

```json
{
  "contractVersion": "cx.report-replay.1",
  "tenantId": "approved_tenant",
  "token": "<signed token from the original response>"
}
```

Replay verifies the signature using a constant-time equal-length comparison,
validity period, request/metric contract, tenant access, complete manifest digest,
definition hash and snapshot identity, then executes the same immutable scope.

| State | Meaning |
| --- | --- |
| `MATCH` | Stable original and replayed content hashes match |
| `MISMATCH` | Validated replay output differs; both exact results are shown |
| `RELEASE_UNAVAILABLE` | Release/snapshot evidence cannot be read and validated |
| `REPLAY_INVALID` | Signature, expiry, contract or immutable manifest identity failed |
| `NOT_REPLAYABLE` | Signing is unavailable or required executable evidence is unavailable |

Original and replayed values are separate response objects. A match is immutable
reproducibility evidence, **not independent source reconciliation**, source-owner
approval or business verification. Revoked/missing/changed releases never fall
back to the latest release or operational analytics.

## Verification and remaining dependencies

`tests/versioned-reporting.test.ts`, `tests/reporting-replay.test.ts` and the
existing exceptions suite use synthetic manifests, fake warehouse clients and
local HTTP servers. They test denied authentication/tenant/origin, strict scope,
bounded queries, source coverage, exact values, immutable metadata, malformed and
changed releases, signature/expiry/tenant replay failures, exact match/mismatch,
and quota retention after a disconnect. They do not run live BigQuery queries or
publish warehouse assets.

Production use still requires approved aggregate calculations, an external
publication process, source-owner contracts and coverage, a configured reporting
dataset containing the registry and immutable snapshots, read/query IAM, a signing
secret, deployment authentication acceptance, and independent reconciliation for
each intended scope. None of those cloud or business approvals is established by
the synthetic tests.

API references checked for this implementation: [BigQuery snapshot metadata](https://docs.cloud.google.com/bigquery/docs/table-snapshots-metadata),
[BigQuery table resource / SnapshotDefinition](https://docs.cloud.google.com/bigquery/docs/reference/rest/v2/tables),
and [Node.js 22 crypto HMAC and timingSafeEqual](https://nodejs.org/download/release/v22.15.0/docs/api/crypto.html).
