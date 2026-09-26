# Source tables, API coverage and metric population

## What is connected in code

The five existing configured physical sources now have explicit, read-only query paths. Each query uses the server's BigQuery SDK and configured tenant warehouse identity. All API reads require authentication and tenant access; schema inventory requires administrator access. Query inputs accept only configured source roles; callers cannot supply arbitrary project/table identifiers.

| Physical source | Role | API | Meaning |
| --- | --- | --- | --- |
| clustered_lead_ledger | leads | /api/analytics/source-metrics/leads | Capture-dated source rows, distinct lead IDs and recorded validity flags. |
| lead_ledger_all_vicidial_insights | calls | /api/analytics/source-metrics/calls | Call-start-dated dialler rows, RPC/sale flags and duration counters. Not certified unique call events. |
| lead_ledger_all_vicidial_insights_time_to_dial | timeToDial | /api/analytics/source-metrics/timeToDial | Recorded-first-dial-dated source rows with both actual FIRST_DIAL_DATE and scheduled EXPECTED_FIRST_DIAL. Tenant scope uses VENDOR; cross-source lead joins remain contract-gated. |
| tbl_blc_activations | activations | /api/analytics/source-metrics/activations | Source-creation-dated rows, transaction IDs and recorded expected value. BLC data does not prove all-vendor activation coverage. |
| lead_ledger_platform_insights | marketing | /api/analytics/acquisition and /api/analytics/source-metrics/marketing | Media-date impressions, clicks and platform lead actions. Budget is not treated as incurred spend. |

### Canonical parameters for the three shared analytics tables

The table names and known source parameters are centralized in `contracts/physicalSources.ts`; runtime code must reference this contract rather than maintain independent copies.

| Table | Role | Contracted parameters |
| --- | --- | --- |
| `lead_ledger_platform_insights` | Marketing | `client_name`, `date`, `channel`, `Channel_Campaign_Name`, `channel_adset_name`, `budget`, `impressions`, `reach`, `engagements`, `clicks`, `outbound_clicks`, `actions_lead`, `objective`, `created_at`, link/page/cart/checkout/payment action fields, messaging-started and `currency`. The supplied schema contains no observed-spend column; total spend must therefore remain unavailable. |
| `lead_ledger_all_vicidial_insights` | Calls / Agent / CLI | `vendor`, `dialer_uniqueid`, `dialer_lead_id`, list/campaign fields, `entry_date`, `modify_date`, `call_start_date`, `call_end_date`, `length_in_sec`, `user`, `status_name`, `is_rpc`, `is_sale`, `is_callback`, `called_count` and supporting audit fields. The supplied schema does not expose an approved outbound CLI/caller-ID field, so CLI-by-number remains unavailable unless a recognised field is later present. |
| `lead_ledger_all_vicidial_insights_time_to_dial` | Time-to-dial observability | `vendor`, `dialer_uniqueid`, `dialer_lead_id`, `campaign_id`, `list_id`, `entry_date`, `modify_date`, `first_dial_date`, `expected_first_dial`, `created_at`. Source metrics use recorded `first_dial_date` as their date basis and retain expected first dial as a separate scheduled field. No Lead Ledger join is enabled until identity equivalence is approved. |

The admin source catalogue and source-metric responses expose this parameter contract so schema drift is visible instead of silently changing analytical meaning.

Source aggregate APIs require explicit `startDate`, `endDate`, and the permitted `clientId`. Where a source has no verified source/vendor/medium mapping, that filter produces HTTP 422 rather than being dropped. Diagnostics in Source Field Mappings intentionally use source-specific dates without applying the legacy cohort filter dimensions; this is displayed in the interface.

## Tenant ownership

Authorisation to select a workspace and ownership of rows in a shared source are separate checks. Source aggregates always apply the following ownership contract before optional caller filters; selecting a different vendor or omitting filters cannot widen the authorised tenant population.

| Source role | Tenant ownership requirement |
| --- | --- |
| `leads` | A configured tenant-specific source view distinct from the master ledger. |
| `calls` | An approved tenant vendor mapping and a scalar STRING `vendor` column; the query binds the tenant's vendor values. |
| `marketing` | A resolved, approved `client_name` mapping and a scalar STRING ownership column; wildcard mappings are rejected. |
| `activations` | The explicitly configured BLC-only source is available to `ontact_blc`; other tenant ownership remains unestablished. |
| `timeToDial` | An approved tenant vendor mapping and scalar STRING `vendor` column scope the shared timing source. The separate dialler-to-Lead-Ledger identity join remains unapproved. |

