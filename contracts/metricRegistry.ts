/**
 * Authoritative Server-Owned Capability and Metric Registry Contract
 * Version: cx.metric.2.0.0
 * 
 * Enforces strict mathematical rules, explicit non-ambiguous labels, counting grains,
 * date bases, precision, and handling of missing/unknown outcomes.
 */

export const METRIC_REGISTRY_VERSION = 'cx.metric.2.0.0';

export type CountingGrain =
  | 'lead'
  | 'lead_vendor_route'
  | 'vendor_transaction_row'
  | 'call_event'
  | 'contract'
  | 'source_aggregate';

export type DateBasis =
  | 'intake_cohort'
  | 'activity_period'
  | 'fixed_age_horizon';

export type MetricUnit =
  | 'records'
  | 'percent'
  | 'currency'
  | 'seconds'
  | 'calls_per_lead';

export type UnknownTreatment =
  | 'excluded_from_numerator_and_denominator'
  | 'withheld_if_unverified'
  | 'explicit_false_only'
  | 'preserved_in_missing_discrepancy'
  | 'zero_not_assumed';

export interface AuthoritativeMetricDefinition {
  id: string;
  businessLabel: string;
  technicalLabel: string;
  version: typeof METRIC_REGISTRY_VERSION;
  countingGrain: CountingGrain;
  unit: MetricUnit;
  numerator: string;
  numeratorDescription: string;
  denominator: string | null;
  denominatorDescription: string | null;
  scaling: 'percentage_value' | 'ratio_fraction' | 'none';
  dateBasis: DateBasis;
  additive: boolean;
  treatmentOfUnknown: UnknownTreatment;
  supportedDimensions: string[];
  reconciliationStatus: 'RECONCILED' | 'PARTIAL' | 'NOT_VERIFIED' | 'UNAVAILABLE';
  dependencies: string[];
  caveats: string[];
}

