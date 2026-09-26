export interface ParameterMapping {
  canonicalParameter: string;
  sourceTable: string;
  sourceColumn: string;
  dataType: string;
  primarySource: boolean;
  fallbackSource: string | null;
  status: 'MAPPED' | 'UNMAPPED';
}

export const CANONICAL_PARAMETERS: ParameterMapping[] = [
  { canonicalParameter: 'Vendors', sourceTable: 'clustered_lead_ledger', sourceColumn: 'hlc_details.vendor', dataType: 'STRING', primarySource: true, fallbackSource: 'lead_ledger_all_vicidial_insights.vendor', status: 'MAPPED' },
  { canonicalParameter: 'Lead ID', sourceTable: 'clustered_lead_ledger', sourceColumn: 'lead_id', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Total Revenue', sourceTable: 'tbl_blc_activations', sourceColumn: 'expected_ontact_revenue', dataType: 'FLOAT64', primarySource: true, fallbackSource: 'clustered_lead_ledger.hlc_details.revenue_generated', status: 'MAPPED' },
  { canonicalParameter: 'Consumer ID', sourceTable: 'clustered_lead_ledger', sourceColumn: 'consumer_id', dataType: 'INT64', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Offershop Source', sourceTable: 'clustered_lead_ledger', sourceColumn: 'offershop_source', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Fetched', sourceTable: 'clustered_lead_ledger', sourceColumn: 'fetched', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Standardised IDNO', sourceTable: 'clustered_lead_ledger', sourceColumn: 'standardised_idno', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Standardised Mobile', sourceTable: 'clustered_lead_ledger', sourceColumn: 'standardised_mobile', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Standardised Alt Phone', sourceTable: 'clustered_lead_ledger', sourceColumn: 'standardised_alt_phone', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Standardised Email', sourceTable: 'clustered_lead_ledger', sourceColumn: 'standardised_email', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Valid IDNO', sourceTable: 'clustered_lead_ledger', sourceColumn: 'valid_idno', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Validate IDNO', sourceTable: 'clustered_lead_ledger', sourceColumn: 'validate_idno', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Phone Valid', sourceTable: 'clustered_lead_ledger', sourceColumn: 'phone_valid', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Validate Mobile', sourceTable: 'clustered_lead_ledger', sourceColumn: 'validate_mobile', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Hospital Applied', sourceTable: 'clustered_lead_ledger', sourceColumn: 'hospital_applied', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Hospital Applied Date', sourceTable: 'clustered_lead_ledger', sourceColumn: 'hospital_applied_date', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Offershop Color Vetting', sourceTable: 'clustered_lead_ledger', sourceColumn: 'offershop_color_vetting', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Offershop Color Vetting Date', sourceTable: 'clustered_lead_ledger', sourceColumn: 'offershop_color_vetting_date', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Offershop Grade', sourceTable: 'clustered_lead_ledger', sourceColumn: 'offershop_grade', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'Offershop Grade Date', sourceTable: 'clustered_lead_ledger', sourceColumn: 'offershop_grade_date', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'HLC Vendor', sourceTable: 'clustered_lead_ledger', sourceColumn: 'hlc_details.vendor', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'HLC Transaction ID', sourceTable: 'clustered_lead_ledger', sourceColumn: 'hlc_details.transaction_id', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'HLC Status', sourceTable: 'clustered_lead_ledger', sourceColumn: 'hlc_details.status', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'HLC Revenue Generated', sourceTable: 'tbl_blc_activations', sourceColumn: 'expected_ontact_revenue', dataType: 'FLOAT64', primarySource: true, fallbackSource: 'clustered_lead_ledger.hlc_details.revenue_generated', status: 'MAPPED' },
  { canonicalParameter: 'HLC Attempted to Deliver', sourceTable: 'clustered_lead_ledger', sourceColumn: 'hlc_details.attempted_to_deliver', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'HLC Delivered', sourceTable: 'clustered_lead_ledger', sourceColumn: 'hlc_details.delivered', dataType: 'STRING', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'HLC Expected First Dial', sourceTable: 'lead_ledger_all_vicidial_insights_time_to_dial', sourceColumn: 'expected_first_dial', dataType: 'STRING', primarySource: true, fallbackSource: 'clustered_lead_ledger.hlc_details.expected_first_dial', status: 'MAPPED' },
  { canonicalParameter: 'HLC New Dialer Lead', sourceTable: 'clustered_lead_ledger', sourceColumn: 'hlc_details.new_dialer_lead', dataType: 'INT64', primarySource: true, fallbackSource: null, status: 'MAPPED' },
  { canonicalParameter: 'HLC First Call Date', sourceTable: 'lead_ledger_all_vicidial_insights', sourceColumn: 'MIN(call_start_date)', dataType: 'STRING', primarySource: true, fallbackSource: 'clustered_lead_ledger.hlc_details.first_call_date', status: 'MAPPED' },
  { canonicalParameter: 'HLC Last Call Date', sourceTable: 'lead_ledger_all_vicidial_insights', sourceColumn: 'MAX(call_end_date)', dataType: 'STRING', primarySource: true, fallbackSource: 'clustered_lead_ledger.hlc_details.last_call_date', status: 'MAPPED' },
  { canonicalParameter: 'HLC Last Dialer Status', sourceTable: 'lead_ledger_all_vicidial_insights', sourceColumn: 'status_name', dataType: 'STRING', primarySource: true, fallbackSource: 'clustered_lead_ledger.hlc_details.last_dialer_status', status: 'MAPPED' },
  { canonicalParameter: 'HLC Last Call Length in Sec', sourceTable: 'lead_ledger_all_vicidial_insights', sourceColumn: 'length_in_sec', dataType: 'INT64', primarySource: true, fallbackSource: 'clustered_lead_ledger.hlc_details.last_call_length_in_sec', status: 'MAPPED' },
  { canonicalParameter: 'HLC Total Calls Length in Sec', sourceTable: 'lead_ledger_all_vicidial_insights', sourceColumn: 'SUM(length_in_sec)', dataType: 'INT64', primarySource: true, fallbackSource: 'clustered_lead_ledger.hlc_details.total_calls_length_in_sec', status: 'MAPPED' },
  { canonicalParameter: 'HLC Total Calls', sourceTable: 'lead_ledger_all_vicidial_insights', sourceColumn: 'COUNT(*)', dataType: 'INT64', primarySource: true, fallbackSource: 'clustered_lead_ledger.hlc_details.total_calls', status: 'MAPPED' },
  { canonicalParameter: 'HLC RPC', sourceTable: 'lead_ledger_all_vicidial_insights', sourceColumn: 'LOGICAL_OR(is_rpc)', dataType: 'BOOL', primarySource: true, fallbackSource: 'clustered_lead_ledger.hlc_details.rpc', status: 'MAPPED' },
  { canonicalParameter: 'HLC Sale', sourceTable: 'lead_ledger_all_vicidial_insights', sourceColumn: 'LOGICAL_OR(is_sale)', dataType: 'BOOL', primarySource: true, fallbackSource: 'clustered_lead_ledger.hlc_details.sale', status: 'MAPPED' },
  { canonicalParameter: 'HLC Activated', sourceTable: 'tbl_blc_activations', sourceColumn: 'transaction_id', dataType: 'STRING', primarySource: true, fallbackSource: 'clustered_lead_ledger.hlc_details.activated', status: 'MAPPED' }
];

export const SOURCE_OF_TRUTH_REGISTRY = {
  activation: {
    primary: 'activationsTable',
    fallback: 'leadLedgerTable'
  },
  sale: {
    primary: 'vicidialInsightsTable',
    fallback: 'leadLedgerTable'
  },
  calls: {
    primary: 'vicidialInsightsTable',
    fallback: 'leadLedgerTable'
  },
  rpc: {
    primary: 'vicidialInsightsTable',
    fallback: 'leadLedgerTable'
  },
  revenue: {
    primary: 'activationsTable',
    fallback: 'leadLedgerTable'
  },
  marketing: {
    primary: 'platformInsightsTable',
    fallback: null
  },
  leads: {
    primary: 'leadLedgerTable',
    fallback: null
  }
};
