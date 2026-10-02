# CX3 numerical accuracy and evidence audit

Audit date: 2 October 2026. Fetched baseline: `fca6150b83c4c9e9f00a41cabe1104ea9bd7ae38` on `main`.
Definition registry: `cx.metric.3.0.0`. Lifecycle policy: `cx.lifecycle.3.0.0`.

This document records tested formula/query behavior and remaining evidence boundaries. It does **not** certify all displayed numbers or current warehouse totals. Earlier versions' inventory percentages and blanket “verified”/“SUPPORTED” claims are superseded: they did not establish production reconciliation or source-owner approval.

## Evidence states

These are separate states, not a single approval ladder:

| State | Meaning |
| --- | --- |
| `CODE_VERIFIED` | Relevant formula, compiler, service or rendering behavior has an executed passing regression test. This does not execute GoogleSQL against production. |
| `SOURCE_STRUCTURALLY_MAPPED` | The recorded schema/source contract supplies the required field. This does not prove current access or business meaning. |
| `BUSINESS_MEANING_NOT_VERIFIED` | A source/business owner has not certified the business interpretation. |
| `LIVE_RECONCILIATION_PENDING` | No live reconciliation was executed for the requested production scope. |
| `RECONCILED_FOR_SCOPE` | An opt-in run compared the listed independent warehouse measurements with service measurements for an explicit tenant/date/filter scope. It certifies neither other metrics nor other scopes. |
| `UNAVAILABLE` | Required evidence, identity, source access, numerator or denominator is absent or incomplete. |

Metric mapping status `APPROVED` remains distinct from source-contract and reconciliation status. API validation stays `NOT_VERIFIED`; Data Confidence remains `overallHealthScore = null`, `healthGrade = NOT_VERIFIED`.

## Canonical population and final definitions

All maintained operational services select the tenant's configured source, capture-date period, timezone and supported filters **before** normalizing to one row per non-null lead ID. Vendor filters restrict nested vendor evidence as well as lead membership. Earliest valid event timestamps are retained; cumulative calls use the maximum non-negative recorded counter. No source fallback or identity bridge is introduced.

| Metric | Numerator / definition | Denominator / grain |
| --- | --- | --- |
| Fetched | Distinct lead IDs selected by intake/capture timestamp | One lead per selected cohort |
| Source-recorded delivery | Valid normalized delivery timestamp exists | Independent recorded evidence |
| Delivered | Recorded delivery at or after capture; required predecessor available | Qualified distinct lead |
| Source-recorded first dial | Valid normalized first-call timestamp exists | Independent recorded evidence |
| Dialled | Qualified delivery plus first dial at or after both capture and delivery | Qualified distinct lead |
| RPC | Qualified dialled lead with positive recorded RPC evidence | Distinct lead; unknown RPC remains unknown |
| Recorded sales | Valid normalized `hlc.sale` timestamp exists | Independent distinct lead; no inferred RPC |
| Recorded activation | Valid normalized `hlc.activated` timestamp exists | Independent distinct lead; no inferred sale |
| Delivery rate | Qualified delivered | Fetched |
| Dial coverage | Qualified dialled | Qualified delivered |
| RPC rate | Qualified dialled with positive RPC | Qualified dialled, including separately disclosed unknown RPC evidence |
| Lead-to-sale | Recorded sales | Fetched |
| Activation / sale | Recorded activations | Recorded sales; **independent population ratio**, potentially above 100% |
| Sale → activation conversion | Recorded sale at/after capture and activation at/after that sale | Recorded sales; chronological intersection |
| RPC → sale conversion | Qualified RPC and recorded sale at/after capture and first dial | Qualified RPC; chronological intersection |
| One-call share | Qualified dialled leads with recorded count exactly one | Qualified dialled, including separately exposed unrecorded-call population |
| Multi-call share | Qualified dialled leads with recorded count at least two | Qualified dialled, including separately exposed unrecorded-call population |
| 5+ calls, no RPC | Recorded count at least five and RPC **explicitly false** | Independent exception count; unknown RPC excluded |

Recorded sale means a valid sale timestamp exists in the selected source. CX3 does not infer billing, collection, underwriting or commercial completion from this field. Recorded activation does not establish collection, recurring-contract status or successful billing. `is_sale` and `is_activated` retain those recorded populations even when chronology is anomalous.

A valid source timestamp means blank/malformed/1900/1970 values were rejected with `validTimestampSql`. Chronological qualification is separate from timestamp parsing. Missing predecessors do not invent validity. Invalid recorded events remain visible in record evidence and chronology flags. Earliest recorded evidence is assessed rather than replacing an anomalous first event with a later convenient event.

