import type { DictionaryObject } from '../../contracts/warehouseDictionary';

export interface SourceProfileOptions {
  limit?: number;
  sampleRatio?: number;
  timeoutMs?: number;
  maxBytesBilled?: number;
  redactDynamicKeys?: boolean;
}

export interface RawSourceProfileResult {
  sourceId: string;
  project: string;
  dataset: string;
  table: string;
  profiledAt: string;
  rowCountEstimate: number | null;
  scannedBytesEstimate: number | null;
  outerTimestampSemantics: 'outer_record_timestamp';
  topLevelKeys: Array<{
    key: string;
    type: string;
    nullCount: number;
    missingCount?: number;
    explicitNullCount?: number;
    sampleValues?: string[];
  }>;
  jsonStructureFindings: {
    envelopeType: 'event' | 'snapshot' | 'batch_array' | 'unknown';
    topLevelShape: 'object' | 'array' | 'scalar' | 'null';
    recordArrayCandidates: string[];
    scalarVsArrayDrift: boolean;
    detectedDynamicKeys: string[];
  };
  sampleRecordsAnalyzed: number;
  samplingMethod?: string;
  samplingLimitations?: string;
  status: 'PROFILED' | 'ERROR' | 'UNAUTHORIZED';
  error?: string;
  dependencies: string[];
}

const col = (name: string, type: string, ordinalPosition: number) => ({ name, type, nullable: true, ordinalPosition });

