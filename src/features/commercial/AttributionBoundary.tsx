import React from 'react';
import { Link2, Link2Off, ShieldQuestion } from 'lucide-react';

/** A labelled source boundary. Mapping availability alone never certifies matched populations. */
export default function AttributionBoundary({ state, label, detail }: {
  state: 'matched' | 'partial' | 'unavailable' | 'unverified';
  label: string;
  detail: string;
}) {
  const Icon = state === 'matched' ? Link2 : state === 'unavailable' ? Link2Off : ShieldQuestion;
  return <div className="cx-attribution-boundary" data-state={state} role="note">
    <span>Marketing platform</span>
    <div><Icon size={18} aria-hidden="true" /><strong>{label}</strong><small>{detail}</small></div>
    <span>Operational lifecycle</span>
  </div>;
}