The explicitly authorised `default_tenant` master workspace may query its configured source population. Other tenants receive HTTP 422 when the required mapping, field shape, or ownership contract is absent. Schema discovery alone does not establish ownership. The predicates and failure cases are implemented in `server/bigquery/sourceTenantScope.ts` and exercised by `tests/query-boundaries.test.ts`.

## Coverage and lineage

`/api/analytics/source-coverage` retrieves the complete table listing returned by each authorised dataset and independently checks all five configured source schemas. Extra tables are reported as unmapped rather than auto-joined. Listing failure means incomplete inventory, not an empty dataset. Nested `hlc_details` schema paths are retained. Metadata row counts remain strings and are not described as period-filtered counts. `populated` remains unknown until an aggregate query is actually performed.

`/api/analytics/metric-lineage` lists the physical legacy model dependencies and the canonical facts required by each of the 12 approved-report metric definitions. `/api/reporting/catalogue` now exposes the actual pinned snapshot identities for each metric when a release exists. No release means no snapshot identity; a raw-table configuration cannot impersonate a published fact release.

Historical `/parameter-coverage` now checks live schema presence instead of returning permanent MAPPED badges. Its expressions and fallback descriptions are still historical mapping proposals, not independently certified source precedence.

## Precision, missing data and execution evidence

The queries use explicit projections, parameterised values, configured identifiers and safe timestamp/numeric conversion. Results include BigQuery job IDs, referenced tables, processed bytes, date-field meaning, valid/missing/invalid field counts and interpretation warnings. Counts and NUMERIC sums are returned as decimal strings. A sum with missing or malformed input is withheld as a complete total while the observed subtotal remains identifiable. A true empty result can produce zero; a missing source, bad query or inaccessible table cannot.

Media totals use the entire selected population rather than a capped list of rows summed in JavaScript. Channel breakdowns and totals are calculated in the same query; excessive groups produce an explicit error. Cost-per-lead, ROAS, vendor spend allocation and collected revenue are not inferred from a budget or expected-value column.

Optional legacy calls/activation sources no longer fall back to a hard-coded other-tenant table. A lead with no vendor identity no longer matches every vendor's dialler summary. These changes are not a general certification of all legacy joins; source IDs, snapshot counters, duplicate transactions and outcome evidence still need live reconciliation.

## Remaining live integration requirements

The time-to-dial table has a live source-metric path and now uses its recorded `first_dial_date` as the source-date basis while exposing `expected_first_dial` separately. Tenant ownership is bounded by the table's vendor column. It is deliberately NOT joined to Lead Ledger outcomes without a verified dialler-to-ledger identity contract.

The versioned Evidence Reports still require canonical source adapters, approved identity bridges and a published release. This change does not automatically convert cumulative HLC counters into call events, guessed activation IDs into sale relationships, or expected values into financial ledger deltas. All-vendor activation data, approved rate cards, invoice/collection events and media allocation keys must be supplied by the source owners.

During the 21 September 2026 audit, the read-only connector was invoked but this host had no usable warehouse credentials. Dataset inventory, all five schema reads and all five aggregate checks returned `CHECK_FAILED` before a BigQuery job ID was created. No live source table, published release or business approval was changed. Automated SQL-generation and HTTP tests use explicit fixture metadata/results; browser tests use synthetic API responses. See `SOURCE-METRIC-COVERAGE.md` for the exact evidence state.

## Read-only deployment verification

Using the application's authorised warehouse identity:

```sh
npm run sources:check -- --tenant default_tenant --start 2026-08-01 --end 2026-08-31 --out source-evidence.json
```

The command inventories configured datasets, checks all five source schemas, and executes sequential date-bound aggregate queries under the configured per-query byte limit. It writes no warehouse data and publishes no release. A failed table/query or incomplete inventory exits nonzero. A successful run establishes source read/query evidence, NOT contractual billability, event-level deduplication, completeness of upstream delivery, or all-metric certification.
