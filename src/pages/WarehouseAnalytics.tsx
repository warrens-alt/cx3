import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Database, RefreshCw, Search, BookOpen } from 'lucide-react';
import { useClient } from '../lib/ClientContext';
import { useOperationalData } from '../lib/useOperationalData';
import { fetchWarehouseOverview, fetchWarehouseTables, type DictionaryObject } from '../lib/warehouseClient';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import { downloadCsv } from '../lib/formatters';
import WarehouseDataPuller from '../components/warehouse/WarehouseDataPuller';
import '../styles/warehouseTruth.css';

const tabs = ['overview', 'pull', 'waterfall', 'touchpoints', 'telemetry', 'tables'] as const;
type Tab = typeof tabs[number];
const labels: Record<Tab, string> = { overview: 'Source catalogue', pull: 'Read current records', waterfall: 'Journey sources', touchpoints: 'Media sources', telemetry: 'Event sources', tables: 'Tables & schema' };
const loadCatalogue = (scope: Record<string, unknown>, force = false, signal?: AbortSignal) => fetchWarehouseOverview(String(scope.clientId), force, signal);
const loadTables = (scope: Record<string, unknown>, force = false, signal?: AbortSignal) => fetchWarehouseTables({ clientId: String(scope.clientId) }, force, signal);

