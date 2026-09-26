# OfferNet analytics map

This document records the recurring operational questions that CX3 is designed to answer. It is based on OfferNet/ONtact working material, client data-review correspondence, dialler reporting briefs and the lead-ledger analysis workflow.

The product principle is:

> Start with the operational question, expose the measured population, and provide a path to the affected records. Do not manufacture missing events or turn descriptive associations into recommendations.

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

The CLI surface is intended to answer delivery/contact questions from validated dialler fields only. Missing answered/activation fields must remain unavailable and may not be back-filled for presentation.

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

Cross-source ratios remain unreconciled until attribution keys are independently validated.

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
