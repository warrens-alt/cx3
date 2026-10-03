import React, { useId, useMemo, useRef, useState } from 'react';
import { groupAnalyticalParameters, matchesAnalyticalParameter, type AnalyticalParameter } from './analyticalParameters';

export default function AnalyticalColumnManager({ fields, selected, presetLabel, returnedFieldCount = fields.length, onChange, onRestore }: {
  fields: AnalyticalParameter[]; selected: string[]; presetLabel: string; returnedFieldCount?: number; onChange: (keys: string[]) => void; onRestore: () => void;
}) {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const scopeId = `${searchId}-scope`;
  const root = useRef<HTMLDetailsElement>(null);
  const selectedKeys = useMemo(() => new Set(selected), [selected]);
  const visible = fields.filter(field => matchesAnalyticalParameter(field, query));
  const required = fields.filter(field => field.key === 'lead_id').map(field => field.key);
  return <details ref={root} className="cx-analytical-column-manager" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (root.current) { root.current.open = false; root.current.querySelector('summary')?.focus(); } } }}>
    <summary>Columns <span aria-label={`${selected.length} selected columns`}>{selected.length}</span></summary>
    <div className="cx-analytical-column-manager-body">
      <p>Column selection affects presentation only. It does not change the analytical population or request new data.</p>
      <p id={scopeId}>Available returned columns are the union of analytical fields returned for the currently loaded page.{fields.length > returnedFieldCount && ' Preset fields may also show unavailable values or supported milestone-derived timing.'}</p>
      <label htmlFor={searchId}>Search analytical columns</label><input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Field name or group" aria-describedby={scopeId} />
      <p className="cx-analytical-column-count" aria-live="polite">{selected.length} selected · {visible.length} of {fields.length} available columns{query.trim() ? ' match this search' : ''}. Lead ID stays visible.</p>
      <div className="cx-analytical-column-actions"><button type="button" onClick={onRestore}>Restore {presetLabel} preset</button><button type="button" onClick={() => onChange(fields.map(field => field.key))}>Select all</button><button type="button" onClick={() => onChange(required)}>Clear optional fields</button></div>
      <div className="cx-analytical-column-options">{groupAnalyticalParameters(visible).map(group => <fieldset key={group.id}><legend>{group.label}</legend>{group.fields.map(field => <label key={field.key}><input type="checkbox" checked={selectedKeys.has(field.key)} disabled={field.key === 'lead_id'} onChange={event => onChange(event.target.checked ? [...selected, field.key] : selected.filter(key => key !== field.key))} /><span>{field.label}<code>{field.key === '@delay' ? 'From recorded milestones' : field.key}</code></span></label>)}</fieldset>)}</div>
      {!visible.length && <p role="status">No analytical fields match this search.</p>}
    </div>
  </details>;
}
