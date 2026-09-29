import React, { useMemo, useState } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import type { AiInsightsData } from '../../lib/offernetClient';

type Severity = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';
export default function InsightWorkbench({ insights, severity, onSeverity }: {
  insights: AiInsightsData['insights']; severity: Severity; onSeverity: (value: Severity) => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const rows = useMemo(() => insights.map((item, index) => ({ item, index })).filter(({ item }) =>
    (severity === 'ALL' || severity === item.severity) && `${item.category} ${item.finding} ${item.metricReference} ${item.directive}`.toLowerCase().includes(search.trim().toLowerCase())), [insights, severity, search]);
  const active = rows.find(r => r.index === selected) || rows[0];
  return <section id="ai-findings" className="cx-admin-panel cx-insight-workbench" aria-label="Findings workbench">
    <header className="cx-admin-panel-heading"><div><h2>Findings & supporting references</h2><p>Select an observation to read its supplied explanation, proposed action and metric reference. These are not independently verified conclusions.</p></div></header>
    <div className="cx-admin-toolbar"><label className="cx-admin-search"><Search size={15} aria-hidden="true" /><input aria-label="Search findings" placeholder="Search findings or references…" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <div className="cx-admin-switch" role="group" aria-label="Finding severity">{(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(s => <button key={s} type="button" aria-pressed={severity === s} onClick={() => onSeverity(s)}>{s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()} <span>{insights.filter(i => s === 'ALL' || i.severity === s).length}</span></button>)}</div>
    </div>
    <p className="cx-admin-footnote" role="status">{rows.length} of {insights.length} returned findings. Counts describe observations, not affected leads.</p>
    {!active ? <p className="cx-admin-empty">{insights.length ? 'No findings match these filters.' : 'No findings were returned for this scope.'}</p> : <div className="cx-insight-split">
      <ul aria-label="Returned findings">{rows.map(({ item, index }) => <li key={index}><button type="button" aria-pressed={active.index === index} onClick={() => setSelected(index)}><span className="cx-insight-row-heading"><strong>{item.category}</strong><span className="cx-admin-status" data-state={item.severity}>{item.severity}</span></span><span className="cx-insight-preview">{item.finding}</span><small>Read evidence <ArrowRight size={12} aria-hidden="true" /></small></button></li>)}</ul>
      <article className="cx-insight-detail" aria-label="Selected finding"><header><span className="cx-admin-status" data-state={active.item.severity}>{active.item.severity}</span><h3>{active.item.category}</h3></header><dl><div><dt>Observation</dt><dd>{active.item.finding}</dd></div><div><dt>Proposed action</dt><dd>{active.item.directive || 'No action supplied.'}</dd></div><div><dt>Supplied metric reference</dt><dd><code>{active.item.metricReference || 'No metric reference supplied.'}</code></dd></div></dl></article>
    </div>}
  </section>;
}
