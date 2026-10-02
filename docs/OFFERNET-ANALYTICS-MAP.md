# OfferNet analytics map

This document records the recurring operational questions that CX3 is designed to answer. It is based on OfferNet/ONtact working material, client data-review correspondence, dialler reporting briefs and the lead-ledger analysis workflow.

The product principle is:

> Start with the operational question, expose the measured population, and provide a path to the affected records. Do not manufacture missing events or turn descriptive associations into recommendations.

## Investigation workflow — 2 October 2026

The maintained investigation entry is `/investigate`; `/exceptions` remains a compatible route to the same inbox. The workflow is **Signal → Diagnose → Segment → Records → Evidence → Conclusion**. A selected exception or supported metric becomes a visible investigation context, followed by its returned comparison and breakdown, affected records, a persistent lead dossier, and local evidence notes.

The sidebar groups **Investigation inbox**, **Record explorer**, and **Data confidence** under Investigate. **Evidence reports**, **Lead ledger**, and **Vendor evidence** appear under Evidence & Audit. Record explorer, lead dossier source access, and Lead Ledger retain administrator restrictions. Published evidence releases keep their existing separate release scope.

### Reporting scope and investigation scope

| Layer | Parameters and behaviour |
| --- | --- |
| Reporting scope | Existing `clientId`/workspace, `startDate`, `endDate`, and complete validated global `filters` or supported scalar filters. Unsupported filter operators still fail closed. |
| Investigation predicate | Existing `drill` and `drillValue`; visible in the context bar and analytical breadcrumbs. Clearing the investigation preserves reporting scope and global filters. |
| Selected metric | `investigationMetric` carries an exact supported decomposition ID. Unsupported metrics do not silently become another metric. |
| Additive narrowing | `segmentVendor`, `segmentSource`, `segmentGrade`, `segmentLeadAge` intersect the global predicate and original drill with SQL `AND`. Selecting a vendor does not overwrite the global vendor filter. |
| Record state | Search retains the investigation. Page and selected dossier are reset when the analytical scope changes. Selected lead identifiers remain session state and are not added to navigation/copy links. |

Repeated scalar investigation, search, client, date or filter URL parameters fail closed before analytical requests; identical repetitions are also invalid. Resetting an ambiguous investigation clears its complete predicate/narrowing while retaining valid reporting scope. An ambiguous client requires an explicit workspace selection and is never repaired with a default tenant.

Investigation navigation preserves predicate, metric and narrowing between the inbox, records, data confidence, AI, and analytical ledger surfaces. Contextual source diagnostics disclose their broader tenant-owned observation scope; retaining an investigation in the URL does not claim that a source-wide check certifies that exact lead cohort. Copying a safe investigation link excludes transient selection; a link is withheld when private search/identity scope cannot be copied exactly without broadening it.

### Supported populations and driver semantics

The shared server predicate builder qualifies raw records and returns their structured `investigationReason`. Supported families are:

- exceptions: `awaiting-first-dial`, `waiting-over-hour`, `sla-breach`, `missing-disposition`, `zero-call-leads`, `one-call-only`, `high-attempt-no-rpc`, `sales-awaiting-activation`, `unactivated-sales`, `missing-source`, `missing-vendor`, `missing-grade`, and `invalid-timestamps`;
- `backlog-age`, `lead-age` (capture → first dial), and `delivery-age` (delivery → first dial), with existing allowlisted buckets;
- `funnel-stage`, `funnel-loss`, `call-effort`, and `lifecycle-segment`/vendor/source/grade variants with existing allowlisted values.

Unknown predicates or unsupported values return an error, never a plausible substitute population. `segmentLeadAge` specifically uses delivery → first dial and the existing driver buckets: Not delivered, Undialled, Invalid timing, 0–5m, 5–15m, 15–30m, 30–60m, 1–6h, 6–24h, and 24h+. Blank dimensions use the same `Unrecorded` normalization for grouping and narrowing; the operational vendor value `Unknown` remains distinct.

`DriverAnalysis` and the compatibility `RootCauseDrawer` share the existing root-cause API and decomposition. Operational metric IDs are `fetchedLeads`, `deliveryRate`, `dialRate`, `contactRate`, `leadToSaleRate`, and `activationRate`. Current and immediately preceding equal-length capture windows remain explicit. Rates, returned denominators, per-dimension reconciliation and unavailable values are shown without recomputation in the browser. Vendor, source, grade and first-dial-age dimensions are alternative views of the same population; their contributions must not be added together. A reconciled arithmetic breakdown does not verify its sources or establish a causal explanation.

