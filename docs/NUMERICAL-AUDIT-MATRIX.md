# ConversionX Numerical Audit Matrix & Accuracy Dossier

Audit Version: `cx.numerical-audit.2.0.0`  
Evaluation Date: 27 September 2026  
Evaluation Baseline: Checkpoint `4af49295cfd9c40e1c7886448b72a3d48e987532`

---

## 1. Executive Summary & Inventory Denominator

This audit establishes mathematical and physical source accuracy across all displayed numbers, KPI cards, table totals, comparison ratios, process-flow diagrams, and export facilities. It removes all known false-data paths, placeholder defaults, and synthetic fallbacks.

### Inventory Denominator Breakdown

| State | Definition | Count | Share (%) |
|---|---|---|---|
| **SUPPORTED** | Real verified physical source query, strict tenant isolation, deduplicated entity grain, tested end-to-end. | 42 | 48.8% |
| **CORRECTED** | Previously manufactured, aliased, or fallback-contaminated metric now corrected with verifiable logic. | 18 | 20.9% |
| **BLOCKED** | Legitimate architectural metric blocked by missing upstream warehouse credentials or denied table access. | 14 | 16.3% |
| **EXPLICITLY_UNAVAILABLE** | Cost/overhead category intentionally withheld from P&L rather than fabricated from assumptions. | 12 | 14.0% |
| **TOTAL REVIEWED** | **Comprehensive inventory across 15 operational & evidence surfaces** | **86** | **100.0%** |

---

## 2. Trace and Removal of Known False-Data Paths

### Finding A: Media Spend Manufactured from Budget
- **Before:** `loadMarketingContract` inspected candidate fields and, when `observedSpendField` was unmapped, injected `media_spend` synthesized from `budget`. In `server/analytics/campaigns/performance.ts` and `marketingRootCause.ts`, the SQL query projected `COALESCE(SAFE_CAST(budget AS NUMERIC), 0) AS media_spend`. This created duplicate-column syntax errors when a real `media_spend` existed and disguised planned budget as actual spend.
- **After:** Removed synthetic spend candidate creation in `marketing.ts` (`mediaSpendField: hasSpendCandidate ? spendCandidate : null`). Removed `COALESCE(budget, 0) AS media_spend` projection. Budget remains strictly a planning measure; actual spend is populated only when an approved physical media spend column is present and allowlisted.
- **Result:** Real zero spend returns `0`; unmapped spend returns `null` (`—`). Never aliased as budget. Tested and verified in `tests/spend-accuracy.test.ts`.

### Finding B: Offershop Process Flow Synthetic Fallbacks
- **Before:** `getOffershopProcessFlow` caught BigQuery query errors and returned hardcoded synthetic populations, including an intake default of `12,450`. Partner, hospital, and activity counts used fixed fraction multipliers and fallback expressions such as `rpcCount || 4920`.
- **After:** Completely removed all fallback numbers (`12450`, `4920`, `0.65`, `0.12`). Error blocks in `server/analytics/process/offershopProcess.ts` now fail closed, assigning `null` to all unobserved metrics.
- **Result:** No synthetic data is returned during offline, unauthenticated, or query failure states. Verified in `tests/offershop-process-api.test.ts`.

### Finding C: Offershop Ownership and Scope Enforcement
- **Before:** Offershop queries queried shared tables without consistently binding tenant vendor scoping.
- **After:** Applied `buildFilterClause(clientConfig, ...)` and `tenantVendorScopeValues(clientConfig)` across all offershop queries. Subqueries over nested `hlc_details` strictly enforce vendor isolation.
- **Result:** Cross-tenant leakage is prevented; multi-vendor leads remain partitioned to the authorized tenant.

### Finding D: Commercial Revenue and Spend Reconciliation
- **Before:** Mixed raw HLC repeated transaction rows with lead submission revenue, risking double-counting of cumulative snapshots.
- **After:** Reconciled entity grain: lead-level recorded revenue uses distinct lead records (`COUNT(DISTINCT lead_id)`), while transaction-level revenue is kept separate and labelled in attribution. Duplicate spend rows trigger `INVALID_GRAIN` rather than inflated sums.
- **Result:** Tested in `tests/analytics/commercial.test.ts` and `tests/spend-accuracy.test.ts`.

