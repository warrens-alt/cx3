# Analytics expansion and spend accuracy — 26 September 2026

Implementation builds on main `3b72e7c5a56c924319e9dd874c6b896dbf50abf8`. Existing routes, tenant authorization, IAP, source allowlists, administrator record/export controls and query budgets are retained. No production source mapping is approved by this implementation.

## Spend evidence and calculation

Configured marketing source: `dashboards-422710.lead_ledger.lead_ledger_platform_insights`.

Configured unique spend grain: `date + client_name + channel + Channel_Campaign_Name + channel_adset_name`.

The observed-spend column is resolved against the server's approved field contract and runtime schema. A single approved candidate with a declared currency/micros unit is required. Multiple candidates are ambiguous and withhold spend until `CX_MARKETING_SPEND_FIELD_JSON` designates one already allowlisted field. Budget, planned and estimated fields are excluded. There were no locally configured warehouse credentials in this implementation environment; **no live source column, warehouse total, duplicate count or external billing reconciliation is certified by this change**.

Spend is parsed strictly as BigQuery NUMERIC and aggregated independently of leads. Malformed and missing values remain missing; they are not repaired into plausible numbers. Grain diagnostics include selected rows, distinct grain keys, duplicate rows, incomplete keys and missing/invalid spend. Invalid or incomplete evidence withholds the commercial total and dependent ratios. A recorded zero remains zero; an empty population is unavailable.

The reconciliation response compares the raw observed subtotal, validated contracted-grain total, full campaign aggregation and commercial total. `RECONCILED` describes internal arithmetic at the approved grain; it does not certify external billing or source completeness beyond these checks. `PARTIAL`, `INVALID_GRAIN`, `UNAVAILABLE` and `NOT_VERIFIED` explain other outcomes. Bounded detail tables do not determine headline totals.

Attribution aggregates each population before its FULL OUTER JOIN. Missing keys do not match each other. Full-population matched spend, unmatched spend, matched percentage and matching/marketing-only/operations-only key counts are computed before the 250-row detail limit. Ambiguous operational keys withhold attribution. The joined snapshot rechecks spend integrity. Operational vendor, grade, medium, agent and CLI filters cannot silently retain a broad marketing numerator. Source and campaign filters propagate only through explicitly configured equivalent keys. Channel/adset outcome ratios remain unavailable without operational equivalents.

Commercial's six outcome-cost metrics use matched spend and the matching fetched/delivered/dialled/RPC/sale/activation population. Revenue/spend uses matched revenue and matched spend. Platform CPL uses platform lead events; ledger CPL uses fetched leads. Telephony, commissions, overhead, net profit, margin, break-even and vendor profitability remain outside the approved contracts.

## Domain changes

| Existing surface | Added or strengthened evidence |
| --- | --- |
| Overview | Matched-period lifecycle counts/rates, explicit rate-point versus count changes, expanded backlog thresholds and fulfilment ageing; commercial panel shares the canonical Commercial endpoint and its trust gates. Missing revenue remains unavailable. |
| Funnel | Per-lead capture/delivery/dial/RPC/sale/activation transitions, intersection-based conversion and loss, non-nested event warning, largest absolute leakage and largest measured deterioration; vendor/source/grade/hour/day segmentation, prior values and reconciled change contributions. |
| Speed to lead | P95 alongside median/P75/P90, full requested capture-to-first-dial cohorts through 24h+, Undialled and invalid evidence, SLA/backlog diagnostics. Outcomes by age are labelled descriptive associations. |
| Contact strategy | Exclusive 0/1/2/3/4/5+ recorded-call cohorts plus Unrecorded, outcome rates, one-call/zero-call/high-attempt leakage, bucket outcome contributions. Incremental attempt-level causality and stop recommendations remain unavailable. |
| Vendor quality | Lifecycle segmentation, current/prior values, selectable explicit metric sorting, SLA/call/disposition controls and reconciled rate-contribution tables; exclusive vendor assignment is clearly distinguished from overlapping vendor activity. |
| Time & day | Tenant-local capture, delivery and first-dial bases; hour/day and 168-cell heatmap, weekday/weekend rollups and operating-window comparisons; missing event timestamps are stated. |
| Sales & activation | Revenue evidence, time-to-sale and sale-to-activation medians, 0–3/4–7/8–14/15–30/30+ day outstanding activation bands; vendor/source/grade outcomes and revenue ratios. Unsupported maturation is withheld. |
| Commercial | Spend audit, full marketing metrics, coverage, six matched outcome costs, revenue ratios and CSV containing scope/validation metadata. No profitability model added. |
| Campaigns | Reconciliation and grain diagnostics, complete headline totals independent of bounded detail, channel/campaign/adset scope and matched prior media comparisons. Reach is labelled summed platform reach, not cross-row unique audience. |
| Agent activity | Exact approved agent filter, day/hour activity from tenant-local call dates, vendor scope, field completeness and explicit unavailable scoring/campaign evidence. Duration means recorded call duration; a separate talk-time or after-call-work handle-time measure is not inferred. |
| Caller ID | Calls per sale, live daily trends and matched-period change where the bounded dated series is complete, hour and disposition breakdowns, directly deduplicated scope lead counts and sold-RPC conversion. Missing duration evidence remains unavailable. Imported snapshots do not claim a complete historical comparison population. |
| Exceptions | Dedicated aggregate endpoint with shared predicates for count and Lead Explorer drill, matched cohort count change, affected vendors/sources, all requested supported action populations and administrative record links. Exception types overlap and must not be summed. Backlog and ageing comparisons are present-day snapshots of each capture cohort, not reconstructed historical queue states. |
| Lead Explorer | Factual drill populations, zero/missing evidence preserved and undated ledger RPC evidence without fabricated timestamps. The timeline includes up to 200 matching ledger vendor histories, labels any truncation and presents warehouse-normalized UTC timestamps. No call-table lookup is made while the approved unique ledger-to-dialler ID mapping is absent; individual call history is explicitly `CONTRACT_REQUIRED`. |
| Data integrity | Physical lead-row grain checks, missing fields, sentinel and invalid timing evidence, source row counts/freshness and marketing spend-grain diagnostics. No arbitrary health score. |
| Insights | Deterministic summaries from measured exception and change outputs, with metric-path/value citations; generative numerical claims and recommendations remain disabled. |
| Routing / Cohorts | Scoped aggregate exports and null-safe rate/currency display on these retained analytical surfaces. |

