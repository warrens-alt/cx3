import React from 'react';
import { Link2, Link2Off, ShieldQuestion } from 'lucide-react';

/** A labelled source boundary. Mapping availability alone never certifies matched populations. */
export default function AttributionBoundary({ state, label, detail, onInspect }: {
  state: 'matched' | 'partial' | 'unavailable' | 'unverified';
  label: string;
  detail: string;
  onInspect?: () => void;
}) {
  const Icon = state === 'matched' ? Link2 : state === 'unavailable' ? Link2Off : ShieldQuestion;
  return <div className="cx-attribution-boundary" data-state={state} role="note">
    <span>Marketing platform</span>
    <div><Icon size={18} aria-hidden="true" /><strong>{label}</strong><small>{detail}</small>{onInspect && <button type="button" className="cx-audit-evidence-control" onClick={onInspect} aria-label="Audit evidence: Approved attribution-key match">Audit evidence</button>}</div>
    <span>Operational lifecycle</span>
  </div>;
}
