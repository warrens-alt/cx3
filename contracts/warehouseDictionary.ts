/**
 * All-Projects Data Dictionary Snapshot - 2026-09-27
 * 2 projects, 4 datasets, 65 objects (18 TABLE, 47 VIEW), 1,848 declared columns.
 */

export interface DictionaryColumn {
  name: string;
  type: string;
  nullable: boolean;
  ordinalPosition: number;
}

export interface DictionaryObject {
  project: string;
  dataset: string;
  tableName: string;
  tableType: 'TABLE' | 'VIEW';
  columns: DictionaryColumn[];
  family: 'lead_ledger' | 'vicidial' | 'touchpoints' | 'marketing' | 'waterfall' | 'retail' | 'activations' | 'budgets' | 'raw_json';
  disposition: 'primary' | 'alternative_reconciliation' | 'restricted_detail' | 'backup_duplicate' | 'raw_awaiting_interpretation' | 'blocked';
  analyticalGrain: string;
  dateFields: string[];
  candidateKeys: string[];
  sensitiveFields: string[];
  ownershipField?: string;
}

export const WAREHOUSE_SNAPSHOT_DATE = '2026-09-27';

export const RAW_JSON_SOURCES = [
  'vibe-code-warren-stear.analytics_warehouse.ontact_raw_data',
  'vibe-code-warren-stear.analytics_warehouse.onvest_raw_data',
] as const;

export const CANDIDATE_SPEND_SOURCES = [
  'dashboards-422710.lead_ledger.tbl_lead_ledger_lewis_group_top_stores',
  'dashboards-422710.lead_ledger.tbl_lewis_group_waterfall_report',
  'dashboards-422710.watfall_report.view_lewis_group_waterfall_report_lewis',
  'dashboards-422710.vibe_coding_data.tbl_vibe_code_warren_stear_ontact_ofline_data',
  'dashboards-422710.vibe_coding_data.view_combined',
  'dashboards-422710.vibe_coding_data.view_onvest_online_data',
  'dashboards-422710.vibe_coding_data.view_onvest_online_data_v1',
  'dashboards-422710.vibe_coding_data.view_output_view',
] as const;
