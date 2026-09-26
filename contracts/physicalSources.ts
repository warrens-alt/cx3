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
  id: 'id',
  clientName: 'client_name',
  date: 'date',
  channel: 'channel',
  campaign: 'Channel_Campaign_Name',
  adset: 'channel_adset_name',
  budget: 'budget',
  impressions: 'impressions',
  reach: 'reach',
  engagements: 'engagements',
  clicks: 'clicks',
  outboundClicks: 'outbound_clicks',
  platformLeads: 'actions_lead',
  objective: 'objective',
  createdAt: 'created_at',
  actionsLinkClick: 'actions_link_click',
  pageView: 'page_view',
  actionsInitiateCheckout: 'actions_initiate_checkout',
  actionsAddToCart: 'actions_add_to_cart',
  actionsAddPaymentInfo: 'actions_add_payment_info',
  messagingConversationStarted: 'conversion_messaging_conversation_started',
  currency: 'currency',
  observedSpendField: null as string | null,
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
  id: 'id',
  vendor: 'vendor',
  uniqueId: 'dialer_uniqueid',
  leadId: 'dialer_lead_id',
  listId: 'list_id',
  listName: 'list_name',
  campaignId: 'campaign_id',
  campaignName: 'campaign_name',
  entryDate: 'entry_date',
  modifyDate: 'modify_date',
  date: 'call_start_date',
  callEndDate: 'call_end_date',
  durationSeconds: 'length_in_sec',
  agent: 'user',
  comments: 'comments',
  processed: 'processed',
  userGroup: 'user_group',
  termReason: 'term_reason',
  altDial: 'alt_dial',
  calledCount: 'called_count',
  statusName: 'status_name',
  rpc: 'is_rpc',
  sale: 'is_sale',
  callback: 'is_callback',
  createdAt: 'created_at',
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
  id: 'id',
  vendor: 'vendor',
  uniqueId: 'dialer_uniqueid',
  leadId: 'dialer_lead_id',
  campaignId: 'campaign_id',
  listId: 'list_id',
  entryDate: 'entry_date',
  modifyDate: 'modify_date',
  firstDialDate: 'first_dial_date',
  expectedFirstDial: 'expected_first_dial',
  createdAt: 'created_at',
  date: 'first_dial_date',
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
    dateMeaning: 'Recorded first-dial date from the dedicated time-to-dial source',
    ownership: 'vendor',
    crossSourceJoin: 'CONTRACT_REQUIRED',
  },
} as const;