## Source → query → API → UI audit matrix

The code states below are supported by targeted tests and the verification record in `IMPLEMENTATION-STATUS.md`; live reconciliation remains pending for every production tenant/date/filter scope in this change.

| Surface / contract | Source and query path | Accuracy behavior / limits | Evidence state |
| --- | --- | --- | --- |
| Overview, Journey, Response Speed, Vendor Quality | Configured lead source → `common/leadMetrics.ts` → domain services → maintained pages/inspectors | Qualified delivery/dial/RPC; recorded sales/activation; unchanged approved rate denominators. Matched-period mechanics and representative-vendor rules retained. | `CODE_VERIFIED`; structurally mapped; live pending |
| Time & Day | Same canonical CTE → `temporal/service.ts` → `TemporalIntelligence` | Undefined `operational_leads` reference repaired. Capture, Delivery and First dial group the **same capture cohort** by their respective recorded timestamp. Missing timestamp counts, unknown RPC and cohort volume remain explicit. Tenant timezone used consistently. | `CODE_VERIFIED`; live pending |
| Attempt Coverage / Contact Governance | Canonical counter → `contact/operatingControls.ts`, `contact/strategy.ts` → control panels/export | `NULL`/invalid negative → Unrecorded; recorded 0 → Zero calls; repeated counters use MAX. Explicit no-RPC required for 5+ exception. No reconstruction of missing dial denominator or no-RPC count from other totals. | `CODE_VERIFIED`; live pending |
| Funnel / Investigation | `lifecycleDiagnostics.ts` intersections and shared `exceptionPredicates.ts` | Delivery→dial and sale→activation require chronology. `NON_NESTED` retains independently recorded populations. Queue, drill, driver and evidence use shared predicates; waiting means no **qualified** first dial. | `CODE_VERIFIED`; live pending |
| Data Confidence / dossier | Canonical lead state plus source-quality observations | Separate delivery-before-capture, dial-before-capture, dial-before-delivery, sale-before-capture and activation-before-sale counts. Combined anomaly count deduplicates leads; separate counts may overlap. Raw recorded dates and qualification retained. | `CODE_VERIFIED`; no invented health score |
| Source-recorded revenue | HLC lead/vendor/transaction keys → canonical NUMERIC assessment | Identical amount+currency duplicates collapse once. Missing identity/currency/amount, wrong currency or conflicting values withhold complete total. Known subtotal is separate. An incomplete key cannot become zero. | `CODE_VERIFIED`; business meaning and live totals unverified |
| Marketing / media spend | Approved field candidates and configured marketing tenant mapping | Budget remains planning evidence. No approved observed-spend field → spend/CPC/CPM/spend-dependent CPL unavailable. Missing or duplicate spend-grain evidence fails closed. | `CODE_VERIFIED`; mapping/access dependent |
| Commercial | `commercial/spend.ts` and approved recorded components | Telephony/agent/delivery costs, commission, fixed overhead, contribution, profit, margin and break-even withheld without contracts. Revenue less media spend is not profit. | `UNAVAILABLE` for unsupported components |
| Agent performance | Discrete call-event source → `agents/activity.ts` | Event grain, tenant vendor restrictions, field completeness and same-call sale/RPC preserved. No invented tiers. | `CODE_VERIFIED`; live pending |
| Source inventory | Runtime/source catalogue → `DataIntakePanel` | Missing inventory cannot substitute 65 objects, 18 tables or 47 views; prior-tenant evidence cleared when scope changes. | `CODE_VERIFIED`; catalogue is not a source-access certification |
| Historical synthetic executive console | No remaining runtime importer | Deleted `src/components/analytics/ExecutiveAnalyticsConsole.tsx` and `src/pages/ExecutiveOverview.tsx`; synthetic shares, hourly profiles, benchmarks, lift and revenue assumptions retired. Maintained Overview unchanged by those historical assumptions. | Retired |

Time & Day describes **observed association by recorded event timestamp, not causal calling recommendation**. A delivery/dial timestamp outside the capture dates remains an observation on the selected intake cohort; selecting a time basis does not select a new event-date cohort. No event timestamp is substituted from another lifecycle field.

## Retired duplicate code and legacy financial paths

Beyond the two synthetic executive files, consumer searches found no runtime use of
`server/queries.ts` or these duplicate modules under `server/bigquery/legacy/`:
`calls.ts`, `funnel.ts`, `index.ts`, `leads.ts`, `overview.ts`, `quality.ts`,
`routing.ts`, `sources.ts`. They were retired; the tested `cohorts.ts` and `types.ts`
remain, and the live cohort service now uses that corrected implementation.

