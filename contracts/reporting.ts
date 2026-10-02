import { REPORT_COPY } from './naming';
/** Public report contract. Changes to definitions require a new version, never an in-place revision. */
export const METRIC_VERSION = 'cx.metrics.2.0.1';
export const MODEL_VERSION = 'cx.facts.2.0.0';
export const FACTS = ['leads', 'deliveries', 'calls', 'sales', 'activations', 'commercial'] as const;
export type Fact = typeof FACTS[number];
export type DateBasis = 'capture_cohort' | 'event_date';
export type Grouping = 'none' | 'source' | 'vendor' | 'capture_month';
export interface MetricDefinition {
  id: string; label: string; grain: string; definition: string;
  numeratorLabel: string; denominatorLabel: string | null; formula: string;
  aggregation: 'count' | 'distinct' | 'ratio' | 'decimal_sum';
  unit: 'records' | 'percent' | 'currency'; requires: Fact[]; dateBases: DateBasis[];
  overlapWarning?: string;
}
const metricDefinitions = [
  { id: 'fetched_leads', grain: 'lead', definition: 'Distinct ingested lead submissions; vendor selection means leads with a recorded delivery episode to that vendor.', aggregation: 'distinct', unit: 'records', requires: ['leads'], dateBases: ['capture_cohort', 'event_date'], overlapWarning: 'Vendor populations may overlap. Do not sum distinct leads across vendors.' },
  { id: 'delivered_episodes', grain: 'delivery', definition: 'Distinct vendor delivery episodes with an observed successful-delivery timestamp by the cutoff.', aggregation: 'count', unit: 'records', requires: ['leads', 'deliveries'], dateBases: ['capture_cohort', 'event_date'] },
  { id: 'call_attempts', grain: 'call', definition: 'Distinct observed dialler events linked to a delivery episode. Cumulative HLC counters are not call events.', aggregation: 'count', unit: 'records', requires: ['leads', 'deliveries', 'calls'], dateBases: ['capture_cohort', 'event_date'] },
  { id: 'called_episodes', grain: 'delivery', definition: 'Distinct delivered episodes with at least one observed call at or after delivery. Event-date mode uses the first such call.', aggregation: 'distinct', unit: 'records', requires: ['leads', 'deliveries', 'calls'], dateBases: ['capture_cohort', 'event_date'] },
  { id: 'call_coverage', grain: 'delivery', definition: 'Delivered episodes called at or after delivery / all delivered episodes in the capture cohort, observed through the cutoff.', aggregation: 'ratio', unit: 'percent', requires: ['leads', 'deliveries', 'calls'], dateBases: ['capture_cohort'] },
  { id: 'sale_events', grain: 'sale', definition: 'Distinct observed sale-event identities, not leads labelled as sales. Cancellations are not netted into this nominal event count.', aggregation: 'count', unit: 'records', requires: ['leads', 'deliveries', 'sales'], dateBases: ['capture_cohort', 'event_date'] },
  { id: 'activation_events', grain: 'activation', definition: 'Distinct observed activation events linked to identifiable sales. Cancellation and active-contract balances are separate measures.', aggregation: 'count', unit: 'records', requires: ['leads', 'deliveries', 'sales', 'activations'], dateBases: ['capture_cohort', 'event_date'] },
  { id: 'sale_activation_rate', grain: 'sale', definition: 'Sales with at least one observed activation / distinct sales in the capture cohort. Multiple activations cannot count a sale twice.', aggregation: 'ratio', unit: 'percent', requires: ['leads', 'deliveries', 'sales', 'activations'], dateBases: ['capture_cohort'] },
  ...(['expected', 'approved', 'invoiced', 'collected'] as const).map(stage => ({
    id: `${stage}_value`, grain: 'commercial_event',
    definition: `Sum of signed ${stage}-stage ledger deltas in the selected currency. Reversals are negative deltas, not overwritten history.`,
    aggregation: 'decimal_sum' as const, unit: 'currency' as const, requires: ['leads', 'deliveries', 'sales', 'commercial'] as Fact[], dateBases: ['capture_cohort', 'event_date'] as DateBasis[],
  })),
];
export const METRICS: readonly MetricDefinition[] = metricDefinitions.map(m => {
  const copy = REPORT_COPY[m.id as keyof typeof REPORT_COPY];
  return { ...m, ...copy, formula: copy.denominatorLabel
    ? `${copy.numeratorLabel} / ${copy.denominatorLabel} × 100`
    : m.aggregation === 'decimal_sum' ? `Sum of ${copy.numeratorLabel.toLowerCase()} in the selected currency` : `Count of ${copy.numeratorLabel.toLowerCase()}` } as MetricDefinition;
});
export const METRIC_BY_ID = Object.fromEntries(METRICS.map(m => [m.id, m])) as Record<string, MetricDefinition>;
export interface ReportRequest {
  tenantId: string; startDate: string; endDate: string; observationCutoff: string;
  dateBasis: DateBasis; grouping: Grouping; currency: string; metrics: string[];
  filters: { vendor?: string[]; source?: string[]; medium?: string[] };
}
export interface CheckEvidence { id: string; status: 'PASS' | 'FAIL' | 'NOT_RUN'; observed: string; expected: string; jobId: string; }
export interface SourceEvidence {
  fact: Fact; status: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE'; contractVersion: string;
  completeThrough: string | null; earliestAvailable: string | null; owner: string; approvalReference: string;
}
export interface ReleaseManifest {
  releaseId: string; tenantId: string; modelVersion: string; metricVersion: string; engineHash: string;
  status: 'PUBLISHED' | 'REVOKED'; builtAt: string; cutoff: string; sourceBatchIds: string[];
  snapshots: Record<Fact, { table: string; createdAt: string; snapshotTime: string }>;
  provenance: Record<'records' | 'batches' | 'contracts', { table: string; createdAt: string; snapshotTime: string }>;
  sources: SourceEvidence[]; checks: CheckEvidence[]; approvedBy: string; approvalReference: string;
  /** Explicitly approved aggregate output. Absent means facts cannot be executed by this reader. */
  execution?: AggregateSnapshotContract;
}
export interface MetricResult {
  metricId: string; group: string | null; value: string | null; numerator: string | null; denominator: string | null;
  unit: MetricDefinition['unit']; calculationStatus: 'CHECKED' | 'UNAVAILABLE';
  completeness: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE'; reason: string | null;
}
export interface QueryExecutionEvidence {
  durationMs: number; bytesProcessed: string | null; cacheHit: boolean | null;
  subqueryCount: number; completion: 'COMPLETED' | 'NOT_RUN';
}
export interface ReportResult {
  queryJobId: string; queryEvidence: QueryExecutionEvidence; engineHash: string;
  executionId: string; token: string | null; request: ReportRequest; releaseId: string; modelVersion: string; metricVersion: string;
  releaseCutoff: string; sourceBatchIds: string[]; totals: MetricResult[]; groups: MetricResult[];
  metricDefinitions: MetricDefinition[]; generatedAt: string; validation: CheckEvidence[]; sources: SourceEvidence[];
}

