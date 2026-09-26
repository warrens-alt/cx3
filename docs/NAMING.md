# ConversionX naming and metric definitions

Naming version: `cx.naming.1.0.0`. Versioned-report metric definition: `cx.metrics.2.0.1`.

`contracts/naming.ts` owns page names, report labels and legacy display vocabulary. `contracts/legacyMetrics.ts` owns the existing dynamic metric expressions and matching human definitions. Frontend/backend metric and journey-reference imports now share these contracts rather than maintaining divergent copies. Machine identifiers, source columns, vendor values and existing API metric IDs are retained.

## Units must be visible

- **Fetched Leads** counts lead submissions, not distinct people.
- **Lead Deliveries** counts successful vendor delivery episodes. This is not a distinct-lead count and is not proof of queue acceptance.
- **Call Attempts** counts observed dialler events in v2. **Recorded Call Attempts** in legacy screens means joined source counters, explicitly unverified.
- **Dialled Lead Deliveries** counts delivered episodes with a subsequent observed call. **Dialled Leads** is the separate legacy lead-level count.
- **Sales (Recorded Events)** and **Activations (Recorded Events)** are event counts. Legacy **Leads with Sales** and **Leads with Activations** are lead flags. Neither is a consumer count.
- **Sale Flags (Transaction Rows)** is a third population used by legacy vendor/outcome breakdowns, not interchangeable with leads or events.
- **Leads with Sales and Recorded Revenue** describes the legacy positive-revenue proxy. It must not be called Delivered Sales, approved billable sales, Premium Collections or cash received.

## Rates state both populations

V2 Delivery-to-Dial Rate = delivered episodes with a subsequent call / successful delivery episodes × 100. V2 Sale-to-Activation Rate = sales with at least one activation / distinct sales × 100. Extra activation events do not add extra numerator sales.

Legacy labels state the actual denominator: Sales / Dialled Leads, Sales / Fetched Leads, RPC / Dialled Leads, Dialled / Delivered Leads, Revenue-Matched Sales / Sales, or Activations / Revenue-Matched Sales (Lead Counts) where that query uses matched sales. Transaction-row tables identify their separate denominator explicitly.

Call-band percentages use lead records in each band, not outcomes caused by the nth call. One-Call Lead Share is not first-call resolution. First-dial-hour charts count lead records at their first dial, not call events. Duration includes the recorded source duration and is not labelled talk time without a talk-time mapping.

Legacy explorer percentages arrive in percent units; the browser does not multiply them by 100 again. Ratios are non-additive. Its explicitly labelled unweighted group average is not an overall conversion rate. Unsupported dynamic dimensions are not offered. Legacy charts remain unverified despite corrected labels.

## Money and commercial meaning

Expected Value, Approved Value, Invoiced Amount and Collected Amount are distinct signed ledger stages. They are not treated as synonyms for revenue or profit. Recorded Revenue in legacy screens is not verified collected cash. No rate cards, billing approvals or financial recognition rules were created by this naming change.

Standardised Leads, Qualified Leads, Delivered Sales, Answered Calls, Premium Collections, Customer Lifetime Value and duplicate classifications remain unavailable where there is no validated mapping. Validity alone does not prove standardisation or qualification. A failed validity check does not establish a duplicate.

## Compatibility, evidence and release handling

API IDs such as `billable_sales`, source keys such as `has_call`, and raw CSV column names remain stable for integrations. Export JSON now includes column definitions, record-unit and naming-version metadata; CSVs retain their exact source headers plus reporting-unit metadata. Report/evidence JSON includes the metric definition with human numerator and denominator labels.

The v2 metric version and source fingerprint change together so an old snapshot release cannot silently acquire new definitions. Publish a separately validated release using the updated contract before serving it through the new engine. No existing live release, source data or production configuration was modified.

Historical journey item numbers and cost-code identifiers are preserved in the shared reference catalogue. That catalogue is explicitly reference-only, not proof that every journey stage is available or a validated runtime formula.

Tests cover contract parity, stable IDs, unit distinctions, percentage scaling, unavailable concepts, export metadata and browser label consistency. Browser and HTTP cases use synthetic data; passing them does not certify live source completeness or all legacy analytics.