Active legacy query and Explore outputs now preserve incomplete monetary totals,
unknown call/duration evidence and empty denominators. Historical revenue-by-call-age
projections remain unavailable because first-call time does not establish revenue
recognition. Legacy transaction revenue requires actual HLC amount/currency/key
eligibility; expected activation-register revenue cannot fill a missing recorded
amount. Explicit eligible duplicate NULL contributions are excluded from completeness
checks without excluding incomplete or conflicting keys. These protections do not
certify the older model's unrelated source identity bridges or business semantics.

The live lifecycle waterfall now renders each supplied transition's parent population,
qualified intersection, rate and loss. It does not compute adjacent-stage subtraction,
end-to-end conversion or total fall-off from non-nested populations.

## Revenue, financial precision and exports

The canonical complete-total expression remains `CASE WHEN COUNTIF(revenue IS NULL) > 0 THEN NULL ELSE SUM(revenue) END`. A measured zero is zero; a missing complete total remains null. SUM over an empty population may remain unavailable rather than asserting a financial observation.

The flat-source adapter now casts source revenue to BigQuery `NUMERIC`, avoiding an unnecessary FLOAT64 conversion before key/currency reconciliation. Existing approximate physical FLOAT64 values cannot be made exact by a later cast; the supplied MTN, Mondo and RealPromotions dictionaries already declare FLOAT64 source revenue. Canonical financial arithmetic occurs in BigQuery before presentation conversion.

Legacy operational API fields may still use JavaScript `Number` for chart/display compatibility. Binary floating point cannot represent every decimal fraction; integers beyond `2^53 - 1` cannot be represented safely, and cent precision is not guaranteed for sufficiently large amounts. These presentation values are not exact financial reconciliation artifacts. No decimal-library migration was undertaken. The reconciliation harness returns COUNT/NUMERIC results as decimal strings and refuses service-count comparisons outside the safe-integer range. Exact audit/export work should use those strings or the existing decimal-string warehouse reporting path.

Inspectors reuse the existing metric registry/audit architecture for definition, numerator, denominator, grain, date basis, source and validation. Export metadata retains supplied workspace/client, dates, filters, date basis, grain, definition version, validation, truncation and generation time. Missing metadata stays explicit; an approved mapping does not manufacture reconciliation. Operating-control export evidence distinguishes zero-call, unrecorded-call and dialled-unrecorded populations. Modelled values are not presented as observed evidence.

## Numeric fallback review classifications

A review scan found 646 initial matching source lines and 441 after the shared hardening edits at that checkpoint; these are syntactic hits, not defect counts. Searches covered production `src`, `server`, and `contracts`, including `?? number`, `|| number`, `Number(value || 0)`, SQL `COALESCE`/`IFNULL`, fixed percentages, revenue assumptions, rankings and synthetic profiles. Each retained family has a different evidential meaning:

| Class | Examples / decision |
| --- | --- |
| Configuration | Operating hours and weekday lists; SLA thresholds; bounded query bytes; pagination limits; timeout/cache sizes. These are policy/configuration, not measured counts. Retained and labelled by their contracts. |
| UI layout constant | Chart height, grid sizes, opacity, animation duration, empty visual scaffolding and numeric axis geometry. Retained where they do not enter reported metrics. |
| Test fixture | `tests/**`, browser acceptance fixture builders and mocked warehouse responses. Retained, synthetic and isolated from production queries. |
| Explicit simulation | Isolated labelled test/demo fixtures cannot be merged into observed totals or exported as observed evidence. `getOffershopSimulation` remains explicitly `isSimulation=true` / `BASELINE_REQUIRED`, with null baseline/change/counts until evidence exists. No simulation introduced into maintained reporting. |
| Production analytical fallback | Historical executive synthetic values removed with their unmounted files; inventory 65/18/47 and CLI schema 24 fallbacks removed; operating missing calls→0 removed; Temporal/Response Speed missing dial denominator→intake removed; strategy no-RPC inferred by subtraction removed; legacy budget→spend, missing revenue “$0”, fixed A− quality score, previous=current/comparison=0 and caught-source-failure→empty-success removed. Required absent evidence now null/unavailable. |
| Proven measured zero | COUNT outputs; a missing categorical bucket after a successful complete aggregate; array lengths; zero contributions for rows outside a deliberately selected SUM population. Retained only in that context. |
| Incomplete monetary/outcome evidence | Missing revenue/spend/call/RPC/denominator/feed values are not safe zero defaults. Relevant financial completeness paths and nullable response conversions are protected by regression tests. |

A successful formula test does not certify current source rows. This review does not grant approval to unrelated historical source joins or assert that their business identities have been reconciled.

