# ConversionX data-contract alignment

This document records the application rules implemented from the approved ConversionX data contract supplied on 26 September 2026.

## Physical source contract

Primary sources:

- `clustered_lead_ledger`: lead identity, acquisition source/medium, validation, grade/vetting, nested vendor delivery/dialler outcomes.
- `lead_ledger_platform_insights`: marketing client, date, channel, campaign, adset, budget, impressions, reach, clicks, outbound clicks and platform lead events.
- `lead_ledger_all_vicidial_insights`: dialler event fields including unique call ID, campaign, agent, duration, status, RPC, sale and callback signals.
- `tbl_blc_activations`: BLC activation lifecycle source with `transaction_id`, `date_created` and expected ONtact revenue.

## Tenant contract

CX3 retains existing public workspace IDs for compatibility, but applies the approved tenant source views and aliases.

| Contract tenant | CX3 workspace | Lead source view | Operating window | Workdays | Marketing client_name |
| --- | --- | --- | --- | --- | --- |
| default_tenant | default_tenant | clustered_lead_ledger | 08:00–17:30 | Mon–Fri | master |
| mtn | mtn | view_lead_ledger_mtn_lead_submit_open | 08:00–17:30 | Mon–Fri | MTN, MTN SA |
| mondo | mondo | view_lead_ledger_mondo_lead_submit_open | 08:00–17:30 | Mon–Fri | Mondo, Mondo Deals |
| blc | ontact_blc | view_lead_ledger_blc_lead_submit_open | 08:00–17:00 | Mon–Fri | BLC, BLC 1Life |
| bizvoip | vodacom_bizvoip | view_lead_ledger_bizvoip_lead_submit_open | 08:30–17:00 | Mon–Fri | BizVoIP |
| rewardsco | rewardsco | view_lead_ledger_rewardsco_lead_submit_open | 08:00–18:00 | Mon–Sat | Rewardsco |
| realpromotions | real_promotions | view_lead_ledger_real_promotions_lead_submit_open | 08:00–17:30 | Mon–Fri | Real Promotions |
| oneplan | oneplan | view_lead_leadger_oneplan_lead_submit_open | 08:00–17:00 | Mon–Fri | OnePlan |
| affiliate | affiliate | view_lead_ledger_affiliate_lead_submit_open | 08:00–17:30 | Mon–Fri | lead-only / unmapped |

Runtime environment variables may override marketing mappings when a source owner explicitly approves a replacement mapping.

## Metric contract

Primary operational metrics remain lead-distinct unless the metric explicitly uses a dialler event population.

- Fetched = distinct lead IDs.
- Delivered = distinct leads with a valid delivery timestamp.
- Dialled = distinct leads with a valid first-call timestamp.
- RPC = distinct leads with recorded RPC.
- Sales = distinct leads with valid sale timestamp.
- Activations = distinct leads with valid activation timestamp.
- 15-minute SLA = first dial within 900 seconds of delivery.
- One-call share = dialled leads with maximum recorded cumulative call count equal to one.
- 5+ no-RPC = leads with maximum recorded cumulative call count at least five and no RPC.
- Disposition completeness = dialled leads with recorded disposition.
- Outside-hours share = tenant-local capture time outside configured workdays/window.
- Activation backlog >14d = recorded sales not activated after 14 days.
- Media spend = observed incurred spend only; budget is never substituted.
- CPC/CPM/platform CPL derive only from the same validated marketing spend population.

## Additional acquisition signals

The platform-insights contract also provides:

- reach;
- outbound clicks;
- frequency = impressions / reach;
- outbound CTR = outbound clicks / impressions;
- click-to-lead rate = platform leads / outbound clicks where outbound clicks are available.

These are descriptive platform metrics and are not lead-level attribution.

## Governance rules

CX3 must fail closed when a contract cannot be applied.

1. Budget is planning data, never incurred spend.
2. Spend is withheld when the approved date + client + channel + campaign + adset grain is duplicated.
3. Cumulative HLC call counts are descriptive; CX3 does not claim which attempt caused an outcome.
4. Missing telephony metrics are never estimated or synthesized.
5. Sentinel 1900/1970 timestamps are invalid.
6. Consumer-level lead, transaction and timeline access is administrator-only.
7. Tenant-local time calculations use the configured IANA timezone.
8. Cross-source attribution is unavailable when the active operational filters cannot be reproduced on the marketing source.
9. Imported CLI data must carry enough source fields to calculate the displayed metric; absent fields remain unavailable.
10. CLI imports and sample mutations are administrator-only; benchmark sample data is disabled in production by default.

## Current implementation notes

- Marketing schema discovery is cached briefly to avoid repeated `INFORMATION_SCHEMA` scans.
- Frontend analytics cache entries are bounded and stale entries are pruned.
- BLC activation-source freshness uses the contracted `date_created` timestamp.
- Tenant-specific lead views reduce unnecessary cross-tenant scanning while server-side tenant guards remain in place.
