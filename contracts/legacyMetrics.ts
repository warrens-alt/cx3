import { LEGACY_LABELS as L } from './naming';
import { divideExactDecimal, exactDecimal } from './exactDecimal';
/** A description of the existing lead-grain queries, not certification of those queries. */
export interface LegacyMetricDefinition {
  id: string; canonicalName: string; reportValue: string; metric: string; definition: string;
  numerator: string; denominator: string; numeratorLabel: string; denominatorLabel: string | null;
  source: string; grain: string; unit: 'records' | 'percent' | 'currency' | 'calls_per_lead';
  waterfallMetricFormula: string; costMetric?: string; costMetricFormula?: string;
  itemNo?: number; formattedItemNo?: string; channel?: string; revenueMetric?: string;
  costOfRevenueMetric?: string; costOfRevenueMetricFormula?: string;
  mappingStatus: 'LEGACY_UNVERIFIED' | 'UNAVAILABLE';
}
function metric(id: string, label: string, numerator: string, numeratorLabel: string,
  denominator = 'N/A', denominatorLabel: string | null = null,
  unit: LegacyMetricDefinition['unit'] = 'records', definition = ''): LegacyMetricDefinition {
  return { id, canonicalName: label, reportValue: label, metric: label, numerator, denominator, numeratorLabel, denominatorLabel,
    source: 'vw_leads', grain: 'lead', unit, mappingStatus: 'LEGACY_UNVERIFIED',
    waterfallMetricFormula: denominatorLabel ? `${numeratorLabel} / ${denominatorLabel}${unit === 'percent' ? ' × 100' : ''}` : 'Not applicable: this is a count or amount.',
    definition: definition || `${numeratorLabel}${denominatorLabel ? ' / ' + denominatorLabel : ''}. Legacy source flags are not independently verified.` };
}
const lead = 'COUNT(DISTINCT lead_id)', dial = 'COUNTIF(has_call = true)', sale = 'COUNTIF(has_sale = true)';
const core = {
  total_leads: metric('total_leads', L.leads, lead, L.leads),
  valid_leads: metric('valid_leads', L.valid, 'COUNTIF(valid_lead = true)', L.valid),
  delivered_leads: metric('delivered_leads', L.delivered, 'COUNTIF(has_delivery = true)', L.delivered),
  called_leads: metric('called_leads', L.called, dial, L.called),
  rpcs: metric('rpcs', L.rpcs, 'COUNTIF(has_rpc = true)', L.rpcs, 'N/A', null, 'records', 'Lead-level RPC flags, including any source-model inferences. Not a count of answered calls or independently verified contacts.'),
  sales: metric('sales', L.sales, sale, L.sales),
  sales_with_revenue: metric('sales_with_revenue', L.billable_sales, 'COUNTIF(has_billable_sale = true)', L.billable_sales, 'N/A', null, 'records', 'Leads with a sale and positive matched recorded revenue. This does not establish sale delivery, contractual billability, invoicing or collection.'),
  activations: metric('activations', L.activations, 'COUNTIF(has_activation = true)', L.activations),
  revenue: metric('revenue', L.revenue, 'SUM(IFNULL(total_revenue, 0))', L.revenue, 'N/A', null, 'currency', 'Expected or recorded revenue from the legacy source model; not verified approved, invoiced or collected value.'),
  delivery_rate: metric('delivery_rate', L.delivery_rate, 'COUNTIF(has_delivery = true)', L.delivered, lead, L.leads, 'percent'),
  dial_rate: metric('dial_rate', L.dial_rate, dial, L.called, lead, L.leads, 'percent'),
  call_coverage: metric('call_coverage', L.call_coverage, dial, L.called, 'COUNTIF(has_delivery = true)', L.delivered, 'percent', 'Ratio of dialled lead flags to delivered lead flags. Unlike v2 delivery coverage, this legacy ratio does not independently enforce a common episode population.'),
  rpc_rate: metric('rpc_rate', L.rpc_rate, 'COUNTIF(has_rpc = true)', L.rpcs, dial, L.called, 'percent'),
  sale_rate: metric('sale_rate', L.sale_rate, sale, L.sales, dial, L.called, 'percent'),
  lead_to_sale_rate: metric('lead_to_sale_rate', L.lead_to_sale_rate, sale, L.sales, lead, L.leads, 'percent'),
  billable_sale_rate: metric('billable_sale_rate', L.billable_sale_rate, 'COUNTIF(has_billable_sale = true)', L.billable_sales, sale, L.sales, 'percent'),
  activation_rate: metric('activation_rate', L.activation_rate, 'COUNTIF(has_activation = true)', L.activations, sale, L.sales, 'percent'),
  revenue_per_lead: metric('revenue_per_lead', L.revenue_per_lead, 'SUM(IFNULL(total_revenue, 0))', L.revenue, lead, L.leads, 'currency'),
  revenue_per_sale: metric('revenue_per_sale', L.revenue_per_sale, 'SUM(IFNULL(total_revenue, 0))', L.revenue, sale, L.sales, 'currency'),
  total_calls: metric('total_calls', L.total_calls, 'SUM(IFNULL(total_calls, 0))', L.total_calls),
  calls_per_lead: metric('calls_per_lead', L.calls_per_lead, 'SUM(IFNULL(total_calls, 0))', L.total_calls, lead, L.leads, 'calls_per_lead'),
  calls_per_called_lead: metric('calls_per_called_lead', L.calls_per_called_lead, 'SUM(IFNULL(total_calls, 0))', L.total_calls, dial, L.called, 'calls_per_lead'),
  one_call_leads: metric('one_call_leads', L.one_call_leads, 'COUNTIF(total_calls = 1)', L.one_call_leads),
  repeat_call_leads: metric('repeat_call_leads', L.repeat_call_leads, 'COUNTIF(total_calls > 1)', L.repeat_call_leads),
};
function unavailable(id: string, label: string, reason: string): LegacyMetricDefinition {
  return { ...metric(id, label, 'CAST(NULL AS INT64)', label, 'N/A', null, 'records', reason),
    mappingStatus: 'UNAVAILABLE', source: 'No validated source mapping', waterfallMetricFormula: 'Unavailable: no validated mapping.' };
}
export const LEGACY_METRICS: Record<string, LegacyMetricDefinition> = {
  ...core,
  transaction_sale_flags: { ...metric('transaction_sale_flags','Sale Flags (Transaction Rows)','COUNTIF(sale = true)','Sale Flag Rows'), grain:'vendor_transaction_row', source:'vw_lead_vendor_transactions' },
  transaction_sales_with_revenue: { ...metric('transaction_sales_with_revenue','Sale Flags with Recorded Revenue','COUNTIF(is_billable_sale = true)','Sale Flag Rows with Positive Recorded Revenue', 'N/A', null, 'records', 'Transaction-row sale flags with positive recorded revenue; not proof of sale delivery, contractual billability or cash collection.'), grain:'vendor_transaction_row', source:'vw_lead_vendor_transactions' },
  fetched_leads: core.total_leads, dialed_leads: core.called_leads, dialled_leads: core.called_leads, lead_dial_rate: core.call_coverage,
  standardised_leads: unavailable('standardised_leads','Standardised Leads','Requires a standardisation event; a validity flag is not evidence of standardisation.'),
  qualified_leads: unavailable('qualified_leads','Qualified Leads','Requires an approved qualification rule; valid data is not necessarily a qualified lead.'),
  answered_calls: unavailable('answered_calls','Answered Calls','Requires observed answer dispositions at call-event grain; RPC or positive duration alone is not an answer-event mapping.'),
  answer_rate: unavailable('answer_rate','Call Answer Rate','Requires answered call attempts / all eligible call attempts. No validated answer-event mapping is available.'),
  delivered_sales: unavailable('delivered_sales','Delivered Sales','Requires an observed sale-delivery event. Positive revenue is not evidence of sale delivery.'),
  sales_payment_collected: unavailable('sales_payment_collected','Sales payment collected','Requires observed payment transactions; positive expected revenue is not payment evidence.'),
  internal_deduped_leads: unavailable('internal_deduped_leads','Internal DeDuped Leads','Requires a validated duplicate classification; failed validation is not necessarily duplication.'),
  right_party_contact: core.rpcs,
  premium_collections: unavailable('premium_collections','Premium Collections','Requires premium payment records; recorded lead revenue is not a premium collection.'),
  lifetime_value: unavailable('lifetime_value','Customer Lifetime Value','Requires a defined customer lifetime, retention and value model; revenue per lead is not lifetime value.'),
  duplicate_leads: unavailable('duplicate_leads','Duplicate Leads','Requires a validated duplicate classification; failed validation is not necessarily duplication.'),
  duplicate_rate: unavailable('duplicate_rate','Duplicate Lead Rate','Requires duplicate leads / evaluated leads; unavailable does not mean zero.'),
};
/** These expression strings are unchanged from the existing dynamic query engine. */
export const EXPLORER_EXPRESSIONS: Record<string, string> = {
  leads: 'COUNT(*)', delivered: 'COUNTIF(has_delivery)', called: 'COUNTIF(has_call)', rpcs: 'COUNTIF(has_rpc)',
  sales: 'COUNTIF(has_sale)', billable_sales: 'COUNTIF(has_billable_sale)', activations: 'COUNTIF(has_activation)', revenue: 'SUM(total_revenue)',
  delivery_rate: '100 * SAFE_DIVIDE(COUNTIF(has_delivery), COUNT(*))', dial_rate: '100 * SAFE_DIVIDE(COUNTIF(has_call), COUNT(*))',
  call_coverage: '100 * SAFE_DIVIDE(COUNTIF(has_call), COUNTIF(has_delivery))', rpc_rate: '100 * SAFE_DIVIDE(COUNTIF(has_rpc), COUNTIF(has_call))',
  sale_rate: '100 * SAFE_DIVIDE(COUNTIF(has_sale), COUNTIF(has_call))', lead_to_sale_rate: '100 * SAFE_DIVIDE(COUNTIF(has_sale), COUNT(*))',
  billable_sale_rate: '100 * SAFE_DIVIDE(COUNTIF(has_billable_sale), COUNTIF(has_sale))', activation_rate: '100 * SAFE_DIVIDE(COUNTIF(has_activation), COUNTIF(has_sale))',
  revenue_per_lead: 'SAFE_DIVIDE(SUM(total_revenue), COUNT(*))', revenue_per_sale: 'SAFE_DIVIDE(SUM(total_revenue), COUNTIF(has_sale))', calls_per_lead: 'SAFE_DIVIDE(SUM(total_calls), COUNT(*))',
};
const keys: Record<string,string> = { leads:'total_leads', delivered:'delivered_leads', called:'called_leads', billable_sales:'sales_with_revenue' };
export const EXPLORER_METRICS = Object.keys(EXPLORER_EXPRESSIONS).map(id => {
  const m = LEGACY_METRICS[keys[id] || id];
  return { id, label: m.canonicalName + (m.unit === 'percent' ? ' (%)' : ''), unit: m.unit,
    additive: m.denominator === 'N/A', definition: m.definition, formula: m.waterfallMetricFormula };
});
export function formatExplorerValue(value: unknown, id: string, currency = 'ZAR'): string {
  // Historic callers can already hold an IEEE-754 display value; warehouse/API paths use strings.
  const exact = exactDecimal(typeof value === 'number' && Number.isFinite(value) ? String(value) : value);
  if (exact === null) return 'Unavailable';
  const m = EXPLORER_METRICS.find(x => x.id === id);
  const roundedRaw = m?.unit === 'records' ? exact : divideExactDecimal(exact, '1', 2) ?? exact;
  const rounded = roundedRaw.includes('.') ? roundedRaw.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : roundedRaw;
  const [whole, fraction] = rounded.split('.');
  const number = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction === undefined ? '' : `.${fraction}`}`;
  return `${m?.unit === 'currency' ? currency + ' ' : ''}${number}${m?.unit === 'percent' ? '%' : ''}`;
}
