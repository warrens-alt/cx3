import React, { useState } from 'react';
import { auditMetricDefinitions, metricDefinitionEvidence } from '../../features/trust/sourceMetricEvidence';
import EvidenceTrace from '../../shared/evidence/EvidenceTrace';
import type { InspectorContent } from '../../shared/evidence/InspectorHost';
import type { AuditScope } from '../../shared/evidence/auditPresentation';

/** A registry-backed, inspectable lineage. It never claims a physical source was read. */
export default function EvidenceLineageExplorer({ scope, onInspect }: { scope: AuditScope; onInspect: (content: InspectorContent) => void }) {
  const [metricId, setMetricId] = useState(auditMetricDefinitions[0]?.id);
  const metric = auditMetricDefinitions.find(item => item.id === metricId) || auditMetricDefinitions[0];
  if (!metric) return null;
  const content = metricDefinitionEvidence(metric, scope);
  const nodes = (content.trace || []).map(node => ({ ...node, action: { label: `Inspect ${node.type === 'metric' ? 'metric definition' : node.label.toLowerCase()}`, supported: true as const, authorized: true as const, onClick: () => onInspect(content) } }));
  return <section className="cx-evidence-lineage-explorer" aria-label="Visual metric lineage">
    <header><div><h2>Follow a number to its definition</h2><p>Choose a maintained metric to inspect its declared fields, grain and eligibility. A declared mapping does not supply a measured result.</p></div>
      <label>Metric<select value={metric.id} onChange={event => setMetricId(event.target.value)}>{auditMetricDefinitions.map(item => <option key={item.id} value={item.id}>{item.businessLabel}</option>)}</select></label>
    </header>
    <EvidenceTrace nodes={nodes} label={`${metric.businessLabel} · declared lineage`} />
  </section>;
}