## Comparison and decomposition

`contracts/periodComparison.ts` defines inclusive calendar windows and the immediately preceding equal-length window, including day, seven-day, month-selection and custom periods up to 366 days. A 30-day September selection compares to the preceding 30 days; it does not silently compare with a 31-day month. Comparisons are unavailable without both dates or a valid bounded window.

Counts/currency report absolute and relative change. Rates report percentage-point change. A zero prior denominator does not generate infinity or a fabricated percentage change. Lead capture filters and temporal classification use the tenant's timezone.

Lifecycle current/prior rows and all exclusive segment dimensions are collected together. Transition rates use actual intersections of adjacent stages so downstream events without upstream evidence cannot fabricate conversions. Contribution to rate change is `current segment numerator / current total denominator - prior segment numerator / prior total denominator`, multiplied by 100. Every supported exclusive dimension is reconciled separately; dimensions are not additive to one another. No segment is dropped to make a top-N total appear reconciled. Cohorts have different follow-up maturity and the UI states that limitation.

## Lineage, exports and efficiency

Operational API responses include source table, population, grain, numerator, denominator, date basis, filter compatibility, null meaning and validation metadata. Existing headers offer a metric-definition drawer. Aggregate exports embed tenant, dates, filters, validation, date basis, definitions and truncation; formula-like text is escaped. Record exports keep their administrator restrictions.

Aggregate report responses redact record-level samples for viewers, including unmatched routing samples. Administrator record endpoints and timelines remain separately protected. Shared tenant sources fail closed when approved vendor ownership mappings are absent.

CLI CSV imports reject missing or malformed mandatory call/RPC/sale counts, malformed optional numeric values and impossible distinct-lead or duration-subset counts. Invalid imports do not return a partial successful record set or clamp values into plausible counts. Blank optional fields remain unavailable; recorded zeroes remain zero, including zero-call rows whose rates are unavailable. A rounded source-reported average duration is not multiplied into a purported exact total duration.

Pages remain lazy loaded. Existing frontend request deduplication and caches are retained. Schema introspection has contract-sensitive caching and single-flight behavior. Shared lifecycle aggregation uses pending-only deduplication; it does not add a second retained cache that can make old evidence appear fresh. Commercial returns attribution in the same API payload so its page no longer issues a duplicate attribution request. Summary and detail limits are reported explicitly.

## Validation scope

The deterministic spend acceptance fixture contains R100 and R200 on September 1 and R150 on September 2: total R450. Adding the duplicate September 1 / Campaign A / Adset 1 R100 row must produce `INVALID_GRAIN` and an unavailable total, never R550. Joining three operational leads to a R100 marketing row retains R100. Tests separately cover matched/unmatched keys, filter propagation, source selection, null/zero spend, missing grain, unsupported scopes, cost formulas, matched periods, contribution reconciliation, queue drill parity, factual bounded ledger timelines and rejection of malformed CLI imports. HTTP regression coverage verifies viewer access to aggregate exceptions, administrator-only record/timeline access, unauthorized tenant rejection and unsupported-filter rejection before warehouse queries.

