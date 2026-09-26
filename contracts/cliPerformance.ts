/**
 * CLI Performance & Dialler Intelligence Contracts
 * Version: cx.cli.1.0.0
 * 
 * Defines strict mathematical contracts, schema validations, rate definitions,
 * duration bands, lead age bands, and period comparisons for outbound CLI analysis.
 */

import { addExactDecimals, divideExactDecimal, exactDecimal } from './exactDecimal';

export const CLI_CONTRACT_VERSION = 'cx.cli.1.1.0';

export const CLI_DAILY_EXPORT_SCHEMA = [
  { field: 'report_date', required: true, meaning: 'Local reporting date for the daily CLI extract.' },
  { field: 'cli_number', required: true, meaning: 'Outbound caller ID / presentation number.' },
  { field: 'campaign_code', required: true, meaning: 'VICIdial campaign code; export grain is CLI × campaign × report date.' },
  { field: 'total_calls', required: true, meaning: 'Observed call attempts.' },
  { field: 'asr_count', required: false, meaning: 'Carrier/switch seizure count.' },
  { field: 'asr_pct', required: false, meaning: 'ASR count ÷ total calls.' },
  { field: 'answered_count', required: false, meaning: 'Answered calls from the source report.' },
  { field: 'answered_pct', required: false, meaning: 'Answered count ÷ total calls.' },
  { field: 'contact_count', required: true, meaning: 'Right-party-contact count.' },
  { field: 'contact_pct', required: false, meaning: 'Contact count ÷ total calls.' },
  { field: 'sale_count', required: true, meaning: 'Recorded sales.' },
  { field: 'sale_pct', required: false, meaning: 'Sale count ÷ contact count (Sale/RPC), matching the observed OfferNet export.' },
  { field: 'duration_ge_1m_count', required: false, meaning: 'Calls lasting at least 60 seconds.' },
  { field: 'duration_ge_1m_pct', required: false, meaning: 'Calls ≥1m ÷ total calls.' },
  { field: 'duration_ge_5m_count', required: false, meaning: 'Calls lasting at least 300 seconds.' },
  { field: 'duration_ge_5m_pct', required: false, meaning: 'Calls ≥5m ÷ total calls.' },
  { field: 'duration_ge_15m_count', required: false, meaning: 'Calls lasting at least 900 seconds.' },
  { field: 'duration_ge_15m_pct', required: false, meaning: 'Calls ≥15m ÷ total calls.' },
  { field: 'avg_lead_age_days', required: false, meaning: 'Source-reported average lead age for the CLI/campaign row.' },
] as const;

export type CliProvenance = 'LIVE_BIGQUERY' | 'IMPORTED_REPORT';

export type CliMetricStatus = 'MEASURED' | 'PARTIAL' | 'UNAVAILABLE' | 'NOT_VERIFIED';

export interface CliFieldCoverage {
  field: string;
  label: string;
  status: CliMetricStatus;
  sourceColumn: string | null;
  definition: string;
  note?: string;
}

export interface CliDurationBands {
  under1mCount: string | null;
  under1mPct: string | null;
  oneTo5mCount: string | null;
  oneTo5mPct: string | null;
  fiveTo15mCount: string | null;
  fiveTo15mPct: string | null;
  over15mCount: string | null;
  over15mPct: string | null;
  totalDurationSeconds: string | null;
  avgDurationSeconds: string | null;
  medianDurationSeconds: string | null;
}

export interface CliLeadAgeBand {
  band: '< 15 min' | '15–60 min' | '1–4 hours' | '4–24 hours' | '1–2 days' | '2–3 days' | '3+ days';
  callCount: string;
  callSharePct: string;
  contactCount: string;
  contactRatePct: string;
  saleCount: string;
  salePerCallRatePct: string;
}

export interface CliLeadAgeBands {
  bands: CliLeadAgeBand[];
  avgLeadAgeDays: string | null;
  medianLeadAgeDays: string | null;
  joinReliability: 'JOINED_VIA_DIALER_LEAD_ID' | 'SOURCE_REPORTED_ESTIMATE' | 'UNAVAILABLE';
  disclaimer: string;
}

