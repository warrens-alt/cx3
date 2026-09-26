/** Display vocabulary only. Source columns, API IDs and vendor identity values are never renamed. */
export const NAMING_VERSION = 'cx.naming.1.0.0';
export const BRAND = { 
  name: 'Offernet', 
  platform: 'Operational Intelligence Platform',
  description: 'Offernet Operational Intelligence Platform', 
  engine: 'Powered by ConversionX' 
} as const;
export const PAGE_TITLES: Readonly<Record<string, string>> = {
  '/': 'Overview',
  '/overview': 'Overview',
  '/funnel': 'Funnel',
  '/speed-to-lead': 'Contact',
  '/contact-strategy': 'Contact Strategy',
  '/vendor-quality': 'Performance',
  '/temporal': 'Time & Day Performance',
  '/sales-activation': 'Sales & Activation',
  '/commercial': 'Commercial Evidence',
  '/data-integrity': 'Data Integrity',
  '/agent-performance': 'Agent Performance',
  '/campaigns': 'Campaigns',
  '/ai-insights': 'AI Insights Status',
  '/lead-explorer': 'Explore',
  '/reports': 'Evidence',
  '/vendors': 'Vendor Performance',
  '/exceptions': 'Exceptions',
  '/reconciliation': 'Commercial Reconciliation',
  '/explore': 'Data Explorer',
  '/routing': 'Lead Routing',
  '/call-performance': 'Call Performance',
  '/cli-performance': 'CLI Performance',
  '/quality': 'Lead Validation & Vetting',
  '/lead-ledger': 'Lead Ledger',
  '/access-control': 'User & Access Control',
  '/users': 'User & Access Control',
};
export const REPORT_COPY = {
  fetched_leads: { label: 'Fetched Leads', numeratorLabel: 'Distinct Lead Submissions', denominatorLabel: null },
  delivered_episodes: { label: 'Lead Deliveries', numeratorLabel: 'Successful Delivery Episodes', denominatorLabel: null },
  call_attempts: { label: 'Call Attempts', numeratorLabel: 'Observed Dialler Events', denominatorLabel: null },
  called_episodes: { label: 'Dialled Lead Deliveries', numeratorLabel: 'Delivered Episodes with a Subsequent Call', denominatorLabel: null },
  call_coverage: { label: 'Delivery-to-Dial Rate', numeratorLabel: 'Delivered Episodes with a Subsequent Call', denominatorLabel: 'Successful Delivery Episodes' },
  sale_events: { label: 'Sales (Recorded Events)', numeratorLabel: 'Distinct Sale Events', denominatorLabel: null },
  activation_events: { label: 'Activations (Recorded Events)', numeratorLabel: 'Distinct Activation Events', denominatorLabel: null },
  sale_activation_rate: { label: 'Sale-to-Activation Rate', numeratorLabel: 'Sales with at Least One Activation', denominatorLabel: 'Distinct Sale Events' },
  expected_value: { label: 'Expected Value', numeratorLabel: 'Signed Expected-Value Changes', denominatorLabel: null },
  approved_value: { label: 'Approved Value', numeratorLabel: 'Signed Approved-Value Changes', denominatorLabel: null },
  invoiced_value: { label: 'Invoiced Amount', numeratorLabel: 'Signed Invoice Changes', denominatorLabel: null },
  collected_value: { label: 'Collected Amount', numeratorLabel: 'Signed Collection Changes', denominatorLabel: null },
} as const;
export const LEGACY_LABELS = {
  leads: 'Fetched Leads', valid: 'Valid Leads (Recorded Flag)', delivered: 'Delivered Leads', called: 'Dialed Leads',
  rpcs: 'Leads with RPC', sales: 'Leads with Sales', billable_sales: 'Leads with Sales and Recorded Revenue',
  activations: 'Leads with Activations', revenue: 'Recorded Revenue',
  delivery_rate: 'Fetched-to-Delivered Lead Rate', dial_rate: 'Fetched-to-Dialed Lead Rate',
  call_coverage: 'Dialed / Delivered Leads', rpc_rate: 'RPC / Dialed Leads',
  sale_rate: 'Sales / Dialed Leads', lead_to_sale_rate: 'Sales / Fetched Leads',
  billable_sale_rate: 'Revenue-Matched Sales / Sales', activation_rate: 'Activations / Sales (Lead Counts)',
  activation_revenue_rate: 'Activations / Revenue-Matched Sales (Lead Counts)',
  revenue_per_lead: 'Recorded Revenue per Fetched Lead', revenue_per_sale: 'Recorded Revenue per Lead with a Sale',
  calls_per_lead: 'Call Attempts per Fetched Lead', calls_per_called_lead: 'Call Attempts per Dialed Lead',
  total_calls: 'Recorded Call Attempts', one_call_leads: 'Leads with One Call Attempt', repeat_call_leads: 'Leads with Repeat Call Attempts',
  one_call_rate: 'One-Call Lead Share', repeat_call_rate: 'Repeat-Call Lead Share',
} as const;
export const DIMENSION_LABELS = { date: 'Capture Date', week: 'Capture Week', month: 'Capture Month',
  source: 'Lead Source', medium: 'Traffic Medium', vendor: 'Vendor', hour: 'Capture Hour', weekday: 'Capture Weekday',
  calls_bucket: 'Call-Attempt Band' } as const;
export const FIELD_LABELS: Readonly<Record<string, string>> = {
  entity_key: 'Record Key', lead_key: 'Lead Key', source_record_id: 'Source Record ID', batch_id: 'Ingestion Batch ID',
  captured_at: 'Capture Timestamp (UTC)', event_at: 'Event Timestamp (UTC)', source: 'Lead Source', medium: 'Traffic Medium', vendor: 'Vendor',
};
