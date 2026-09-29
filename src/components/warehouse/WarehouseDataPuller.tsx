import React from 'react';
import { Database, RefreshCw, AlertCircle } from 'lucide-react';
import { useClient } from '../../lib/ClientContext';
import { useAuth } from '../../lib/AuthContext';
import { useFilters } from '../../lib/FilterContext';
import { getAnalyticalSessionKey } from '../../lib/analyticalSession';
import { fetchWarehouseProjectsAndTables, pullWarehouseTableData, type WarehouseProjectInfo, type PulledTableDataResult } from '../../lib/warehousePullClient';
import { downloadCsv } from '../../lib/formatters';

function initialDates() {
  const end = new Date().toISOString().slice(0, 10);
  return { start: new Date(Date.parse(`${end}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10), end };
}
export default function WarehouseDataPuller({ initialProject = 'dashboards-422710', initialDataset = 'lead_ledger', initialTable = 'clustered_lead_ledger' }: { initialProject?: string; initialDataset?: string; initialTable?: string }) {
  const { selectedClient, ready, reportAuthenticationFailure } = useClient();
  const { isAdmin } = useAuth();
  const applied = useFilters();
  const allowed = isAdmin && selectedClient === 'default_tenant' && ready;
  const [projects, setProjects] = React.useState<WarehouseProjectInfo[]>([]);
  const [selection, setSelection] = React.useState({ project: initialProject, dataset: initialDataset, table: initialTable });
  const [dates, setDates] = React.useState(() => ({ start: applied.startDate || initialDates().start, end: applied.endDate || initialDates().end }));
  const [dateField, setDateField] = React.useState('');
  const [limit, setLimit] = React.useState(50);
  const [offset, setOffset] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [stored, setStored] = React.useState<{ key: string; data: PulledTableDataResult } | null>(null);
  const active = React.useRef<AbortController | null>(null);
  const session = getAnalyticalSessionKey();
  const key = JSON.stringify([session, selectedClient, selection, dates, dateField, limit, offset]);
  const data = allowed && !loading && !error && stored?.key === key ? stored.data : null;
  const project = projects.find(p => p.projectId === selection.project);
  const dataset = project?.datasets.find(d => d.datasetId === selection.dataset);
  const table = dataset?.tables.find(t => t.tableName === selection.table);
  const field = dateField || (selection.table === 'lead_ledger_all_vicidial_insights_time_to_dial' ? 'first_dial_date' : table?.dateFields[0] || '');

  React.useEffect(() => {
    const controller = new AbortController(); setProjects([]); setStored(null); setError(null);
    if (allowed) void fetchWarehouseProjectsAndTables(selectedClient, controller.signal).then(value => { if (!controller.signal.aborted) setProjects(value); }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => { controller.abort(); active.current?.abort(); };
  }, [allowed, selectedClient, session]);
  React.useEffect(() => { active.current?.abort(); setLoading(false); setError(null); }, [key]);
  const pull = async () => {
    if (!allowed) return;
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setLoading(true); setStored(null); setError(null);
    try {
      const result = await pullWarehouseTableData({ clientId: selectedClient, ...selection, startDate: dates.start, endDate: dates.end, dateField: field, limit, offset }, controller.signal);
      if (!controller.signal.aborted && session === getAnalyticalSessionKey()) setStored({ key, data: result });
    } catch (err) {
      if (controller.signal.aborted) return;
      if ((err as { status?: number }).status === 401) reportAuthenticationFailure();
      setError(err instanceof Error ? err.message : 'Source read failed. No records were substituted.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  };
  const selectProject = (id: string) => { const first = projects.find(p => p.projectId === id)?.datasets[0]; setSelection({ project: id, dataset: first?.datasetId || '', table: first?.tables[0]?.tableName || '' }); setDateField(''); setOffset(0); };
  const selectDataset = (id: string) => { setSelection(s => ({ ...s, dataset: id, table: project?.datasets.find(d => d.datasetId === id)?.tables[0]?.tableName || '' })); setDateField(''); setOffset(0); };
  if (!allowed) return <section className="cx-command-panel"><h2>Read-only source inspection</h2><p>Generic source records require an administrator with explicit Offernet Master access. Vendor workspaces retain their existing scoped analytical views.</p></section>;
  return <section className="cx-command-panel cx-warehouse-reader" aria-label="Current source records">
    <header><div><h2>Read a bounded source window</h2><p>This is a read-only preview, not a complete export. Dates use the selected source field in UTC, independently of lead/vendor filters elsewhere.</p></div><Database size={23} aria-hidden="true"/></header>
    <div className="cx-reader-step" aria-hidden="true"><span>1 · Select source</span><span>2 · Define UTC window</span><span>3 · Read & inspect evidence</span></div>
    <div className="cx-warehouse-fields">
      <label>Project<select value={selection.project} onChange={e => selectProject(e.target.value)}>{projects.map(p => <option key={p.projectId} value={p.projectId}>{p.projectId}</option>)}</select></label>
      <label>Dataset<select value={selection.dataset} onChange={e => selectDataset(e.target.value)}>{project?.datasets.map(d => <option key={d.datasetId} value={d.datasetId}>{d.datasetId}</option>)}</select></label>
      <label>Registered table<select value={selection.table} onChange={e => { setSelection(s => ({ ...s, table: e.target.value })); setDateField(''); setOffset(0); }}>{dataset?.tables.map(t => <option key={t.tableName} value={t.tableName}>{t.tableName}</option>)}</select></label>
      <label>Date basis<select aria-label="Date basis" value={field} onChange={e => { setDateField(e.target.value); setOffset(0); }}>{table?.dateFields.map(f => <option key={f} value={f}>{f}</option>)}</select></label>
      <label>From (UTC)<input type="date" value={dates.start} onChange={e => { setDates(d => ({ ...d, start: e.target.value })); setOffset(0); }}/></label>
      <label>To (UTC)<input type="date" value={dates.end} onChange={e => { setDates(d => ({ ...d, end: e.target.value })); setOffset(0); }}/></label>
      <label>Rows per page<select value={limit} onChange={e => { setLimit(Number(e.target.value)); setOffset(0); }}>{[25, 50, 100, 250, 500].map(n => <option key={n}>{n}</option>)}</select></label>
    </div>
    <div className="cx-warehouse-tools"><button className="cx-button-primary" type="button" disabled={loading || !field || !dates.start || !dates.end} onClick={() => { void pull(); }}><RefreshCw size={15} aria-hidden="true"/> {loading ? 'Reading source…' : 'Read current records'}</button>{loading && <button className="cx-button-secondary" onClick={() => { active.current?.abort(); setLoading(false); }}>Cancel read</button>}<span>Page {Math.floor(offset / limit) + 1} · No automatic refresh</span></div>
    {loading && <p role="status">Querying the authorised source. Earlier results are hidden until this read completes.</p>}
    {error && <div role="alert" className="cx-command-error"><AlertCircle size={16}/>{error}</div>}
    {data && <>
      <dl className="cx-reader-result-summary" aria-label="Bounded read summary"><div><dt>Source rows in window</dt><dd>{data.totalRows.toLocaleString()}</dd></div><div><dt>Rows on this page</dt><dd>{data.rows.length.toLocaleString()}</dd></div><div><dt>Selected date field</dt><dd>{data.metadata.dateField}</dd></div><div><dt>Reconciliation</dt><dd>Not verified</dd></div></dl>
      <div className="cx-warehouse-notice"><div><strong>{data.rows.length ? 'Live BigQuery result — business reconciliation not verified' : 'No matching records in this UTC window'}</strong><p>{data.totalRows.toLocaleString()} source rows in the selected window. Query completed: {data.pulledAt}.</p><p>Latest {data.metadata.dateField} in window: {data.metadata.latestEventAtInWindow || 'No valid event timestamp'}. Upstream ingestion time: unknown.</p><small>Query job: {data.queryJobId || 'Not returned'} · {data.metadata.redactedFields.length} unapproved, sensitive or nested fields excluded.</small></div></div>
      <div className="cx-warehouse-tools"><button disabled={!data.rows.length} className="cx-button-secondary" onClick={() => downloadCsv('warehouse-current-page.csv', [['Evidence', 'Window start UTC', 'Window end UTC', 'Date basis', 'Query job', ...data.columns.map(c => c.name)], ...data.rows.map(r => ['LIVE_BIGQUERY_NOT_RECONCILED', data.metadata.startDate, data.metadata.endDate, data.metadata.dateField, data.queryJobId, ...data.columns.map(c => r[c.name] == null ? null : String(r[c.name]))])])}>Export this page with evidence</button><button className="cx-button-secondary" disabled={offset === 0} onClick={() => setOffset(n => Math.max(0, n - limit))}>Previous page</button><button className="cx-button-secondary" disabled={offset + data.rows.length >= data.totalRows} onClick={() => setOffset(n => n + limit)}>Next page</button></div>
      <p>{data.metadata.pagination} After changing page, select “Read current records”.</p>
      <div className="cx-warehouse-table" role="region" aria-label="Current source record page" tabIndex={0}><table><thead><tr>{data.columns.map(c => <th key={c.name}>{c.name}</th>)}</tr></thead><tbody>{data.rows.map((row, i) => <tr key={`${data.queryJobId}:${i}`}>{data.columns.map(c => <td key={c.name}>{row[c.name] == null ? 'Unavailable' : String(row[c.name])}</td>)}</tr>)}</tbody></table></div>
    </>}
    <p className="cx-warehouse-footnote">Legacy Cloud SQL sync is disabled and its mixed-provenance records are quarantined from reporting. No stored records have been deleted. This reader never writes warehouse data.</p>
  </section>;
}
