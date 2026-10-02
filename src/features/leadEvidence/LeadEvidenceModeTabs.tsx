import React from 'react';
export type LeadEvidenceMode = 'population' | 'source';
export default function LeadEvidenceModeTabs({ mode, id, onChange }: { mode: LeadEvidenceMode; id: string; onChange: (mode: LeadEvidenceMode) => void }) {
  const modes: LeadEvidenceMode[] = ['population', 'source'];
  const select = (next: LeadEvidenceMode) => {
    onChange(next);
    requestAnimationFrame(() => document.getElementById(`${id}-${next}-tab`)?.focus());
  };
  return <div role="tablist" aria-label="Lead Evidence modes" className="cx-lead-evidence-mode-tabs">{modes.map((value, index) => <button key={value} id={`${id}-${value}-tab`} role="tab" type="button" data-view={value} aria-selected={mode === value} aria-controls={`${id}-${value}-panel`} tabIndex={mode === value ? 0 : -1} onClick={() => select(value)} onKeyDown={event => {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? 1 - index : null;
    if (next !== null) { event.preventDefault(); select(modes[next]); }
  }}>{value === 'population' ? 'Population' : 'Source Evidence'}</button>)}</div>;
}
