# Marketing spend, attribution and reconciliation contracts

CX3 measures observed media spend independently of operational lead rows. Budget, planned budget, daily/lifetime budget and estimated cost are never substitutes for observed spend. Spend is unavailable until source, tenant mapping, grain, amount completeness and reconciliation checks pass.

## Configured source versus live evidence

The approved repository contract points to `dashboards-422710.lead_ledger.lead_ledger_platform_insights`. Its declared grain is:

`date × client_name × channel × Channel_Campaign_Name × channel_adset_name`

The reporting date is `date`; operational funnel outcomes use the tenant-local `fetched` capture cohort. These are different date bases and must be read as an observed period association.

The existing contract allowlists `spend`, `amount_spent`, `actual_spend`, `media_spend`, `ad_spend`, `total_spend`, `cost`, `cost_micros` and `spend_micros`. Runtime schema inspection must find exactly one approved candidate with an explicit unit. The last two use micros; the others use currency. A field's name alone does not create approval: only the server contract's allowlist supplies the approved candidates. Multiple candidates now fail closed instead of selecting one by array order. The exact runtime field is exposed as `spendSource.column` and the table as `spendSource.table`.

When a source contains multiple approved candidates, the owner must designate the observed field using an already allowlisted name:

```bash
CX_MARKETING_SPEND_FIELD_JSON='{"mtn":"spend"}'
```

This selection cannot approve a new arbitrary column or budget field. Unknown field names fail deployment configuration validation. New fields or different units require a reviewed server contract change. Spend uses BigQuery `NUMERIC` and strict numeric conversion; malformed text becomes missing evidence rather than being stripped into a plausible number. Micros are divided by 1,000,000 before aggregation.

Repository fixtures validate code and SQL construction. They do **not** establish which columns or values exist in the live warehouse, independently verify invoices, or certify live spend. Until authenticated warehouse checks run, live source/field/grain evidence remains `NOT_VERIFIED`.

## Tenant ownership

Non-master tenants require exact approved `client_name` values. The repository includes existing approved tenant mappings; `CX_MARKETING_CLIENT_MAP_JSON` can override them:

```bash
CX_MARKETING_CLIENT_MAP_JSON='{"mtn":["<exact approved client_name>"]}'
```

An empty override leaves the tenant unresolved. Display-name similarity does not establish ownership. The master scope remains explicitly all-client. Parameterized tenant predicates apply to the marketing summary, details, prior period, integrity and attribution populations.

## Spend audit and totals

The Campaigns query constructs one selected marketing population and calculates:

1. Marketing row count, distinct contracted-grain count and duplicate excess rows.
2. Incomplete grain-key rows and missing/invalid spend rows.
3. Raw observed amount, directly summed from selected marketing rows.
4. A separate full campaign/channel/adset aggregation summed back to the same total.

`rawObservedSpend` is diagnostic: if duplicate or missing records exist it is **not** trustworthy total spend. `contractedGrainSpend` is available only for a unique, complete grain with complete observed amounts. The full campaign aggregation must reconcile to this amount before `commercialTotalSpend` is returned. The summary uses the entire population; the 250-row detail limit never affects it. Bounded campaign details come from the same query snapshot as grain validation and totals, so rows arriving between separate validation/detail queries cannot escape the guard. Campaign details report their displayed/full group count and whether they are truncated.

Reconciliation states:

- `RECONCILED`: within-query raw, valid contracted-grain and full campaign totals match. This checks arithmetic, not external billing or causal attribution.
- `PARTIAL`: some spend is missing/invalid, or the independently grouped sum differs; total and cost ratios are withheld.
- `INVALID_GRAIN`: duplicate or incomplete grain keys; total and cost ratios are withheld. CX3 never guesses how to deduplicate conflicting records.
- `UNAVAILABLE`: no approved field or no observed marketing rows.
- `NOT_VERIFIED`: a required reconciliation result is unavailable.

The Commercial and Overview UI use the same canonical commercial endpoint and show its spend value, source and reconciliation. Data Integrity runs a lightweight selected-scope grain audit. Schema discovery is cached for five minutes with a contract fingerprint and single-flight protection.

## Null, zero and platform metrics

A fully observed zero spend is `0`, displayed as `R 0`. No marketing rows, missing spend, malformed spend, a duplicate grain, or an unreconciled total produces unavailable spend, not zero. One missing spend row withholds the entire selected total; `SUM` silently ignoring nulls is insufficient evidence of total spend.

CPC is spend/clicks; CPM is spend/impressions × 1,000; Platform CPL is spend/platform lead events. A zero or unavailable denominator yields unavailable. A measured zero numerator with a positive valid denominator yields zero. CTR is unavailable for zero impressions. Missing, malformed or negative clicks/impressions/platform leads withhold the affected population total and ratios; null counts are validated on both complete scope and each detail group. A partially observed denominator must not inflate CPC/CPL/CPM. Configured-but-missing outbound clicks remain unavailable instead of silently changing the click-to-lead denominator. Platform leads (`actions_lead`) remain distinct from warehouse fetched leads.

