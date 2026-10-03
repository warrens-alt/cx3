import React, { useId, useMemo, useState } from 'react';
import { analyticalParameterJson, discoverAnalyticalParameters, groupAnalyticalParameters, matchesAnalyticalParameter, type AnalyticalRow } from './analyticalParameters';
import AnalyticalParameterValue from './AnalyticalParameterValue';

export default function AnalyticalAllParameters({ row, className = '' }: { row: AnalyticalRow; className?: string }) {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const scopeId = `${searchId}-scope`;
  const fields = useMemo(() => discoverAnalyticalParameters([row]), [row]);
  const visible = fields.filter(field => matchesAnalyticalParameter(field, query));
  return <section className={`cx-analytical-all-parameters ${className}`} aria-label="All analytical parameters">
    <p id={scopeId} className="cx-analytical-parameter-scope">Parameters returned for this analytical lead. Null values remain visible; original source records remain separate.</p>
    <div className="cx-analytical-parameter-search"><label htmlFor={searchId}>Search parameter names</label><input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Field name or group" aria-describedby={scopeId} /></div>
    <p className="cx-analytical-parameter-count" role="status">{visible.length} of {fields.length} returned parameters{query.trim() ? ' match this search' : ''}</p>
    {groupAnalyticalParameters(visible).map(group => <details className="cx-analytical-parameter-group" key={group.id} open={query.trim() ? true : group.id === 'identity' ? true : undefined}><summary>{group.label}<span>{group.fields.length}</span></summary><dl>{group.fields.map(field => <div key={field.key} data-parameter-key={field.key}><dt>{field.label}<code>{field.key}</code></dt><dd><AnalyticalParameterValue row={row} field={field} /></dd></div>)}</dl></details>)}
    {!visible.length && <p>No returned parameter names match this search.</p>}
    <details className="cx-analytical-parameter-json"><summary>Returned analytical row (JSON)</summary><pre>{analyticalParameterJson(row)}</pre></details>
  </section>;
}
