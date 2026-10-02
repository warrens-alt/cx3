import React from 'react';
import { GitBranch } from 'lucide-react';
import { AUTHORITATIVE_METRICS } from '../../../../contracts/metricRegistry';
import EvidenceMatrix from '../../../shared/visuals/EvidenceMatrix';
import AuditDependencyMap from '../../../shared/evidence/AuditDependencyMap';
import ReconciliationView from '../../../shared/evidence/ReconciliationView';
import type { InspectorContent } from '../../../shared/evidence/InspectorHost';
import type { AuditScope } from '../../../shared/evidence/auditPresentation';
import { auditMetricDefinitions, metricDefinitionEvidence, metricsDependentOnSource, sourceObservationEvidence, type ObservedSource } from '../sourceMetricEvidence';

type Props = { scope: AuditScope; sources?: ObservedSource[]; onInspect: (content: InspectorContent) => void };

export function SourceMetricDependencies({ scope, sources, onInspect }: Props) {
  const declaredSources = (sources || []).filter(source => metricsDependentOnSource(source.key).length > 0);
  return <section className="cx-command-panel cx-metric-audit-hub" aria-labelledby="source-dependencies-heading">
    <header><div><span className="cx-command-section-kicker">Declared lineage</span><h2 id="source-dependencies-heading">Source → metric dependencies</h2><p>Registry roles show which definitions depend on a source. They do not establish cross-source joins, measured metric values or independent reconciliation.</p></div></header>
    <AuditDependencyMap model={{
      label: 'Observed sources and declared metric dependencies',
      inputs: declaredSources.map(source => ({ key: source.key, label: source.label, value: source.table, state: source.rowCount == null ? 'unavailable' : 'observed', detail: 'Physical identifier returned for this tenant. Dependency connections below are logical registry declarations.', action: { label: `Audit source ${source.label}`, supported: true, authorized: true, onClick: () => onInspect(sourceObservationEvidence(source, scope.clientId, metric => onInspect(metricDefinitionEvidence(metric, scope)))) } })),
      outputs: auditMetricDefinitions.filter(metric => declaredSources.some(source => metricsDependentOnSource(source.key).includes(metric))).map(metric => ({ key: metric.id, label: metric.businessLabel, value: null, state: 'mapped', dependencies: declaredSources.filter(source => metricsDependentOnSource(source.key).includes(metric)).map(source => source.key), detail: `Declared metric source: ${metric.source}. All dependencies: ${metric.dependencies.join(', ')}.`, action: { label: `Audit definition for ${metric.businessLabel}`, supported: true, authorized: true, onClick: () => onInspect(metricDefinitionEvidence(metric, scope)) } })),
    }} />
    {!declaredSources.length && <p className="cx-admin-empty">No returned source has a matching declared registry dependency.</p>}
  </section>;
}

export default function MetricEvidenceHub({ scope, onInspect }: Props) {
  return <section className="cx-command-panel cx-metric-audit-hub" aria-labelledby="metric-evidence-heading">
    <header><div><span className="cx-command-section-kicker">Metric evidence</span><h2 id="metric-evidence-heading">Declared metric evidence</h2><p>Definitions and mappings are versioned metadata. This integrity response does not return these metric values or evaluate their selected populations.</p></div></header>
    <EvidenceMatrix label="Metric audit dimensions" rowHeading="Metric" columns={[{ key: 'mapping', label: 'Mapping' }, { key: 'scope', label: 'Metric scope' }, { key: 'definition', label: 'Definition' }, { key: 'reconciliation', label: 'Reconciliation' }, { key: 'business', label: 'Business meaning' }]} rows={auditMetricDefinitions.map(metric => ({
      key: metric.id, label: metric.businessLabel, detail: `${metric.countingGrain} · ${metric.dateBasis}`,
      action: <button type="button" className="cx-audit-evidence-control" onClick={() => onInspect(metricDefinitionEvidence(metric, scope))}><GitBranch size={14} aria-hidden="true" /><span>Audit evidence</span></button>,
      cells: {
        mapping: { state: metric.mappingStatus === 'APPROVED' ? 'mapped' : metric.mappingStatus === 'PROVISIONAL' ? 'partial' : 'unavailable', label: metric.mappingStatus === 'APPROVED' ? 'Declared mapping' : metric.mappingStatus, detail: metric.source },
        scope: { state: 'unavailable', label: 'No metric result', detail: 'Integrity scope is navigation context only' },
        definition: { state: 'mapped', label: 'Definition supplied', detail: metric.version },
        reconciliation: { state: 'unverified', label: 'Not verified', detail: 'No independent exact-scope comparison supplied' },
        business: { state: 'unverified', label: 'Not verified', detail: 'Structural mapping is separate from business approval' },
      },
    }))} />
  </section>;
}

export function MetricDefinitions({ scope, onInspect }: Omit<Props, 'sources'>) {
  return <section className="cx-command-panel cx-metric-audit-hub" aria-labelledby="audit-definitions-heading"><header><div><span className="cx-command-section-kicker">Definitions</span><h2 id="audit-definitions-heading">What CX3 counts</h2><p>Source fields, counting grain and qualification follow the maintained metric registry.</p></div></header>
    <div className="cx-audit-definition-list">{Object.values(AUTHORITATIVE_METRICS).map(metric => <details key={metric.id}><summary>{metric.businessLabel}</summary><p>{metric.plainDefinition}</p><dl><div><dt>Grain / date basis</dt><dd>{metric.countingGrain} · {metric.dateBasis}</dd></div><div><dt>Declared source and fields</dt><dd>{metric.source}<br />{metric.fields.join(', ')}</dd></div><div><dt>Calculation / precedence</dt><dd>{metric.precedence}</dd></div><div><dt>Eligibility</dt><dd>{metric.eligibility}</dd></div><div><dt>Exclusions</dt><dd>{metric.exclusions}</dd></div></dl><button className="cx-audit-evidence-control" type="button" onClick={() => onInspect(metricDefinitionEvidence(metric, scope))}><GitBranch size={14} aria-hidden="true" /><span>Audit evidence</span></button></details>)}</div>
  </section>;
}

export function IntegrityReconciliationBoundary() {
  return <section className="cx-command-panel cx-metric-audit-hub" aria-labelledby="integrity-reconciliation-heading"><header><div><span className="cx-command-section-kicker">Reconciliation</span><h2 id="integrity-reconciliation-heading">Independent comparison evidence</h2><p>Integrity gap checks and source observations do not establish independent reconciliation.</p></div></header>
    <ReconciliationView model={{ label: 'Independent reconciliation for this scope', kind: 'source_reconciliation', state: 'not_verified', values: [], detail: 'No independent expected/observed comparison or persisted reconciliation history was supplied by this response. No reconciliation result is inferred from the returned operational status.' }} />
    <p className="cx-trust-note">Metric → API → display agreement is delivery consistency. Business meaning requires separate approval. Each evidence dimension remains independent.</p>
  </section>;
}
