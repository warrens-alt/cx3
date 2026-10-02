import React, { type CSSProperties, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface OutcomeBranch {
  key: string;
  label: string;
  value: ReactNode;
  detail: string;
  Icon: LucideIcon;
  color: string;
  available?: boolean;
}

/** Separate evidence populations. Connectors express grouping, never membership or conversion. */
export default function OutcomeBranchMap({ anchor, branches, onSelect }: {
  anchor: OutcomeBranch;
  branches: OutcomeBranch[];
  onSelect: (key: string) => void;
}) {
  const node = (item: OutcomeBranch) => <button type="button" className="cx-outcome-branch-node"
    style={{ '--branch-color': item.color } as CSSProperties} data-state={item.available === false ? 'unavailable' : 'observed'}
    onClick={() => onSelect(item.key)} aria-label={`Inspect ${item.label}: ${item.value}`}>
    <span className="cx-outcome-branch-label"><item.Icon size={19} aria-hidden="true" />{item.label}</span>
    <strong>{item.value}</strong><small>{item.detail}</small>
  </button>;
  return <div className="cx-outcome-branch-map" aria-label="Independent outcome evidence views">
    <div className="cx-outcome-branch-anchor">{node(anchor)}</div>
    <p className="cx-outcome-branch-boundary">Independent evidence views<span>Recorded separately within the selected intake cohort</span></p>
    <ul className="cx-outcome-branches">{branches.map(item => <li key={item.key}>{node(item)}</li>)}</ul>
  </div>;
}
