import React, { useId, useMemo, useRef, useState } from 'react';
import { groupAnalyticalParameters, matchesAnalyticalParameter, type AnalyticalParameter } from './analyticalParameters';

export default function AnalyticalColumnManager({ fields, selected, presetLabel, onChange, onRestore }: {
  fields: AnalyticalParameter[]; selected: string[]; presetLabel: string; onChange: (keys: string[]) => void; onRestore: () => void;
}) {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const root = useRef<HTMLDetailsElement>(null);
  const selectedKeys = useMemo(() => new Set(selected), [selected]);
  const visible = fields.filter(field => matchesAnalyticalParameter(field, query));
  const required = fields.filter(field => field.key === 'lead_id').map(field => field.key);
  return <details ref={root} className="cx-analytical-column-manager" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (root.current) { root.current.open = false; root.current.querySelector('summary')?.focus(); } } }}>
    <summary>Columns <span>{selected.length}</span></summary>
    <div className="cx-analytical-column-manager-body"><p>Choose fields for this view. Lead identity stays visible; the loaded evidence and reporting scope stay the same.</p>
      <label htmlFor={searchId}>Search analytical columns</label><input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Field name or group" />
      <div className="cx-analytical-column-actions"><button type="button" onClick={onRestore}>Restore {presetLabel} preset</button><button type="button" onClick={() => onChange(fields.map(field => field.key))}>Select all</button><button type="button" onClick={() => onChange(required)}>Clear optional fields</button></div>
      <div className="cx-analytical-column-options">{groupAnalyticalParameters(visible).map(group => <fieldset key={group.id}><legend>{group.label}</legend>{group.fields.map(field => <label key={field.key}><input type="checkbox" checked={selectedKeys.has(field.key)} disabled={field.key === 'lead_id'} onChange={event => onChange(event.target.checked ? [...selected, field.key] : selected.filter(key => key !== field.key))} /><span>{field.label}<code>{field.key === '@delay' ? 'From recorded milestones' : field.key}</code></span></label>)}</fieldset>)}</div>
      {!visible.length && <p role="status">No analytical fields match this search.</p>}
    </div>
  </details>;
}
