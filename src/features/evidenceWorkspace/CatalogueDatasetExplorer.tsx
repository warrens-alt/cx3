import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import type { DatasetSummary } from '../../../server/analytics/warehouse/warehouseAnalytics';
import { formatTableNumber } from '../../lib/formatters';
import ChartFrame from '../../shared/visuals/ChartFrame';
import InspectorHost, { type InspectorContent } from '../../shared/evidence/InspectorHost';

/** Catalogue geometry only: registered objects are not source records or live coverage. */
export default function CatalogueDatasetExplorer({ datasets, onBrowse, selectedDataset, scope, generatedAt, snapshotDate }: {
  datasets: DatasetSummary[];
  onBrowse: (dataset: DatasetSummary) => void;
  selectedDataset?: { project: string; dataset: string };
  scope: NonNullable<InspectorContent['scope']>;
  generatedAt?: string;
  snapshotDate?: string;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'name' | 'objects'>('objects');
  const [inspected, setInspected] = useState<DatasetSummary | null>(null);
  const active = inspected && datasets.includes(inspected) ? inspected : null;
  const rows = useMemo(() => datasets.filter(d => `${d.project}.${d.dataset}`.toLowerCase().includes(search.trim().toLowerCase()))
    .slice().sort((a, b) => sort === 'name' ? `${a.project}.${a.dataset}`.localeCompare(`${b.project}.${b.dataset}`) : b.totalObjects - a.totalObjects), [datasets, search, sort]);
  const maximum = Math.max(1, ...datasets.map(d => d.totalObjects));
  return <ChartFrame title="Registered datasets" subtitle="Saved catalogue object counts; no source records are read." className="cx-catalogue-explorer"
    scope={<span>{scope?.clientLabel || scope?.clientId || 'Workspace not supplied'} · Saved catalogue; analytical dates do not bound this inventory.</span>}>
    <div className="cx-admin-toolbar">
      <label className="cx-admin-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Search datasets</span><input aria-label="Search datasets" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search project or dataset…" /></label>
      <label>Order<select value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="objects">Most registered objects</option><option value="name">Dataset name</option></select></label>
      <span role="status">{rows.length} of {datasets.length} datasets</span>
    </div>
    <div className="cx-admin-table-scroll" role="region" aria-label="Dataset catalogue comparison" tabIndex={0}>
      <table className="cx-admin-table"><thead><tr><th scope="col">Dataset / project</th><th scope="col">Registered objects</th><th scope="col">Schema columns</th><th scope="col">Access</th><th scope="col">Explore</th></tr></thead>
        <tbody>{rows.map(d => <tr key={`${d.project}.${d.dataset}`} data-audit-selected={d.project === selectedDataset?.project && d.dataset === selectedDataset?.dataset || undefined}><th scope="row"><strong>{d.dataset}</strong><small>{d.project}</small></th>
          <td><div className="cx-admin-inline-bar"><span className="cx-admin-bar-track" aria-hidden="true"><i style={{ width: `${d.totalObjects / maximum * 100}%` }} /></span><strong>{formatTableNumber(d.totalObjects)}</strong></div></td>
          <td className="cx-admin-number">{formatTableNumber(d.totalColumns)}</td><td><span className="cx-admin-status" data-state="NOT_RUN">Not checked</span></td>
          <td><button type="button" className="cx-admin-text-button" aria-label={`Inspect evidence for ${d.project}.${d.dataset}`} onClick={() => setInspected(d)}>Inspect evidence</button></td></tr>)}</tbody>
      </table>
    </div>
    {!rows.length && <p className="cx-admin-empty">{datasets.length ? 'No registered datasets match this search.' : 'No datasets were returned in this catalogue.'}</p>}
    <p className="cx-admin-footnote">Bars represent object counts, not leads, source rows or connectivity. A larger catalogue is not evidence of a healthier or more complete feed.</p>
    {active && <InspectorHost open onClose={() => setInspected(null)} content={{
      type: 'custom', title: `${active.project}.${active.dataset}`, value: active.totalObjects, unit: 'registered objects', scope,
      definition: {
        meaning: active.description || 'Object registrations in the saved catalogue for this exact dataset.',
        grain: 'Registered catalogue objects; not source records.',
        calculation: 'The registered object count is supplied by the catalogue response. No business-record denominator is supplied.',
        dateBasis: 'Catalogue metadata; analytical date filters do not bound this inventory.',
        limitations: ['Registration does not establish source access or feed completeness. Object count is not a data-quality measurement.'],
      },
      provenance: { validationStatus: active.status, source: `${active.project}.${active.dataset}`, generatedAt },
      detailLimitation: 'This catalogue count has no supporting lead-record drill. Browse its saved schemas; current records require an explicit permitted read.',
      details: <div className="cx-integrity-inspector-detail"><dl>
        <div><dt>Schema snapshot</dt><dd>{snapshotDate || 'Not supplied'}</dd></div>
        <div><dt>Registered tables</dt><dd>{formatTableNumber(active.tablesCount)}</dd></div>
        <div><dt>Registered views</dt><dd>{formatTableNumber(active.viewsCount)}</dd></div>
        <div><dt>Schema columns</dt><dd>{formatTableNumber(active.totalColumns)}</dd></div>
        <div><dt>Source access</dt><dd>Not checked by this catalogue.</dd></div>
      </dl><p>Snapshot and generated-at timestamps describe catalogue metadata; neither establishes source freshness.</p>
      <button type="button" className="cx-admin-text-button" aria-label={`Browse ${active.project}.${active.dataset} schema`} onClick={() => { setInspected(null); onBrowse(active); }}>Browse schema <ArrowUpRight size={13} aria-hidden="true" /></button></div>,
    }} />}
  </ChartFrame>;
}