export interface CliPerformanceRecord {
  cli: string;
  campaign: string;
  vendor: string;
  totalCalls: string;
  distinctLeads: string | null;
  callsPerLead: string | null;
  reportDate?: string | null;
  asrCount: string | null;
  asrRate: string | null;
  answeredCount: string | null;
  answeredRate: string | null;
  contactCount: string;
  contactRate: string;
  saleCount: string;
  salePerCallRate: string;
  salePerAnswerRate: string | null;
  salePerContactRate: string | null;
  durationGe1mCount: string | null;
  durationGe1mPct: string | null;
  durationGe5mCount: string | null;
  durationGe5mPct: string | null;
  durationGe15mCount: string | null;
  durationGe15mPct: string | null;
  avgDurationSeconds: string | null;
  totalDurationSeconds: string | null;
  avgLeadAgeDays: string | null;
  activations: string | null;
  recordedValue: string | null;
  valuePerCall: string | null;
  valuePerLead: string | null;
  hasAnomalies: boolean;
  anomalies: string[];
}

export interface CliSummary {
  totalCalls: string;
  activeClis: number;
  distinctLeads: string | null;
  callsPerLead: string | null;
  asrCount: string | null;
  asrRate: string | null;
  answeredCount: string | null;
  answeredRate: string | null;
  contactCount: string;
  contactRate: string;
  saleCount: string;
  salePerCallRate: string;
  salePerAnswerRate: string | null;
  salePerContactRate: string | null;
  durationGe5mRate: string | null;
  avgDurationSeconds: string | null;
  totalDurationSeconds: string | null;
  avgLeadAgeDays: string | null;
  activations: string | null;
  recordedValue: string | null;
}

export interface CliMetricDelta {
  current: string | null;
  previous: string | null;
  delta: string | null;
  pctChange?: string | null;
}

export interface CliPeriodComparison {
  currentPeriod: { start: string; end: string };
  previousPeriod: { start: string; end: string };
  metrics: {
    calls: CliMetricDelta;
    asrRate: CliMetricDelta;
    answeredRate: CliMetricDelta;
    contactRate: CliMetricDelta;
    saleRate: CliMetricDelta;
    sales: CliMetricDelta;
    conversationGe5mRate: CliMetricDelta;
    avgLeadAgeDays: CliMetricDelta;
  };
  cliDeltas: {
    cli: string;
    callsDelta: string;
    contactRateDelta: string;
    saleRateDelta: string;
    durationGe5mRateDelta: string;
  }[];
  observations: string[];
}

export interface CliTrendPoint {
  date: string;
  totalCalls: number;
  contactRate: number;
  saleRate: number;
  answeredRate: number | null;
  asrRate: number | null;
  durationGe5mRate: number | null;
  byCli?: Record<string, { calls: number; contactRate: number; saleRate: number }>;
}

export interface CliCampaignAggregate {
  campaign: string;
  calls: string;
  contacts: string;
  contactRate: string;
  sales: string;
  saleRate: string;
  cliCount: number;
}

export interface CliValidationAnomaly {
  type: 
    | 'NEGATIVE_DURATION'
    | 'INVALID_CLI_FORMAT'
    | 'SALES_EXCEED_CALLS'
    | 'SALES_EXCEED_CONTACTS'
    | 'PERCENTAGE_OUT_OF_BOUNDS'
    | 'PERCENTAGE_MISMATCH'
    | 'MISSING_DATE'
    | 'MISSING_CAMPAIGN'
    | 'ANOMALOUS_SALE_RATE';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  cli: string;
  message: string;
  rawValues?: Record<string, unknown>;
}

export interface CliMetricDefinition {
  id: string;
  label: string;
  formula: string;
  numerator: string;
  denominator: string;
  note: string;
}

