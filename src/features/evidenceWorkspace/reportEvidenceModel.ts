import { METRIC_BY_ID, type EvidenceMetricResult, type EvidenceReportResult, type MetricResult, type ReportResult } from '../../../contracts/reporting';
import type { InspectorContent } from '../../shared/evidence/InspectorHost';
import type { AuditDimension } from '../../shared/evidence/auditVisualModel';

export function reportDimensions(report: EvidenceReportResult, reproduced = false): AuditDimension[] {
  return [
    { key: 'source', label: 'Observed', state: report.evidence.observed ? 'observed' : 'unavailable', detail: 'An exact value was returned from the registered frozen aggregate.' },
    { key: 'mapping', label: 'Mapped', state: report.evidence.mapped ? 'mapped' : 'unavailable', detail: 'Declared release and metric contracts; source meaning approval remains separate.' },
    { key: 'scope', label: 'Scoped', state: report.evidence.scoped ? 'scoped' : 'unavailable', detail: 'Exact tenant, dates, filters and observation cutoff.' },
    { key: 'reproduced', label: 'Reproduced', state: reproduced ? 'reproduced' : 'not_verified', detail: reproduced ? 'Signed original and replay match. This is reproducibility evidence only.' : 'Replay has not established a match.' },
    { key: 'reconciliation', label: 'Independently reconciled', state: 'not_verified', detail: 'Replay does not independently measure the underlying source.' },
    { key: 'business', label: 'Business verified', state: 'not_verified', detail: 'Publication and a checked calculation do not approve source business meaning.' },
  ];
}

export function reportMetricInspector(report: ReportResult, metric: MetricResult): InspectorContent {
  const definition = report.metricDefinitions.find(item => item.id === metric.metricId) || METRIC_BY_ID[metric.metricId];
  const evidence = (metric as EvidenceMetricResult).evidence;
  const full = report as EvidenceReportResult;
  return {
    type: 'custom', title: definition?.label || metric.metricId,
    subtitle: 'Immutable release result · calculation and independent verification are separate.',
    value: metric.value, unit: metric.unit === 'currency' ? report.request.currency : metric.unit,
    definition: { meaning: definition?.definition, grain: definition?.grain, dateBasis: report.request.dateBasis, calculation: definition?.formula, limitations: [metric.reason, definition?.overlapWarning].filter(Boolean) as string[] },
    scope: { clientId: report.request.tenantId, startDate: report.request.startDate, endDate: report.request.endDate, filters: report.request.filters, narrowing: {} },
    provenance: { validationStatus: 'NOT_VERIFIED', countingGrain: definition?.grain, dateBasis: report.request.dateBasis, generatedAt: report.generatedAt, observationCutoff: report.request.observationCutoff, queryJobId: report.queryJobId, metricVersion: report.metricVersion, modelVersion: report.modelVersion, source: full.snapshot?.table || 'Snapshot not supplied' },
    anatomy: { kind: definition?.aggregation === 'ratio' ? 'ratio' : metric.unit === 'currency' ? 'financial' : 'count', label: definition?.label || metric.metricId, value: metric.value, unit: metric.unit === 'currency' ? report.request.currency : metric.unit,
      numerator: { key: 'numerator', label: definition?.numeratorLabel || 'Numerator', value: metric.numerator },
      ...(definition?.denominatorLabel ? { denominator: { key: 'denominator', label: definition.denominatorLabel, value: metric.denominator }, scaling: 'percentage_value' as const } : {}), formula: definition?.formula },
    dimensions: full.evidence ? reportDimensions({ ...full, evidence: { ...full.evidence, observed: metric.value !== null && metric.calculationStatus === 'CHECKED', mapped: full.evidence.mapped && evidence?.mappingStatus === 'APPROVED_RELEASE_CONTRACT' } }) : [
      { key: 'calculation', label: 'Calculation', state: metric.calculationStatus === 'CHECKED' ? 'formula_checked' : 'unavailable' },
      { key: 'reconciliation', label: 'Independent reconciliation', state: 'not_verified' },
      { key: 'meaning', label: 'Business meaning', state: 'not_verified' },
    ],
    trace: [
      ...(evidence?.sources || []).map(source => ({ key: source.fact, type: 'source' as const, label: source.fact, state: source.coverage.status === 'COMPLETE' ? 'mapped' as const : source.coverage.status === 'PARTIAL' ? 'partial' as const : 'unavailable' as const, detail: `${source.snapshot.table} · ${source.coverage.contractVersion} · ${source.coverage.status}` })),
      { key: 'snapshot', type: 'normalization', label: 'Published aggregate snapshot', state: full.snapshot ? 'mapped' : 'unavailable', detail: full.snapshot ? `${full.snapshot.table} · ${full.snapshot.snapshotTime}` : 'No executable snapshot supplied.' },
      { key: 'scope', type: 'qualification', label: 'Exact release scope', state: 'scoped', detail: `${report.request.tenantId} · ${report.request.startDate} → ${report.request.endDate} · ${JSON.stringify(report.request.filters)}` },
      { key: 'result', type: 'metric', label: definition?.label || metric.metricId, value: metric.value, state: metric.value === null ? 'unavailable' : 'observed' },
    ],
    detailLimitation: `Release cutoff: ${report.releaseCutoff}. Requested observation cutoff: ${report.request.observationCutoff}. No record-level supporting-evidence reader is approved for these immutable aggregate snapshots. Operational lead populations cannot establish the frozen report result.`,
  };
}
