import type { EvidencePin } from './EvidenceTray';
import { investigationScopeText, type InvestigationModel } from './investigationModel';
import type { InspectorContent } from '../../shared/evidence/InspectorHost';
import { resultState, type AuditScope } from '../../shared/evidence/auditPresentation';

/** Use the pin's immutable observed case scope, including restrictions absent from global filters. */
export function pinnedAuditScope(model: InvestigationModel): AuditScope {
  const narrowing: Record<string, string> = {};
  if (model.drill) narrowing.drill = model.drill;
  if (model.drillValue) narrowing.drillValue = model.drillValue;
  if (model.metric) narrowing.investigationMetric = model.metric;
  if (model.search) narrowing.search = model.search;
  for (const segment of model.segments) narrowing[segment.key] = segment.value;
  return { clientId: model.clientId, clientLabel: model.clientLabel, startDate: model.startDate, endDate: model.endDate, filters: structuredClone(model.filters), narrowing };
}

/** A local pin is an observation snapshot, not a new analytical evaluation or audit event. */
export function pinnedAuditEvidence(item: EvidencePin & { scope: InvestigationModel }): InspectorContent {
  const provenanceText = Array.isArray(item.provenance) ? item.provenance.join(' · ') : item.provenance;
  const valueAvailable = resultState(item.value) !== 'Unavailable';
  // A pinned breakdown row may be narrower than its case scope. Its identifier
  // alone is not an approved segment predicate and must not create a broad drill.
  const hasPopulationDrill = Boolean(item.scope.drill && ['metric', 'exception'].includes(item.kind));
  return {
    type: 'custom', title: item.label, subtitle: `Pinned ${item.kind.replaceAll('-', ' ')} observation`, value: item.value, showAnatomy: ['metric', 'exception'].includes(item.kind),
    scope: pinnedAuditScope(item.scope),
    definition: { meaning: item.definition, grain: item.scope.countingGrain, dateBasis: item.scope.dateBasis, calculation: 'The original pinned value is displayed without a new query or recalculation. Pins across scopes are not additive.', limitations: ['Analyst pins and notes do not establish independent reconciliation or business approval.'] },
    provenance: { validationStatus: item.scope.validationStatus, countingGrain: item.scope.countingGrain, dateBasis: item.scope.dateBasis },
    dimensions: [
      { key: 'observation', label: 'Pinned observation', state: valueAvailable ? 'observed' : 'unavailable', detail: 'The original supplied value and definition are retained locally. Missing values remain unavailable.' },
      { key: 'scope', label: 'Observed case scope', state: 'scoped', detail: investigationScopeText(item.scope) },
      { key: 'source', label: 'Source provenance', state: provenanceText ? 'observed' : 'unavailable', detail: provenanceText || 'No source provenance was pinned.' },
      { key: 'reconciliation', label: 'Independent reconciliation', state: 'not_verified', detail: 'No independent comparison is stored with this pin.' },
      { key: 'business', label: 'Business verification', state: 'not_verified', detail: 'Pinning does not approve the source business meaning.' },
    ],
    trace: [
      { key: 'source', type: 'source', label: 'Pinned provenance', value: provenanceText || null, state: provenanceText ? 'observed' : 'unavailable' },
      { key: 'qualification', type: 'qualification', label: 'Original case population', value: item.scope.label, state: 'scoped', detail: investigationScopeText(item.scope) },
      { key: 'result', type: item.kind === 'metric' ? 'metric' : 'api', label: item.label, value: item.value, state: valueAvailable ? 'observed' : 'unavailable', detail: item.definition },
      { key: 'display', type: 'display', label: 'Pinned evidence tray', value: item.value, state: valueAvailable ? 'presentation_consistent' : 'unavailable', detail: 'Local snapshot of the supplied observation. Pinned time is an analyst action, not a source or reconciliation event.' },
    ],
    ...(hasPopulationDrill ? { recordDrill: { drill: item.scope.drill, ...(item.scope.drillValue ? { drillValue: item.scope.drillValue } : {}) } } : {}),
    detailLimitation: hasPopulationDrill ? 'The supporting-record action uses the original case predicate, dates, global filters and segment/search restrictions. Opening this audit view makes no record request.' : 'No exact supporting-record predicate was supplied for this pinned observation. Record and timeline identities remain local to the existing authorized evidence view.',
  };
}
