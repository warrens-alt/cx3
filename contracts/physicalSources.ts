/**
 * Canonical physical source contract for the three shared OfferNet warehouse tables
 * surfaced by the application.
 *
 * These names/fields are server-approved configuration, not browser input.
 * Cross-source joins remain separately gated by identity/ownership contracts.
 */
export const OFFERNET_SOURCE_TABLES = {
  marketing: 'dashboards-422710.lead_ledger.lead_ledger_platform_insights',
  calls: 'dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights',
  timeToDial: 'dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights_time_to_dial',
} as const;

export const MARKETING_SOURCE_FIELDS = {
  clientName: 'client_name',
  date: 'date',
  channel: 'channel',
  campaign: 'Channel_Campaign_Name',
  adset: 'channel_adset_name',
  impressions: 'impressions',
  reach: 'reach',
  clicks: 'clicks',
  outboundClicks: 'outbound_clicks',
  platformLeads: 'actions_lead',
  spendCandidates: [
    'spend',
    'amount_spent',
    'actual_spend',
    'media_spend',
    'ad_spend',
    'total_spend',
    'cost',
    'cost_micros',
    'spend_micros',
  ],
  spendUnits: {
    spend: 'currency',
    amount_spent: 'currency',
    actual_spend: 'currency',
    media_spend: 'currency',
    ad_spend: 'currency',
    total_spend: 'currency',
    cost: 'currency',
    cost_micros: 'micros',
    spend_micros: 'micros',
  },
  budgetCandidates: ['budget', 'campaign_budget', 'daily_budget'],
  spendGrain: ['date', 'client_name', 'channel', 'Channel_Campaign_Name', 'channel_adset_name'],
} as const;

export const CALL_SOURCE_FIELDS = {
  date: 'call_start_date',
  vendor: 'vendor',
  leadId: 'dialer_lead_id',
  agent: 'user',
  rpc: 'is_rpc',
  sale: 'is_sale',
  callback: 'is_callback',
  durationSeconds: 'length_in_sec',
  cliCandidates: [
    'cli',
    'caller_id',
    'outbound_cid',
    'source_cli',
    'phone_presentation',
    'cli_number',
    'dialer_caller_id',
    'outbound_caller_id',
  ],
} as const;

export const TIME_TO_DIAL_SOURCE_FIELDS = {
  date: 'expected_first_dial',
} as const;

export const SOURCE_TABLE_CONTRACT = {
  marketing: {
    table: OFFERNET_SOURCE_TABLES.marketing,
    fields: MARKETING_SOURCE_FIELDS,
    dateMeaning: 'Media reporting date',
    ownership: 'client_name',
    crossSourceJoin: 'CONTRACT_REQUIRED',
  },
  calls: {
    table: OFFERNET_SOURCE_TABLES.calls,
    fields: CALL_SOURCE_FIELDS,
    dateMeaning: 'Recorded call-start date',
    ownership: 'vendor',
    crossSourceJoin: 'CONTRACT_REQUIRED',
  },
  timeToDial: {
    table: OFFERNET_SOURCE_TABLES.timeToDial,
    fields: TIME_TO_DIAL_SOURCE_FIELDS,
    dateMeaning: 'Expected first-dial date; not an observed call timestamp',
    ownership: null,
    crossSourceJoin: 'CONTRACT_REQUIRED',
  },
} as const;
