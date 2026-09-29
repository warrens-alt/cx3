import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import type { DatasetSummary } from '../../../server/analytics/warehouse/warehouseAnalytics';
import { formatTableNumber } from '../../lib/formatters';

/** Catalogue geometry only: registered objects are not source records or live coverage. */
export default function CatalogueDatasetExplorer({ datasets, onBrowse }: {
  datasets: DatasetSummary[];
  onBrowse: (dataset: DatasetSummary) => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'name' | 'objects'>('objects');
  const rows = useMemo(() => datasets.filter(d => `${d.project}.${d.dataset}`.toLowerCase().includes(search.trim().toLowerCase()))
    .slice().sort((a, b) => sort === 'name' ? `${a.project}.${a.dataset}`.localeCompare(`${b.project}.${b.dataset}`) : b.totalObjects - a.totalObjects), [datasets, search, sort]);
  const maximum = Math.max(1, ...datasets.map(d => d.totalObjects));
  return <section className="cx-command-panel cx-catalogue-explorer" aria-label="Registered datasets">
    <header className="cx-admin-panel-heading"><div><h2>Registered datasets</h2><p>Compare saved catalogue entries, then open their schema. Bars represent object counts, not leads, source rows or connectivity.</p></div></header>
    <div className="cx-admin-toolbar">
      <label className="cx-admin-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Search datasets</span><input aria-label="Search datasets" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search project or dataset…" /></label>
      <label>Order<select value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="objects">Most registered objects</option><option value="name">Dataset name</option></select></label>
      <span role="status">{rows.length} of {datasets.length} datasets</span>
    </div>
    <div className="cx-admin-table-scroll" role="region" aria-label="Dataset catalogue comparison" tabIndex={0}>
      <table className="cx-admin-table"><thead><tr><th scope="col">Dataset / project</th><th scope="col">Registered objects</th><th scope="col">Schema columns</th><th scope="col">Access</th><th scope="col">Explore</th></tr></thead>
        <tbody>{rows.map(d => <tr key={`${d.project}.${d.dataset}`}><th scope="row"><strong>{d.dataset}</strong><small>{d.project}</small></th>
          <td><div className="cx-admin-inline-bar"><span className="cx-admin-bar-track" aria-hidden="true"><i style={{ width: `${d.totalObjects / maximum * 100}%` }} /></span><strong>{formatTableNumber(d.totalObjects)}</strong></div></td>
          <td className="cx-admin-number">{formatTableNumber(d.totalColumns)}</td><td><span className="cx-admin-status" data-state="NOT_RUN">Not checked</span></td>
          <td><button type="button" className="cx-admin-text-button" aria-label={`Browse ${d.project}.${d.dataset} schema`} onClick={() => onBrowse(d)}>Browse schema <ArrowUpRight size={13} aria-hidden="true" /></button></td></tr>)}</tbody>
      </table>
    </div>
    {!rows.length && <p className="cx-admin-empty">{datasets.length ? 'No registered datasets match this search.' : 'No datasets were returned in this catalogue.'}</p>}
    <p className="cx-admin-footnote">A larger catalogue is not evidence of a healthier or more complete feed.</p>
  </section>;
}
