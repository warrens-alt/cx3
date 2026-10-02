import React from 'react';
import { AlertTriangle, Circle, CircleHelp, Database, FileCheck, Filter, GitBranch, Monitor, Scale, ShieldCheck, Braces, Hash } from 'lucide-react';
import { auditStateLabel, canUseAuditAction, formatAuditValue, TRACE_NODE_LABELS, type AuditDimension, type AuditState, type EvidenceTraceNode } from './auditVisualModel';

export type { EvidenceTraceNode, EvidenceTraceNodeType } from './auditVisualModel';
const nodeIcons = { source: Database, field: Hash, normalization: GitBranch, qualification: Filter, metric: FileCheck, api: Braces, display: Monitor, reconciliation: Scale, business: ShieldCheck };

export function AuditStateLabel({ state, label }: { state: AuditState; label?: string }) {
  const Icon = state === 'mismatch' || state === 'partial' ? AlertTriangle : state === 'unavailable' || state === 'not_verified' ? CircleHelp : Circle;
  return <span className="cx-audit-state" data-audit-state={state}><Icon size={13} aria-hidden="true"/>{label || auditStateLabel(state)}</span>;
}
export function AuditDimensions({ dimensions, label = 'Evidence state' }: { dimensions: AuditDimension[]; label?: string }) {
  if (!dimensions.length) return null;
  return <section className="cx-audit-dimension-grid" aria-label={label}><h3>{label}</h3><ul>{dimensions.map(dimension => <li key={dimension.key}><strong>{dimension.label}</strong><AuditStateLabel state={dimension.state}/>{dimension.detail && <p>{dimension.detail}</p>}</li>)}</ul></section>;
}

/** An ordered lineage, not an additive flow. Connectors have no quantitative meaning. */
export default function EvidenceTrace({ nodes, label = 'Evidence trace' }: { nodes: EvidenceTraceNode[]; label?: string }) {
  if (!nodes.length) return null;
  return <section className="cx-evidence-trace" aria-label={label}><h3>{label}</h3><ol className="cx-evidence-trace-nodes">{nodes.map((node, index) => {
    const Icon = nodeIcons[node.type];
    return <li key={node.key} data-node-type={node.type} aria-label={`Step ${index + 1}. ${TRACE_NODE_LABELS[node.type]}: ${node.label}. ${auditStateLabel(node.state)}`}><div className="cx-evidence-trace-heading"><Icon size={16} aria-hidden="true"/><span>{index + 1} · {TRACE_NODE_LABELS[node.type]}</span></div><strong>{node.label}</strong>{node.value !== undefined && <span className="cx-audit-exact-value">{formatAuditValue(node.value)}</span>}<AuditStateLabel state={node.state}/>{node.detail && <p>{node.detail}</p>}{canUseAuditAction(node.action) && <button type="button" className="cx-audit-node-action" onClick={node.action.onClick}>{node.action.label}</button>}</li>;
  })}</ol><p className="cx-audit-visual-note">Lineage shows supplied evidence and declared transformations. Each state describes its own layer.</p></section>;
}