// 1. dashboards-422710.lead_ledger (35 objects: 12 TABLE, 23 VIEW)
const LEAD_LEDGER_OBJECTS: DictionaryObject[] = [
  // 12 Tables
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'blc_remote_activations', tableType: 'TABLE',
    family: 'activations', disposition: 'alternative_reconciliation', analyticalGrain: 'date_segment_contract',
    dateFields: ['date', 'date_created', 'updatedAt'], candidateKeys: ['contract_key'], sensitiveFields: [],
    columns: [col('date', 'STRING', 1), col('segment', 'STRING', 2), col('contract_key', 'STRING', 3), col('activations', 'INT64', 4), col('revenue', 'NUMERIC', 5), col('date_created', 'STRING', 6), col('updatedAt', 'STRING', 7)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'clustered_lead_ledger', tableType: 'TABLE',
    family: 'lead_ledger', disposition: 'primary', analyticalGrain: 'lead_id',
    dateFields: ['fetched', 'hospital_applied_date', 'offershop_color_vetting_date', 'offershop_grade_date'], candidateKeys: ['lead_id', 'consumer_id'], sensitiveFields: ['standardised_idno', 'standardised_mobile', 'standardised_alt_phone', 'standardised_email'],
    columns: [col('lead_id', 'STRING', 1), col('consumer_id', 'INT64', 2), col('offershop_source', 'STRING', 3), col('offernet_medium', 'STRING', 4), col('fetched', 'STRING', 5), col('hlc_details', 'ARRAY<STRUCT>', 36)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'clustered_lead_ledger_open', tableType: 'TABLE',
    family: 'lead_ledger', disposition: 'restricted_detail', analyticalGrain: 'lead_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id'], sensitiveFields: ['first_name', 'surname', 'mobile_number', 'idno'],
    columns: [col('lead_id', 'STRING', 1), col('consumer_id', 'INT64', 2), col('first_name', 'STRING', 3), col('surname', 'STRING', 4), col('mobile_number', 'STRING', 5), col('idno', 'STRING', 6)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'clustered_lead_ledger_open_backup', tableType: 'TABLE',
    family: 'lead_ledger', disposition: 'backup_duplicate', analyticalGrain: 'lead_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id'], sensitiveFields: ['first_name', 'surname', 'mobile_number', 'idno'],
    columns: [col('lead_id', 'STRING', 1), col('consumer_id', 'INT64', 2)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'lead_ledger_all_vicidial_insights', tableType: 'TABLE',
    family: 'vicidial', disposition: 'primary', analyticalGrain: 'dialer_uniqueid',
    dateFields: ['call_start_date', 'call_end_date', 'entry_date', 'modify_date'], candidateKeys: ['dialer_uniqueid', 'dialer_lead_id'], sensitiveFields: ['user', 'comments'],
    columns: [col('vendor', 'STRING', 1), col('dialer_uniqueid', 'STRING', 2), col('dialer_lead_id', 'INT64', 3), col('call_start_date', 'STRING', 11), col('is_rpc', 'BOOL', 22), col('is_sale', 'BOOL', 23)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'lead_ledger_all_vicidial_insights_time_to_dial', tableType: 'TABLE',
    family: 'vicidial', disposition: 'primary', analyticalGrain: 'dialer_uniqueid',
    dateFields: ['entry_date', 'first_dial_date', 'modify_date'], candidateKeys: ['dialer_uniqueid', 'dialer_lead_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('dialer_uniqueid', 'STRING', 2), col('dialer_lead_id', 'INT64', 3), col('first_dial_date', 'STRING', 10), col('expected_first_dial', 'STRING', 11)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'lead_ledger_platform_insights', tableType: 'TABLE',
    family: 'marketing', disposition: 'primary', analyticalGrain: 'date_client_channel_campaign_adset',
    dateFields: ['date'], candidateKeys: ['client_name', 'date', 'channel', 'Channel_Campaign_Name', 'channel_adset_name'], sensitiveFields: [],
    columns: [col('client_name', 'STRING', 1), col('date', 'DATE', 2), col('channel', 'STRING', 3), col('Channel_Campaign_Name', 'STRING', 4), col('channel_adset_name', 'STRING', 5), col('budget', 'FLOAT64', 6), col('impressions', 'FLOAT64', 7), col('clicks', 'FLOAT64', 10), col('outbound_clicks', 'FLOAT64', 11), col('actions_lead', 'FLOAT64', 17), col('currency', 'STRING', 20)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'tbl_blc_activations', tableType: 'TABLE',
    family: 'activations', disposition: 'primary', analyticalGrain: 'transaction_id',
    dateFields: ['date_created'], candidateKeys: ['transaction_id'], sensitiveFields: [],
    columns: [col('transaction_id', 'INT64', 1), col('date_created', 'STRING', 2), col('color', 'STRING', 3), col('expected_ontact_revenue', 'INT64', 4)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'tbl_lead_ledger_all_lewis_group_lead_submit_open', tableType: 'TABLE',
    family: 'retail', disposition: 'restricted_detail', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched', 'contactability_verification_status_date'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: ['full_name', 'mobile_number', 'email_address'],
    columns: [col('client', 'STRING', 1), col('lead_id', 'INT64', 2), col('transaction_id', 'INT64', 3), col('campaign_name', 'STRING', 9), col('source', 'STRING', 10), col('delivered', 'STRING', 23)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'tbl_lead_ledger_lewis_group_top_stores', tableType: 'TABLE',
    family: 'retail', disposition: 'alternative_reconciliation', analyticalGrain: 'client_store_date_channel',
    dateFields: ['date'], candidateKeys: ['store_id', 'date', 'Channel'], sensitiveFields: [],
    columns: [col('client_name', 'STRING', 1), col('Country', 'STRING', 2), col('date', 'DATE', 3), col('Channel', 'STRING', 4), col('Channel_Campaign_Name', 'STRING', 5), col('adset_name', 'STRING', 6), col('store', 'STRING', 7), col('store_id', 'STRING', 8), col('Objective', 'STRING', 9), col('Amount_Spent', 'FLOAT64', 10)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'tbl_lewis_group_waterfall_report', tableType: 'TABLE',
    family: 'retail', disposition: 'alternative_reconciliation', analyticalGrain: 'client_date_channel_campaign',
    dateFields: ['date'], candidateKeys: ['client_name', 'date', 'Channel_Campaign_Name'], sensitiveFields: [],
    columns: [col('client_name', 'STRING', 1), col('Country', 'STRING', 2), col('date', 'DATE', 3), col('Channel', 'STRING', 4), col('Channel_Campaign_Name', 'STRING', 5), col('Objective', 'STRING', 6), col('Amount_Spent', 'FLOAT64', 7)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'tbl_touchpoint_projects', tableType: 'TABLE',
    family: 'budgets', disposition: 'primary', analyticalGrain: 'project_id',
    dateFields: ['project_created_at'], candidateKeys: ['project_id'], sensitiveFields: [],
    columns: [col('project_id', 'NUMERIC', 1), col('project_name', 'STRING', 2), col('client_name', 'STRING', 4), col('actual_budget_allocated', 'FLOAT64', 15)],
  },

  // 23 Views
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_all_lead_submit_open', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched', 'first_call_date', 'last_call_date'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'STRING', 3), col('revenue_generated', 'FLOAT64', 19)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_all_offershop_lead_submit', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched', 'first_call_date', 'last_call_date'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'STRING', 3), col('revenue_generated', 'FLOAT64', 19)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_blc_activations', tableType: 'VIEW',
    family: 'activations', disposition: 'alternative_reconciliation', analyticalGrain: 'transaction_id',
    dateFields: ['date_created'], candidateKeys: ['transaction_id', 'contract_key'], sensitiveFields: [],
    columns: [col('transaction_id', 'INT64', 1), col('contract_key', 'INT64', 2), col('date_created', 'STRING', 3), col('color', 'STRING', 4), col('expected_ontact_revenue', 'INT64', 5)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_clustered_lead_ledger', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id'], sensitiveFields: ['standardised_idno', 'standardised_mobile'],
    columns: [col('lead_id', 'STRING', 1), col('consumer_id', 'INT64', 2), col('hlc_details', 'ARRAY<STRUCT>', 35)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_clustered_lead_ledger_open', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'restricted_detail', analyticalGrain: 'lead_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id'], sensitiveFields: ['standardised_idno', 'standardised_mobile'],
    columns: [col('lead_id', 'STRING', 1), col('consumer_id', 'INT64', 2)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_fb_budget_changes', tableType: 'VIEW',
    family: 'budgets', disposition: 'alternative_reconciliation', analyticalGrain: 'date_account_campaign_adset',
    dateFields: ['date'], candidateKeys: ['account_id', 'campaign_id', 'adset_id', 'date'], sensitiveFields: [],
    columns: [col('date', 'DATE', 1), col('account_id', 'STRING', 2), col('campaign_id', 'STRING', 3), col('campaign_daily_budget', 'FLOAT64', 4), col('any_budget_changed', 'BOOL', 13)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_lead_leadger_oneplan_lead_submit_open', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'primary', analyticalGrain: 'lead_id_vendor',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'INT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_lead_ledger_affiliate_lead_submit_open', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'primary', analyticalGrain: 'lead_id_vendor',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'INT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_lead_ledger_all_lewis_group_lead_submit_open', tableType: 'VIEW',
    family: 'retail', disposition: 'restricted_detail', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: ['full_name', 'mobile_number', 'email_address'],
    columns: [col('client', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'STRING', 3)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_lead_ledger_all_vicidial_insights', tableType: 'VIEW',
    family: 'vicidial', disposition: 'alternative_reconciliation', analyticalGrain: 'dialer_uniqueid',
    dateFields: ['call_start_date'], candidateKeys: ['dialer_uniqueid'], sensitiveFields: ['user', 'comments'],
    columns: [col('vendor', 'STRING', 1), col('dialer_uniqueid', 'STRING', 2), col('dialer_lead_id', 'INT64', 3)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_lead_ledger_all_vicidial_insights_time_to_dial', tableType: 'VIEW',
    family: 'vicidial', disposition: 'alternative_reconciliation', analyticalGrain: 'dialer_uniqueid',
    dateFields: ['entry_date', 'first_dial_date'], candidateKeys: ['dialer_uniqueid'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('dialer_uniqueid', 'STRING', 2), col('first_dial_date', 'STRING', 10)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_lead_ledger_bizvoip_lead_submit_open', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'primary', analyticalGrain: 'lead_id_vendor',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'INT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_lead_ledger_blc_lead_submit_open', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'primary', analyticalGrain: 'lead_id_vendor',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'INT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_lead_ledger_invalid_idno_lead_submit_open', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'restricted_detail', analyticalGrain: 'lead_id_vendor',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_lead_ledger_mondo_lead_submit_open', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'primary', analyticalGrain: 'lead_id_vendor',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'FLOAT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_lead_ledger_mtn_lead_submit_open', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'primary', analyticalGrain: 'lead_id_vendor',
    dateFields: ['fetched', 'first_call_date', 'last_call_date'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'FLOAT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_lead_ledger_offer_shop_lead_submit_open', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'restricted_detail', analyticalGrain: 'lead_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id'], sensitiveFields: ['first_name', 'surname', 'mobile_number', 'idno'],
    columns: [col('lead_id', 'STRING', 1), col('consumer_id', 'INT64', 2), col('first_name', 'STRING', 3)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_lead_ledger_platform_insights', tableType: 'VIEW',
    family: 'marketing', disposition: 'alternative_reconciliation', analyticalGrain: 'date_client_channel_campaign_adset',
    dateFields: ['date'], candidateKeys: ['client_name', 'date'], sensitiveFields: [],
    columns: [col('client_name', 'STRING', 1), col('date', 'DATE', 2), col('channel', 'STRING', 3)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_lead_ledger_real_promotions_lead_submit_open', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'primary', analyticalGrain: 'lead_id_vendor',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'FLOAT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_lead_ledger_rewardsco_lead_submit_open', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'primary', analyticalGrain: 'lead_id_vendor',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'INT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_lead_ledger_using_open_leadger', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id'], sensitiveFields: ['standardised_idno'],
    columns: [col('lead_id', 'STRING', 1), col('consumer_id', 'INT64', 2)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_offershop_lead_submit', tableType: 'VIEW',
    family: 'lead_ledger', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id'], sensitiveFields: ['standardised_idno'],
    columns: [col('lead_id', 'STRING', 1), col('consumer_id', 'INT64', 2)],
  },
  {
    project: 'dashboards-422710', dataset: 'lead_ledger', tableName: 'view_touchpoint_projects', tableType: 'VIEW',
    family: 'budgets', disposition: 'alternative_reconciliation', analyticalGrain: 'project_id',
    dateFields: ['project_created_at'], candidateKeys: ['project_id'], sensitiveFields: [],
    columns: [col('project_id', 'NUMERIC', 1), col('project_name', 'STRING', 2), col('actual_budget_allocated', 'FLOAT64', 15)],
  },
];

// 2. dashboards-422710.watfall_report (18 objects: 1 TABLE, 17 VIEW)
const WATFALL_REPORT_OBJECTS: DictionaryObject[] = [
  // 1 Table
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_lewis_group_waterfall_report_lewis', tableType: 'TABLE',
    family: 'waterfall', disposition: 'alternative_reconciliation', analyticalGrain: 'client_date_channel_campaign',
    dateFields: ['date'], candidateKeys: ['client_name', 'date', 'Channel_Campaign_Name'], sensitiveFields: [],
    columns: [col('client_name', 'STRING', 1), col('Country', 'STRING', 2), col('date', 'DATE', 3), col('Channel', 'STRING', 4), col('Channel_Campaign_Name', 'STRING', 5), col('Objective', 'STRING', 6), col('Amount_Spent', 'FLOAT64', 7)],
  },
  // 17 Views
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_affiliate_timeline', tableType: 'VIEW',
    family: 'waterfall', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'INT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_beares_waterfall_timeline', tableType: 'VIEW',
    family: 'retail', disposition: 'restricted_detail', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: ['full_name', 'mobile_number', 'email_address'],
    columns: [col('client', 'STRING', 1), col('lead_id', 'INT64', 2), col('transaction_id', 'INT64', 3)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_bedzone_waterfall_timeline', tableType: 'VIEW',
    family: 'retail', disposition: 'restricted_detail', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: ['full_name', 'mobile_number', 'email_address'],
    columns: [col('client', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'STRING', 3)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_bhe_waterfall_timeline', tableType: 'VIEW',
    family: 'retail', disposition: 'restricted_detail', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: ['full_name', 'mobile_number', 'email_address'],
    columns: [col('client', 'STRING', 1), col('lead_id', 'INT64', 2), col('transaction_id', 'INT64', 3)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_bizvoip_waterfall_timeline', tableType: 'VIEW',
    family: 'waterfall', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'INT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_blc_waterfall_timeline', tableType: 'VIEW',
    family: 'waterfall', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'INT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_invalid_idno_timeline', tableType: 'VIEW',
    family: 'waterfall', disposition: 'restricted_detail', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_lewis_waterfall_timeline', tableType: 'VIEW',
    family: 'retail', disposition: 'restricted_detail', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: ['full_name', 'mobile_number', 'email_address'],
    columns: [col('client', 'STRING', 1), col('lead_id', 'INT64', 2), col('transaction_id', 'INT64', 3)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_mondo_waterfall_timeline', tableType: 'VIEW',
    family: 'waterfall', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'FLOAT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_mtn_waterfall_timeline', tableType: 'VIEW',
    family: 'waterfall', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched', 'first_call_date'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'FLOAT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_offernet_full_lead_timeline', tableType: 'VIEW',
    family: 'waterfall', disposition: 'alternative_reconciliation', analyticalGrain: 'client_offer_shop_lead_id',
    dateFields: ['fetched'], candidateKeys: ['offer_shop_lead_id'], sensitiveFields: [],
    columns: [col('client', 'STRING', 1), col('offer_shop_lead_id', 'STRING', 2)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_offershop_lead_ledger', tableType: 'VIEW',
    family: 'waterfall', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'INT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_offershop_rest_timeline', tableType: 'VIEW',
    family: 'waterfall', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'INT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_oneplan_timeline', tableType: 'VIEW',
    family: 'waterfall', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'INT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_onvest_waterfall_timeline', tableType: 'VIEW',
    family: 'waterfall', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'INT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_real_promotions_timeline', tableType: 'VIEW',
    family: 'waterfall', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'FLOAT64', 22)],
  },
  {
    project: 'dashboards-422710', dataset: 'watfall_report', tableName: 'view_rewardsco_waterfall_timeline', tableType: 'VIEW',
    family: 'waterfall', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3), col('revenue_generated', 'INT64', 22)],
  },
];

// 3. dashboards-422710.vibe_coding_data (10 objects: 3 TABLE, 7 VIEW)
const VIBE_CODING_OBJECTS: DictionaryObject[] = [
  // 3 Tables
  {
    project: 'dashboards-422710', dataset: 'vibe_coding_data', tableName: 'tbl_offershop_lead_ledger', tableType: 'TABLE',
    family: 'lead_ledger', disposition: 'alternative_reconciliation', analyticalGrain: 'lead_id_transaction_id',
    dateFields: ['fetched', 'first_call_date'], candidateKeys: ['lead_id', 'transaction_id'], sensitiveFields: [],
    columns: [col('vendor', 'STRING', 1), col('lead_id', 'STRING', 2), col('transaction_id', 'INT64', 3)],
  },
  {
    project: 'dashboards-422710', dataset: 'vibe_coding_data', tableName: 'tbl_vibe_code_warren_stear_ontact_analytics_api', tableType: 'TABLE',
    family: 'vicidial', disposition: 'restricted_detail', analyticalGrain: 'uniqueid',
    dateFields: ['call_date', 'entry_date', 'modify_date'], candidateKeys: ['uniqueid', 'lead_id'], sensitiveFields: ['user', 'comments', 'first_name', 'last_name', 'phone_number', 'email'],
    columns: [col('uniqueid', 'STRING', 1), col('lead_id', 'INT64', 2), col('call_date', 'DATETIME', 5)],
  },
  {
    project: 'dashboards-422710', dataset: 'vibe_coding_data', tableName: 'tbl_vibe_code_warren_stear_ontact_ofline_data', tableType: 'TABLE',
    family: 'touchpoints', disposition: 'alternative_reconciliation', analyticalGrain: 'offershop_source_date',
    dateFields: ['date'], candidateKeys: ['offershop_source', 'date'], sensitiveFields: [],
    columns: [col('offershop_source', 'STRING', 1), col('date', 'STRING', 2), col('Fetched_Leads', 'INT64', 3), col('Amount_Spent', 'BIGNUMERIC', 51), col('Impressions', 'BIGNUMERIC', 52), col('Clicks', 'FLOAT64', 58)],
  },
  // 7 Views
  {
    project: 'dashboards-422710', dataset: 'vibe_coding_data', tableName: 'view_combined', tableType: 'VIEW',
    family: 'touchpoints', disposition: 'alternative_reconciliation', analyticalGrain: 'offershop_source_client_date',
    dateFields: ['date'], candidateKeys: ['offershop_source', 'client', 'date'], sensitiveFields: [],
    columns: [col('offershop_source', 'STRING', 1), col('client', 'STRING', 2), col('date', 'DATE', 3), col('Amount_Spent', 'BIGNUMERIC', 52), col('Impressions', 'BIGNUMERIC', 53), col('Clicks', 'FLOAT64', 59)],
  },
  {
    project: 'dashboards-422710', dataset: 'vibe_coding_data', tableName: 'view_onvest_offline_data', tableType: 'VIEW',
    family: 'touchpoints', disposition: 'alternative_reconciliation', analyticalGrain: 'offershop_source_client_date',
    dateFields: ['date'], candidateKeys: ['offershop_source', 'Client', 'date'], sensitiveFields: [],
    columns: [col('offershop_source', 'STRING', 1), col('Client', 'STRING', 2), col('date', 'DATE', 3), col('Fetched_Leads', 'INT64', 4)],
  },
  {
    project: 'dashboards-422710', dataset: 'vibe_coding_data', tableName: 'view_onvest_online_data', tableType: 'VIEW',
    family: 'touchpoints', disposition: 'alternative_reconciliation', analyticalGrain: 'client_date_channel',
    dateFields: ['date'], candidateKeys: ['client', 'date', 'channel'], sensitiveFields: [],
    columns: [col('date', 'DATE', 1), col('client', 'STRING', 2), col('channel', 'STRING', 3), col('Amount_Spent', 'FLOAT64', 5), col('Impressions', 'FLOAT64', 6), col('Clicks', 'FLOAT64', 12)],
  },
  {
    project: 'dashboards-422710', dataset: 'vibe_coding_data', tableName: 'view_onvest_online_data_v1', tableType: 'VIEW',
    family: 'touchpoints', disposition: 'backup_duplicate', analyticalGrain: 'client_date_channel_offershop_source',
    dateFields: ['date'], candidateKeys: ['offershop_source', 'client', 'date', 'channel'], sensitiveFields: [],
    columns: [col('date', 'DATE', 1), col('offershop_source', 'STRING', 2), col('client', 'STRING', 3), col('channel', 'STRING', 4), col('Amount_Spent', 'BIGNUMERIC', 6)],
  },
  {
    project: 'dashboards-422710', dataset: 'vibe_coding_data', tableName: 'view_output_view', tableType: 'VIEW',
    family: 'touchpoints', disposition: 'alternative_reconciliation', analyticalGrain: 'offershop_source_date',
    dateFields: ['date'], candidateKeys: ['offershop_source', 'date'], sensitiveFields: [],
    columns: [col('offershop_source', 'STRING', 1), col('date', 'STRING', 2), col('Amount_Spent', 'BIGNUMERIC', 51)],
  },
  {
    project: 'dashboards-422710', dataset: 'vibe_coding_data', tableName: 'view_vibe-code-warren--stear--ontact--analytics--api', tableType: 'VIEW',
    family: 'vicidial', disposition: 'backup_duplicate', analyticalGrain: 'uniqueid',
    dateFields: ['call_date'], candidateKeys: ['uniqueid'], sensitiveFields: ['user', 'first_name', 'last_name'],
    columns: [col('uniqueid', 'STRING', 1), col('lead_id', 'INT64', 2)],
  },
  {
    project: 'dashboards-422710', dataset: 'vibe_coding_data', tableName: 'view_vibe_code_warren_stear_ontact_analytics_api', tableType: 'VIEW',
    family: 'vicidial', disposition: 'alternative_reconciliation', analyticalGrain: 'uniqueid',
    dateFields: ['call_date'], candidateKeys: ['uniqueid'], sensitiveFields: ['user', 'first_name', 'last_name'],
    columns: [col('uniqueid', 'STRING', 1), col('lead_id', 'INT64', 2)],
  },
];

// 4. vibe-code-warren-stear.analytics_warehouse (2 objects: 2 TABLE)
const ANALYTICS_WAREHOUSE_OBJECTS: DictionaryObject[] = [
  {
    project: 'vibe-code-warren-stear', dataset: 'analytics_warehouse', tableName: 'ontact_raw_data', tableType: 'TABLE',
    family: 'raw_json', disposition: 'raw_awaiting_interpretation', analyticalGrain: 'unique_id',
    dateFields: ['timestamp'], candidateKeys: ['unique_id'], sensitiveFields: ['raw_data'],
    columns: [col('unique_id', 'STRING', 1), col('source', 'STRING', 2), col('timestamp', 'TIMESTAMP', 3), col('raw_data', 'JSON', 4)],
  },
  {
    project: 'vibe-code-warren-stear', dataset: 'analytics_warehouse', tableName: 'onvest_raw_data', tableType: 'TABLE',
    family: 'raw_json', disposition: 'raw_awaiting_interpretation', analyticalGrain: 'unique_id',
    dateFields: ['timestamp'], candidateKeys: ['unique_id'], sensitiveFields: ['raw_data'],
    columns: [col('unique_id', 'STRING', 1), col('source', 'STRING', 2), col('timestamp', 'TIMESTAMP', 3), col('raw_data', 'JSON', 4)],
  },
];

export const ALL_WAREHOUSE_OBJECTS: DictionaryObject[] = [
  ...LEAD_LEDGER_OBJECTS,
  ...WATFALL_REPORT_OBJECTS,
  ...VIBE_CODING_OBJECTS,
  ...ANALYTICS_WAREHOUSE_OBJECTS,
];

export function getWarehouseObject(project: string, dataset: string, table: string): DictionaryObject | undefined {
  return ALL_WAREHOUSE_OBJECTS.find(o => o.project === project && o.dataset === dataset && o.tableName === table);
}

export function getObjectsByDataset(project: string, dataset: string): DictionaryObject[] {
  return ALL_WAREHOUSE_OBJECTS.filter(o => o.project === project && o.dataset === dataset);
}

export function getObjectsByFamily(family: DictionaryObject['family']): DictionaryObject[] {
  return ALL_WAREHOUSE_OBJECTS.filter(o => o.family === family);
}
