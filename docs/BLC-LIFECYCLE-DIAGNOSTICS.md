# BLC activation-register diagnostics

The Data integrity lifecycle card now separates an observed warehouse read from
lifecycle-contract approval. It is not a Rubix API health check or a Power BI
connector. No approval can be obtained merely by changing an environment flag.

## Execution and scope

The existing authenticated source-observability flow calls
`getBlcLifecycleDiagnostics`. Only `ontact_blc` and explicitly authorised
`default_tenant` access the exact configured `tbl_blc_activations` source. Other
tenants do not receive a BLC lifecycle card or cause a BLC metadata/data read.
A changed/unapproved configured source is blocked; there is no source fallback.

Metadata is read first. One generated aggregate SELECT replaces the former
activation freshness SELECT; the two displayed activation cards reuse this one
result. There is no extra full-table scan. As before, source observability covers
all tenant-owned register rows, independently of selected capture-cohort dates.
The diagnostic check time remains the underlying read time when existing caches
reuse a response; it is not refreshed on browser rendering. The existing analytical concurrency, authentication, read-only query guard and
maximum billed-byte ceiling remain in force. No raw record, status value, job ID,
credential or named staff/customer data is returned by this feature.

## What the observations establish

- Exact physical-row, distinct transaction-reference and missing-reference counts.
- Additional rows sharing a nonblank reference (not automatically duplicate events).
- Latest usable register `date_created` and unusable timestamp count, using the
  existing UTC/sentinel parser. This is not a verified activation or refresh date.
- Presence and scalar compatibility of an explicit candidate list for contract
  identity, Rubix status, activation status, activation time and colour.

Candidate names are checks, not certified aliases or an exhaustive dictionary.
`transaction_id` is not silently equated to Rubix contract identity, and
`date_created` is not substituted for activation time. Metadata presence is not
field-value validation. A missing/denied schema leaves the requirements unchecked,
not falsely marked missing. Data-query failures and invalid result shapes have
null counts; successful empty reads have real zeros where the fields are available.

The legacy activation card uses numbers only when safely representable. The
lifecycle detail retains decimal strings for exact large counts. Its generic
freshness fields remain null so it does not duplicate register dates in the
source-age chart; its dedicated UI shows the correctly labelled observations.

## Unresolved contract

`canonical` remains false. `FIELDS_MISSING`, `VALIDATION_REQUIRED` and
`SOURCE_UNAVAILABLE` are derived from observations and never presented as approval.
The refresh timestamp remains unverified. Even a source containing every candidate
column needs owner-approved key relationships, record grain, event/status meanings,
timezone, colour meaning, deduplication rules and reconciliation before any new
canonical lifecycle calculations are enabled. Existing cohort metrics, warehouse
reports, exports and read-only Power BI evidence are unchanged.

## Verification

Run `npm run verify` and `npm run test:rules` where emulator prerequisites exist.
New tests use synthetic metadata and aggregate results and cover source gating,
missing/incompatible schemas, metadata and query failures, empty results, unsafe or
inconsistent counts, reference and date caveats, UI labels, and unchanged scan count.
No live warehouse access, deployment, source refresh or business reconciliation is
certified by these tests. Validate the deployed card under its authorised runtime
identity after code deployment. Some older original source attachments have expired;
a current lifecycle dictionary or sanitised record-level evidence is still needed
for the separate business-mapping review.