/** Adds an execution boundary to the existing release/metric registry; no fact mappings are inferred. */
export const REPORT_REQUEST_VERSION = 'cx.report-request.1' as const;
export const REPORT_RESULT_VERSION = 'cx.report-result.1' as const;
export const AGGREGATE_SNAPSHOT_VERSION = 'cx.reporting.aggregate-snapshot.1' as const;
export const REPORT_MAX_ROWS = 100;
export interface SnapshotIdentity { table: string; createdAt: string; snapshotTime: string; }
export interface AggregateSnapshotContract {
  contractVersion: typeof AGGREGATE_SNAPSHOT_VERSION;
  snapshot: SnapshotIdentity;
  /** SHA-256 of the canonical existing METRICS, MODEL_VERSION and METRIC_VERSION. */
  definitionHash: string;
  supportedMetrics: string[];
  supportedDateBases: DateBasis[];
  supportedGroupings: Grouping[];
  supportedFilters: (keyof ReportRequest['filters'])[];
}
export interface VersionedReportRequest extends ReportRequest {
  contractVersion: typeof REPORT_REQUEST_VERSION;
  releaseId: string;
}
export interface MetricEvidence {
  grain: string; dateBasis: DateBasis; definitionVersion: string; releaseId: string;
  numeratorDefinition: string; denominatorDefinition: string | null;
  sources: { fact: Fact; snapshot: SnapshotIdentity; coverage: SourceEvidence }[];
  mappingStatus: 'APPROVED_RELEASE_CONTRACT' | 'UNAVAILABLE';
  reconciliationStatus: 'NOT_VERIFIED'; businessMeaningStatus: 'NOT_VERIFIED';
  evidenceStatus: 'OBSERVED' | 'PARTIAL' | 'UNAVAILABLE';
}
export interface EvidenceMetricResult extends MetricResult { evidence: MetricEvidence; }
export interface EvidenceReportResult extends Omit<ReportResult, 'request' | 'totals' | 'groups'> {
  contractVersion: typeof REPORT_RESULT_VERSION;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_SUPPORTED';
  message: string | null;
  request: VersionedReportRequest; totals: EvidenceMetricResult[]; groups: EvidenceMetricResult[];
  scopeHash: string; manifestHash: string; resultHash: string;
  generationContract: typeof AGGREGATE_SNAPSHOT_VERSION;
  snapshot: SnapshotIdentity | null;
  replay: { status: 'AVAILABLE' | 'NOT_CONFIGURED' | 'NOT_REPLAYABLE'; expiresAt: string | null; reason: string | null };
  evidence: { observed: boolean; mapped: boolean; scoped: boolean; reproduced: 'NOT_RUN'; independentlyReconciled: 'NOT_VERIFIED'; businessVerified: 'NOT_VERIFIED' };
}