export default function WarehouseAnalytics() {
  const { selectedClient } = useClient();
  const [params, setParams] = useSearchParams();
  const scoped = useScopedNavigationTarget();
  const [search, setSearch] = React.useState('');
  const candidate = params.get('tab') as Tab;
  const tab: Tab = tabs.includes(candidate) ? candidate : 'overview';
  const catalogue = useOperationalData('warehouse-catalogue', { clientId: selectedClient }, loadCatalogue, tab !== 'pull');
  const tablesQuery = useOperationalData('warehouse-catalogue-tables', { clientId: selectedClient }, loadTables, tab === 'tables');
  const data = !catalogue.loading ? catalogue.data : null;
  const setTab = (next: Tab) => setParams(old => { const out = new URLSearchParams(old); out.set('tab', next); return out; }, { replace: true });
  const filtered = (tablesQuery.data || []).filter(t => `${t.project}.${t.dataset}.${t.tableName} ${t.family}`.toLowerCase().includes(search.toLowerCase()));
  const sourceLinks = [
    { path: '/overview', title: 'Ledger performance', note: 'Fetched-cohort operational evidence; not today’s complete event stream.' },
    { path: '/contact-strategy', title: 'Contact evidence', note: 'Recorded call summaries; missing feedback is not zero calls.' },
    { path: '/campaigns', title: 'Campaigns & media', note: 'Approved marketing source; budget is not incurred spend.' },
    { path: '/commercial', title: 'Commercial evidence', note: 'Recorded value and approved attribution, not settled cash.' },
  ];
  const inspect = (table: { project: string; dataset: string; tableName: string }) => setParams(old => {
    const out = new URLSearchParams(old); out.set('tab', 'pull'); out.set('project', table.project); out.set('dataset', table.dataset); out.set('table', table.tableName); return out;
  });
  return <div className="cx-command-page"><div className="cx-command-content cx-warehouse-truth">
    <header className="cx-command-hero"><div><span className="cx-command-eyebrow">Investigate</span><h1>Warehouse sources & current records</h1><p>Separate the registered schema from measured business data. Failed reads never become demonstration figures.</p></div><Database aria-hidden="true" size={28} /></header>
    <nav className="cx-warehouse-tabs" aria-label="Warehouse views">{tabs.map(item => <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)}>{labels[item]}</button>)}</nav>
    {tab === 'pull' ? <WarehouseDataPuller key={`${selectedClient}:${params.get('project')}:${params.get('dataset')}:${params.get('table')}`} initialProject={params.get('project') || undefined} initialDataset={params.get('dataset') || undefined} initialTable={params.get('table') || undefined} /> : <>
      <section className="cx-warehouse-notice" aria-label="Evidence boundary"><BookOpen size={20} aria-hidden="true"/><div><strong>Catalogue only — not live business performance</strong><p>{data?.evidence.reason || 'Table names and schema descriptions come from a saved catalogue. Connectivity, current row counts, spend and conversion cannot be inferred from that catalogue.'}</p><small>{data ? `Schema snapshot: ${data.evidence.snapshotDate}. Catalogue generated: ${data.generatedAt}. Neither is an ingestion timestamp.` : 'No current source read has been performed by this catalogue.'}</small></div></section>
      {(catalogue.loading || (tab === 'tables' && tablesQuery.loading)) && <p role="status">Loading registered source metadata…</p>}
      {(catalogue.error || tablesQuery.error) && <p role="alert" className="cx-command-error">{catalogue.error || tablesQuery.error}</p>}
      <button type="button" className="cx-button-secondary" disabled={catalogue.loading} onClick={() => { void catalogue.loadData(true); if (tab === 'tables') void tablesQuery.loadData(true); }}><RefreshCw size={14}/> Refresh catalogue</button>
      {tab === 'overview' && data && <>
        <div className="cx-warehouse-grid">{[['Registered projects', data.kpis.totalProjects], ['Registered datasets', data.kpis.totalDatasets], ['Registered objects', data.kpis.totalWarehouseObjects], ['Current business rows', 'Not measured']].map(([name, value]) => <article className="cx-warehouse-card" key={name}><span>{name}</span><strong>{value}</strong></article>)}</div>
        <div className="cx-warehouse-grid">{sourceLinks.map(link => <Link className="cx-warehouse-card" key={link.path} to={scoped(link.path)}><h2>{link.title}</h2><p>{link.note}</p><span>Open scoped analytics →</span></Link>)}</div>
        <section className="cx-command-panel"><h2>Registered datasets</h2><p>Counts below describe catalogue entries, not live source populations.</p><div className="cx-warehouse-table"><table><thead><tr><th>Dataset</th><th>Objects</th><th>Schema columns</th><th>Access</th></tr></thead><tbody>{data.datasets.map(d => <tr key={`${d.project}.${d.dataset}`}><th>{d.project}.{d.dataset}</th><td>{d.totalObjects}</td><td>{d.totalColumns}</td><td>Not checked</td></tr>)}</tbody></table></div></section>
      </>}
      {['waterfall', 'touchpoints', 'telemetry'].includes(tab) && data && <section className="cx-command-panel"><h2>{labels[tab]}</h2><p>Unverified volumes, retention rates, spend and sampled telemetry are withheld. Read a bounded source window or use the governed report; no cross-source total is fabricated.</p><div className="cx-warehouse-source-list">{data.tableInventoryPreview.filter(o => tab === 'waterfall' ? o.dataset === 'watfall_report' : tab === 'telemetry' ? o.isRawJson : o.isSpendCandidate).map(o => <article key={`${o.project}.${o.dataset}.${o.tableName}`}><div><strong>{o.tableName}</strong><small>{o.project}.{o.dataset} · {o.analyticalGrain}</small></div><button className="cx-button-secondary" onClick={() => inspect(o)}>Inspect source window</button></article>)}</div></section>}
      {tab === 'tables' && !tablesQuery.loading && <section className="cx-command-panel"><div className="cx-warehouse-tools"><label><Search size={16} aria-hidden="true"/> Search catalogue <input aria-label="Search catalogue" value={search} onChange={e => setSearch(e.target.value)} /></label><button className="cx-button-secondary" disabled={!filtered.length} onClick={() => downloadCsv('warehouse-catalogue-not-live.csv', [['Evidence', 'Project', 'Dataset', 'Table', 'Type', 'Registered columns'], ...filtered.map(t => ['CATALOGUE_ONLY', t.project, t.dataset, t.tableName, t.tableType, t.columns.length])])}>Export catalogue</button></div><p>{filtered.length} registered objects. Expand an entry to inspect its saved schema.</p>{filtered.map(t => <CatalogueEntry key={`${t.project}.${t.dataset}.${t.tableName}`} table={t} inspect={() => inspect(t)} />)}</section>}
    </>}
  </div></div>;
}
function CatalogueEntry({ table, inspect }: { table: DictionaryObject; inspect: () => void }) {
  return <details className="cx-warehouse-schema"><summary><strong>{table.tableName}</strong><span>{table.project}.{table.dataset} · {table.tableType}</span></summary><p>Grain: {table.analyticalGrain}. Candidate keys and date fields are structural metadata, not approved identity or time semantics.</p><button className="cx-button-secondary" onClick={inspect}>Read a current source window</button><div className="cx-warehouse-table"><table><thead><tr><th>Field</th><th>Declared type</th><th>Sensitivity</th></tr></thead><tbody>{table.columns.map(c => <tr key={c.name}><th>{c.name}</th><td>{c.type}</td><td>{table.sensitiveFields.includes(c.name) ? 'Excluded from generic preview' : 'Review live schema'}</td></tr>)}</tbody></table></div></details>;
}
