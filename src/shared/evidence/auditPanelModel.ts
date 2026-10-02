import { AUTHORITATIVE_METRICS } from '../../../contracts/metricRegistry';
import type { InspectorContent } from './InspectorHost';
import { resultState } from './auditPresentation';
import type { AuditDimension, EvidenceTraceNode, MetricAnatomyModel, AuditReconciliationModel } from './auditVisualModel';

/** Presentation defaults use declared contracts and returned values only; no warehouse or record reads. */
export function buildAuditPanelModel(content: InspectorContent, scopeDescription: string) {
  const contract = content.metricId ? AUTHORITATIVE_METRICS[content.metricId] : undefined;
  const available = resultState(content.value) !== 'Unavailable';
  const base: AuditDimension[] = [
    { key: 'source', label: 'Source evidence', state: available ? 'observed' : 'unavailable', detail: available ? 'This aggregate result was returned. Raw source completeness has not been established by the displayed value.' : 'A value for this metric was not returned.' },
    { key: 'mapping', label: 'Source mapping', state: contract?.mappingStatus === 'APPROVED' ? 'mapped' : contract?.mappingStatus === 'PROVISIONAL' ? 'partial' : 'not_verified', detail: contract ? `${contract.source}; ${contract.mappingStatus}. Mapping approval does not verify business meaning.` : 'No registered field mapping is supplied for this aggregate.' },
    { key: 'scope', label: 'Reporting scope', state: content.scope ? 'scoped' : 'not_verified', detail: content.scope ? scopeDescription : 'The current navigation context is shown; this result has no explicit response scope.' },
    { key: 'reconciliation', label: 'Independent reconciliation', state: content.reconciliation?.kind === 'source_reconciliation' ? content.reconciliation.state : 'not_verified', detail: content.reconciliation?.kind === 'source_reconciliation' ? content.reconciliation.detail : 'No independent source comparison for this exact metric and scope was supplied.' },
    { key: 'business', label: 'Business meaning', state: content.reconciliation?.kind === 'business_verification' ? content.reconciliation.state : 'not_verified', detail: content.reconciliation?.kind === 'business_verification' ? content.reconciliation.detail : 'Source-owner approval of business meaning is not supplied by this operational response.' },
  ];
  const dimensions = base.map(dimension => content.dimensions?.find(item => item.key === dimension.key) || dimension);
  for (const dimension of content.dimensions || []) if (!dimensions.some(item => item.key === dimension.key)) dimensions.push(dimension);
  const nodes: EvidenceTraceNode[] = [];
  const source = content.provenance?.source || contract?.source;
  if (source) nodes.push({ key: 'source', type: 'source', label: content.provenance?.source ? 'Response source reference' : 'Declared contract source', value: source, state: 'mapped', detail: 'A source reference is lineage metadata. It does not establish an independent read or physical source completeness.' });
  if (contract?.fields.length) nodes.push({ key: 'fields', type: 'field', label: 'Declared fields', value: contract.fields.join(' · '), state: 'mapped', detail: 'Fields declared by the metric definition; runtime field coverage is not supplied here.' });
  if (contract?.precedence) nodes.push({ key: 'normalization', type: 'normalization', label: 'Normalisation', value: contract.precedence, state: 'mapped' });
  if (contract?.eligibility) nodes.push({ key: 'qualification', type: 'qualification', label: 'Qualification rule', value: contract.eligibility, state: 'mapped', detail: contract.exclusions });
  if (contract || content.definition) nodes.push({ key: 'metric', type: 'metric', label: 'Analytical definition', value: content.metricId || content.title, state: 'mapped', detail: content.definition?.calculation || contract?.numeratorDescription || content.definition?.meaning });
  nodes.push({ key: 'display', type: 'display', label: 'Displayed result', value: available ? content.value : null, state: available ? 'observed' : 'unavailable', detail: scopeDescription });
  // No API endpoint, job, independent-source node, or event is inferred from the route or render.
  const independent = content.metricId === 'activation_rate' || content.metricId === 'sales_per_rpc_rate';
  const hasRatio = content.denominatorCount !== undefined || contract?.denominator != null;
  const anatomy: MetricAnatomyModel = content.anatomy || {
    kind: independent ? 'independent_ratio' : hasRatio ? 'ratio' : contract?.unit === 'currency' ? 'financial' : contract?.unit === 'records' || content.numeratorCount !== undefined ? 'count' : 'value',
    label: content.title, value: content.value ?? null, unit: content.unit,
    numerator: { key: 'numerator', label: content.numeratorLabel || contract?.numeratorDescription || content.definition?.grain || 'Returned result', value: content.numeratorCount !== undefined ? content.numeratorCount : hasRatio ? null : content.value ?? null },
    ...(hasRatio ? { denominator: { key: 'denominator', label: content.denominatorLabel || contract?.denominatorDescription || 'Required denominator', value: content.denominatorCount ?? null } } : {}),
    formula: content.definition?.calculation,
    ...(contract?.scaling !== 'none' && contract?.scaling ? { scaling: contract.scaling } : {}),
    detail: content.definition?.meaning || contract?.plainDefinition,
  };
  const reconciliation: AuditReconciliationModel = content.reconciliation || {
    label: 'Independent reconciliation', kind: 'source_reconciliation', state: 'not_verified', values: [], scopeDescription,
    detail: 'No independent comparison for this exact population was returned. Query/output consistency, approved mapping and code tests do not establish source reconciliation or business verification.',
  };
  return { dimensions, trace: content.trace || nodes, anatomy, reconciliation };
}
