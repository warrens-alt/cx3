import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useClient } from '../../lib/ClientContext';
import { defaultDateRange, useFilters } from '../../lib/FilterContext';
import { OffernetFilterBar } from '../../components/OffernetFilterBar';
import { LEDGER_COLUMNS, type LedgerCell, type LedgerCoverage, type LedgerLead, type LedgerReplicaReport } from '../../../contracts/leadLedgerReplica';
import { receiveLedgerCsv } from './download';
import './ledger.css';

const AnalyticalLedger = lazy(() => import('../../pages/LeadLedger'));
const number = (value: number) => value.toLocaleString('en-ZA');
const text = (value: LedgerCell | undefined) => value == null || value === '' ? 'Not recorded' : String(value);
const issueText = (value: string) => value.replace(/_/g, ' ').toLowerCase();
async function json<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, credentials: 'same-origin' });
  const body = await response.json();
  if (!response.ok || body?.success !== true) throw new Error(body?.error || `Request failed (${response.status}).`);
  return body.data as T;
}
function LeadDetails({ lead }: { lead: LedgerLead }) {
  const [expanded, setExpanded] = useState(false);
  const first = lead.records[0]?.raw || {};
  return <details className="cx-ledger-lead" onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>
      <span><strong>{lead.leadId || 'Unresolved lead'}</strong><small>{text(first['Offershop Source'])}</small></span>
      <span><small>Fetched</small>{text(first.Fetched)}</span>
      <span><small>Grade / vetting</small>{text(first['Offershop Grade'])} / {text(first['Offershop Color Vetting'])}</span>
      <span><small>Visible source records</small>{number(lead.records.length)}</span>
      <span className={lead.issues.length ? 'cx-ledger-warning' : ''}>{lead.issues.length ? `${lead.issues.length} exception types` : 'Inspect records'}</span>
    </summary>
    {expanded && <div className="cx-ledger-detail">
      {lead.issues.length > 0 && <p className="cx-ledger-warning">{lead.issues.map(issueText).join(' · ')}</p>}
      <p>Each vendor record below is retained as reported. Repeated lead totals are not additive. Missing outcome evidence is not a confirmed negative.</p>
      {lead.records.map((record, index) => <article className="cx-ledger-record" key={index}>
        <h3>{text(record.raw['HLC Vendor'])} <small>Transaction {text(record.raw['HLC Transaction ID'])}</small></h3>
        <dl className="cx-ledger-evidence">
          {['HLC Status', 'HLC Last Dialer Status', 'HLC Total Calls', 'HLC RPC', 'HLC Revenue Generated', 'HLC CURRENCY'].map(label => <div key={label}><dt>{label}</dt><dd>{text(record.raw[label])}</dd></div>)}
        </dl>
        <details><summary>Recorded milestones and date exceptions</summary>
          <ol className="cx-ledger-events">{record.events.filter(event => event.state !== 'missing').sort((a, b) => (a.timestamp || a.raw).localeCompare(b.timestamp || b.raw)).map(event => <li key={event.label}><strong>{event.label}</strong><span>{event.raw}</span><small>{event.state === 'observed' ? 'Recorded timestamp' : `${event.state} — excluded from observed events`}</small></li>)}</ol>
          {!record.events.some(event => event.state !== 'missing') && <p>No non-placeholder milestones recorded.</p>}
          <p>These are snapshot milestones, not a complete call or status-change history. Naive timestamps are interpreted as UTC.</p>
        </details>
        <details><summary>Inspect all 63 source fields</summary><dl className="cx-ledger-fields">{LEDGER_COLUMNS.map(column => <div key={column.label}><dt>{column.label}</dt><dd>{text(record.raw[column.label])}</dd></div>)}</dl></details>
      </article>)}
    </div>}
  </details>;
}
function SourceLedger({ sourceMode, setSourceMode }: { sourceMode: string; setSourceMode: (value: string) => void }) {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters, filterError, setDateRange } = useFilters();
  const [searchInput, setSearchInput] = useState(''), [search, setSearch] = useState('');
  const [page, setPage] = useState(0), [pageSize, setPageSize] = useState(25);
  const [downloadState, setDownloadState] = useState(''), [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const scopeKey = JSON.stringify([selectedClient, startDate, endDate, filters, sourceMode, search, pageSize]);
  const [previousScope, setPreviousScope] = useState(scopeKey);
  // Reset before paint/query evaluation, not after requesting a stale tenant/page combination.
  if (scopeKey !== previousScope) { setPreviousScope(scopeKey); setPage(0); }
  useEffect(() => () => { controller.current?.abort(); }, [scopeKey]);
  const params = new URLSearchParams({ clientId: selectedClient, startDate, endDate, filters: JSON.stringify(filters), sourceMode, search, limit: String(pageSize), offset: String(page * pageSize) });
  const coverage = useQuery({ queryKey: ['ledger-replica-coverage', selectedClient, sourceMode], queryFn: ({ signal }) => json<LedgerCoverage>(`/api/analytics/lead-ledger/replica/coverage?clientId=${encodeURIComponent(selectedClient)}&sourceMode=${encodeURIComponent(sourceMode)}`, signal), retry: false, staleTime: 60000 });
  const enabled = Boolean(startDate && endDate && !filterError);
  const query = useQuery({ queryKey: ['ledger-replica', scopeKey, page], queryFn: ({ signal }) => json<LedgerReplicaReport>(`/api/analytics/lead-ledger/replica?${params}`, signal), enabled, retry: false, staleTime: 30000 });
  const data = enabled && !query.isError ? query.data : undefined;
  const fields = data?.metadata.coverage || coverage.data;
  const error = filterError || (query.error instanceof Error ? query.error.message : '') || (coverage.error instanceof Error ? coverage.error.message : '');
  const download = async (mode: 'compatible' | 'available') => {
    if (!data || downloading || query.isFetching) return;
    const abort = new AbortController(); controller.current = abort;
    setDownloading(true); setDownloadError(''); setDownloadState('Preparing one complete query snapshot…');
    try {
      const exportParams = new URLSearchParams(params); exportParams.delete('limit'); exportParams.delete('offset'); exportParams.set('mode', mode);
      const response = await fetch(`/api/analytics/lead-ledger/replica/export?${exportParams}`, { signal: abort.signal, credentials: 'same-origin' });
      const result = await receiveLedgerCsv(response, abort.signal, bytes => setDownloadState(`Receiving ${(bytes / 1048576).toFixed(1)} MiB…`));
      if (abort.signal.aborted) return;
      const url = URL.createObjectURL(result.blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = result.filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setDownloadState(`Complete: ${number(result.rows)} source rows. Query job: ${result.jobId || 'not supplied'}.`);
    } catch (cause) {
      if (abort.signal.aborted) setDownloadState('Export cancelled. No file was saved.');
      else { setDownloadState(''); setDownloadError(cause instanceof Error ? cause.message : 'Export failed.'); }
    } finally { if (controller.current === abort) controller.current = null; setDownloading(false); }
  };
  return <>
    <OffernetFilterBar onRefresh={() => { void query.refetch(); void coverage.refetch(); }} />
    <section className="cx-ledger-workspace">
      <header className="cx-ledger-heading"><div><p className="cx-ledger-kicker">LEAD OPERATIONS / SOURCE EVIDENCE</p><h1>Lead Ledger</h1><p>Explore the fetched cohort from portfolio summary to individual lead and vendor evidence.</p></div><span className="cx-ledger-tag">Source evidence · unverified</span></header>
      <div className="cx-ledger-panel cx-ledger-coverage"><div><strong>{fields ? `${fields.available.length} / 63 fields available` : 'Checking source coverage…'}</strong><p className="cx-ledger-source">{fields?.source || 'Only the selected tenant’s approved source is queried.'}</p>{fields?.missing.length ? <details><summary>{fields.missing.length} unavailable fields — exports are explicitly partial</summary><p>{fields.missing.join(', ')}</p></details> : <p>Coverage does not establish historical parity or freshness.</p>}</div><label>Source<select value={sourceMode} onChange={event => setSourceMode(event.target.value)}><option value="configured">Configured tenant source</option><option value="rich" disabled={!fields?.richViewEnabled}>Approved richer master view</option></select></label></div>
      {!enabled && <div className="cx-ledger-panel"><h2>Select a fetched-date window</h2><p>This report requires both dates, with a maximum of 366 days. Later vendor outcomes remain attached to that fetched cohort.</p><button type="button" onClick={() => { const dates = defaultDateRange(); setDateRange(dates.start, dates.end); }}>Use last 30 days</button></div>}
      {error && <p role="alert" className="cx-ledger-error">{error}</p>}
      {query.isFetching && enabled && <p role="status">Loading source records…</p>}
      {data && <>
        <div className="cx-ledger-stats">{[['Unique leads', data.summary.leads, 'leads'], ['Source rows', data.summary.rows, 'rows'], ['Lead-only rows', data.summary.leadOnlyRows, 'lead-only'], ['Rows with repeated keys', data.summary.duplicateKeyRows, 'exceptions']].map(([label, value, metric]) => <div key={String(label)} data-metric={metric}><small>{label}</small><strong>{number(Number(value))}</strong><span>{metric === 'leads' ? 'Distinct lead population' : metric === 'rows' ? 'Visible source evidence' : metric === 'lead-only' ? 'No vendor record attached' : 'Requires careful interpretation'}</span></div>)}</div>
        <div className="cx-ledger-panels"><section className="cx-ledger-panel cx-ledger-vendor-panel"><div className="cx-ledger-panel-heading"><div><p className="cx-ledger-eyebrow">DISTRIBUTION</p><h2>Vendor coverage</h2></div><span>Distinct leads</span></div><p>Distinct leads per vendor; a lead can belong to several vendors.</p>{data.vendors.map(vendor => <div className="cx-ledger-vendor" key={vendor.vendor}><span>{vendor.vendor}</span><meter min="0" max={Math.max(data.summary.leads, 1)} value={vendor.leads} aria-label={`${vendor.vendor}: ${vendor.leads} distinct leads`} /><strong>{number(vendor.leads)}</strong></div>)}</section><section className="cx-ledger-panel cx-ledger-revenue-panel"><div className="cx-ledger-panel-heading"><div><p className="cx-ledger-eyebrow">COMMERCIAL EVIDENCE</p><h2>Reported HLC revenue</h2></div><span>Recorded only</span></div><p>Selected vendor records only. Not repeated lead totals, collected cash or independently reconciled revenue.</p>{data.summary.revenue.map(row => <p className="cx-ledger-money" key={row.currency}><strong>{row.currency} {row.amount ?? 'Not recorded'}</strong><small>{row.missingAmounts ? `${number(row.missingAmounts)} missing amounts; sum is incomplete.` : 'Raw records retained, including repeated transaction keys.'}</small></p>)}<p>Sale, activation and contact evidence remain separate; no upstream event is manufactured from a downstream outcome.</p></section></div>
      </>}
      <div className="cx-ledger-section-heading"><div><p className="cx-ledger-eyebrow">LEAD EVIDENCE</p><h2>Records in scope</h2><p>Search, inspect and export the same bounded cohort without changing its source semantics.</p></div></div><div className="cx-ledger-toolbar"><form onSubmit={event => { event.preventDefault(); setSearch(searchInput.trim()); setPage(0); }}><label className="sr-only" htmlFor="ledger-search">Search lead ID, consumer ID or source</label><input id="ledger-search" value={searchInput} maxLength={200} onChange={event => setSearchInput(event.target.value)} placeholder="Lead ID, consumer ID or source" /><button type="submit">Search</button>{search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }}>Clear</button>}</form><div className="cx-ledger-actions"><button type="button" disabled={!data || query.isFetching || downloading || !fields?.compatible} onClick={() => void download('compatible')}>Export complete 63-column CSV</button>{fields && !fields.compatible && <button type="button" disabled={!data || query.isFetching || downloading} onClick={() => void download('available')}>Export all rows · partial fields</button>}{downloading && <button type="button" onClick={() => controller.current?.abort()}>Cancel export</button>}</div></div>
      {downloadState && <p role="status">{downloadState}</p>}{downloadError && <p role="alert" className="cx-ledger-error">{downloadError}</p>}
      {data && <>
        <div className="cx-ledger-list" aria-busy={query.isFetching}>{data.leads.map(lead => <LeadDetails key={lead.key} lead={lead} />)}{!data.leads.length && <p className="cx-ledger-panel">No source records match this scope.</p>}</div>
        <div className="cx-ledger-pagination"><label>Leads per page<select value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{[25, 50, 100].map(value => <option key={value}>{value}</option>)}</select></label><span>Page {page + 1} · {number(data.summary.leads)} leads in scope</span><button type="button" disabled={page === 0 || query.isFetching} onClick={() => setPage(value => value - 1)}>Previous</button><button type="button" disabled={!data.metadata.hasMore || query.isFetching} onClick={() => setPage(value => value + 1)}>Next</button></div>
        <details className="cx-ledger-panel"><summary>Source provenance and interpretation</summary><p>{data.metadata.pagination}</p><p>{data.metadata.timestampInterpretation}</p><p>Fetched window: {data.metadata.startDate} to {data.metadata.endDate}. Generated: {data.metadata.generatedAt}. Job: {data.metadata.queryJobId || 'not supplied'}.</p><p>Exports use a separate, single query snapshot and may differ from an earlier interactive page. Placeholder dates are retained in raw fields but excluded from milestones. Formula-like CSV strings are escaped for spreadsheet safety. Process fields that are not timestamp-shaped are redacted.</p></details>
      </>}
    </section>
  </>;
}
export default function LeadLedgerWorkspace() {
  const { selectedClient } = useClient();
  const [mode, setMode] = useState<'source' | 'analytical'>('source');
  const [source, setSource] = useState({ tenant: selectedClient, mode: 'configured' });
  const sourceMode = source.tenant === selectedClient ? source.mode : 'configured';
  return <div><nav className="cx-ledger-tabs" aria-label="Lead ledger views"><button type="button" aria-pressed={mode === 'source'} onClick={() => setMode('source')}><strong>Source ledger</strong><small>Evidence & complete export</small></button><button type="button" aria-pressed={mode === 'analytical'} onClick={() => setMode('analytical')}><strong>Analytical ledger</strong><small>Operational table & timeline</small></button></nav>{mode === 'source' ? <SourceLedger key={selectedClient} sourceMode={sourceMode} setSourceMode={value => setSource({ tenant: selectedClient, mode: value })} /> : <div className="cx-ledger-analytical"><Suspense fallback={<p role="status">Opening analytical ledger…</p>}><AnalyticalLedger /></Suspense></div>}</div>;
}
