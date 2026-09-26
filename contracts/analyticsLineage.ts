export interface AnalyticsMetricDefinition {
  id: string;
  label: string;
  source: 'lead_ledger' | 'marketing_contract' | 'approved_call_contract';
  grain: string;
  population: string;
  numerator: string;
  denominator: string | null;
  dateBasis: string;
  filterCompatibility: string;
  nullMeaning: string;
  validationState: string;
}

const operational = (id: string, label: string, numerator: string, denominator: string | null = null): AnalyticsMetricDefinition => ({
  id, label, source: 'lead_ledger', grain: 'One selected lead after tenant and vendor scoping',
  population: 'Fetched lead cohort; stage events require valid recorded evidence', numerator, denominator,
  dateBasis: 'Capture date in tenant-local timezone',
  filterCompatibility: 'Client, capture dates, vendor, source, medium and grade. Unsupported cross-grain filters fail closed.',
  nullMeaning: 'Unavailable evidence or no valid denominator; an observed zero remains zero.', validationState: 'NOT_VERIFIED',
});
const marketing = (id: string, label: string, numerator: string, denominator: string | null): AnalyticsMetricDefinition => ({
  id, label, source: 'marketing_contract', grain: 'Server-approved unique marketing spend grain',
  population: 'Selected marketing rows, aggregated independently of operational leads', numerator, denominator,
  dateBasis: 'Contracted marketing reporting date',
  filterCompatibility: 'Client/date/channel/campaign/ad set. Source propagation and outcome ratios require approved equivalent attribution keys.',
  nullMeaning: 'No approved observed-spend field, invalid grain, incomplete evidence, incompatible scope, or zero denominator. Budget is never spend.',
  validationState: 'Runtime grain/reconciliation checks; independent business verification remains NOT_VERIFIED',
});

export const ANALYTICS_METRIC_DEFINITIONS: AnalyticsMetricDefinition[] = [
  operational('fetchedLeads', 'Fetched leads', 'Distinct selected lead IDs'),
  operational('deliveredLeads', 'Delivered leads', 'Leads with valid delivery timestamp'),
  operational('dialledLeads', 'Dialled leads', 'Leads with valid first-dial timestamp'),
  operational('contactedLeads', 'RPC leads', 'Leads with recorded positive RPC evidence'),
  operational('saleLeads', 'Recorded sales', 'Leads with valid sale timestamp'),
  operational('activatedLeads', 'Activations', 'Leads with valid activation timestamp'),
  operational('deliveryRate', 'Delivery rate', 'Delivered leads', 'Fetched leads'),
  operational('dialRate', 'Dial coverage', 'Dialled leads', 'Delivered leads'),
  operational('contactRate', 'RPC / dialled', 'RPC leads', 'Dialled leads'),
  operational('leadToSaleRate', 'Lead → sale', 'Recorded sale leads', 'Fetched leads'),
  operational('contactToSaleRate', 'RPC → sale', 'Recorded sale leads', 'RPC leads'),
  operational('activationRate', 'Sale → activation', 'Activated leads', 'Recorded sale leads'),
  operational('totalCalls', 'Recorded calls', 'Maximum recorded cumulative call counter per lead, then sum'),
  operational('firstDialLatency', 'First-dial latency', 'Valid nonnegative capture/delivery-to-first-dial seconds', 'Leads with valid timestamps for the labelled interval'),
  operational('recordedRevenue', 'Recorded revenue', 'Recorded revenue in selected ledger transactions; no inferred margin or profit'),
  marketing('totalSpend', 'Total observed spend', 'SUM(approved observed spend), with complete values and unique contracted grain', null),
  marketing('cpc', 'CPC', 'Valid total observed spend', 'Recorded platform clicks > 0'),
  marketing('cpm', 'CPM', 'Valid total observed spend × 1,000', 'Recorded platform impressions > 0'),
  marketing('platformCpl', 'Platform CPL', 'Valid total observed spend', 'Recorded platform lead events > 0'),
  marketing('funnelEconomics', 'Attributed outcome costs', 'Observed spend for approved matched attribution keys', 'Matching fetched/delivered/dialled/RPC/sale/activation population > 0'),
];

export function definitionsForDomain(domain: string): AnalyticsMetricDefinition[] {
  if (domain === 'agent-performance' || domain === 'cli-performance') {
    return [
      { id: 'calls', label: 'Recorded calls', numerator: 'Approved recorded call events', denominator: null },
      { id: 'rpcRate', label: 'RPC / call', numerator: 'Calls with recorded RPC evidence', denominator: 'Calls with complete outcome evidence' },
      { id: 'salePerRpc', label: 'Sale / RPC', numerator: 'RPC calls with recorded sale evidence', denominator: 'RPC calls' },
      { id: 'duration', label: 'Recorded duration', numerator: 'Approved recorded call duration', denominator: 'Calls with complete duration evidence for an average' },
    ].map(metric => ({ ...metric, source: 'approved_call_contract', grain: 'Approved call source grain',
      population: 'Selected tenant-scoped call population', dateBasis: 'Approved call reporting date',
      filterCompatibility: 'Source-supported dimensions only; unsupported filters fail closed.',
      nullMeaning: 'Missing or incomplete call evidence; observed zero duration/outcomes remain zero.', validationState: 'NOT_VERIFIED' }));
  }
  const commercial = ['commercial', 'campaigns', 'marketing-root-cause', 'marketing-attribution'].includes(domain);
  return ANALYTICS_METRIC_DEFINITIONS.filter(metric => commercial || domain === 'overview' || metric.source === 'lead_ledger');
}
