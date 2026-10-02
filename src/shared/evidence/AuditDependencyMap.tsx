import React, { useState } from 'react';
import { Database, FileCheck } from 'lucide-react';
import { canUseAuditAction, formatAuditValue, requiredInputAvailability, type AuditDependencyModel } from './auditVisualModel';
import { AuditStateLabel } from './EvidenceTrace';
export type { AuditDependencyModel, AuditDependency } from './auditVisualModel';

/** Dependencies are caller-supplied declarations. Input availability is separately supplied. */
export default function AuditDependencyMap({ model }: { model: AuditDependencyModel }) {
  const [selectedInput, setSelectedInput] = useState<string | null>(null);
  if (!model.inputs.length && !model.outputs?.length) return null;
  const selected = model.inputs.find(input => input.key === selectedInput);
  const availability = requiredInputAvailability(model.inputs);
  return <section className="cx-audit-dependencies" aria-label={model.label}><h3>{model.label}</h3>{availability && <p className="cx-audit-input-availability"><strong>{availability.available} of {availability.total}</strong> required inputs available</p>}
    <div className="cx-audit-dependency-columns"><div><h4>Sources / required inputs</h4><ul>{model.inputs.map(input => <li key={input.key} data-selected={selectedInput === input.key || undefined}><div className="cx-audit-dependency-node"><Database size={16} aria-hidden="true"/><strong>{input.label}</strong>{model.outputs?.some(output => output.dependencies?.includes(input.key)) && <button type="button" className="cx-audit-node-action" aria-pressed={selectedInput === input.key} onClick={() => setSelectedInput(current => current === input.key ? null : input.key)}>Show dependent metrics</button>}</div><span className="cx-audit-exact-value">{formatAuditValue(input.value)}</span>{input.state && <AuditStateLabel state={input.state}/>} {input.required === true && <small>Required input</small>}{typeof input.available === 'boolean' && <small>Input availability: {input.available ? 'Available' : 'Unavailable'}</small>}{input.detail && <p>{input.detail}</p>}{canUseAuditAction(input.action) && <button type="button" className="cx-audit-node-action" onClick={input.action.onClick}>{input.action.label}</button>}</li>)}</ul></div>
      {model.outputs?.length ? <div><h4>{selected ? `Metrics using ${selected.label}` : 'Dependent metrics'}</h4><ul>{model.outputs.filter(output => !selected || output.dependencies?.includes(selected.key)).map(output => <li key={output.key}><div className="cx-audit-dependency-node"><FileCheck size={16} aria-hidden="true"/><strong>{output.label}</strong></div><span className="cx-audit-exact-value">{formatAuditValue(output.value)}</span>{output.state && <AuditStateLabel state={output.state}/>} {output.dependencies?.length ? <small>Declared inputs: {output.dependencies.map(key => model.inputs.find(input => input.key === key)?.label || key).join(', ')}</small> : null}{output.detail && <p>{output.detail}</p>}{canUseAuditAction(output.action) && <button type="button" className="cx-audit-node-action" onClick={output.action.onClick}>{output.action.label}</button>}</li>)}</ul></div> : null}
    </div>{selected && <button type="button" className="cx-audit-node-action" onClick={() => setSelectedInput(null)}>Show all dependent metrics</button>}
    <p className="cx-audit-visual-note">Declared dependencies do not establish that an input was observed or that a metric is business verified.</p>{model.detail && <p>{model.detail}</p>}
  </section>;
}
