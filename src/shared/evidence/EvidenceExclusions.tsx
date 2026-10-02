import React from 'react';
import { auditMagnitude, canUseAuditAction, formatAuditValue, type EvidenceExclusionsModel } from './auditVisualModel';
import { AuditStateLabel } from './EvidenceTrace';
export type { EvidenceExclusionsModel, AuditExclusion } from './auditVisualModel';

export default function EvidenceExclusions({ model }: { model: EvidenceExclusionsModel }) {
  const summary = [model.recorded, model.qualified, model.excluded].filter(item => item !== undefined);
  if (!summary.length && !model.reasons.length) return null;
  const maximum = Math.max(0, ...model.reasons.map(reason => auditMagnitude(reason.value) ?? 0));
  return <section className="cx-evidence-exclusions" aria-label={model.label}><h3>{model.label}</h3>{summary.length > 0 && <ul className="cx-audit-population-list cx-audit-qualification-summary">{summary.map(population => <li key={population.key}><span>{population.label}</span><strong className="cx-audit-exact-value">{formatAuditValue(population.value)}</strong>{population.state && <AuditStateLabel state={population.state}/>} {population.detail && <p>{population.detail}</p>}</li>)}</ul>}
    {model.reasons.length > 0 && <ul className="cx-audit-population-list">{model.reasons.map(reason => {
      const magnitude = auditMagnitude(reason.value), action = canUseAuditAction(reason.action) ? reason.action : null;
      const bar = <div className="cx-audit-bar-track" aria-hidden="true">{magnitude !== null && <span data-audit-state={reason.state || 'partial'} style={{ width: `${maximum > 0 ? magnitude / maximum * 100 : 0}%` }}/>}</div>;
      return <li key={reason.key}>{action ? <button type="button" className="cx-audit-exclusion-action" onClick={action.onClick} aria-label={`${action.label}: ${reason.label}, ${formatAuditValue(reason.value)}`}><span>{reason.label}</span><strong className="cx-audit-exact-value">{formatAuditValue(reason.value)}</strong>{bar}<span className="cx-audit-action-label">{action.label}</span></button> : <><span>{reason.label}</span><strong className="cx-audit-exact-value">{formatAuditValue(reason.value)}</strong>{bar}</>}{reason.state && <AuditStateLabel state={reason.state}/>} {reason.detail && <p>{reason.detail}</p>}</li>;
    })}</ul>}
    <p className="cx-audit-visual-note">Counts are supplied exclusion observations. Reasons may overlap; no excluded total is inferred from them.</p>{model.detail && <p>{model.detail}</p>}
  </section>;
}
