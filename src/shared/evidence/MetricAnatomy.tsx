import React from 'react';
import { auditMagnitude, formatAuditValue, isAvailableAuditValue, type AuditPopulation, type MetricAnatomyModel } from './auditVisualModel';
import { AuditStateLabel } from './EvidenceTrace';
export type { MetricAnatomyModel } from './auditVisualModel';

function Population({ population, maximum }: { population: AuditPopulation; maximum: number }) {
  const magnitude = auditMagnitude(population.value);
  return <div className="cx-anatomy-population"><span>{population.label}</span><strong className="cx-audit-exact-value">{formatAuditValue(population.value)}</strong>{population.state && <AuditStateLabel state={population.state}/>}<div className="cx-audit-bar-track" aria-hidden="true">{magnitude !== null && <span style={{ width: `${maximum > 0 ? magnitude / maximum * 100 : 0}%` }}/>}</div>{population.detail && <p>{population.detail}</p>}</div>;
}
export default function MetricAnatomy({ model }: { model: MetricAnatomyModel }) {
  const isRatio = model.kind === 'ratio' || model.kind === 'independent_ratio';
  const maximum = Math.max(auditMagnitude(model.numerator?.value) ?? 0, auditMagnitude(model.denominator?.value) ?? 0);
  const resultAvailable = isAvailableAuditValue(model.value);
  const canExplainEquation = model.scaling && auditMagnitude(model.numerator?.value) !== null && (auditMagnitude(model.denominator?.value) ?? 0) > 0;
  return <section className="cx-metric-anatomy" aria-label={`Metric anatomy: ${model.label}`} data-anatomy-kind={model.kind}><h3>Metric anatomy</h3><div className="cx-anatomy-result"><span>{model.label}</span><strong className="cx-audit-exact-value">{formatAuditValue(model.value)}{resultAvailable && model.unit ? ` ${model.unit}` : ''}</strong></div>
    {model.kind === 'independent_ratio' && <p className="cx-audit-visual-note">Independent population ratio. The numerator and denominator are separately recorded populations; this is not a cohort conversion rate.</p>}
    <div className="cx-anatomy-components">{model.numerator && <Population population={model.numerator} maximum={maximum}/>} {isRatio && model.denominator && <><span className="cx-anatomy-operator">divided by</span><Population population={model.denominator} maximum={maximum}/></>}</div>
    {isRatio && <p className="cx-anatomy-formula">{formatAuditValue(model.numerator?.value)} / {formatAuditValue(model.denominator?.value)}{canExplainEquation && model.scaling !== 'ratio_fraction' ? ` × ${model.scaling === 'per_thousand' ? '1,000' : '100'}` : ''}{resultAvailable ? `${canExplainEquation ? ' = ' : ' · Supplied result: '}${formatAuditValue(model.value)}${model.unit ? ` ${model.unit}` : ''}` : ' · Result unavailable'}</p>}
    {isRatio && !isAvailableAuditValue(model.denominator?.value) && <p className="cx-audit-visual-note">Denominator unavailable. No rate is calculated from missing evidence.</p>}
    {isRatio && auditMagnitude(model.denominator?.value) === 0 && <p className="cx-audit-visual-note">The supplied denominator is zero. Division cannot establish a rate.</p>}
    {model.kind === 'count' && !model.numerator && <p className="cx-audit-visual-note">Count of the supplied population. No denominator applies.</p>}
    {model.kind === 'financial' && <p className="cx-audit-visual-note">Financial value. Completeness describes the evidence supporting the amount; no denominator is implied.</p>}
    {model.completeness && <div className="cx-anatomy-completeness"><strong>{model.completeness.label}</strong><AuditStateLabel state={model.completeness.state}/>{model.completeness.detail && <p>{model.completeness.detail}</p>}</div>}
    {model.secondary?.length ? <ul className="cx-audit-population-list">{model.secondary.map(population => <li key={population.key}><span>{population.label}</span><strong>{formatAuditValue(population.value)}</strong>{population.state && <AuditStateLabel state={population.state}/>} {population.detail && <p>{population.detail}</p>}</li>)}</ul> : null}
    {model.formula && <p>{model.formula}</p>}{model.detail && <p>{model.detail}</p>}
  </section>;
}