Reported reach across dates/adsets is a **sum of row-level reach**, not unique period audience: audience overlap is not deduplicated. Frequency derived from that sum must be interpreted accordingly.

Budget may appear as the latest planning observation. It never supplies spend or commercial costs.

## Attribution contract and coverage

Attribution is off by default. Activate only after the source owner approves equivalent keys:

```bash
CX_MARKETING_ATTRIBUTION_JSON='{
  "mtn": {
    "marketingSourceField":"<approved source field>",
    "leadSourceField":"offershop_source",
    "marketingCampaignField":"<optional approved campaign field>",
    "leadCampaignField":"<optional equivalent lead campaign field>"
  }
}'
```

Both campaign fields must be supplied together and are validated identifiers. When configured, the key is the source/campaign tuple. Otherwise it is the source key. Keys are trimmed and lowercased under this explicit contract. Missing/blank keys never match each other. An operational lead with multiple keys fails closed.

Marketing spend is grouped by approved key independently. Operational leads are reduced to their lead ID before key aggregation. Only then are the two aggregates joined. Three leads matching an `R100` marketing row therefore leave marketing spend at `R100`, never `R300`. Both the validation query and the joined query snapshot check marketing grain/completeness; changes between them cannot authorize costs from an invalid joined snapshot.

The query computes full-scope total observed spend, matched spend, unmatched marketing spend, matched percentage and matched/marketing-only/operations-only key counts **before** bounding the detail array at 250 keys. It reconciles matched + unmatched spend to the independent marketing total. Detail truncation is explicitly disclosed.

Funnel economics use matched spend and outcomes from matching keys only:

- Spend/fetched, delivered, dialled, RPC, sale and activation.
- Matched recorded revenue and revenue/spend.

Without a valid approved attribution contract these are unavailable. Legacy API `blendedCost...` fields retain their names for compatibility but now obey this matched-population gate; period-wide unallocated media spend is no longer divided by unrelated operational leads. Operational revenue and revenue/fetched, sale and activation remain separate measured capture-cohort values where their own filters are valid.

`OBSERVED_UNRECONCILED` / `NOT_VERIFIED` labels retain the boundary between observed configured-key arithmetic and independently verified business attribution. Coverage may be `PARTIAL` even when total marketing spend is arithmetically reconciled.

## Filter compatibility

| Dimension | Marketing | Operations / cross-source behavior |
| --- | --- | --- |
| Client | Exact approved tenant values | Approved isolated tenant source / ownership predicate |
| Date | Reporting date | Tenant-local capture cohort; date bases are disclosed |
| Campaign | Approved campaign column | Only through an explicitly configured equivalent campaign key |
| Channel / adset | Approved marketing columns | Withheld without equivalent operational mappings |
| Source | Attribution endpoint with an active source-key contract | Same approved source key on both populations |
| Vendor / grade / medium / agent / CLI | Unsupported | Operational only; marketing and cross-source costs are withheld |

Campaign details cannot receive source-level funnel values replicated over every adset. Channel/adset funnel counts remain unavailable until the corresponding operational dimensions have approved equivalence. Commercial recorded revenue is withheld under marketing-only campaign/channel/adset filters rather than showing an unfiltered operational total.

## Matched periods, investigation and exports

Campaigns use the shared equal-length immediately preceding period contract, up to 366 calendar days. Current and previous spend each have a complete independent grain and reconciliation audit. Invalid grain withholds the comparison. Empty/missing prior spend is not a zero baseline; percentage change from zero is unavailable. CTR change uses percentage points, while count/currency changes include absolute and percentage differences.

Media root-cause queries preserve campaign/channel/adset scope and independently audit their own fresh query snapshot for current/prior grain and requested numerator/denominator completeness. Invalid evidence withholds drivers. Commercial/Overview expose spend and Platform CPL changes; operational CPS/fetched/sales changes require valid approved attribution in both equal-length periods, and query prior attribution only when current attribution is available. Segment deltas are deterministic observations, not additive causal contribution scores. Campaign and attribution CSV exports include client, dates, filters, date basis, metric definitions, validation and detail truncation. Record exports remain governed separately by admin access.

The admin-only discovery endpoint remains `GET /api/analytics/offernet/marketing-discovery?clientId=<tenant>`. It reports schema, source contract, approved/resolved columns and observed tenant values; it does not mutate tenant mappings.

## Automated acceptance and remaining approval

`tests/spend-accuracy.test.ts` includes deterministic acceptance for `R100 + R200 + R150 = R450`, duplicate `R100` producing `INVALID_GRAIN` rather than `R550`, and three leads preserving `R100` spend. It also covers full coverage beyond 250 keys, scope binding, unsupported filters, null/zero semantics, CPC/CPM/CPL, sale/activation costs, ambiguous fields, explicit units and source selection. Mocked warehouse fixtures and SQL-boundary checks are clearly distinguished from live BigQuery execution.

Telephony, agent/delivery cost, commissions, overhead, contribution, margin, break-even and vendor profitability remain unavailable pending approved incurred-cost contracts. Exact live spend column selection, finer-grain exceptions and cross-source key equivalence still require source-owner evidence; no fixtures or UI status manufacture that evidence.