Regression tests inspect submitted production SQL and test the response mapping with independent fixture oracles. They do not execute that SQL in BigQuery. Browser QA uses the actual frontend with temporary external-to-repository authentication fixtures and intercepted synthetic APIs. It tests desktop/mobile rendering, unavailable/error/empty states, metric definitions, export metadata, and record drill/timeline interaction. No production authentication bypass or synthetic dataset is introduced into live application code.

Repository gates: `npm run lint`, `npm test`, `npm run docs:surfaces:check`, `npm run build`, and `npm run verify`. CI additionally runs the dedicated Firestore emulator suite and dependency audit.

All five local gates passed for this implementation: 253 test cases, 252 passed, zero failed, and the Firestore-emulator case skipped in the ordinary test command because it runs in the dedicated CI step. The expansion adds 48 cases relative to the initial main baseline. Browser QA passed 103 checks across 21 existing routes at desktop 1440×1000 and mobile 390×844, including held loading, empty/error states, aggregate CSV metadata, definitions, exact exception navigation, undated RPC, invalid-grain withholding and recorded zero spend. These browser results use synthetic intercepted responses and do not establish live warehouse execution or production IAP acceptance.

## Remaining source-owner decisions

1. Confirm the actual observed-spend column, unit, data types and declared spend grain in the live marketing table. Use the configured admin discovery and source-check tools in an authorized environment.
2. Approve exact tenant marketing client-name mappings and equivalent source/campaign attribution keys. Channel/adset/vendor economic allocations require additional contracts.
3. Confirm unique call-event to lead linkage, event timestamp semantics and completeness before showing individual call histories or attempt-specific incremental yield.
4. Confirm revenue completeness and deduplication semantics, and any separately required revenue/cost contracts. Recorded revenue is source evidence, not certified collections or profit.
5. Approve source freshness SLAs, scoring or decision models before introducing operational thresholds beyond the explicitly requested diagnostic bands.
6. Versioned evidence reporting continues to require an independently approved published release and executor. This expansion preserves its explicit unavailable state; it does not invent a release or bypass that trust boundary.

## Optimization follow-up

The follow-up reduces submitted work while preserving the analytical scope and trust gates:

- Overview and Vendor each submit one composed warehouse query rather than separate dashboard and lifecycle queries. Current-cohort raw rows are selected before lead normalization, retaining the prior behavior for repeated IDs across periods. Vendor activity still uses lead/vendor grain.
- Commercial's fully configured matched-period regression submits five analytical queries rather than seven, excluding schema discovery. Attribution validates raw grain/completeness, grouped campaign spend and joined totals in one snapshot. Internal Campaign summary callers omit unused detail arrays and budget calculations. Commercial uses a small current-cohort totals query without Overview's trends, quantiles or backlog calculations.
- CLI exports use only the selected reporting dates and roster aggregation. A seven-day fixture now uses seven rather than fourteen days, with one aggregate branch over scoped calls rather than five. Dashboard comparisons remain available in the normal report path.
- Concurrent matching Exceptions/Insights reads share pending work, then discard it on completion or failure. Tenant configuration and ambient analytics scope participate in pending-work identities. Subsequent requests remain fresh, and failed work can be retried.
- The duplicated `lifecycle.contributions` alias is removed; the complete sale-rate decomposition remains at `lifecycle.rateContributions.saleRate`. A representative fixture falls from 17,933 to 16,147 JSON bytes (10.0%). This is an internal response-shape change delivered with its frontend consumer.
- Lifecycle tables render 25 rows per page, support segment search and retain full-scope comparisons and contributions. CSV generation is deferred until export and includes all current segments, with an explicit label and scope metadata. Pagination does not truncate the underlying evidence.
- Metric definitions load only when requested; an optional chunk failure remains local to the control. Overview starts its independent Commercial request alongside its operational request, shares the Commercial page's freshness key, and refreshes both populations from the Refresh control.

Fourteen new regression cases cover query counts, compact responses, export equivalence, scope separation, pending-work retry, current-cohort normalization and payload reconciliation. The complete suite now has 267 cases: 266 pass and the dedicated Firestore-emulator case is skipped in the ordinary command. These measurements establish submitted queries, SQL scope and rendered/payload work; live BigQuery latency and billed bytes remain unmeasured. Reusing a CTE does not guarantee that BigQuery will materialize it or scan its source once.

Eighteen targeted browser checks passed at 1440×1000 and 390×844 using synthetic responses. At 500 source segments, the three lifecycle tables went from 1,500 rendered rows / 16,000 cells to 75 rows / 800 cells (95% fewer); total page DOM nodes fell from 18,265 to 1,661. Tests exercised later pages, segment search, empty search, sorting, complete 500-row CSV export after search, deferred definitions and an intentionally failed drawer import. They also verified concurrent Overview/Commercial requests, refreshing Commercial from Overview, and fresh cache reuse when navigating to Commercial.