export const CLI_METRIC_DEFINITIONS: Record<string, CliMetricDefinition> = {
  totalCalls: {
    id: 'totalCalls',
    label: 'Total Calls',
    formula: 'COUNT(call_events)',
    numerator: 'Observed call attempt events',
    denominator: 'N/A',
    note: 'Sum of all physical call attempts logged at the dialler grain.',
  },
  distinctLeads: {
    id: 'distinctLeads',
    label: 'Distinct Leads Dialled',
    formula: 'COUNT(DISTINCT dialer_lead_id)',
    numerator: 'Distinct dialler lead identifiers dialled',
    denominator: 'N/A',
    note: 'Count of unique dialler_lead_id instances reached or attempted.',
  },
  callsPerLead: {
    id: 'callsPerLead',
    label: 'Calls per Lead',
    formula: 'totalCalls / distinctLeads',
    numerator: 'Total call attempts',
    denominator: 'Distinct leads dialled',
    note: 'Average call attempts per dialled lead. Excludes uncalled leads.',
  },
  asrRate: {
    id: 'asrRate',
    label: 'ASR (Answer Seizure Ratio)',
    formula: 'SUM(asr_count) / SUM(total_calls)',
    numerator: 'Seized / connected calls acknowledged by carrier or gateway',
    denominator: 'Total call attempts',
    note: 'Carrier-level Answer Seizure Ratio. Only populated when directly supplied by source/switch telemetry. Never guessed.',
  },
  answeredRate: {
    id: 'answeredRate',
    label: 'Answer Rate',
    formula: 'SUM(answered_calls) / SUM(total_calls)',
    numerator: 'Calls where human or machine answer was detected (length_in_sec > 0 or ANSWER disposition)',
    denominator: 'Total call attempts',
    note: 'Distinct from RPC (Right Party Contact). Includes answering machines, voicemail and non-target respondents.',
  },
  contactRate: {
    id: 'contactRate',
    label: 'Right Party Contact Rate (RPC %)',
    formula: 'SUM(rpc_calls) / SUM(total_calls)',
    numerator: 'Calls flagged with confirmed Right Party Contact (is_rpc = true)',
    denominator: 'Total call attempts',
    note: 'Verified engagement with the requested lead consumer.',
  },
  salePerCallRate: {
    id: 'salePerCallRate',
    label: 'Sale / Call Rate',
    formula: 'SUM(sale_calls) / SUM(total_calls)',
    numerator: 'Calls resulting in a recorded sale (is_sale = true)',
    denominator: 'Total call attempts',
    note: 'Overall call-to-sale conversion efficiency across all dialler attempts.',
  },
  salePerContactRate: {
    id: 'salePerContactRate',
    label: 'Sale / Contact Rate',
    formula: 'SUM(sale_calls) / SUM(contact_calls)',
    numerator: 'Calls resulting in a recorded sale (is_sale = true)',
    denominator: 'Calls with confirmed Right Party Contact (is_rpc = true)',
    note: 'Pitch-to-close conversion rate. In the OfferNet daily CLI export this is the semantic meaning of sale_pct. Only calculated when contact_calls > 0.',
  },
  durationGe5mPct: {
    id: 'durationGe5mPct',
    label: 'Conversation >= 5m Share',
    formula: 'SUM(calls_with_duration >= 300s) / SUM(total_calls)',
    numerator: 'Calls with talk duration >= 300 seconds',
    denominator: 'Total call attempts',
    note: 'Proxy for qualified consultative conversations and sales engagement depth.',
  },
  avgLeadAgeDays: {
    id: 'avgLeadAgeDays',
    label: 'Average Lead Age at Call',
    formula: 'AVG(TIMESTAMP_DIFF(call_start, lead_fetched, HOUR)) / 24',
    numerator: 'Elapsed time from lead capture/delivery to call event',
    denominator: 'Calls with verified lead join',
    note: 'Speed-to-contact latency. Observed association only; does not infer direct causation.',
  },
};

export interface CliPerformanceResponse {
  provenance: CliProvenance;
  status: 'AVAILABLE' | 'SCHEMA_UNAVAILABLE' | 'NO_DATA';
  sourceStatus: {
    table: string;
    configured: boolean;
    schemaChecked: boolean;
    cliFieldPresent: boolean;
    cliFieldName?: string;
    totalColumnsFound?: number;
    reason?: string;
  };
  summary: CliSummary | null;
  cliPerformance: CliPerformanceRecord[];
  trend: CliTrendPoint[];
  durationBands: CliDurationBands;
  leadAgeBands: CliLeadAgeBands;
  campaigns: CliCampaignAggregate[];
  periodComparison: CliPeriodComparison | null;
  fieldCoverage: CliFieldCoverage[];
  anomalies: CliValidationAnomaly[];
  metricDefinitions: Record<string, CliMetricDefinition>;
  metadata: {
    clientId: string;
    startDate: string | null;
    endDate: string | null;
    filters: Record<string, any>;
    modelVersion: string;
    generatedAt: string;
    rowCount: number;
    validationStatus: string;
  };
}

/**
 * Computes exact aggregate rate as percentage: (numerator / denominator) * 100
 * using integer / exact decimal division.
 */
export function calculateExactRate(numerator: string | number, denominator: string | number, places = 2): string | null {
  const numStr = String(numerator).trim();
  const denStr = String(denominator).trim();
  if (denStr === '0' || !denStr) return null;
  const numVal = exactDecimal(numStr);
  const denVal = exactDecimal(denStr);
  if (!numVal || !denVal) return null;
  
  // Multiply numerator by 100 for percentage
  const numTimes100 = (BigInt(numVal.split('.')[0] || '0') * 100n).toString();
  return divideExactDecimal(numTimes100, denVal, places);
}
