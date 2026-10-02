import type { RubixCapabilityDefinition, RubixQueryType } from '../../../contracts/rubixPowerBi';

export interface RubixQuerySpec {
  queryType: RubixQueryType;
  metricId: string;
  metricLabel: string;
  eventDateField: 'activation' | 'capture_complete';
  aggregation: string;
  dimensions: string[];
  staffDetailRequired: boolean;
  notes: string;
}

export const RUBIX_QUERY_SPECS: Record<RubixQueryType, RubixQuerySpec> = {
  activation_over_time: {
    queryType: 'activation_over_time',
    metricId: 'rubix.activation_count',
    metricLabel: 'Reported Activations',
    eventDateField: 'activation',
    aggregation: 'CountNonNull',
    dimensions: ['date'],
    staffDetailRequired: false,
    notes: 'Power BI-reported non-null activation event count over time.',
  },
  activation_by_team: {
    queryType: 'activation_by_team',
    metricId: 'rubix.activation_count',
    metricLabel: 'Reported Activations by Team',
    eventDateField: 'activation',
    aggregation: 'CountNonNull',
    dimensions: ['team_name'],
    staffDetailRequired: false,
    notes: 'Power BI-reported non-null activation event count grouped by source team.',
  },
  activation_by_segment: {
    queryType: 'activation_by_segment',
    metricId: 'rubix.activation_count',
    metricLabel: 'Reported Activations by Segment',
    eventDateField: 'activation',
    aggregation: 'CountNonNull',
    dimensions: ['segment'],
    staffDetailRequired: false,
    notes: 'Power BI-reported non-null activation event count grouped by source segment.',
  },
  activation_by_agent_and_team: {
    queryType: 'activation_by_agent_and_team',
    metricId: 'rubix.activation_count',
    metricLabel: 'Reported Activations by Agent & Team',
    eventDateField: 'activation',
    aggregation: 'CountNonNull(contract_key)',
    dimensions: ['team_name', 'full_name'],
    staffDetailRequired: true,
    notes: 'Property contract_key with aggregation function 5. Note: visual title displays misleading alias Sum(contract_key) but operation is non-null count. Staff names are masked for viewers.',
  },
  capture_complete_over_time: {
    queryType: 'capture_complete_over_time',
    metricId: 'rubix.capture_complete_count',
    metricLabel: 'Reported Capture Complete',
    eventDateField: 'capture_complete',
    aggregation: 'CountNonNull',
    dimensions: ['date'],
    staffDetailRequired: false,
    notes: 'Power BI-reported non-null capture_complete event count over time.',
  },
  capture_complete_by_team: {
    queryType: 'capture_complete_by_team',
    metricId: 'rubix.capture_complete_count',
    metricLabel: 'Reported Capture Complete by Team',
    eventDateField: 'capture_complete',
    aggregation: 'CountNonNull',
    dimensions: ['team_name'],
    staffDetailRequired: false,
    notes: 'Power BI-reported non-null capture_complete event count grouped by source team.',
  },
  capture_complete_by_segment: {
    queryType: 'capture_complete_by_segment',
    metricId: 'rubix.capture_complete_count',
    metricLabel: 'Reported Capture Complete by Segment',
    eventDateField: 'capture_complete',
    aggregation: 'CountNonNull',
    dimensions: ['segment'],
    staffDetailRequired: false,
    notes: 'Power BI-reported non-null capture_complete event count grouped by source segment.',
  },
  capture_complete_by_agent_and_team: {
    queryType: 'capture_complete_by_agent_and_team',
    metricId: 'rubix.capture_complete_count',
    metricLabel: 'Reported Capture Complete by Agent & Team',
    eventDateField: 'capture_complete',
    aggregation: 'CountNonNull(contract_key)',
    dimensions: ['team_name', 'full_name'],
    staffDetailRequired: true,
    notes: 'Capture complete by agent and team. Staff names are masked for viewers.',
  },
};

export const RUBIX_CAPABILITIES_LIST: RubixCapabilityDefinition[] = [
  ...Object.values(RUBIX_QUERY_SPECS).map((spec) => ({
    id: spec.queryType,
    label: spec.metricLabel,
    metricId: spec.metricId,
    eventDateField: spec.eventDateField,
    dimension: spec.dimensions.join(', '),
    status: 'NOT_VERIFIED' as const,
    staffDetailRequired: spec.staffDetailRequired,
    notes: `${spec.notes} Registered query template only; independent source reconciliation has not been performed.`,
  })),
  {
    id: 'rubix.nett_apps',
    label: 'Reported Nett Apps',
    metricId: 'rubix.nett_apps_count',
    eventDateField: 'nett_app',
    dimension: 'date',
    status: 'TEMPLATE_REQUIRED',
    staffDetailRequired: false,
    notes: 'Nett Apps event field observed in historical capture; exact business definition and template contract unconfirmed.',
  },
  {
    id: 'rubix.activation_by_device',
    label: 'Reported Activations by Device',
    metricId: 'rubix.activation_count',
    eventDateField: 'activation',
    dimension: 'device_model',
    status: 'NOT_VERIFIED',
    staffDetailRequired: false,
    notes: 'Observed device_model is a device attribute list, not verified per-device activation counts.',
  },
];

export const RUBIX_SUPPORTED_FILTERS = ['team', 'segment', 'agent', 'startDate', 'endDate'] as const;
export const RUBIX_UNSUPPORTED_FILTERS = [
  'vendor',
  'partner',
  'ror_partner',
  'source',
  'medium',
  'campaign',
  'channel',
  'adset',
  'grade',
  'cli',
] as const;