## Opt-in live reconciliation harness

Run only as an authorised operator with existing BigQuery credentials/ADC and read/query access:

```bash
npm run reconcile:metrics -- --client mtn --start 2026-09-01 --end 2026-09-30
npm run reconcile:metrics -- --client mtn --start 2026-09-01 --end 2026-09-30 --compare-service
npm run reconcile:metrics -- --client default_tenant --start 2026-09-01 --end 2026-09-30 --vendor BLC --source example --grade Gold
npm run reconcile:metrics -- --client mtn --start 2026-09-01 --end 2026-09-30 --dry-run
```

`--grade` is refused for flat tenant sources that do not supply grade. Unknown/inactive tenant, unsupported flags/filters, malformed/reversed dates and more than 366 inclusive days fail before query execution. There is no implicit default tenant. The configured `BIGQUERY_MAX_BYTES_BILLED` ceiling and single-SELECT read-only guard apply; no DDL, DML, destination table, export job or schema mutation is allowed. Normal test runs import/test the compiler with fake clients only and never invoke CLI main.

The independent query shares only source adaptation, timestamp normalization and scope/security guards. It does not import the canonical lead aggregation: it independently computes lead rollups, financial keys, lifecycle qualification, contact buckets, chronology anomalies, ratios and timing. Output contains selected source tables, tenant, timezone, dates, filters, as-of/generated time, definition/harness versions, truncation and warehouse job ID. Service query IDs are null because that API does not expose them.

Metrics include recorded/qualified delivery and dial counts, qualified RPC and unknown evidence, sales/activation, independent and linked activation ratios, all five chronology counts, unrecorded/0/1/2/3/4/5+ call buckets, explicit 5+ no RPC, revenue completeness/key/duplicate/conflict/subtotal/total evidence, approximate median/P90 delivery→dial and awaiting/over-15m/over-60m backlog.

JSON is written to stdout; optional comparison table to stderr. Service comparison checks only the listed stable count metrics and returns signed service-minus-warehouse differences. Matching those metrics once is `RECONCILED_FOR_SCOPE`; warehouse-only measurement is `WAREHOUSE_MEASURED_ONLY`; dry-run remains `LIVE_RECONCILIATION_PENDING`. Unavailable or mismatched comparisons exit nonzero. Sequential jobs may see source updates; rerun/review discrepancies rather than declaring either number correct. Approximate quantiles are labelled approximate, and financial decimal output is not compared to approximate legacy JS amounts.

**Live reconciliation not executed in this change.** No production totals, source permissions or business semantics have been newly certified.

## Remaining certification work

- Owner-approved meaning of `hlc.sale` and `hlc.activated`.
- Current tenant-specific source permissions, including historically restricted MTN views.
- Approved source identity bridges before any new cross-source join.
- All-vendor activation coverage and maturity semantics.
- Live totals for an explicit tenant/date/filter scope, with retained job evidence.
- Billing, collection and revenue certification separate from recorded source amounts.
- Marketing attribution and client mapping where unconfigured.
- Exact financial reconciliation beyond legacy presentation-number precision.

Failures remain explicit and do not fall back to the default tenant, master table or a wider vendor population.

## Completed verification record

The final `npm run verify` succeeded: **1,089 passing, 0 failing, 1 skipped,
0 cancelled** out of 1,090 repository tests, plus lint, generated-surface check and
production build. The skip requires a local Firestore emulator. Required numerical
targeted suites passed 104/104; the offline reconciliation harness suite passed
10/10 and its standalone TypeScript check passed. Browser checks passed 63 broad
scenarios and 10 focused numerical scenarios using explicitly synthetic fixtures.
These overlapping code/UI checks establish neither live production totals nor
business certification. See `IMPLEMENTATION-STATUS.md` for commands and evidence.

## Reporting and reconciliation readiness — 2 October 2026

Operational definitions and lifecycle policy above are unchanged. The separate
existing versioned reporting registry remains `cx.metrics.2.0.1`; its new executor
validates approved immutable aggregate rows against those definitions and exact
components. Values outside available source coverage remain null/PARTIAL. Exact
replay proves reproducibility only, with independent source reconciliation and
business meaning still `NOT_VERIFIED`.

Admin `/validation` prepares existing harness commands and validates imported
seven-metric comparisons for their original exact scope, grain, definition and run
time. Import provenance is `OPERATOR_SUPPLIED_UNATTESTED`; no new persistence,
production evidence or global verification promotion is introduced. See
[the contract](VERSIONED-REPORTING.md) and [verification record](CX3-MATURITY-PASS-2026-10-02.md).
