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

export const EXPORT_MANIFEST_EVIDENCE = {
  exportedAt: '2026-09-27T01:37:20.228Z',
  scope: 'all_projects' as const,
  totalProjects: 2,
  totalDatasets: 4,
  totalObjects: 65,
  totalTables: 18,
  totalViews: 47,
  totalDeclaredColumns: 1848,
  totalRowsExported: 981,
  rowLimitPerSource: 50,
  successfulSourcesCount: 20,
  restrictedSourcesCount: 45,
  datasetCoverage: {
    'dashboards-422710.lead_ledger': { successful: 13, total: 35 },
    'dashboards-422710.vibe_coding_data': { successful: 5, total: 10 },
    'dashboards-422710.watfall_report': { successful: 0, total: 18 },
    'vibe-code-warren-stear.analytics_warehouse': { successful: 2, total: 2 },
  },
  note: 'Handover evidence from capped sample export (max 50 rows per object). Not a live warehouse completeness assertion.',
} as const;

export interface ObservedViewFailure {
  objectName: string;
  project: string;
  dataset: string;
  table: string;
  failingDependency: string;
  errorReason: string;
  ownerActionRequired: string;
  isDedicatedTenantView: boolean;
  tenantId?: string;
}

export interface HistoricalExportOutcome {
  status: 'SUCCESS' | 'RESTRICTED' | 'UNKNOWN';
  rowsExported: number | null;
  exportedAt: string | null;
  failingDependency?: string | null;
  errorReason?: string | null;
  ownerActionRequired: string;
}