Exception comparison remains a pair of capture cohorts measured at query time. In particular, a previous cohort's waiting/ageing count is not a reconstructed historical queue snapshot. Exception breakdowns supply **current** vendor/source counts and shares only; previous segment counts and grade/age exception breakdowns are not supplied or fabricated. Exception types overlap and their totals must not be summed. Root-cause comparison requires explicit dates and is unavailable for record-text search; the UI explains this limitation and the root-cause API rejects such search.

### Records, evidence and synthesis

The administrator record list defaults to compact investigation fields, with Investigation, Journey, Contact, Outcome and Source presets. Every supported investigation row carries a factual “Why included” label from the shared qualification family. A lead opens beside the list on desktop and as a stacked dossier on smaller displays, with Summary, Journey, Calls, Outcomes, Evidence and Source tabs. Journey reuses `LeadJourney`; Source reuses extracted Lead Ledger source formatting. Source transaction rows remain separate and do not independently establish that every source row meets the lead-level predicate.

Call counts remain aggregates. Individual attempt timestamps and attempt-level dispositions are unavailable where the contract supplies only aggregate evidence. Missing timestamps, outcomes, revenue and source metadata remain unavailable. Data-confidence disclosures retain returned `NOT_VERIFIED`, `PARTIAL`, `UNAVAILABLE` and failure semantics; no missing metadata becomes a healthy/verified badge.

The local evidence tray can pin metrics, exceptions, drivers/segments, leads and journey events, retaining their original scope, definition, provenance and supplied observation time. Exports use the existing CSV evidence utility and distinguish analyst conclusions from validated facts. Pins and conclusion notes survive investigation route changes within the session/workspace and clear at the workspace, role or session boundary. There is no new persistence backend or published-report integration. The existing `contracts/savedAnalysis.ts` remains a future home for versioned analytical view definitions; its record-free contract does not permit storing lead/event pins and lacks the complete investigation predicate/narrowing contract. Persistence therefore needs a separately reviewed schema extension rather than serializing this local tray.

“Ask about this investigation” sends the exact drill, additive narrowing, reporting filters, dates and applicable record search. The response must confirm the same scope before display. Deterministic measurements remain primary; model/source, supplied metric references, validation and limitations are visible. This does not replace `AiOperationalInsights` or certify generated conclusions.

Record pagination retains deterministic `LIMIT`/`OFFSET`; this revision does not introduce keyset pagination, unbounded exports, reconstructed historical queues, or new metric definitions.

## Overview — What needs attention now?

Primary questions:

- How many leads entered the operation?
- Were they delivered and dialled?
- How quickly was the first dial made?
- How many leads were contacted, sold and activated?
- Which exception populations require immediate attention?
- Is contact effort adequate and evidenced?
- Are sales ageing without activation?

Analytics:

- Fetched, delivery, dial coverage, RPC and sale/fetched.
- Matched-period changes and root-cause decomposition.
- First-dial SLA.
- Delivered-not-dialled backlog.
- Funnel leakage.
- One-call share.
- 5+ calls without RPC.
- Disposition completeness.
- Outside-hours capture share.
- Activation backlog older than 14 days.

## Funnel — Where is conversion leaking?

Primary questions:

- Is the loss happening before delivery, before dialling, at RPC, at sale or at activation?
- Is a source producing leads that are not being delivered or contacted?
- Do lead grades/vetting groups behave differently downstream?
- Are vendor funnel differences operational or acquisition-driven?

Analytics:

- Fetched → Delivered → Dialled → RPC → Sale → Activated.
- Lifecycle timing.
- Full source funnel including delivery and dial coverage.
- Full grade funnel including delivery and dial coverage.
- First-dial age bands with RPC and sale outcomes.
- Vendor funnel comparison.

## Contact / Speed to Lead — How quickly are we acting?

Primary questions:

- What is time to first dial?
- How much of the delivered population is contacted inside SLA?
- How do RPC and sale outcomes change as leads age?
- What happens to leads captured outside the configured operating window?
- Is weekend capture creating a backlog before the contact centre opens?

Analytics:

- Average, median, P75 and P90 delivery-to-dial latency.
- First-dial age cohorts.
- SLA bands.
- Tenant-local operating-hours comparison.
- Weekend capture share.
- RPC and sale rates inside versus outside operating hours.

Time-of-day interpretation uses the tenant timezone and configured operating window.

## Contact Strategy — Are we making enough attempts?

Primary questions:

- How many leads received zero, one, multiple or 5+ recorded calls?
- Are large populations receiving only one recorded attempt?
- Are some leads receiving high effort without RPC?
- What are the observed RPC/sale outcomes by call-count bucket?

Analytics:

- Exclusive lead-level call-count buckets.
- Zero-call population.
- One-call share.
- Multi-call share.
- 5+ calls without RPC.
- RPC, sale and activation outcomes by bucket.

Important limitation:

