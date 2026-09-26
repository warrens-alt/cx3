# Source-to-metric coverage inventory

Coverage version: `cx.sources.1.0.0`. Metric version: `cx.metrics.2.0.1`. Fact model: `cx.facts.2.0.0`.

## Evidence status

This inventory distinguishes code configuration from observed warehouse evidence:

- **Configured** means the table/field name is allowlisted in source code.
- **Schema-present** means a live metadata call observed a compatible field. That status was not achieved in this audit.
- **Queried** means a bounded, date-scoped aggregate returned a BigQuery job ID. That status was not achieved in this audit.
- **Reconciled** means an independent source/reference comparison passed. No source is reconciled in this audit.
- **Published** applies only to immutable v2 fact snapshots in an approved release. No production release was accessed in this audit.

The read-only 1–31 August 2026 source check on 21 September 2026 could not obtain warehouse credentials. Dataset inventory, all five schema reads and all five aggregate queries returned `CHECK_FAILED`. There were no query job IDs or processed-byte values. Absence of access is not an empty source, zero count or failed business outcome.

## Configured physical sources

Actual live types are **not observed**. “Required compatibility” below is the type contract enforced before SQL is compiled.

| Role and configured table | Row meaning and identity namespace | Date field and required compatibility | Configured fields/metrics | Supported filters and consumers | Current evidence |
| --- | --- | --- | --- | --- | --- |
| `leads` — `dashboards-422710.lead_ledger.clustered_lead_ledger` | One physical Lead Ledger source row. `lead_id` identifies a submission only within its approved source namespace. Repeated `hlc_details` can contain multiple vendor transactions; source rows, leads, consumers and deliveries are not interchangeable. | `fetched` — scalar STRING, TIMESTAMP, DATETIME or DATE parseable as UTC for this API. Source timezone is not independently verified. | Required identity paths: `lead_id`, repeated `hlc_details.vendor`, `hlc_details.transaction_id`. Aggregates: source rows, distinct lead IDs, `valid_lead`, `valid_idno`, `phone_valid`. Vetting also conditionally uses class/colour result and timestamp fields. | Source/medium map to `offershop_source`/`offernet_medium`; vendor uses repeated `hlc_details.vendor`. Feeds most legacy views, Vetting, Explore, leads and exports. | `CHECK_FAILED`; schema/type/rows/watermark unknown. |
| `calls` — `dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights` | One physical dialler source row, not a certified unique call event. `dialer_lead_id` and `vendor` need an approved bridge to ledger/delivery identities. | `call_start_date` — scalar STRING/TIMESTAMP/DATETIME/DATE parseable for the selected source-date window. | Required identity: `dialer_lead_id`, `vendor`. Aggregates: rows, distinct dialler lead IDs, `is_rpc`, `is_sale`, sum of `length_in_sec`. | Vendor only. Used by legacy overview/funnel/calls/outcomes/sources/cohorts/speed-to-lead/Explore/export. | `CHECK_FAILED`; event uniqueness and join cardinality unknown. |
| `timeToDial` — `dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights_time_to_dial` | One physical scheduling/source row. No approved identity key is configured. It is intentionally not merged into lead or call facts. | `expected_first_dial` — scalar compatible timestamp/date. Its meaning is expected/scheduled first dial, not an observed call. | Rows and rows with a valid expected-first-dial timestamp. | No cross-source filters. Only the dedicated `source-metrics/timeToDial` diagnostic consumes it. | `CHECK_FAILED`; schema and identity mapping unknown. |
| `activations` — `dashboards-422710.lead_ledger.tbl_blc_activations` | One physical BLC activation-source row. BLC coverage cannot represent every vendor. Repeated transaction snapshots have not been excluded by live reconciliation. | `date_created` — scalar compatible timestamp/date; source creation date is not automatically service-activation date. | Required identity: `transaction_id`. Aggregates: rows, distinct transaction IDs, observed subtotal of `expected_ontact_revenue`; complete sum is withheld if values are missing/malformed. | No verified source/vendor/medium filters. Used by legacy overview/outcomes/sources/cohorts/Explore/export. | `CHECK_FAILED`; transaction uniqueness/all-vendor coverage unknown. |
| `marketing` — `dashboards-422710.lead_ledger.lead_ledger_platform_insights` | One physical platform/media reporting row. Platform lead actions are not Lead Ledger submissions. | `date` — scalar compatible date/timestamp. | Required identity: `date`, `channel`. Aggregates: rows, `impressions`, `clicks`, `actions_lead`; optional grouping by `channel`. | No verified lead/vendor/medium bridge. Used by Acquisition and the source diagnostic. | `CHECK_FAILED`; schema, campaign mapping and completeness unknown. |

All identifiers are configuration-owned and validated as three-part table names. A caller can select only the five roles above and cannot provide a project/table identifier. Source aggregate windows require explicit dates, are capped at 366 inclusive days, preserve decimal strings, expose missing/invalid counts, and fail instead of silently dropping unsupported filters.

## Versioned fact model

The Evidence Reports do not query those legacy physical tables directly. They require an approved canonical ingestion and immutable snapshots named by a published release manifest.