/** Observed dependency failures from the 2026-09-27 bulk export notice files. */
export const OBSERVED_EXPORT_FAILURES: Record<string, ObservedViewFailure> = {
  // Dedicated tenant views (8)
  'dashboards-422710.lead_ledger.view_lead_ledger_mtn_lead_submit_open': {
    objectName: 'dashboards-422710.lead_ledger.view_lead_ledger_mtn_lead_submit_open',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_lead_ledger_mtn_lead_submit_open',
    failingDependency: 'offernet-dmp.external_data_echos.extrnal_data_echos_mtn_activation_master',
    errorReason: 'Access Denied: Table offernet-dmp:external_data_echos.extrnal_data_echos_mtn_activation_master: User does not have permission to query table or it does not exist.',
    ownerActionRequired: 'Data owner must grant roles/bigquery.dataViewer or configure authorized view access on offernet-dmp:external_data_echos for the querying identity.',
    isDedicatedTenantView: true, tenantId: 'mtn',
  },
  'dashboards-422710.lead_ledger.view_lead_ledger_blc_lead_submit_open': {
    objectName: 'dashboards-422710.lead_ledger.view_lead_ledger_blc_lead_submit_open',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_lead_ledger_blc_lead_submit_open',
    failingDependency: 'offernet-dmp.external_data_echos.extrnal_data_echos_blc_activations_master',
    errorReason: 'Access Denied: Table offernet-dmp:external_data_echos.extrnal_data_echos_blc_activations_master: User does not have permission to query table or it does not exist.',
    ownerActionRequired: 'Data owner must grant roles/bigquery.dataViewer or configure authorized view access on offernet-dmp:external_data_echos for the querying identity.',
    isDedicatedTenantView: true, tenantId: 'ontact_blc',
  },
  'dashboards-422710.lead_ledger.view_lead_ledger_bizvoip_lead_submit_open': {
    objectName: 'dashboards-422710.lead_ledger.view_lead_ledger_bizvoip_lead_submit_open',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_lead_ledger_bizvoip_lead_submit_open',
    failingDependency: 'offernet-dmp.external_data_echos.extrnal_data_echos_bizvoip_vicidial_log',
    errorReason: 'Access Denied: Table offernet-dmp:external_data_echos.extrnal_data_echos_bizvoip_vicidial_log: User does not have permission to query table or it does not exist.',
    ownerActionRequired: 'Data owner must grant roles/bigquery.dataViewer or configure authorized view access on offernet-dmp:external_data_echos for the querying identity.',
    isDedicatedTenantView: true, tenantId: 'vodacom_bizvoip',
  },
  'dashboards-422710.lead_ledger.view_lead_ledger_real_promotions_lead_submit_open': {
    objectName: 'dashboards-422710.lead_ledger.view_lead_ledger_real_promotions_lead_submit_open',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_lead_ledger_real_promotions_lead_submit_open',
    failingDependency: 'offernet-dmp.external_data_echos.extrnal_data_echos_real_promotions_calls_master',
    errorReason: 'Access Denied: Table offernet-dmp:external_data_echos.extrnal_data_echos_real_promotions_calls_master: User does not have permission to query table or it does not exist.',
    ownerActionRequired: 'Data owner must grant roles/bigquery.dataViewer or configure authorized view access on offernet-dmp:external_data_echos for the querying identity.',
    isDedicatedTenantView: true, tenantId: 'real_promotions',
  },
  'dashboards-422710.lead_ledger.view_lead_ledger_mondo_lead_submit_open': {
    objectName: 'dashboards-422710.lead_ledger.view_lead_ledger_mondo_lead_submit_open',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_lead_ledger_mondo_lead_submit_open',
    failingDependency: 'offernet-dmp.hot_lead_connect.mondo_lead_submit',
    errorReason: 'Access Denied: Table offernet-dmp:hot_lead_connect.mondo_lead_submit: User does not have permission to query table or it does not exist.',
    ownerActionRequired: 'Data owner must grant roles/bigquery.dataViewer or configure authorized view access on offernet-dmp:hot_lead_connect for the querying identity.',
    isDedicatedTenantView: true, tenantId: 'mondo',
  },
  'dashboards-422710.lead_ledger.view_lead_leadger_oneplan_lead_submit_open': {
    objectName: 'dashboards-422710.lead_ledger.view_lead_leadger_oneplan_lead_submit_open',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_lead_leadger_oneplan_lead_submit_open',
    failingDependency: 'offernet-dmp.hot_lead_connect.oneplan_lead_submit',
    errorReason: 'Access Denied: Table offernet-dmp:hot_lead_connect.oneplan_lead_submit: User does not have permission to query table or it does not exist.',
    ownerActionRequired: 'Data owner must grant roles/bigquery.dataViewer or configure authorized view access on offernet-dmp:hot_lead_connect for the querying identity.',
    isDedicatedTenantView: true, tenantId: 'oneplan',
  },
  'dashboards-422710.lead_ledger.view_lead_ledger_rewardsco_lead_submit_open': {
    objectName: 'dashboards-422710.lead_ledger.view_lead_ledger_rewardsco_lead_submit_open',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_lead_ledger_rewardsco_lead_submit_open',
    failingDependency: 'offernet-dmp.hot_lead_connect.rewardsco_lead_submit',
    errorReason: 'Access Denied: Table offernet-dmp:hot_lead_connect.rewardsco_lead_submit: User does not have permission to query table or it does not exist.',
    ownerActionRequired: 'Data owner must grant roles/bigquery.dataViewer or configure authorized view access on offernet-dmp:hot_lead_connect for the querying identity.',
    isDedicatedTenantView: true, tenantId: 'rewardsco',
  },
  'dashboards-422710.lead_ledger.view_lead_ledger_affiliate_lead_submit_open': {
    objectName: 'dashboards-422710.lead_ledger.view_lead_ledger_affiliate_lead_submit_open',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_lead_ledger_affiliate_lead_submit_open',
    failingDependency: 'offernet-dmp.hot_lead_connect.affiliate_lead_submit',
    errorReason: 'Access Denied: Table offernet-dmp:hot_lead_connect.affiliate_lead_submit: User does not have permission to query table or it does not exist.',
    ownerActionRequired: 'Data owner must grant roles/bigquery.dataViewer or configure authorized view access on offernet-dmp:hot_lead_connect for the querying identity.',
    isDedicatedTenantView: true, tenantId: 'affiliate',
  },

  // Other Lead Ledger views with external dependencies
  'dashboards-422710.lead_ledger.view_all_lead_submit_open': {
    objectName: 'dashboards-422710.lead_ledger.view_all_lead_submit_open',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_all_lead_submit_open',
    failingDependency: 'offernet-dmp.hot_lead_connect.oneplan_lead_submit',
    errorReason: 'Access Denied: Table offernet-dmp:hot_lead_connect.oneplan_lead_submit: User does not have permission to query table or it does not exist.',
    ownerActionRequired: 'Grant roles/bigquery.dataViewer on offernet-dmp:hot_lead_connect.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.lead_ledger.view_fb_budget_changes': {
    objectName: 'dashboards-422710.lead_ledger.view_fb_budget_changes',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_fb_budget_changes',
    failingDependency: 'jg-test-fb-reporting-data.jg_test_fb_data_stream.fbdatastreamtestotherclients',
    errorReason: 'Access Denied: Table jg-test-fb-reporting-data:jg_test_fb_data_stream.fbdatastreamtestotherclients: User does not have permission or it does not exist.',
    ownerActionRequired: 'Grant roles/bigquery.dataViewer on jg-test-fb-reporting-data:jg_test_fb_data_stream.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.lead_ledger.view_lead_ledger_platform_insights': {
    objectName: 'dashboards-422710.lead_ledger.view_lead_ledger_platform_insights',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_lead_ledger_platform_insights',
    failingDependency: 'waterfall-reports.waterfall_reports.view_dashboard_waterfall_report_onvest',
    errorReason: 'Access Denied: Table waterfall-reports:waterfall_reports.view_dashboard_waterfall_report_onvest: User does not have permission or it does not exist.',
    ownerActionRequired: 'Grant roles/bigquery.dataViewer on waterfall-reports:waterfall_reports.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.lead_ledger.view_touchpoint_projects': {
    objectName: 'dashboards-422710.lead_ledger.view_touchpoint_projects',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_touchpoint_projects',
    failingDependency: 'touchpoint-ui.touchpoint_prod.touchpoint_budget_allocated_wallets',
    errorReason: 'Access Denied: Table touchpoint-ui:touchpoint_prod.touchpoint_budget_allocated_wallets: User does not have permission or it does not exist.',
    ownerActionRequired: 'Grant roles/bigquery.dataViewer on touchpoint-ui:touchpoint_prod.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.lead_ledger.view_all_offershop_lead_submit': {
    objectName: 'dashboards-422710.lead_ledger.view_all_offershop_lead_submit',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_all_offershop_lead_submit',
    failingDependency: 'dashboards-422710.watfall_report.view_affiliate_timeline',
    errorReason: 'Access Denied on underlying view dashboards-422710:watfall_report.view_affiliate_timeline.',
    ownerActionRequired: 'Resolve underlying watfall_report dataset view definitions and permissions.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.lead_ledger.view_blc_activations': {
    objectName: 'dashboards-422710.lead_ledger.view_blc_activations',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_blc_activations',
    failingDependency: 'offernet-dmp.external_data_echos.extrnal_data_echos_blc_activations_master',
    errorReason: 'Access Denied on offernet-dmp:external_data_echos.extrnal_data_echos_blc_activations_master.',
    ownerActionRequired: 'Grant roles/bigquery.dataViewer on offernet-dmp:external_data_echos.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.lead_ledger.view_clustered_lead_ledger': {
    objectName: 'dashboards-422710.lead_ledger.view_clustered_lead_ledger',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_clustered_lead_ledger',
    failingDependency: 'dashboards-422710.watfall_report.view_affiliate_timeline',
    errorReason: 'Access Denied on underlying view dashboards-422710:watfall_report.view_affiliate_timeline.',
    ownerActionRequired: 'Resolve underlying watfall_report dataset access.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.lead_ledger.view_clustered_lead_ledger_open': {
    objectName: 'dashboards-422710.lead_ledger.view_clustered_lead_ledger_open',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_clustered_lead_ledger_open',
    failingDependency: 'offernet-dmp.hot_lead_connect.oneplan_lead_submit',
    errorReason: 'Access Denied on offernet-dmp:hot_lead_connect.oneplan_lead_submit.',
    ownerActionRequired: 'Grant roles/bigquery.dataViewer on offernet-dmp:hot_lead_connect.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.lead_ledger.view_lead_ledger_all_lewis_group_lead_submit_open': {
    objectName: 'dashboards-422710.lead_ledger.view_lead_ledger_all_lewis_group_lead_submit_open',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_lead_ledger_all_lewis_group_lead_submit_open',
    failingDependency: 'dashboards-422710.watfall_report.view_beares_waterfall_timeline',
    errorReason: 'Access Denied on dashboards-422710:watfall_report.view_beares_waterfall_timeline.',
    ownerActionRequired: 'Resolve watfall_report view permissions.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.lead_ledger.view_lead_ledger_all_vicidial_insights': {
    objectName: 'dashboards-422710.lead_ledger.view_lead_ledger_all_vicidial_insights',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_lead_ledger_all_vicidial_insights',
    failingDependency: 'offernet-dmp.external_data_echos.extrnal_data_echos_bizvoip_vicidial_campaigns',
    errorReason: 'Access Denied on offernet-dmp:external_data_echos.extrnal_data_echos_bizvoip_vicidial_campaigns.',
    ownerActionRequired: 'Grant roles/bigquery.dataViewer on offernet-dmp:external_data_echos.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.lead_ledger.view_lead_ledger_all_vicidial_insights_time_to_dial': {
    objectName: 'dashboards-422710.lead_ledger.view_lead_ledger_all_vicidial_insights_time_to_dial',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_lead_ledger_all_vicidial_insights_time_to_dial',
    failingDependency: 'offernet-dmp.external_data_echos.extrnal_data_echos_bizvoip_vicidial_campaigns',
    errorReason: 'Access Denied on offernet-dmp:external_data_echos.extrnal_data_echos_bizvoip_vicidial_campaigns.',
    ownerActionRequired: 'Grant roles/bigquery.dataViewer on offernet-dmp:external_data_echos.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.lead_ledger.view_lead_ledger_invalid_idno_lead_submit_open': {
    objectName: 'dashboards-422710.lead_ledger.view_lead_ledger_invalid_idno_lead_submit_open',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_lead_ledger_invalid_idno_lead_submit_open',
    failingDependency: 'offernet-dmp.external_data_echos.extrnal_data_echos_ontact_vicidial_log',
    errorReason: 'Access Denied on offernet-dmp:external_data_echos.extrnal_data_echos_ontact_vicidial_log.',
    ownerActionRequired: 'Grant roles/bigquery.dataViewer on offernet-dmp:external_data_echos.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.lead_ledger.view_lead_ledger_offer_shop_lead_submit_open': {
    objectName: 'dashboards-422710.lead_ledger.view_lead_ledger_offer_shop_lead_submit_open',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_lead_ledger_offer_shop_lead_submit_open',
    failingDependency: 'offernet-dmp.hot_lead_connect.offer_shop_lead_submit',
    errorReason: 'Access Denied on offernet-dmp:hot_lead_connect.offer_shop_lead_submit.',
    ownerActionRequired: 'Grant roles/bigquery.dataViewer on offernet-dmp:hot_lead_connect.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.lead_ledger.view_offershop_lead_submit': {
    objectName: 'dashboards-422710.lead_ledger.view_offershop_lead_submit',
    project: 'dashboards-422710', dataset: 'lead_ledger', table: 'view_offershop_lead_submit',
    failingDependency: 'offernet-dmp.hot_lead_connect.offer_shop_lead_submit',
    errorReason: 'Access Denied on offernet-dmp:hot_lead_connect.offer_shop_lead_submit.',
    ownerActionRequired: 'Grant roles/bigquery.dataViewer on offernet-dmp:hot_lead_connect.',
    isDedicatedTenantView: false,
  },

  // vibe_coding_data views (5)
  'dashboards-422710.vibe_coding_data.view_combined': {
    objectName: 'dashboards-422710.vibe_coding_data.view_combined',
    project: 'dashboards-422710', dataset: 'vibe_coding_data', table: 'view_combined',
    failingDependency: 'dashboards-422710.vibe_coding_data.view_combined',
    errorReason: 'Access Denied: Table dashboards-422710:vibe_coding_data.view_combined: User does not have permission to query view.',
    ownerActionRequired: 'Authorize view in BigQuery dataset access permissions.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.vibe_coding_data.view_onvest_offline_data': {
    objectName: 'dashboards-422710.vibe_coding_data.view_onvest_offline_data',
    project: 'dashboards-422710', dataset: 'vibe_coding_data', table: 'view_onvest_offline_data',
    failingDependency: 'dashboards-422710.vibe_coding_data.view_onvest_offline_data',
    errorReason: 'Access Denied on view_onvest_offline_data.',
    ownerActionRequired: 'Authorize view in BigQuery dataset access permissions.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.vibe_coding_data.view_onvest_online_data': {
    objectName: 'dashboards-422710.vibe_coding_data.view_onvest_online_data',
    project: 'dashboards-422710', dataset: 'vibe_coding_data', table: 'view_onvest_online_data',
    failingDependency: 'dashboards-422710.vibe_coding_data.view_onvest_online_data',
    errorReason: 'Access Denied on view_onvest_online_data.',
    ownerActionRequired: 'Authorize view in BigQuery dataset access permissions.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.vibe_coding_data.view_onvest_online_data_v1': {
    objectName: 'dashboards-422710.vibe_coding_data.view_onvest_online_data_v1',
    project: 'dashboards-422710', dataset: 'vibe_coding_data', table: 'view_onvest_online_data_v1',
    failingDependency: 'dashboards-422710.vibe_coding_data.view_onvest_online_data_v1',
    errorReason: 'Access Denied on view_onvest_online_data_v1.',
    ownerActionRequired: 'Authorize view in BigQuery dataset access permissions.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.vibe_coding_data.view_output_view': {
    objectName: 'dashboards-422710.vibe_coding_data.view_output_view',
    project: 'dashboards-422710', dataset: 'vibe_coding_data', table: 'view_output_view',
    failingDependency: 'dashboards-422710.vibe_coding_data.view_combined',
    errorReason: 'Access Denied on underlying view dashboards-422710:vibe_coding_data.view_combined.',
    ownerActionRequired: 'Authorize view in BigQuery dataset access permissions.',
    isDedicatedTenantView: false,
  },

  // watfall_report views (18)
  'dashboards-422710.watfall_report.view_affiliate_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_affiliate_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_affiliate_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_affiliate_timeline',
    errorReason: 'Access Denied on view_affiliate_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_beares_waterfall_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_beares_waterfall_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_beares_waterfall_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_beares_waterfall_timeline',
    errorReason: 'Access Denied on view_beares_waterfall_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_bedzone_waterfall_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_bedzone_waterfall_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_bedzone_waterfall_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_bedzone_waterfall_timeline',
    errorReason: 'Access Denied on view_bedzone_waterfall_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_bhe_waterfall_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_bhe_waterfall_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_bhe_waterfall_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_bhe_waterfall_timeline',
    errorReason: 'Access Denied on view_bhe_waterfall_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_bizvoip_waterfall_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_bizvoip_waterfall_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_bizvoip_waterfall_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_bizvoip_waterfall_timeline',
    errorReason: 'Access Denied on view_bizvoip_waterfall_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_blc_waterfall_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_blc_waterfall_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_blc_waterfall_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_blc_waterfall_timeline',
    errorReason: 'Access Denied on view_blc_waterfall_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_invalid_idno_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_invalid_idno_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_invalid_idno_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_invalid_idno_timeline',
    errorReason: 'Access Denied on view_invalid_idno_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_lewis_group_waterfall_report_lewis': {
    objectName: 'dashboards-422710.watfall_report.view_lewis_group_waterfall_report_lewis',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_lewis_group_waterfall_report_lewis',
    failingDependency: 'dashboards-422710.watfall_report.view_lewis_group_waterfall_report_lewis',
    errorReason: 'Access Denied on view_lewis_group_waterfall_report_lewis.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_lewis_waterfall_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_lewis_waterfall_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_lewis_waterfall_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_lewis_waterfall_timeline',
    errorReason: 'Access Denied on view_lewis_waterfall_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_mondo_waterfall_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_mondo_waterfall_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_mondo_waterfall_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_mondo_waterfall_timeline',
    errorReason: 'Access Denied on view_mondo_waterfall_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_mtn_waterfall_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_mtn_waterfall_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_mtn_waterfall_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_mtn_waterfall_timeline',
    errorReason: 'Access Denied on view_mtn_waterfall_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_offernet_full_lead_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_offernet_full_lead_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_offernet_full_lead_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_offernet_full_lead_timeline',
    errorReason: 'Access Denied on view_offernet_full_lead_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_offershop_lead_ledger': {
    objectName: 'dashboards-422710.watfall_report.view_offershop_lead_ledger',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_offershop_lead_ledger',
    failingDependency: 'dashboards-422710.watfall_report.view_offershop_lead_ledger',
    errorReason: 'Access Denied on view_offershop_lead_ledger.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_offershop_rest_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_offershop_rest_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_offershop_rest_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_offershop_rest_timeline',
    errorReason: 'Access Denied on view_offershop_rest_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_oneplan_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_oneplan_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_oneplan_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_oneplan_timeline',
    errorReason: 'Access Denied on view_oneplan_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_onvest_waterfall_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_onvest_waterfall_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_onvest_waterfall_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_blc_waterfall_timeline',
    errorReason: 'Access Denied on view_blc_waterfall_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_real_promotions_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_real_promotions_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_real_promotions_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_real_promotions_timeline',
    errorReason: 'Access Denied on view_real_promotions_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
  'dashboards-422710.watfall_report.view_rewardsco_waterfall_timeline': {
    objectName: 'dashboards-422710.watfall_report.view_rewardsco_waterfall_timeline',
    project: 'dashboards-422710', dataset: 'watfall_report', table: 'view_rewardsco_waterfall_timeline',
    failingDependency: 'dashboards-422710.watfall_report.view_rewardsco_waterfall_timeline',
    errorReason: 'Access Denied on view_rewardsco_waterfall_timeline.',
    ownerActionRequired: 'Authorize dataset watfall_report for application service account.',
    isDedicatedTenantView: false,
  },
};

export const EXTERNAL_DEPENDENCY_PROJECTS = [
  'offernet-dmp',
  'jg-test-fb-reporting-data',
  'waterfall-reports',
  'touchpoint-ui',
] as const;

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

/**
 * Explicit per-source outcomes from the 2026-09-27 bulk export.
 * Success is consumed from verified export manifests; never inferred from absence of failure.
 */
export const HISTORICAL_EXPORT_OUTCOMES: Record<string, HistoricalExportOutcome> = {
  // Confirmed successful tables in 2026-09-27 export
  'dashboards-422710.lead_ledger.blc_remote_activations': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.lead_ledger.clustered_lead_ledger': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.lead_ledger.clustered_lead_ledger_open': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.lead_ledger.clustered_lead_ledger_open_backup': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights_time_to_dial': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.lead_ledger.lead_ledger_platform_insights': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.lead_ledger.tbl_blc_activations': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.lead_ledger.tbl_lead_ledger_all_lewis_group_lead_submit_open': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.lead_ledger.tbl_lead_ledger_lewis_group_top_stores': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.lead_ledger.tbl_lewis_group_waterfall_report': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.lead_ledger.tbl_touchpoint_projects': { status: 'SUCCESS', rowsExported: 31, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.lead_ledger.view_lead_ledger_using_open_leadger': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.vibe_coding_data.tbl_offershop_lead_ledger': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.vibe_coding_data.tbl_vibe_code_warren_stear_ontact_analytics_api': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.vibe_coding_data.tbl_vibe_code_warren_stear_ontact_ofline_data': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.vibe_coding_data.view_vibe-code-warren--stear--ontact--analytics--api': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'dashboards-422710.vibe_coding_data.view_vibe_code_warren_stear_ontact_analytics_api': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'vibe-code-warren-stear.analytics_warehouse.ontact_raw_data': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },
  'vibe-code-warren-stear.analytics_warehouse.onvest_raw_data': { status: 'SUCCESS', rowsExported: 50, exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt, ownerActionRequired: 'None (Available in historical export)' },

  // Observed restricted views populated from OBSERVED_EXPORT_FAILURES
  ...Object.fromEntries(
    Object.entries(OBSERVED_EXPORT_FAILURES).map(([key, fail]) => [
      key,
      {
        status: 'RESTRICTED' as const,
        rowsExported: 0,
        exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt,
        failingDependency: fail.failingDependency,
        errorReason: fail.errorReason,
        ownerActionRequired: fail.ownerActionRequired,
      },
    ])
  ),
};

