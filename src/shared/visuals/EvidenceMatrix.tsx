import React from 'react';
import { AlertTriangle, CircleCheck, CircleHelp, CircleMinus, CircleDashed, Circle, GitBranch, Filter, Scale, ShieldCheck } from 'lucide-react';
import type { AuditState } from '../evidence/auditVisualModel';

export type EvidenceMatrixState = AuditState | 'issue' | 'unverified';
export interface EvidenceMatrixCell { state: EvidenceMatrixState; label: string; detail?: string }
export interface EvidenceMatrixRow { key: string; label: string; detail?: string; cells: Record<string, EvidenceMatrixCell>; action?: React.ReactNode }
const states = {
  observed: { Icon: CircleCheck, label: 'Returned observation' },
  issue: { Icon: AlertTriangle, label: 'Reported issue' },
  partial: { Icon: CircleMinus, label: 'Reported partial evidence' },
  unavailable: { Icon: CircleHelp, label: 'Unavailable' },
  unverified: { Icon: CircleDashed, label: 'Not verified' },
  mapped: { Icon: GitBranch, label: 'Mapping defined' },
  scoped: { Icon: Filter, label: 'Scope applied' },
  reconciled: { Icon: Scale, label: 'Reconciled for scope' },
  business_verified: { Icon: ShieldCheck, label: 'Business verified' },
  mismatch: { Icon: AlertTriangle, label: 'Mismatch' },
  not_verified: { Icon: CircleDashed, label: 'Not verified' },
  formula_checked: { Icon: Circle, label: 'Formula checked' },
  api_consistent: { Icon: Circle, label: 'API consistent' },
  presentation_consistent: { Icon: Circle, label: 'Presentation consistent' },
};

/** State labels come from the caller's evidence contract; the matrix never calculates a score. */
export default function EvidenceMatrix({ label, columns, rows, rowHeading = 'Source', emptyLabel = 'No evidence observations were returned.' }: {
  label: string;
  columns: Array<{ key: string; label: string }>;
  rows: EvidenceMatrixRow[];
  rowHeading?: string;
  emptyLabel?: string;
}) {
  return <div className="cx-evidence-matrix">
    {rows.length ? <div className="cx-evidence-matrix-scroll" role="region" aria-label={label} tabIndex={0}>
      <table><caption className="sr-only">{label}. Each cell includes its evidence state and returned value; no combined score is calculated.</caption>
        <thead><tr><th scope="col">{rowHeading}</th>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.key}><th scope="row"><span>{row.label}</span>{row.detail && <small>{row.detail}</small>}{row.action}</th>{columns.map(column => {
          const cell = row.cells[column.key] || { state: 'unavailable' as const, label: 'Unavailable' };
          const { Icon } = states[cell.state];
          return <td key={column.key} data-state={cell.state} aria-label={`${cell.label}. ${states[cell.state].label}${cell.detail ? `. ${cell.detail}` : ''}`}><div className="cx-evidence-matrix-cell"><Icon size={17} aria-hidden="true" /><div><strong>{cell.label}</strong>{cell.detail && <small>{cell.detail}</small>}</div></div></td>;
        })}</tr>)}</tbody>
      </table>
    </div> : <p className="cx-evidence-matrix-empty">{emptyLabel}</p>}
    <ul className="cx-evidence-matrix-key" aria-label="Evidence state legend">{Object.entries(states).filter(([key]) => ['observed', 'issue', 'partial', 'unavailable', 'unverified'].includes(key) || rows.some(row => Object.values(row.cells).some(cell => cell.state === key))).map(([key, { Icon, label: stateLabel }]) => <li key={key} data-state={key}><Icon size={14} aria-hidden="true" />{stateLabel}</li>)}</ul>
  </div>;
}