| Fact | Grain and stable identity | Required upstream evidence | Publication expectations |
| --- | --- | --- | --- |
| `leads` | One canonical lead submission; source namespace participates in identity. | Approved source contract, raw record/batch provenance and capture time. | Unique/required fields, raw-to-fact identity and field reconciliation. |
| `deliveries` | One vendor delivery episode linked to a lead. | Stable delivery ID, vendor, successful-delivery timestamp and parent lead. | Parent, chronology and uniqueness checks. |
| `calls` | One immutable observed dialler event linked to a delivery. | Stable call event/revision ID and observed time. Cumulative HLC counters are forbidden substitutes. | Revision conflict, parent, chronology and uniqueness checks. |
| `sales` | One observed sale event linked to a delivery. | Stable sale event ID/time and parent delivery. | Parent, chronology and uniqueness checks. |
| `activations` | One activation event linked to an identifiable sale. | Stable activation event ID/time and sale parent. | Parent, chronology and uniqueness checks. |
| `commercial` | One signed expected/approved/invoiced/collected ledger delta. | Stable event ID, sale/delivery context, stage, currency, exact amount and reversals as negative deltas. | Monetary precision/stage, parent and raw-field reconciliation. |

Every release also snapshots raw records, batch manifests and source contracts, fixes a common cutoff, stores source coverage declarations and preserves BigQuery job evidence for eight named release gates. Compilation of those gates is not execution.

## Approved report metrics

| Metric | Grain/unit | Formula or aggregation | Required facts | Supported date bases | Main limitations |
| --- | --- | --- | --- | --- | --- |
| `fetched_leads` | lead/records | distinct canonical lead submissions | leads | capture cohort, event date | Vendor populations may overlap. |
| `delivered_episodes` | delivery/records | count successful delivery episodes | leads, deliveries | capture cohort, event date | Delivery episodes are not distinct people. |
| `call_attempts` | call/records | count observed call events | leads, deliveries, calls | capture cohort, event date | Requires event records, never cumulative counters. |
| `called_episodes` | delivery/records | distinct delivered episodes with a subsequent call | leads, deliveries, calls | capture cohort, event date | Event-date mode uses first subsequent call. |
| `call_coverage` | delivery/percent | called episodes / successful delivery episodes × 100 | leads, deliveries, calls | capture cohort only | Withheld when supporting coverage windows are incomplete. |
| `sale_events` | sale/records | count distinct sale events | leads, deliveries, sales | capture cohort, event date | Nominal event count; cancellations are not silently netted. |
| `activation_events` | activation/records | count activations linked to identifiable sales | leads, deliveries, sales, activations | capture cohort, event date | Active balance/cancellation are separate concepts. |
| `sale_activation_rate` | sale/percent | sales with ≥1 activation / distinct sales × 100 | leads, deliveries, sales, activations | capture cohort only | Multiple activations cannot multiply a sale. |
| `expected_value` | commercial event/currency | sum signed expected-stage deltas | leads, deliveries, sales, commercial | capture cohort, event date | Not approved/invoiced/collected value. |
| `approved_value` | commercial event/currency | sum signed approved-stage deltas | leads, deliveries, sales, commercial | capture cohort, event date | Not invoice or cash. |
| `invoiced_value` | commercial event/currency | sum signed invoiced-stage deltas | leads, deliveries, sales, commercial | capture cohort, event date | Not collection. |
| `collected_value` | commercial event/currency | sum signed collected-stage deltas | leads, deliveries, sales, commercial | capture cohort, event date | Requires actual collection events; not generic “revenue”. |

## API and display lineage

| Boundary | Source/query | UI/display | Evidence status |
| --- | --- | --- | --- |
| `GET /api/reporting/catalogue` | Latest authorised published manifest and snapshot identities. | Evidence Reports availability, definitions, cutoff and release evidence. | Verified by repository/HTTP/fixture tests; live release unavailable here. |
| `POST /api/reporting/reports` | Snapshot-only aggregate query generated from the shared metric contract. | Exact KPI cards and breakdown tables/visuals. | Synthetic reference cases pass; live SQL not executed. |
| `POST /api/reporting/replay` | Rechecks token, subject, tenant, permission, release and snapshot identity. | “Revalidate and replay”. | HTTP/security tests pass. |
| `POST /api/reporting/evidence` | Reuses the signed metric population query; max 50,000 records with explicit overflow. | Evidence drawer/export. | Exact strings and evidence IDs tested. |
| `GET /api/analytics/source-coverage` | Dataset table listing plus metadata/schema reads for the five roles. | Data Coverage and Visual Workspace; admin only. | Fixture tested; live call failed. |
| `GET /api/analytics/source-metrics/:role` | One bounded aggregate query over one configured physical table. | Data Coverage and Visual Workspace. | SQL/HTTP fixtures pass; all live roles failed before a job. |
| `GET /api/analytics/acquisition` | Marketing source aggregates grouped by channel. | Acquisition. Financial outputs remain null. | Fixture tested; live source unavailable. |
| Other `/api/analytics/*` | Legacy semantic model and report-specific queries. | Legacy-labelled application routes. | Code/fixture/browser tested, `NOT_VERIFIED`; not a v2 fallback. |

## Open evidence requirements

1. Run the source inventory and aggregates with the intended read-only service identity and retain job IDs, referenced tables and processed bytes.
2. Confirm dataset region, live schema types/modes, timestamp timezones, row meanings and stable ID namespaces with source owners.
3. Reconcile ledger↔delivery↔dialler↔sale↔activation bridges on independent cases, including duplicates, late revisions and missing parents.
4. Supply all-vendor activation evidence, approved commercial stage events/rate contracts and media spend/allocation keys; do not repurpose budget or expected value.
5. Execute `warehouse:test` in a new isolated test dataset, then run the candidate graph/assertions in a new build dataset.
6. Publish only after every required assertion passes and every fact has an owner-approved coverage declaration. A partial count may be shown as partial; an unsupported ratio stays unavailable.
