/** Schema evidence supplied on 2026-09-26, NOT a live freshness or join-authority assertion.
 * Only the already configured sources are represented; no additional datasets are exposed.
 */
export const WAREHOUSE_SCHEMA_SNAPSHOT_DATE = '2026-09-26';
export const FLAT_LEAD_VIEW_NAMES = [
  'view_lead_ledger_mtn_lead_submit_open',
  'view_lead_ledger_mondo_lead_submit_open',
  'view_lead_ledger_blc_lead_submit_open',
  'view_lead_ledger_bizvoip_lead_submit_open',
  'view_lead_ledger_rewardsco_lead_submit_open',
  'view_lead_ledger_real_promotions_lead_submit_open',
  'view_lead_leadger_oneplan_lead_submit_open',
  'view_lead_ledger_affiliate_lead_submit_open',
] as const;
const flatTables = new Set(FLAT_LEAD_VIEW_NAMES.map(name => `dashboards-422710.lead_ledger.${name}`));
export function isFlatLeadSource(table: string): boolean { return flatTables.has(table); }
/** MTN/Mondo/Real Promotions use FLOAT64 revenue; other configured flat views use INT64. */
export const FLAT_LEAD_COLUMNS: Record<string, string> = {
  vendor: 'STRING', lead_id: 'STRING', transaction_id: 'INT64', consumer_id: 'INT64', fetched: 'STRING',
  vetting_status: 'STRING', vetted: 'STRING', attempted_to_deliver: 'STRING', delivered: 'STRING', expected_first_dial: 'STRING',
  new_dialer_lead: 'INT64', first_call_date: 'STRING', last_call_date: 'STRING', last_dialer_status: 'STRING',
  last_call_length_in_sec: 'INT64', total_calls_length_in_sec: 'INT64', total_calls: 'INT64', rpc: 'INT64',
  sale: 'STRING', activated: 'STRING', lead_cost: 'INT64', revenue_generated: 'FLOAT64', currency: 'STRING', offershop_source: 'STRING',
};
export function flatLeadColumns(table: string): Record<string, string> {
  if (!isFlatLeadSource(table)) return {};
  const floatRevenue = ['view_lead_ledger_mtn_lead_submit_open', 'view_lead_ledger_mondo_lead_submit_open', 'view_lead_ledger_real_promotions_lead_submit_open'].some(name => table.endsWith(`.${name}`));
  return { ...FLAT_LEAD_COLUMNS, revenue_generated: floatRevenue ? 'FLOAT64' : 'INT64' };
}
export const SHARED_SOURCE_COLUMNS: Record<string, Record<string, string>> = {
  lead_ledger_platform_insights: {
    client_name: 'STRING', date: 'DATE', channel: 'STRING', Channel_Campaign_Name: 'STRING', channel_adset_name: 'STRING',
    budget: 'FLOAT64', impressions: 'FLOAT64', reach: 'FLOAT64', engagements: 'FLOAT64', clicks: 'FLOAT64', outbound_clicks: 'FLOAT64',
    actions_link_click: 'FLOAT64', page_view: 'FLOAT64', actions_initiate_checkout: 'FLOAT64', actions_add_to_cart: 'FLOAT64',
    actions_add_payment_info: 'FLOAT64', actions_lead: 'FLOAT64', conversion_messaging_conversation_started: 'FLOAT64',
    objective: 'STRING', currency: 'STRING', entity: 'STRING', multiplier: 'FLOAT64',
  },
  lead_ledger_all_vicidial_insights: {
    vendor: 'STRING', dialer_uniqueid: 'STRING', dialer_lead_id: 'INT64', list_id: 'NUMERIC', list_name: 'STRING',
    campaign_id: 'STRING', campaign_name: 'STRING', entry_date: 'STRING', expected_first_dial: 'STRING', modify_date: 'STRING',
    call_start_date: 'STRING', call_end_date: 'STRING', length_in_sec: 'INT64', user: 'STRING', comments: 'STRING', processed: 'STRING',
    user_group: 'STRING', term_reason: 'STRING', alt_dial: 'STRING', called_count: 'INT64', status_name: 'STRING',
    is_rpc: 'BOOL', is_sale: 'BOOL', is_callback: 'BOOL',
  },
  lead_ledger_all_vicidial_insights_time_to_dial: {
    vendor: 'STRING', dialer_uniqueid: 'STRING', dialer_lead_id: 'INT64', campaign_id: 'STRING', campaign_name: 'STRING',
    list_id: 'NUMERIC', list_name: 'STRING', entry_date: 'STRING', modify_date: 'STRING', first_dial_date: 'STRING', expected_first_dial: 'STRING',
  },
  tbl_blc_activations: { transaction_id: 'INT64', date_created: 'STRING', color: 'STRING', expected_ontact_revenue: 'INT64' },
};
export function leadSourceEvidence(table: string) {
  const flat = isFlatLeadSource(table);
  return {
    schemaEvidenceDate: WAREHOUSE_SCHEMA_SNAPSHOT_DATE,
    schemaEvidenceType: 'uploaded_dictionary_not_live_validation',
    physicalLayout: flat ? 'flat_vendor_transaction' : 'nested_lead_ledger',
    analyticalGrain: 'selected_lead_after_vendor_scoping',
    missingDimensions: flat ? ['grade', 'medium', 'validation_flags', 'routing_history'] : [],
    note: flat
      ? 'This tenant view records vendor transactions. Lead measures are deduplicated by lead ID; grade, medium, validation flags and routing history are not supplied. Null placeholders are not measured failures. No enrichment or cross-source identity join is inferred.'
      : 'A ledger lead can contain multiple vendor records. Lead counts and vendor transaction counts are different populations.',
  };
}
/** Canonical tenant IDs exposed by the current /clients contract. */
export const FLAT_LEAD_TENANT_TABLES: Record<string, string> = Object.fromEntries(
  ['mtn', 'mondo', 'ontact_blc', 'vodacom_bizvoip', 'rewardsco', 'real_promotions', 'oneplan', 'affiliate']
    .map((id, index) => [id, `dashboards-422710.lead_ledger.${FLAT_LEAD_VIEW_NAMES[index]}`]),
);