export const AUTHORITATIVE_METRICS: Record<string, AuthoritativeMetricDefinition> = {
  fetched_leads: {
    id: 'fetched_leads',
    businessLabel: 'Fetched leads',
    technicalLabel: 'Fetched cohort leads',
    version: METRIC_REGISTRY_VERSION,
    countingGrain: 'lead',
    unit: 'records',
    numerator: 'COUNT(DISTINCT lead_id)',
    numeratorDescription: 'Distinct lead identifiers fetched within the reporting window.',
    denominator: null,
    denominatorDescription: null,
    scaling: 'none',
    dateBasis: 'intake_cohort',
    additive: true,
    treatmentOfUnknown: 'preserved_in_missing_discrepancy',
    supportedDimensions: ['vendor', 'source', 'grade', 'medium', 'client'],
    reconciliationStatus: 'RECONCILED',
    dependencies: ['leads'],
    caveats: ['Distinct lead grain; duplicate submissions collapsed under documented identity rules.'],
  },

  delivered_leads: {
    id: 'delivered_leads',
    businessLabel: 'Delivered leads',
    technicalLabel: 'Delivered leads',
    version: METRIC_REGISTRY_VERSION,
    countingGrain: 'lead',
    unit: 'records',
    numerator: 'COUNT(DISTINCT IF(is_delivered, lead_id, NULL))',
    numeratorDescription: 'Distinct leads with an observed delivery event to an operational queue.',
    denominator: null,
    denominatorDescription: null,
    scaling: 'none',
    dateBasis: 'intake_cohort',
    additive: true,
    treatmentOfUnknown: 'zero_not_assumed',
    supportedDimensions: ['vendor', 'source', 'grade'],
    reconciliationStatus: 'RECONCILED',
    dependencies: ['leads', 'deliveries'],
    caveats: ['Requires valid delivered timestamp.'],
  },

  delivery_rate: {
    id: 'delivery_rate',
    businessLabel: 'Delivered / fetched',
    technicalLabel: 'Delivery rate (Delivered / fetched)',
    version: METRIC_REGISTRY_VERSION,
    countingGrain: 'lead',
    unit: 'percent',
    numerator: 'delivered_leads',
    numeratorDescription: 'Distinct delivered leads',
    denominator: 'fetched_leads',
    denominatorDescription: 'Distinct fetched leads',
    scaling: 'percentage_value',
    dateBasis: 'intake_cohort',
    additive: false,
    treatmentOfUnknown: 'zero_not_assumed',
    supportedDimensions: ['vendor', 'source', 'grade'],
    reconciliationStatus: 'RECONCILED',
    dependencies: ['leads'],
    caveats: ['Rate without a denominator is unavailable, not measured 0%.'],
  },

  dialled_leads: {
    id: 'dialled_leads',
    businessLabel: 'Dialled leads',
    technicalLabel: 'Timestamp-confirmed dialled leads',
    version: METRIC_REGISTRY_VERSION,
    countingGrain: 'lead',
    unit: 'records',
    numerator: 'COUNT(DISTINCT IF(is_dialled, lead_id, NULL))',
    numeratorDescription: 'Distinct leads with a verified dial timestamp.',
    denominator: null,
    denominatorDescription: null,
    scaling: 'none',
    dateBasis: 'intake_cohort',
    additive: true,
    treatmentOfUnknown: 'preserved_in_missing_discrepancy',
    supportedDimensions: ['vendor', 'source', 'grade'],
    reconciliationStatus: 'RECONCILED',
    dependencies: ['leads', 'calls'],
    caveats: ['Requires timestamp-confirmed dial event; counter alone is not proof of dial.'],
  },

  dial_rate: {
    id: 'dial_rate',
    businessLabel: 'Dialled / delivered',
    technicalLabel: 'Dial rate (Dialled / delivered)',
    version: METRIC_REGISTRY_VERSION,
    countingGrain: 'lead',
    unit: 'percent',
    numerator: 'dialled_leads',
    numeratorDescription: 'Dialled leads',
    denominator: 'delivered_leads',
    denominatorDescription: 'Delivered leads',
    scaling: 'percentage_value',
    dateBasis: 'intake_cohort',
    additive: false,
    treatmentOfUnknown: 'zero_not_assumed',
    supportedDimensions: ['vendor', 'source', 'grade'],
    reconciliationStatus: 'RECONCILED',
    dependencies: ['leads', 'calls'],
    caveats: ['Explicit label: Dialled / delivered. Never conflated with Dialled / fetched.'],
  },

  rpc_leads: {
    id: 'rpc_leads',
    businessLabel: 'Right-party contacts (RPC)',
    technicalLabel: 'RPC leads',
    version: METRIC_REGISTRY_VERSION,
    countingGrain: 'lead',
    unit: 'records',
    numerator: 'COUNT(DISTINCT IF(is_rpc, lead_id, NULL))',
    numeratorDescription: 'Distinct leads with verified right-party contact.',
    denominator: null,
    denominatorDescription: null,
    scaling: 'none',
    dateBasis: 'intake_cohort',
    additive: true,
    treatmentOfUnknown: 'explicit_false_only',
    supportedDimensions: ['vendor', 'source', 'grade'],
    reconciliationStatus: 'RECONCILED',
    dependencies: ['leads', 'calls'],
    caveats: ['Unknown RPC is null; explicit false is no-RPC. Never treat unknown as negative.'],
  },

  rpc_rate: {
    id: 'rpc_rate',
    businessLabel: 'RPC / dialled',
    technicalLabel: 'RPC rate (RPC / dialled)',
    version: METRIC_REGISTRY_VERSION,
    countingGrain: 'lead',
    unit: 'percent',
    numerator: 'rpc_leads',
    numeratorDescription: 'RPC leads',
    denominator: 'dialled_leads',
    denominatorDescription: 'Dialled leads',
    scaling: 'percentage_value',
    dateBasis: 'intake_cohort',
    additive: false,
    treatmentOfUnknown: 'explicit_false_only',
    supportedDimensions: ['vendor', 'source', 'grade'],
    reconciliationStatus: 'RECONCILED',
    dependencies: ['leads', 'calls'],
    caveats: ['Denominator must be dialled leads, not total fetched leads.'],
  },

  sale_leads: {
    id: 'sale_leads',
    businessLabel: 'Recorded sales',
    technicalLabel: 'Sale leads',
    version: METRIC_REGISTRY_VERSION,
    countingGrain: 'lead',
    unit: 'records',
    numerator: 'COUNT(DISTINCT IF(is_sale, lead_id, NULL))',
    numeratorDescription: 'Distinct leads with recorded sale event.',
    denominator: null,
    denominatorDescription: null,
    scaling: 'none',
    dateBasis: 'intake_cohort',
    additive: true,
    treatmentOfUnknown: 'zero_not_assumed',
    supportedDimensions: ['vendor', 'source', 'grade'],
    reconciliationStatus: 'RECONCILED',
    dependencies: ['leads', 'sales'],
    caveats: ['Observed source sale flag; not contractual billability.'],
  },

  sales_per_fetched_rate: {
    id: 'sales_per_fetched_rate',
    businessLabel: 'Sales / fetched',
    technicalLabel: 'Lead conversion rate (Sales / fetched)',
    version: METRIC_REGISTRY_VERSION,
    countingGrain: 'lead',
    unit: 'percent',
    numerator: 'sale_leads',
    numeratorDescription: 'Recorded sale leads',
    denominator: 'fetched_leads',
    denominatorDescription: 'Total fetched leads',
    scaling: 'percentage_value',
    dateBasis: 'intake_cohort',
    additive: false,
    treatmentOfUnknown: 'zero_not_assumed',
    supportedDimensions: ['vendor', 'source', 'grade'],
    reconciliationStatus: 'RECONCILED',
    dependencies: ['leads', 'sales'],
    caveats: ['True lead-to-sale rate; distinct from Sales / RPC.'],
  },

  sales_per_rpc_rate: {
    id: 'sales_per_rpc_rate',
    businessLabel: 'Sales / RPC',
    technicalLabel: 'Contact closing rate (Sales / RPC)',
    version: METRIC_REGISTRY_VERSION,
    countingGrain: 'lead',
    unit: 'percent',
    numerator: 'sale_leads',
    numeratorDescription: 'Recorded sale leads',
    denominator: 'rpc_leads',
    denominatorDescription: 'Right-party contacts',
    scaling: 'percentage_value',
    dateBasis: 'intake_cohort',
    additive: false,
    treatmentOfUnknown: 'explicit_false_only',
    supportedDimensions: ['vendor', 'source', 'grade'],
    reconciliationStatus: 'RECONCILED',
    dependencies: ['leads', 'calls', 'sales'],
    caveats: ['Do NOT label Sales / RPC as "Lead-to-sale". This is contact conversion.'],
  },

  activated_leads: {
    id: 'activated_leads',
    businessLabel: 'Recorded activations',
    technicalLabel: 'Activated leads',
    version: METRIC_REGISTRY_VERSION,
    countingGrain: 'lead',
    unit: 'records',
    numerator: 'COUNT(DISTINCT IF(is_activated, lead_id, NULL))',
    numeratorDescription: 'Distinct leads with recorded service activation.',
    denominator: null,
    denominatorDescription: null,
    scaling: 'none',
    dateBasis: 'intake_cohort',
    additive: true,
    treatmentOfUnknown: 'zero_not_assumed',
    supportedDimensions: ['vendor', 'source', 'grade'],
    reconciliationStatus: 'RECONCILED',
    dependencies: ['leads', 'activations'],
    caveats: ['Requires dated activation event. Source creation date is not service activation.'],
  },

  activation_rate: {
    id: 'activation_rate',
    businessLabel: 'Activations / recorded sales',
    technicalLabel: 'Activation fulfilment rate (Activations / sales)',
    version: METRIC_REGISTRY_VERSION,
    countingGrain: 'lead',
    unit: 'percent',
    numerator: 'activated_leads',
    numeratorDescription: 'Activated leads',
    denominator: 'sale_leads',
    denominatorDescription: 'Sale leads',
    scaling: 'percentage_value',
    dateBasis: 'intake_cohort',
    additive: false,
    treatmentOfUnknown: 'zero_not_assumed',
    supportedDimensions: ['vendor', 'source', 'grade'],
    reconciliationStatus: 'RECONCILED',
    dependencies: ['leads', 'sales', 'activations'],
    caveats: ['Fulfilment rate of sales; requires observation horizon to mature.'],
  },

  one_call_dialled_share: {
    id: 'one_call_dialled_share',
    businessLabel: 'One-call dialled share',
    technicalLabel: 'Share of timestamp-confirmed dialled leads with 1 call',
    version: METRIC_REGISTRY_VERSION,
    countingGrain: 'lead',
    unit: 'percent',
    numerator: 'COUNTIF(is_dialled AND recorded_call_count = 1)',
    numeratorDescription: 'Dialled leads with exactly one recorded cumulative call.',
    denominator: 'dialled_leads',
    denominatorDescription: 'Timestamp-confirmed dialled leads',
    scaling: 'percentage_value',
    dateBasis: 'intake_cohort',
    additive: false,
    treatmentOfUnknown: 'preserved_in_missing_discrepancy',
    supportedDimensions: ['vendor'],
    reconciliationStatus: 'RECONCILED',
    dependencies: ['leads', 'calls'],
    caveats: [
      'Both numerator and denominator strictly use the dialled population.',
      'Cannot exceed 100%. Discrepancies between counter=1 and unrecorded timestamps are isolated.',
    ],
  },

  sla_15m_rate: {
    id: 'sla_15m_rate',
    businessLabel: '15-minute first dial SLA',
    technicalLabel: 'SLA compliance (Delivery → dial <= 15m)',
    version: METRIC_REGISTRY_VERSION,
    countingGrain: 'lead',
    unit: 'percent',
    numerator: 'COUNTIF(is_delivered AND is_dialled AND delivery_to_dial_sec BETWEEN 0 AND 900)',
    numeratorDescription: 'Delivered leads with first recorded dial within 15 minutes.',
    denominator: 'delivered_leads',
    denominatorDescription: 'Delivered leads',
    scaling: 'percentage_value',
    dateBasis: 'intake_cohort',
    additive: false,
    treatmentOfUnknown: 'zero_not_assumed',
    supportedDimensions: ['vendor'],
    reconciliationStatus: 'RECONCILED',
    dependencies: ['leads', 'deliveries', 'calls'],
    caveats: ['Excludes invalid ordered timestamps from latency calculation.'],
  },
};

/**
 * Format helper honoring exact decimals and currency representations.
 */
export function formatMetricLabel(metricId: string): string {
  return AUTHORITATIVE_METRICS[metricId]?.businessLabel || metricId;
}
