import React from 'react';
import { auditMagnitude, canComposeCoverage, formatAuditValue, type EvidenceCoverageModel } from './auditVisualModel';
import { AuditStateLabel } from './EvidenceTrace';
export type { EvidenceCoverageModel } from './auditVisualModel';

export default function EvidenceCoverage({ model }: { model: EvidenceCoverageModel }) {
  if (!model.categories.length) return null;
  const composed = canComposeCoverage(model);
  const magnitudes = model.categories.map(category => auditMagnitude(category.value));
  // Scale values before summing so large finite counts cannot overflow the coordinate sum.
  const maximum = Math.max(...magnitudes.map(value => value ?? 0));
  const scaledTotal = maximum > 0 ? magnitudes.reduce<number>((sum, value) => sum + (value ?? 0) / maximum, 0) : 0;
  return <section className="cx-evidence-coverage" aria-label={model.label} data-composition={composed ? 'stacked' : 'separate'}><h3>{model.label}</h3>{model.populationLabel && <p className="cx-audit-visual-note">{model.populationLabel}</p>}
    {composed && <div className="cx-audit-coverage-stack" aria-hidden="true">{model.categories.map((category, index) => <span key={category.key} data-audit-state={category.state || 'observed'} data-segment={index % 4} style={{ width: `${scaledTotal ? (magnitudes[index]! / maximum) / scaledTotal * 100 : 0}%` }}/>)}</div>}
    <ul className="cx-audit-population-list">{model.categories.map((category, index) => <li key={category.key} data-segment={index % 4}><span>{category.label}</span><strong className="cx-audit-exact-value">{formatAuditValue(category.value)}</strong>{category.state && <AuditStateLabel state={category.state}/>} {!composed && <div className="cx-audit-bar-track" aria-hidden="true">{magnitudes[index] !== null && <span data-audit-state={category.state || 'observed'} style={{ width: `${maximum > 0 ? magnitudes[index]! / maximum * 100 : 0}%` }}/>}</div>}{category.detail && <p>{category.detail}</p>}</li>)}</ul>
    <p className="cx-audit-visual-note">{composed ? 'Composition uses explicitly disjoint populations in the supplied scope.' : 'Categories are shown separately. They may overlap and are not added together.'} Zero and unavailable evidence are distinct.</p>{model.detail && <p>{model.detail}</p>}
  </section>;
}