The current HLC field is a recorded cumulative call count, not a validated event-level attempt stream. CX3 therefore does not claim which specific attempt caused an RPC or sale and does not recommend a stop threshold.

## Performance — Which vendor/source/quality populations differ?

Primary questions:

- Which vendor is slow to first dial?
- Which vendor has weak disposition completeness?
- Which vendor leaves too many leads with one attempt?
- Which vendor has high repeat effort without RPC?
- Which sources and quality groups progress through the funnel?

Analytics:

- Vendor delivery/dial/RPC/sale/activation funnel.
- Median first dial.
- Calls per lead.
- Invalid-rate indicators.
- 15-minute SLA compliance.
- One-call share.
- 5+ calls without RPC.
- Disposition completeness.
- Source full funnel.
- Grade and vetting outcome matrices.

## Exceptions — Which populations need investigation?

Primary questions:

- Which delivered leads have not been dialled?
- Which leads breach first-dial SLA?
- Which dialled leads have no disposition?
- Which sales remain unactivated?
- Which leads have high contact effort with no RPC?
- Which leads have only one recorded call?

Admin users can drill supported exception populations into record-level Explore.

## Sales & Activation — Are sales progressing to fulfilment?

Primary questions:

- How many sales have recorded revenue?
- How many sales activate?
- How long does sale → activation take?
- How many unactivated sales are ageing beyond operational review thresholds?

Analytics:

- Recorded sales and activations.
- Activation/sale rate.
- Recorded revenue.
- Average time to sale.
- Average sale-to-activation duration.
- Unactivated sale ageing: 0–3d, 4–7d, 8–14d, 15–30d, 30d+.

A true cumulative maturation curve remains withheld until the activation event model is independently validated.

## Time & Day — When are leads entering and how do those cohorts perform?

Primary questions:

- When are leads captured?
- Are large populations entering when the contact centre is closed?
- Which capture windows show stronger observed RPC or sale rates?

Analytics:

- Tenant-local 7 × 24 capture-time matrix.
- Volume, RPC and sale views.
- Observed high-contact capture windows.
- Inside/outside operating-hours comparison.

These are descriptive capture-time cohorts, not recommended calling schedules.

## Agent Activity — What activity and outcomes are recorded per agent?

Primary questions:

- How many calls/leads are handled?
- What are recorded RPC and sales?
- What are talk time, average duration and callback counts?

CX3 deliberately does not assign agent performance tiers until an approved scoring contract exists.

## CLI Performance — What does the caller-ID/dialler report show?

The CLI surface is intended to answer delivery/contact questions from validated dialler fields only. Missing answered, activation, duration, distinct-lead and lead-age fields remain unavailable and may not be back-filled for presentation. Imported reports are administrator-managed. A date-filtered view requires a source-provided report date, and production benchmark sample data is disabled by default. Matched-period comparison is withheld unless a real historical population can be queried.

## Routing — Did the lead follow the expected handoff journey?

Primary questions:

- How deep is routing?
- Which partner sequences are common?
- Did a routed lead create a matched downstream transaction?
- How long are cascades taking?
- Where do unmatched handoffs occur?

Routing remains on the legacy analytics service and should be migrated to the current /offernet contract layer.

## Campaigns & Spend — What did media acquisition cost?

Primary questions:

- What was incurred spend?
- What are CPC, CPM and CPL?
- Which channel/campaign/adset drove a change?
- Is spend grain valid?
- Is the tenant/client_name mapping approved?

Budget remains planning-only and must never substitute for incurred spend.

## Spend & Commercial — How does observed spend relate to downstream outcomes?

Primary questions:

- What media spend is recorded?
- What revenue is recorded?
- Where an approved attribution key exists, what are spend/fetched, spend/sale and spend/activation?

Cross-source ratios remain unreconciled until attribution keys are independently validated. The attribution bridge validates spend grain, shows matched/unmatched key coverage, and refuses operational filters that cannot be applied equivalently to the marketing population.

## Data Integrity — Can the operational analysis be trusted?

Primary questions:

- Are source feeds fresh?
- Are source/client mappings ready?
- Are lead identifiers duplicated?
- Are delivery/call timestamps missing?
- Are dispositions missing?
- Are source, grade or vendor fields missing?

Concrete discrepancy populations are preferred over synthetic health scores.

## Evidence — Can the metric be reproduced?

Evidence is the release/reconciliation layer. Operational metrics remain NOT_VERIFIED until independently reconciled and published through the evidence pipeline.

## Explore — Which exact leads are behind the number?

Explore is the record-level investigation surface for authorised administrators. Supported operational populations include:

- awaiting first dial;
- SLA breach;
- backlog age;
- missing disposition;
- unactivated sale;
- funnel stage/loss;
- first-dial age;
- 5+ recorded calls without RPC;
- exactly one recorded call.