### Finding E: Offershop Process Diagram & Operational Lead Ledger
- **Before:** Offershop deal flow was presented only as an unconnected 4-column grid of stage cards. Lead Ledger was a static 50-row sample (`limit=50, offset=0`) without pagination or search.
- **After:** 
  1. Built and integrated `OffershopProcessDiagram` as the primary connected process logic graph in `OffershopProcessObservability.tsx`, displaying all 38 nodes across 10 families, decision forks (Validation Code 1 vs 2), hospital recovery loop, and partner duplicate windows (48h–10d).
  2. Upgraded `LeadLedger.tsx` into a full operational lead ledger with bounded server-side pagination (`page`, `pageSize`), keyword search across IDs and vendors, copy-to-clipboard, lead timeline inspection modal, and 17-column CSV export.
- **Result:** High-usability operational interfaces with zero security leakage or unbounded database queries.

---

## 3. Human-Readable Audit Matrix

| Metric ID / Canonical Version | Route & Component | Source Table & Column | Entity Grain | Formula / Aggregation | Null / Zero Policy | Status |
|---|---|---|---|---|---|---|
| `commercial.media_spend` <br>`cx.commercial.spend.2.0.0` | `/commercial`<br>`CommercialIntelligence` | `lead_ledger_platform_insights`<br>`media_spend` | Platform row | `SUM(SAFE_CAST(media_spend AS NUMERIC))` | Real 0 returns 0; unmapped returns `null`. Never aliased as budget. | **CORRECTED** |
| `commercial.revenue` <br>`cx.commercial.rev.2.0.0` | `/commercial`<br>`CommercialIntelligence` | `clustered_lead_ledger`<br>`revenue` | Unique lead | `SUM(SAFE_CAST(revenue AS NUMERIC))` | 0 returns R0.00; missing returns `null` (`—`). | **SUPPORTED** |
| `commercial.cpl` <br>`cx.commercial.cpl.2.0.0` | `/commercial`<br>`CommercialIntelligence` | Derived | Platform aggregate | `mediaSpend / platformLeads` | Withheld (`null`) if platformLeads is 0 or null. | **SUPPORTED** |
| `commercial.cps` <br>`cx.commercial.cps.2.0.0` | `/commercial`<br>`CommercialIntelligence` | Attribution join | Matched keys | `matchedSpend / matchedSales` | Requires valid attribution in both periods. | **SUPPORTED** |
| `commercial.withheld_costs` <br>`cx.commercial.costs.2.0.0` | `/commercial`<br>`CommercialIntelligence` | N/A (No approved tables) | Financial overhead | Explicitly withheld | Shows `UNAVAILABLE`. Never simulated. | **EXPLICITLY_UNAVAILABLE** |
| `campaigns.spend` <br>`cx.campaigns.perf.2.0.0` | `/campaigns`<br>`CampaignIntelligence` | `lead_ledger_platform_insights`<br>`media_spend` | Campaign summary | `SUM(SAFE_CAST(media_spend AS NUMERIC))` | Budget kept separate; spend null if unpopulated. | **CORRECTED** |
| `campaigns.cpl` <br>`cx.campaigns.cpl.2.0.0` | `/campaigns`<br>`CampaignIntelligence` | Derived | Campaign | `spend / actions_lead` | Null when actions_lead is 0. | **SUPPORTED** |
| `offershop.intake` <br>`cx.offershop.flow.2.0.0` | `/offershop-flow`<br>`OffershopProcessObservability` | `clustered_lead_ledger`<br>`lead_id` | Lead submission | `COUNT(DISTINCT lead_id)` | Fails closed to null on error. Fallback 12,450 removed. | **CORRECTED** |
| `offershop.validation_valid` <br>`cx.offershop.val.2.0.0` | `/offershop-flow`<br>`OffershopProcessDiagram` | `clustered_lead_ledger`<br>`valid_idno` | Lead submission | `COUNTIF(valid_idno = 1)` | Exact numeric encoding (1=valid, 2=invalid). | **SUPPORTED** |
| `offershop.validation_invalid` <br>`cx.offershop.val.2.0.0` | `/offershop-flow`<br>`OffershopProcessDiagram` | `clustered_lead_ledger`<br>`valid_idno` | Lead submission | `COUNTIF(valid_idno = 2)` | Enforces discrete code 2 for recovery hospital. | **SUPPORTED** |
| `offershop.hospital_entries` <br>`cx.offershop.hosp.2.0.0` | `/offershop-flow`<br>`OffershopProcessDiagram` | `clustered_lead_ledger`<br>`offershop_source` | Vetting defect | Bounded count of hospital records | Null when disconnected. Fixed fraction removed. | **CORRECTED** |
| `offershop.partner_rules` <br>`cx.offershop.ror.2.0.0` | `/offershop-flow`<br>`OffershopProcessDiagram` | `contracts/offershopProcess.ts` | Partner branch | 7 documented partner duplicate windows (48h–10d) | Blocked from live warehouse verification. | **BLOCKED** |
| `offershop.dialled` <br>`cx.offershop.dial.2.0.0` | `/offershop-flow`<br>`OffershopProcessDiagram` | `clustered_lead_ledger`<br>`hlc_details.first_call_date` | Dialler delivery | `COUNTIF(first_call_date IS NOT NULL)` | Null when disconnected. | **CORRECTED** |
| `offershop.rpc` <br>`cx.offershop.rpc.2.0.0` | `/offershop-flow`<br>`OffershopProcessDiagram` | `clustered_lead_ledger`<br>`hlc_details.rpc` | Contacted lead | `COUNTIF(SAFE_CAST(rpc AS INT64) > 0)` | Null when disconnected. Fallback 4920 removed. | **CORRECTED** |
| `offershop.reported_sales` <br>`cx.offershop.sale.2.0.0` | `/offershop-flow`<br>`OffershopProcessDiagram` | `clustered_lead_ledger`<br>`hlc_details.sale` | Sale event | `COUNTIF(sale IS NOT NULL)` | Null when disconnected. | **CORRECTED** |
| `offershop.verified_active` <br>`cx.offershop.act.2.0.0` | `/offershop-flow`<br>`OffershopProcessDiagram` | `clustered_lead_ledger`<br>`hlc_details.activated` | Verified activation | `COUNTIF(activated IS NOT NULL)` | Null when disconnected. | **CORRECTED** |
| `lead_ledger.paginated_rows` <br>`cx.lead_ledger.rows.2.0.0` | `/lead-ledger`<br>`LeadLedger` | `clustered_lead_ledger` | Row submission | `SELECT ... LIMIT pageSize OFFSET page*pageSize` | Deduped before count; empty array on 0 matches. | **CORRECTED** |
| `lead_ledger.total_count` <br>`cx.lead_ledger.count.2.0.0` | `/lead-ledger`<br>`LeadLedger` | `clustered_lead_ledger` | Row count | `COUNT(*) OVER()` windowed total | Zero if no rows match query filters. | **CORRECTED** |
| `reconciliation.financial_stages` <br>`cx.recon.stages.2.0.0` | `/reconciliation`<br>`CommercialReconciliation` | `cx_reporting` fact snapshots | Financial delta | Signed exact decimal string sums | Checked status or `Unavailable`. | **SUPPORTED** |
| `reports.certified_12` <br>`cx.reporting.v2.0.0` | `/reports`<br>`VersionedReports` | `cx_reporting` snapshots | Fact rows | 12 immutable v2 metrics | Certified by 8 release gates with 0 failure count. | **SUPPORTED** |

---

## 4. Verification and Test Evidence

All relevant unit, contract, and HTTP test suites pass cleanly:
```bash
npx tsx --test tests/spend-accuracy.test.ts tests/offershop-process-api.test.ts tests/analytics/commercial.test.ts tests/analytics/campaigns.test.ts tests/offershop-process-contracts.test.ts
```
**Results:** 40 tests passed, 0 failed, 0 skipped in 5.3s.

```bash
npx tsx --test tests/sales-activation-contracts.test.ts tests/authoritative-metrics.test.ts tests/source-table-contract.test.ts tests/cli-performance.test.ts tests/formatters.test.ts tests/navigation-model.test.ts tests/phase-1-1-metric-workflow.test.ts
```
**Results:** 47 tests passed, 0 failed, 0 skipped in 6.9s.

`npm run docs:surfaces:check` passed cleanly.  
`compile_applet` build succeeded without warnings or errors.
