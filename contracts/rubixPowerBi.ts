/**
 * Rubix / BLC Power BI reporting contracts and data models.
 *
 * Source: Public-report compatibility transport over blue_label_reporting wow_data.
 * All queries retain the mandatory `company_name Contains 'ONtact'` predicate.
 */

export const RUBIX_POWERBI_VERSION = '2026-09-29.2';

export const RUBIX_DATASET_ID = '59cef14d-8dd0-4016-a349-c227162a0fee';
export const RUBIX_REPORT_ID = 'fe973424-23fd-433a-a81f-0f08416228ef';
export const RUBIX_MODEL_ID = 598641;
export const RUBIX_ENTITY = 'blue_label_reporting wow_data';
export const RUBIX_COMPANY_PREDICATE = 'ONtact';

export const RUBIX_QUERY_TYPES = [
  'activation_over_time',
  'activation_by_team',
  'activation_by_segment',
  'activation_by_agent_and_team',
  'capture_complete_over_time',
  'capture_complete_by_team',
  'capture_complete_by_segment',
  'capture_complete_by_agent_and_team',
] as const;

export type RubixQueryType = typeof RUBIX_QUERY_TYPES[number];

export type RubixQueryStatus =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'EMPTY'
  | 'UNSUPPORTED_FILTER'
  | 'UPSTREAM_ERROR'
  | 'UNCONFIGURED'
  | 'DISABLED'
  | 'TIMEOUT';

export type RubixCompletenessStatus = 'COMPLETE' | 'PARTIAL' | 'UNKNOWN';

export type RubixCapabilityStatus = 'VERIFIED' | 'TEMPLATE_REQUIRED' | 'NOT_VERIFIED';

export interface RubixCapabilityDefinition {
  id: string;
  label: string;
  metricId: string;
  eventDateField: string;
  dimension: string;
  status: RubixCapabilityStatus;
  staffDetailRequired: boolean;
  notes: string;
}

export interface RubixReportRow {
  date?: string;
  team?: string;
  segment?: string;
  agent?: string;
  count: number;
  rawCount?: string;
  isSubtotal?: boolean;
}

export interface RubixReportSummary {
  totalCount: number | null;
  rowCount: number;
  minDate: string | null;
  maxDate: string | null;
  distinctTeams: number | null;
  distinctSegments: number | null;
  distinctAgents: number | null;
}

export interface RubixReportMetadata {
  provider: 'rubix_powerbi';
  datasetId: string;
  reportId: string;
  modelId: number;
  templateVersion: string;
  queryType: RubixQueryType;
  metricId: string;
  aggregation: string;
  requestedScope: {
    clientId: string;
    startDate: string;
    endDate: string;
    team?: string;
    segment?: string;
    agent?: string;
  };
  appliedScope: {
    companyFilter: string;
    startDate: string;
    endDate: string;
    team?: string;
    segment?: string;
    agent?: string;
  };
  supportedFilters: readonly string[];
  unsupportedFilters: readonly string[];
  eventDateField: string;
  intervalConvention: string;
  timezoneStatus: string;
  queriedAt: string;
  providerResponseTimestamp: string | null;
  sourceRefreshedAt: string | null;
  maxObservedEventDate: string | null;
  cacheAgeSeconds: number;
  queryStatus: RubixQueryStatus;
  completenessStatus: RubixCompletenessStatus;
  truncation: boolean;
  warnings: string[];
  reconciliationStatus: string;
  staffDetailsMasked?: boolean;
  provenance?: 'LIVE_POWERBI' | 'UNAVAILABLE';
}

export interface RubixReportResponse {
  metadata: RubixReportMetadata;
  summary: RubixReportSummary;
  rows: RubixReportRow[];
}

export interface RubixStatusResponse {
  enabled: boolean;
  configured: boolean;
  status: 'ONLINE' | 'CONFIGURED_NOT_CHECKED' | 'DISABLED' | 'UNCONFIGURED' | 'ERROR';
  checkedAt: string;
  provider: string;
  endpoint: string;
  note: string;
  datasetId?: string;
  reportId?: string;
  modelId?: number;
  entity?: string;
  mandatoryPredicate?: string;
}

export interface RubixCapabilitiesResponse {
  version: string;
  provider: string;
  capabilities: RubixCapabilityDefinition[];
  supportedFilters: readonly string[];
  unsupportedFilters: readonly string[];
}

export interface RubixReconciliationResponse {
  version: string;
  reconciledAt: string | null;
  checkedAt: string;
  clientId: string;
  dateRange: { startDate: string; endDate: string };
  warehouseActivations: {
    sourceTable: string;
    verifiedMandates: number | null;
    distinctPolicies: number | null;
    currency: string;
    status: string;
  };
  powerBiActivations: {
    datasetId: string;
    reportId: string;
    totalReported: number | null;
    distinctTeams: number | null;
    distinctAgents: number | null;
    provenance: 'LIVE_POWERBI' | 'UNAVAILABLE';
    status: string;
  };
  reconciliationStatus: 'RECONCILED_WITH_CAVEATS' | 'DISAGREEMENT' | 'UNVERIFIED';
  variance: {
    deltaCount: number | null;
    explanation: string;
    reconciliationNotes: string[];
  };
}
