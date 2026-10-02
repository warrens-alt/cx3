import { AUTHORITATIVE_METRICS, type AuthoritativeMetricDefinition } from '../../../contracts/metricRegistry';
import type { SourceObservabilityData } from '../../lib/offernetClient';
import type { InspectorContent } from '../../shared/evidence/InspectorHost';
import type { AuditScope } from '../../shared/evidence/auditPresentation';

export type ObservedSource = SourceObservabilityData['sources'][number];
export const auditMetricDefinitions = Object.values(AUTHORITATIVE_METRICS);

/** Registry dependencies are logical roles, not a claim that physical tables have been joined. */
export function metricsDependentOnSource(key: string): AuthoritativeMetricDefinition[] {
  return auditMetricDefinitions.filter(metric => metric.source.split('.')[0] === key || metric.dependencies.includes(key));
}

export function metricDefinitionEvidence(metric: AuthoritativeMetricDefinition, scope: AuditScope): InspectorContent {
  return {
    type: 'custom', metricId: metric.id, title: metric.businessLabel, value: null, scope, showAnatomy: false,
    subtitle: 'Declared metric definition · no metric result supplied by this integrity response',
    definition: { meaning: metric.plainDefinition, grain: metric.countingGrain, dateBasis: metric.dateBasis,
      calculation: metric.precedence, limitations: metric.caveats },
    provenance: { metricVersion: metric.version, timezone: metric.timezone },
    dimensions: [
      { key: 'source', label: 'Metric source observation', state: 'unavailable', detail: 'The integrity response contains workspace source observations, but no source observation tied to this metric result.' },
      { key: 'mapping', label: 'Declared mapping', state: metric.mappingStatus === 'APPROVED' ? 'mapped' : metric.mappingStatus === 'PROVISIONAL' ? 'partial' : 'unavailable', detail: metric.mappingStatus },
      { key: 'scope', label: 'Metric evaluated for scope', state: 'unavailable', detail: 'The selected tenant, dates and filters are retained as navigation context. No metric evaluation is returned here.' },
      { key: 'reconciliation', label: 'Independent reconciliation', state: 'not_verified', detail: metric.reconciliationStatus },
      { key: 'business', label: 'Business meaning', state: 'not_verified', detail: metric.sourceContractStatus },
    ],
    trace: [
      { key: 'source', type: 'source', label: 'Declared logical source', value: metric.source, state: 'mapped', detail: 'Definition metadata. This does not establish a physical source read for the current metric scope.' },
      { key: 'fields', type: 'field', label: 'Declared fields', value: metric.fields.join(', '), state: 'mapped' },
      { key: 'normalization', type: 'normalization', label: 'Counting and precedence', value: metric.countingGrain, state: 'mapped', detail: metric.precedence },
      { key: 'qualification', type: 'qualification', label: 'Eligibility', state: 'mapped', detail: `${metric.eligibility} Exclusions: ${metric.exclusions}` },
      { key: 'metric', type: 'metric', label: metric.businessLabel, value: null, state: 'unavailable', detail: 'No value for this metric is returned by Data Confidence. Open its operational report for a measured result.' },
    ],
    dependencies: { label: 'Declared logical dependencies', inputs: metric.dependencies.map(key => ({ key, label: key, value: null, state: 'mapped', detail: 'Declared registry role. A dependency does not establish a physical cross-source join or independent corroboration.' })) },
    detailLimitation: 'This definition view does not supply a measured population or a matching record drill. Supporting record access belongs to the operational metric result.',
  };
}

export function sourceObservationEvidence(source: ObservedSource, clientId: string, onInspectMetric?: (metric: AuthoritativeMetricDefinition) => void): InspectorContent {
  return {
    type: 'custom', title: source.label, subtitle: 'Tenant-wide source observation', value: source.rowCount, unit: 'source rows',
    scope: { clientId, narrowing: {} },
    definition: { meaning: source.detail, grain: 'Returned source rows; not distinct analytical leads.', dateBasis: 'All tenant-owned records, independent of the selected capture cohort.', calculation: 'The returned source row count is displayed directly. Source row counts must not be added across different grains.', nullMeaning: 'An unavailable row count is not measured zero.' },
    provenance: { source: source.table || undefined },
    dimensions: [
      { key: 'observation', label: 'Source rows', state: source.rowCount == null ? 'unavailable' : 'observed', detail: `Returned status: ${source.status}` },
      { key: 'timestamp', label: 'Source timestamp', state: source.latestRecordAt ? 'observed' : 'unavailable', detail: source.latestRecordAt || 'No source freshness timestamp was supplied.' },
      { key: 'scope', label: 'Observation scope', state: 'scoped', detail: 'Tenant-owned records; selected cohort filters do not apply to this observation.' },
      { key: 'coverage', label: 'Field population coverage', state: 'unavailable', detail: 'Source observability does not supply field population counts. Coverage is not calculated from displayed records.' },
      { key: 'reconciliation', label: 'Independent reconciliation', state: 'not_verified', detail: 'No independent comparison for this source and exact scope was supplied.' },
      { key: 'business', label: 'Business verification', state: 'not_verified', detail: 'A source observation does not approve its business meaning.' },
    ],
    trace: [
      { key: 'source', type: 'source', label: source.label, value: source.table, state: source.table ? 'mapped' : 'unavailable', detail: 'Exact configured source identifier as returned.' },
      { key: 'api', type: 'api', label: 'Returned source observation', value: source.rowCount, state: source.rowCount == null ? 'unavailable' : 'observed', detail: source.detail },
      { key: 'display', type: 'display', label: 'Data Confidence', value: source.rowCount, state: source.rowCount == null ? 'unavailable' : 'presentation_consistent', detail: 'The returned count is displayed without recalculation. This is presentation consistency, not source reconciliation.' },
    ],
    dependencies: { label: 'Declared source → metric dependencies', inputs: [{ key: source.key, label: source.label, value: source.table, state: source.table ? 'mapped' : 'unavailable' }],
      outputs: metricsDependentOnSource(source.key).map(metric => ({ key: metric.id, label: metric.businessLabel, value: null, state: 'mapped', dependencies: [source.key], detail: `Declared logical source: ${metric.source}. All dependencies: ${metric.dependencies.join(', ')}.`, ...(onInspectMetric ? { action: { label: `Audit definition for ${metric.businessLabel}`, supported: true as const, authorized: true as const, onClick: () => onInspectMetric(metric) } } : {}) })) },
    detailLimitation: 'The source inventory does not supply an analytical lead population or record drill.',
  };
}
