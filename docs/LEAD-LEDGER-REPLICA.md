# Lead Evidence source mode and 63-column export

## Entry point

Open `/lead-explorer?view=source` for **Source Evidence** in the canonical
**Lead Evidence** workspace. Existing `/lead-ledger` bookmarks redirect there,
preserving valid tenant, dates, filters, case context and source view parameters.
Legacy `search` is retained and copied to `sourceSearch` if the latter is absent,
so the two manual search meanings remain visible when switching modes.

Population (`view=population`, the default) uses normalized analytical lead rows.
Its Full analytical preset retains the useful 17-column presentation. Source
Evidence retains original source/vendor rows and their separate grain; its rows
are not normalized into a universal analytical table. Navigation has one Lead
Evidence destination. After migration commit `4fd4703`, the prior analytical page,
source workspace, standalone Ledger styles and unused router import were retired;
`/lead-ledger` remains a compatibility redirect. `LeadJourney`,
`LeadSourceEvidence`, `LedgerFieldCoverage`, `EvidenceExportPreflight`, timeline
and download helpers remain active in the canonical workspace.

The source explorer uses the selected tenant, explicit fetched start/end dates
(maximum 366 days), source/medium/vendor/grade/vetting/identity-validation filters,
lead ID/consumer ID/source search, and 25/50/100-lead pages. Unsupported analytical
filters return 422 rather than being silently ignored. It is administrator-only,
behind the existing authenticated tenant boundary.

`sourceSearch` and `sourceMode=configured|rich` are local URL-backed source state.
The source browser sends the former as the existing API's `search`; analytical
Population `search` stays independent. Neither mode/preset/source-search state is
a global reporting filter. A selected lead and source field focus stay in session
state and are never serialized simply to hand off between modes. Private searches
or identity filters cannot create shareable audit/investigation links.

Both modes use the same Lead Dossier. Source mode reuses its already-returned
source lead/report; Population's Source tab loads the replica lazily and requires
an exact returned lead identity. An explicit analytical lookup from a source-only
selection must establish the matching analytical row before handoff. Call counters
remain aggregates, unavailable analytical data stays unavailable, and an identity
match does not establish reconciliation or qualification of every source row.

## Source selection and deployment

The default remains `semanticMappings.tables.leads`. No configuration table is
silently replaced. Each request reads that source's schema and projects only the
reviewed 63-column contract. Missing columns remain null and are reported as missing.
No customer name, actual identity number, raw phone or email column is selected.
The four `standardised_*` process fields are returned only when timestamp-shaped;
other values are redacted. This protection is also applied to CSV exports.

The default master schema normally supports 55/63 columns. After an administrator
has independently confirmed the richer view's tenant scope, permissions and data
semantics, set this **server-side** variable:

```env
CX_LEAD_LEDGER_RICH_VIEW_APPROVED=true
# Optional complete-result ceiling; default 1,000,000, maximum 5,000,000.
CX_LEAD_LEDGER_MAX_EXPORT_ROWS=1000000
```

The rich selector is enabled only for `default_tenant` when its configured lead
source is exactly `dashboards-422710.lead_ledger.clustered_lead_ledger`.
It selects `dashboards-422710.lead_ledger.view_lead_ledger_using_open_leadger`.
The switch never grants other tenants master access. A flat vendor view never
falls back to a master/open/backup source. Shared-table tenants fail closed until
an independent row-security contract exists. No upstream table/view is created or
modified by this feature, and this commit does not enable the deployment variable.

## API

All paths below inherit `/api/analytics` authentication, concurrency guards,
read-only BigQuery query options, byte-billing limits and private/no-store responses.

- `GET /api/analytics/lead-ledger/replica/coverage`
- `GET /api/analytics/lead-ledger/replica`
- `GET /api/analytics/lead-ledger/replica/export`

Common parameters: `clientId`, `startDate`, `endDate`, `filters` (the existing JSON
filter contract), `sourceMode=configured|rich`, and `search` (up to 200 characters).
Interactive pagination: `limit` (1–100) and `offset`. Coverage does not require dates.
Export `mode=compatible` requires all 63 schema fields; `mode=available` explicitly
allows unavailable columns to remain empty and labels the file `partial-fields`.
Both export modes include all matching rows, subject to the documented whole-result
ceiling. Exceeding it rejects the request before a CSV response is sent.

## Grains and interpretation

- One interactive group per lead, retaining every visible source HLC record.
- A left-preserving HLC expansion retains leads without transactions.
- `Vendors` is the distinct nonblank vendor count before the user vendor filter.
- `Total Revenue` is a lead/currency total before that filter and repeats on source
  rows. Never add repeated parent totals. Unknown currency/amount is not zero.
- The revenue panel sums raw HLC amounts within the selected vendor scope and
  separates currencies. Missing amounts are flagged. Duplicate-key rows remain in
  raw totals; these are reported source values, not reconciled financial results.
- Conflicting transaction keys remain visible; no arbitrary first/latest row wins.
- No VICIdial or external activation enrichment replaces raw HLC values.
- Fetched date is the cohort anchor. Later calls/sales/activations remain attached.
- 1900-/1970- placeholder timestamps are retained in raw values but not milestones.
  Invalid/future values and first-call-before-delivery are flagged, not repaired.
- Naive source timestamps are interpreted as UTC, preserving the existing source
  interpretation, not claiming upstream timezone verification.
- Snapshot milestones do not reconstruct full call history or status transitions.
- Income/product interest is not an eligibility or permission-to-route decision.

## Export integrity

A single guarded BigQuery job owns every page. Pagination uses that job's opaque
page tokens, not repeated source queries with offsets. There is no SQL LIMIT in
this export path and no inherited 50,000-row cutoff. The query's completed total
row count is validated before streaming; each page must contain all 63 headers.
Repeated tokens, missing columns, too many/few rows and cancellation fail the stream.
The browser verifies the exact header and row count, including quoted multiline
cells, before offering a file. Mid-stream failures never produce a successful
partial download through this UI. Browser memory is bounded to 256 MiB; larger
results must use a narrower fetched window. The server also handles backpressure.

CSV is UTF-8 with BOM and CRLF. Formula-like strings receive a leading apostrophe
for spreadsheet safety. This is value-compatible with documented safety transforms,
not a promise of byte-for-byte equality with a historical report. Column ordering
is fixed by `contracts/leadLedgerReplica.ts`; no audit columns are appended.
HTTP headers expose expected row count, field coverage, missing fields, source and
query job ID. Interactive metadata includes exact scope, generation time and job ID.
Each interactive page is a new query snapshot; a fresh export may legitimately differ.

## Validation

`tests/lead-ledger-replica.test.ts` includes contract/schema checks, source selection
and tenant restrictions, parameterization, date/filter limits, left expansion,
unknown-value handling, duplicate/date exceptions, CSV safety, 99,822-row streaming,
export ceilings, cancellation and server/browser incomplete-download rejection.
All fixtures are synthetic; no uploaded customer records are committed.

Run `npm run verify` in the full repository. Before declaring live replication
complete, use the deployment identity to verify the selected source and reconcile
all 63 fields, row/lead counts, lead-only rows, duplicate keys and per-currency revenue
against the same historical snapshot and filters. Repository tests are not evidence
of live BigQuery access, freshness, deployment success or historical parity.
