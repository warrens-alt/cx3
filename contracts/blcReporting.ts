/** BLC source evidence, not replacements for the canonical cohort metrics. */
import type { Filters } from './filters';

export const BLC_REPORT_VERSION = '2026-09-27.1';
export const BLC_SOURCE_IDS = ['journey', 'activationRegister', 'activationBridge', 'remoteActivations', 'waterfall'] as const;
export type BlcSourceId = typeof BLC_SOURCE_IDS[number];
export interface BlcSourceDefinition {
  id: BlcSourceId;
  label: string;
  table: string;
  dateField: string;
  dateBasis: string;
  keyField: string;
  breakdownField: string;
  fields: Readonly<Record<string, string>>;
  supportsSourceFilter: boolean;
  note: string;
}
const journeyFields = {
  vendor: 'STRING', lead_id: 'STRING', transaction_id: 'INT64', consumer_id: 'INT64',
  fetched: 'STRING', vetting_status: 'STRING', vetted: 'STRING', attempted_to_deliver: 'STRING',
  delivered: 'STRING', expected_first_dial: 'STRING', new_dialer_lead: 'INT64', first_call_date: 'STRING',
  last_call_date: 'STRING', last_dialer_status: 'STRING', last_call_length_in_sec: 'INT64',
  total_calls_length_in_sec: 'INT64', total_calls: 'INT64', rpc: 'INT64', sale: 'STRING',
  activated: 'STRING', lead_cost: 'INT64', revenue_generated: 'INT64', currency: 'STRING', offershop_source: 'STRING',
} as const;
const registerFields = { transaction_id: 'INT64', date_created: 'STRING', color: 'STRING', expected_ontact_revenue: 'INT64' } as const;
export const BLC_SOURCES: Readonly<Record<BlcSourceId, BlcSourceDefinition>> = {
  journey: {
    id: 'journey', label: 'BLC lead journey',
    table: 'dashboards-422710.lead_ledger.view_lead_ledger_blc_lead_submit_open',
    dateField: 'fetched', dateBasis: 'Fetched / intake date', keyField: 'lead_id', breakdownField: 'offershop_source',
    fields: journeyFields, supportsSourceFilter: true,
    note: 'Source rows and distinct lead references, not additional leads to add to the existing dashboard. Recorded sale and activation fields retain their source meaning.',
  },
  activationRegister: {
    id: 'activationRegister', label: 'BLC activation register',
    table: 'dashboards-422710.lead_ledger.tbl_blc_activations',
    dateField: 'date_created', dateBasis: 'Register date_created (not a verified activation date)',
    keyField: 'transaction_id', breakdownField: 'color', fields: registerFields, supportsSourceFilter: false,
    note: 'Register rows are not certified net activations. Expected revenue is not settled revenue; its units and eligibility require a contract.',
  },
  activationBridge: {
    id: 'activationBridge', label: 'BLC activation reference view',
    table: 'dashboards-422710.lead_ledger.view_blc_activations',
    dateField: 'date_created', dateBasis: 'View date_created (not a verified activation date)',
    keyField: 'contract_key', breakdownField: 'color',
    fields: { transaction_id: 'INT64', contract_key: 'INT64', date_created: 'STRING', color: 'STRING', expected_ontact_revenue: 'INT64' },
    supportsSourceFilter: false,
    note: 'The presence of transaction_id and contract_key does not establish equivalence to other sources. No cross-source joins or deduplication are performed.',
  },
  remoteActivations: {
    id: 'remoteActivations', label: 'BLC remote activation source',
    table: 'dashboards-422710.lead_ledger.blc_remote_activations',
    dateField: 'date', dateBasis: 'Remote source date (meaning requires validation)', keyField: 'contract_key', breakdownField: 'segment',
    fields: { date: 'STRING', segment: 'STRING', contract_key: 'STRING', activations: 'INT64', revenue: 'NUMERIC', date_created: 'STRING', updatedAt: 'STRING' },
    supportsSourceFilter: false,
    note: 'Row grain, activation-unit additivity and revenue units remain unverified. This report measures rows and field coverage; it does not sum those fields into production KPIs.',
  },
  waterfall: {
    id: 'waterfall', label: 'BLC waterfall source',
    table: 'dashboards-422710.watfall_report.view_blc_waterfall_timeline',
    dateField: 'fetched', dateBasis: 'Fetched / intake date', keyField: 'lead_id', breakdownField: 'offershop_source',
    fields: journeyFields, supportsSourceFilter: true,
    note: 'A separate view of journey evidence. Do not add its rows to the lead-journey view or construct a proportional funnel without validating the shared cohort.',
  },
};

export interface BlcReport {
  version: string;
  sourceId: BlcSourceId;
  source: BlcSourceDefinition;
  scope: { clientId: string; startDate: string; endDate: string; filters: Filters };
  status: 'READY' | 'EMPTY' | 'SCHEMA_MISMATCH' | 'AUTHENTICATION_REQUIRED' | 'ACCESS_DENIED' | 'NOT_FOUND' | 'INVALID_REQUEST' | 'RATE_LIMITED' | 'UNAVAILABLE';
  checkedAt: string;
  metadataAccessible: boolean;
  querySucceeded: boolean;
  validationStatus: 'NOT_VERIFIED';
  freshnessVerified: false;
  latestSourceDate: string | null;
  message: string | null;
  missingFields: string[];
  observedFields: Array<{ name: string; type: string; compatible: boolean }>;
  summary: { sourceRows: string; distinctReferences: string; missingReferences: string } | null;
  daily: Array<{ date: string; sourceRows: string }>;
  breakdown: Array<{ label: string | null; sourceRows: string }>;
  breakdownTruncated: boolean;
  fieldCoverage: Array<{ field: string; populatedRows: string }>;
  queryEvidence: { jobId: string; bytesProcessed: string | null } | null;
  limitations: string[];
}

export function isBlcSourceId(value: unknown): value is BlcSourceId {
  return typeof value === 'string' && (BLC_SOURCE_IDS as readonly string[]).includes(value);
}

/** Counts remain decimal strings end-to-end; IDs never pass through Number. */
export function formatBlcCount(value: string | null | undefined): string {
  return value != null && /^\d+$/.test(value) ? BigInt(value).toLocaleString('en-GB') : '—';
}
