# Marketing API-table contracts

CX3 treats marketing spend as a source-controlled operational measure. It does not infer spend from budget or from hard-coded CPL assumptions.

## 1. Source contract

The tenant marketing contract defines:

- BigQuery table
- client identity field
- reporting date field
- channel
- campaign
- adset
- impressions
- clicks
- recorded platform leads
- approved incurred-spend field candidates
- unit for each approved spend field
- budget fields, which remain planning-only
- the contracted spend aggregation grain
- attribution status

The default API table is:

`dashboards-422710.lead_ledger.lead_ledger_platform_insights`

Runtime schema inspection validates this contract. It does not automatically assign business meaning to arbitrary warehouse columns.

## 2. Tenant client mapping

Non-master tenants remain fail-closed until exact API-table `client_name` values are approved.

Use the admin Campaigns & Spend screen to inspect observed `client_name` values, then configure production:

```bash
CX_MARKETING_CLIENT_MAP_JSON='{
  "mtn": ["<exact approved client_name>"],
  "mondo": ["<exact approved client_name>"]
}'
```

Rules:

- use exact source values;
- do not map by display-name similarity;
- multiple values are allowed when the source legitimately represents one tenant with multiple names;
- an empty array keeps the tenant unresolved;
- the master tenant remains an all-client source scope.

## 3. Spend grain

The contract currently declares:

`date + client_name + channel + Channel_Campaign_Name + channel_adset_name`

Before returning spend, CX3 checks the selected population for duplicate rows at that grain.

If duplicate grain rows exist:

- spend is withheld;
- CPC, CPM and CPL are withheld;
- delivery counts may still be shown;
- the Campaigns page reports `INVALID_GRAIN`.

If the source has a legitimate finer spend grain, update the contract only after confirming the additional dimension with the source owner.

## 4. Budget

Budget is planning data.

CX3 may display the latest recorded budget field separately, but:

- budget is never summed as incurred spend;
- budget never feeds CPC, CPM or CPL;
- budget never feeds commercial ratios;
- missing spend cannot fall back to budget.

## 5. Attribution contract

Marketing-to-operational attribution is separate from the spend contract and remains off by default.

Activate it only after the marketing key and lead-ledger key have been reconciled:

```bash
CX_MARKETING_ATTRIBUTION_JSON='{
  "mtn": {
    "marketingSourceField": "<approved marketing source field>",
    "leadSourceField": "offershop_source"
  }
}'
```

Optional campaign fields may also be configured for future multi-key attribution.

When active, CX3 can calculate by the approved key:

- Spend
- Platform Leads
- Fetched Leads
- Delivered Leads
- Dialled Leads
- RPC
- Sales
- Activations
- Spend / Fetched Lead
- Spend / Sale
- Spend / Activation
- Recorded Revenue

These outputs remain `OBSERVED_UNRECONCILED` / `NOT_VERIFIED` until coverage, cardinality and semantic equivalence are independently checked.

## 6. Discovery

The admin-only endpoint:

`GET /api/analytics/offernet/marketing-discovery?clientId=<tenant>`

returns:

- configured contract fields;
- current table schema;
- missing required fields;
- resolved approved spend field;
- resolved budget field;
- configured tenant mapping;
- observed `client_name` values and date coverage.

This endpoint is intended to support source-owner mapping approval. It must not automatically change tenant configuration.

## 7. Media root-cause analysis

For explicit date ranges, CX3 compares the selected period with the immediately preceding equal-length period for:

- Spend
- CPC
- CPM
- CPL
- CTR
- Recorded Leads

Breakdowns are available by:

- Channel
- Campaign
- Adset

These are deterministic segment changes, not causal attribution scores.

## 8. Remaining commercial boundary

The following are not sourced by this contract and remain unavailable until separately approved:

- telephony cost;
- agent/delivery cost;
- commission;
- fixed overhead;
- contribution;
- margin;
- break-even;
- vendor profitability.
