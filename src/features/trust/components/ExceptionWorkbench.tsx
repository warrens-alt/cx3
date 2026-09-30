import React, { useMemo, useState } from 'react';
import { Link, type To } from 'react-router-dom';
import { ArrowUpRight, Search, X } from 'lucide-react';
import type { ExceptionPopulation } from '../../../../contracts/exceptionAnalytics';
import { formatTableNumber, formatPercent } from '../../../lib/formatters';
import EvidenceBars, { evidenceBarWidth } from '../../../shared/visuals/EvidenceBars';

export default function ExceptionWorkbench({ items, evidenceHref, isAdmin, populationNote, onInspect }: {
  items: ExceptionPopulation[];
  evidenceHref: (id: string) => To;
  isAdmin: boolean;
  populationNote?: string;
  onInspect?: (item: ExceptionPopulation) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<'severity' | 'count'>('severity');
  const visible = useMemo(() => {
    const filtered = items.filter(item => `${item.title} ${item.severity}`.toLowerCase().includes(search.trim().toLowerCase()));
    return order === 'count' ? [...filtered].sort((a, b) => b.count - a.count) : filtered;
  }, [items, search, order]);
  const selected = visible.find(item => item.id === selectedId) || visible[0];
  const maximum = Math.max(0, ...items.map(item => item.count));
  return <section id="exception-workbench" className="cx-trust-panel cx-exception-workbench" aria-labelledby="exception-workbench-title">
    <header className="cx-trust-heading"><div><h2 id="exception-workbench-title">Choose an exception. Follow the evidence.</h2>
      <p>{populationNote || 'Compare each returned affected population separately; the same lead can appear in more than one check.'}</p></div></header>
    <div className="cx-trust-toolbar">
      <label className="cx-trust-search"><Search size={14} aria-hidden="true" /><span className="sr-only">Find an exception</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find an exception…" />
        {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear exception search"><X size={14} /></button>}</label>
      <label>Sort <select aria-label="Sort exceptions" value={order} onChange={event => setOrder(event.target.value as typeof order)}><option value="severity">Severity, then count</option><option value="count">Affected records</option></select></label>
      <span className="cx-trust-meta">{visible.length} of {items.length} active types · local view only</span>
    </div>
    <div className="cx-exception-focus-grid">
      <ul className="cx-exception-selector" aria-label="Choose an exception">
        {visible.map(item => <li key={item.id}><button type="button" aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)} data-severity={item.severity}>
          <span className="cx-exception-selector-heading"><strong>{item.title}</strong><span className="cx-trust-severity" data-severity={item.severity}>{item.severity}</span></span>
          <span className="cx-exception-selector-count">{formatTableNumber(item.count)}<small>affected records</small></span>
          <span className="cx-exception-selector-track" aria-hidden="true"><span style={{ width: `${evidenceBarWidth(item.count, maximum) ?? 0}%` }} /></span>
        </button></li>)}
        {!visible.length && <li className="cx-trust-empty">No exception types match this search. Clear the search to see the full returned queue.</li>}
      </ul>
      <div className="cx-exception-selected" aria-label="Selected exception evidence" aria-live="polite">
        {selected ? <><header className="cx-trust-heading"><div><span className="cx-trust-meta">Selected exception</span><h3>{selected.title}</h3></div>
          {onInspect ? <button type="button" className="cx-button-secondary" onClick={() => onInspect(selected)}>Inspect evidence</button> : <Link to={evidenceHref(selected.id)} className="cx-trust-link">{isAdmin ? 'Inspect records' : 'Open data integrity'}<ArrowUpRight size={14} aria-hidden="true" /></Link>}</header>
          <p>{selected.detail}</p>
          <dl className="cx-exception-periods"><div><dt>Current cohort</dt><dd>{formatTableNumber(selected.count)}</dd></div><div><dt>Previous cohort</dt><dd>{formatTableNumber(selected.previousCount)}</dd></div>
            <div><dt>Count change</dt><dd>{selected.absoluteChange == null ? 'Unavailable' : `${selected.absoluteChange > 0 ? '+' : ''}${formatTableNumber(selected.absoluteChange)}`}</dd></div>
            <div><dt>Percentage change</dt><dd>{selected.percentageChange == null ? 'Unavailable' : formatPercent(selected.percentageChange)}</dd></div></dl>
          <div className="cx-exception-breakdowns">
            <EvidenceBars title="Vendor concentration" description="Returned vendor groups for this exception." items={(selected.byVendor || []).map((group, index) => ({ key: String(index), label: group.name || 'Unrecorded', value: group.count }))} />
            <EvidenceBars title="Source concentration" description="Returned acquisition sources for this exception." items={(selected.bySource || []).map((group, index) => ({ key: String(index), label: group.name || 'Unrecorded', value: group.count, color: 'var(--cx-data-delivered)' }))} />
          </div>
          <p className="cx-trust-note">Group counts are shown as returned, not forced to total the queue. Severity is supplied by the report; bar length is not a new risk score.</p>
        </> : <p className="cx-trust-empty">Select a returned exception to read its evidence.</p>}
      </div>
    </div>
  </section>;
}
