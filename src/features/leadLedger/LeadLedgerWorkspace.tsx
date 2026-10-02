import React, { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useClient } from '../../lib/ClientContext';
import { defaultDateRange, useFilters } from '../../lib/FilterContext';
import { OffernetFilterBar } from '../../components/OffernetFilterBar';
import { type LedgerCell, type LedgerCoverage, type LedgerLead, type LedgerReplicaReport } from '../../../contracts/leadLedgerReplica';
import { ReportActions } from '../../shared/reporting/ReportPresentation';
import { receiveLedgerCsv } from './download';
import LeadEvidence from './LeadSourceEvidence';
import EvidenceExportPreflight, { returnedEvidenceFields } from './EvidenceExportPreflight';
import InvestigationContextBar from '../investigation/InvestigationContextBar';
import { INVESTIGATION_KEYS, investigationPath } from '../investigation/investigationModel';
import './ledger.css';

type SourceFocus = { tenant: string; leadId: string; fields: string[] };

const AnalyticalLedger = lazy(() => import('../../pages/LeadLedger'));
const number = (value: number) => value.toLocaleString('en-ZA');
const text = (value: LedgerCell | undefined) => value == null || value === '' ? 'Not recorded' : String(value);
async function json<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, credentials: 'same-origin' });
  const body = await response.json();
  if (!response.ok || body?.success !== true) throw new Error(body?.error || `Request failed (${response.status}).`);
  return body.data as T;
}
function LeadDetails({ lead, focusFields }: { lead: LedgerLead; focusFields?: string[] }) {
  const [expanded, setExpanded] = useState(Boolean(focusFields));
  const first = lead.records[0]?.raw || {};
  return <details className="cx-ledger-lead" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>
      <span><strong>{lead.leadId || 'Unresolved lead'}</strong><small>{text(first['Offershop Source'])}</small></span>
      <span><small>Fetched</small>{text(first.Fetched)}</span>
      <span><small>Grade / vetting</small>{text(first['Offershop Grade'])} / {text(first['Offershop Color Vetting'])}</span>
      <span><small>Visible source records</small>{number(lead.records.length)}</span>
      <span className={lead.issues.length ? 'cx-ledger-warning' : ''}>{lead.issues.length ? `${lead.issues.length} exception types` : 'Inspect records'}</span>
    </summary>
    {expanded && <div className="cx-ledger-detail"><LeadEvidence lead={lead} focusFields={focusFields} /></div>}
  </details>;
}
function SourceLeadBrowser({ leads, busy, sourceFocus }: { leads: LedgerLead[]; busy: boolean; sourceFocus?: SourceFocus }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(() => leads.find(lead => lead.leadId === sourceFocus?.leadId)?.key || null);
  const inspectorId = useId();
  const selectionButton = useRef<HTMLButtonElement | null>(null);
  const selectedLead = leads.find(lead => lead.key === selectedKey) || null;
  if (!leads.length) return <p className="cx-ledger-panel">No source records match this scope.</p>;
  return <div className="cx-ledger-browser" aria-busy={busy}>
    <div className="cx-ledger-master-detail">
      <section className="cx-ledger-table-panel" aria-label="Source leads on this page">
        <p className="cx-ledger-table-note">Lead fields below use each lead’s first returned source record. Select a lead to inspect all of its returned records.</p>
        <table className="cx-ledger-source-table"><thead><tr><th scope="col">Lead / source</th><th scope="col">Grade / vetting</th><th scope="col">Vendors</th><th scope="col">Warnings</th></tr></thead><tbody>{leads.map(lead => {
          const first = lead.records[0]?.raw || {};
          return <tr key={lead.key} data-selected={selectedLead?.key === lead.key}>
            <td><button type="button" className="cx-ledger-select-lead" aria-label={`Inspect source lead ${lead.leadId || 'Unresolved lead'}`} aria-pressed={selectedLead?.key === lead.key} aria-controls={inspectorId} onClick={event => { selectionButton.current = event.currentTarget; setSelectedKey(lead.key); requestAnimationFrame(() => document.getElementById(inspectorId)?.focus({ preventScroll: true })); }}>{lead.leadId || 'Unresolved lead'}</button><span>{text(first['Offershop Source'])}</span><small>Fetched {text(first.Fetched)}</small></td>
            <td>{text(first['Offershop Grade'])}<small>{text(first['Offershop Color Vetting'])}</small></td>
            <td>{text(first.Vendors)}</td>
            <td>{lead.issues.length > 0 ? <span className="cx-ledger-warning">{number(lead.issues.length)} exception types</span> : <span>None supplied</span>}</td>
          </tr>;
        })}</tbody></table>
      </section>
      <aside className="cx-ledger-inspector" id={inspectorId} aria-label="Selected source lead" tabIndex={0}>
        {selectedLead ? <><header className="cx-ledger-inspector-heading"><div><p className="cx-ledger-eyebrow">SELECTED LEAD</p><h2>{selectedLead.leadId || 'Unresolved lead'}</h2><p>{number(selectedLead.records.length)} returned source records</p></div><button type="button" aria-label="Clear selected lead" onClick={() => { setSelectedKey(null); selectionButton.current?.focus(); }}>Clear</button></header><LeadEvidence key={selectedLead.key} lead={selectedLead} focusFields={selectedLead.leadId === sourceFocus?.leadId ? sourceFocus.fields : undefined} /></> : <div className="cx-ledger-inspector-empty"><p className="cx-ledger-eyebrow">LEAD INSPECTOR</p><h2>Select a lead from this page</h2><p>Open its summary, milestones, vendor records, commercial evidence and raw source fields here.</p></div>}
      </aside>
    </div>
    <div className="cx-ledger-list cx-ledger-mobile-list"><p>Lead fields below use each lead’s first returned source record. Expand a lead to inspect all of its returned records.</p>{leads.map(lead => <LeadDetails key={lead.key} lead={lead} focusFields={lead.leadId === sourceFocus?.leadId ? sourceFocus.fields : undefined} />)}</div>
  </div>;
}
function SourceLedger({ sourceMode, setSourceMode, sourceFocus }: { sourceMode: string; setSourceMode: (value: string) => void; sourceFocus?: SourceFocus }) {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters, filterError, setDateRange } = useFilters();
  const [searchParams, setSearchParams] = useSearchParams();
  // The endpoint already supports this search. Read URL state before the first
  // query so navigation never issues an intermediate unfiltered request.
  const search = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => { setSearchInput(search); }, [search]);
  const setSearch = (value: string) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (value) next.set('search', value); else next.delete('search');
    return next;
  }, { replace: true });
  const [page, setPage] = useState(0), [pageSize, setPageSize] = useState(25);
  const [exportReview, setExportReview] = useState<{ mode: 'compatible' | 'available'; scopeKey: string; result: LedgerReplicaReport } | null>(null);
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
  useEffect(() => { setExportReview(null); }, [scopeKey, page, data, query.isFetching]);
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

    <section className="cx-ledger-workspace">
      <header className="cx-ledger-heading"><div><h1>Lead Ledger</h1><p>Explore the fetched cohort from portfolio summary to individual lead and vendor evidence.</p></div><ReportActions analysisContext={{ purpose: 'Inspect original source-compatible records for the fetched cohort.', grain: 'Original lead/vendor source records. Every returned record is retained; repeated lead totals are not additive', basis: `Fetched date selects the cohort; later vendor outcomes remain attached. ${data?.metadata.timestampInterpretation || 'Timestamp interpretation is shown with returned source provenance'}`, nullMeaning: 'Null and empty source fields are shown as Not recorded. Explicit zero and false remain source values. Missing outcome evidence is not a confirmed negative.', originalSource: true }} statusEvidence={<><p>{fields ? `${fields.available.length} / 63 fields available` : 'Source coverage has not been returned.'}</p><p className="cx-ledger-source">{fields?.source || 'Only the selected tenant’s approved source is queried.'}</p>{fields?.missing.length ? <p>Unavailable fields: {fields.missing.join(', ')}. Exports are explicitly partial.</p> : null}<p>Coverage does not establish historical parity or freshness.</p>{data && <><p>{data.metadata.timestampInterpretation}</p><p>Fetched window: {data.metadata.startDate} to {data.metadata.endDate}.</p>{data.metadata.generatedAt && <p>Generated at: {data.metadata.generatedAt}. This describes the response, not source freshness.</p>}{data.metadata.queryJobId && <p>Query job ID: {data.metadata.queryJobId}</p>}</>}</>} /></header>
    <OffernetFilterBar onRefresh={() => { void query.refetch(); void coverage.refetch(); }} />
      {data && <section className="cx-ledger-snapshot" aria-label="Source snapshot">
        <div className="cx-ledger-snapshot-summary">
          <span>{data.metadata.startDate === data.metadata.endDate ? data.metadata.startDate : `${data.metadata.startDate} → ${data.metadata.endDate}`}</span>
          {data.metadata.dateBasis && <span>{data.metadata.dateBasis === 'fetched_cohort' ? 'Fetched cohort' : data.metadata.dateBasis}</span>}
          <span>{data.metadata.validationStatus === 'NOT_VERIFIED' ? 'Not verified' : data.metadata.validationStatus || 'Validation not supplied'}</span>
        </div>
        <details><summary>Details</summary>
          <dl>{data.metadata.validationStatus && <div><dt>Validation</dt><dd>{data.metadata.validationStatus}</dd></div>}{data.metadata.generatedAt && <div><dt>Generated at</dt><dd>{data.metadata.generatedAt}</dd></div>}{data.metadata.coverage?.source && <div><dt>Returned source</dt><dd>{data.metadata.coverage.source}</dd></div>}{data.metadata.version && <div><dt>Report version</dt><dd>{data.metadata.version}</dd></div>}{data.metadata.queryJobId && <div><dt>Query job ID</dt><dd>{data.metadata.queryJobId}</dd></div>}</dl>
          <p>Generated at describes this response, not source freshness. This operational source snapshot is separate from immutable published reporting releases.</p>
        </details>
      </section>}
      <div className="cx-ledger-source-selection">{fields?.missing.length ? <div role="note"><strong>{fields.missing.length} unavailable fields — exports are explicitly partial</strong><details><summary>Unavailable source fields</summary><p>{fields.missing.join(', ')}</p></details></div> : null}</div>
      {!enabled && <div className="cx-ledger-panel"><h2>Select a fetched-date window</h2><p>This report requires both dates, with a maximum of 366 days. Later vendor outcomes remain attached to that fetched cohort.</p><button type="button" onClick={() => { const dates = defaultDateRange(); setDateRange(dates.start, dates.end); }}>Use last 30 days</button></div>}
      {error && <p role="alert" className="cx-ledger-error">{error}</p>}
      {query.isFetching && enabled && <p role="status">Loading source records…</p>}
      {data && <>
        <div className="cx-ledger-stats">{[['Unique leads', data.summary.leads, 'leads'], ['Source rows', data.summary.rows, 'rows'], ['Lead-only rows', data.summary.leadOnlyRows, 'lead-only'], ['Rows with repeated keys', data.summary.duplicateKeyRows, 'exceptions']].map(([label, value, metric]) => <div key={String(label)} data-metric={metric}><small>{label}</small><strong>{number(Number(value))}</strong><span>{metric === 'leads' ? 'Distinct lead population' : metric === 'rows' ? 'Visible source evidence' : metric === 'lead-only' ? 'No vendor record attached' : 'Requires careful interpretation'}</span></div>)}</div>

      </>}
      <div className="cx-ledger-section-heading"><div><h2>Records in scope</h2>{search && <p>Source search: “{search}”. Matches lead ID, consumer ID or source text within this reporting scope; it is not an exact-match or reconciliation claim.</p>}</div></div><div className="cx-ledger-toolbar"><form onSubmit={event => { event.preventDefault(); setSearch(searchInput.trim()); setPage(0); }}><label className="sr-only" htmlFor="ledger-search">Search lead ID, consumer ID or source</label><input id="ledger-search" value={searchInput} maxLength={200} onChange={event => setSearchInput(event.target.value)} placeholder="Lead ID, consumer ID or source" /><button type="submit">Search</button>{search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }}>Clear</button>}</form><div className="cx-ledger-actions"><label>Source dataset<select value={sourceMode} onChange={event => setSourceMode(event.target.value)}><option value="configured">Configured tenant source</option><option value="rich" disabled={!fields?.richViewEnabled}>Approved richer master view</option></select></label><button type="button" disabled={!data || query.isFetching || downloading || !fields?.compatible} onClick={() => { if (data) setExportReview({ mode: 'compatible', scopeKey, result: data }); }}>Export complete 63-column CSV</button>{fields && !fields.compatible && <button type="button" disabled={!data || query.isFetching || downloading} onClick={() => { if (data) setExportReview({ mode: 'available', scopeKey, result: data }); }}>Export all rows · partial fields</button>}{downloading && <button type="button" onClick={() => controller.current?.abort()}>Cancel export</button>}</div></div>
      <EvidenceExportPreflight open={Boolean(exportReview && exportReview.scopeKey === scopeKey && exportReview.result === data && !query.isFetching && !downloading)} onClose={() => setExportReview(null)} onConfirm={() => { if (exportReview) void download(exportReview.mode); }} fields={data ? returnedEvidenceFields({ metadata: data.metadata }) : []}>
        <strong>{exportReview?.mode === 'available' ? 'All matching source rows · partial fields' : 'All matching source rows · source-compatible 63-column CSV'}</strong>
        <p>Complete source export uses a separate single query snapshot and may differ from the currently displayed interactive page. Current page limits do not limit this export.</p>
        {fields?.missing.length ? <p>Unavailable source fields: {fields.missing.join(', ')}. This export is explicitly partial.</p> : null}
      </EvidenceExportPreflight>
      {downloadState && <p role="status">{downloadState}</p>}{downloadError && <p role="alert" className="cx-ledger-error">{downloadError}</p>}
      {data && <>
        {sourceFocus && search === sourceFocus.leadId && <p className="cx-ledger-source-handoff" role="status">Source evidence for {sourceFocus.leadId}. {data.leads.some(lead => lead.leadId === sourceFocus.leadId) ? 'The matching lead is selected; relevant original fields are highlighted below.' : 'An exact lead match was not returned on this page; source search results are not a reconciliation claim.'}</p>}
        <SourceLeadBrowser key={JSON.stringify([scopeKey, page])} leads={data.leads} busy={query.isFetching} sourceFocus={search === sourceFocus?.leadId ? sourceFocus : undefined} />
        <div className="cx-ledger-pagination"><label>Leads per page<select value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{[25, 50, 100].map(value => <option key={value}>{value}</option>)}</select></label><span>Page {page + 1} · {number(data.summary.leads)} leads in scope</span><button type="button" disabled={page === 0 || query.isFetching} onClick={() => setPage(value => value - 1)}>Previous</button><button type="button" disabled={!data.metadata.hasMore || query.isFetching} onClick={() => setPage(value => value + 1)}>Next</button></div>
        <details className="cx-ledger-portfolio"><summary>Portfolio evidence · Vendor coverage & reported revenue</summary>        <div className="cx-ledger-panels"><section className="cx-ledger-panel cx-ledger-vendor-panel"><div className="cx-ledger-panel-heading"><div><p className="cx-ledger-eyebrow">DISTRIBUTION</p><h2>Vendor coverage</h2></div><span>Distinct leads</span></div><p>Distinct leads per vendor; a lead can belong to several vendors.</p>{data.vendors.map(vendor => <div className="cx-ledger-vendor" key={vendor.vendor}><span>{vendor.vendor}</span><meter min="0" max={Math.max(data.summary.leads, 1)} value={vendor.leads} aria-label={`${vendor.vendor}: ${vendor.leads} distinct leads`} /><strong>{number(vendor.leads)}</strong></div>)}</section><section className="cx-ledger-panel cx-ledger-revenue-panel"><div className="cx-ledger-panel-heading"><div><p className="cx-ledger-eyebrow">COMMERCIAL EVIDENCE</p><h2>Reported HLC revenue</h2></div><span>Recorded only</span></div><p>Selected vendor records only. Not repeated lead totals, collected cash or independently reconciled revenue.</p>{data.summary.revenue.map(row => <p className="cx-ledger-money" key={row.currency}><strong>{row.currency} {row.amount ?? 'Not recorded'}</strong><small>{row.missingAmounts ? `${number(row.missingAmounts)} missing amounts; sum is incomplete.` : 'Raw records retained, including repeated transaction keys.'}</small></p>)}<p>Sale, activation and contact evidence remain separate; no upstream event is manufactured from a downstream outcome.</p></section></div></details>
        <details className="cx-ledger-panel"><summary>Source provenance and interpretation</summary><p>{data.metadata.pagination}</p><p>{data.metadata.timestampInterpretation}</p><dl className="cx-ledger-provenance">{returnedEvidenceFields({ metadata: data.metadata }).map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}{data.metadata.version && <div><dt>Report version</dt><dd>{data.metadata.version}</dd></div>}{data.metadata.queryJobId && <div><dt>Query job ID</dt><dd>{data.metadata.queryJobId}</dd></div>}<div><dt>Returned page</dt><dd>Offset {data.metadata.offset} · page size {data.metadata.pageSize}</dd></div></dl><p>Generated at describes this response, not source freshness. Exports use a separate, single query snapshot and may differ from an earlier interactive page. Placeholder dates are retained in raw fields but excluded from milestones. Formula-like CSV strings are escaped for spreadsheet safety. Process fields that are not timestamp-shaped are redacted.</p></details>
      </>}
    </section>
  </>;
}
export default function LeadLedgerWorkspace() {
  const { selectedClient } = useClient();
  const [mode, setMode] = useState<'source' | 'analytical'>('source');
  const [investigationParams, setSearchParams] = useSearchParams();
  const activeInvestigation = INVESTIGATION_KEYS.some(key => investigationParams.has(key));
  const [sourceFocus, setSourceFocus] = useState<SourceFocus | undefined>();
  const viewSource = (leadId: string, fields: string[]) => {
    setSourceFocus({ tenant: selectedClient, leadId, fields });
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('search', leadId); next.delete('drill'); next.delete('drillValue');
      return next;
    });
    setMode('source');
  };
  const [source, setSource] = useState({ tenant: selectedClient, mode: 'configured' });
  const sourceMode = source.tenant === selectedClient ? source.mode : 'configured';
  return <div>{activeInvestigation && <><InvestigationContextBar dateBasis="Fetched source cohort" countingGrain="Separate lead/vendor source records" /><p className="cx-ledger-panel">This is the deeper source evidence layer. Reporting dates and global filters apply here; analytical investigation predicates and segments are shown as context and do not filter this raw-source table. Use the selected lead dossier to inspect source records for a qualified lead. <Link to={investigationPath('/lead-explorer', investigationParams)}>Return to affected records</Link></p></>}<nav className="cx-ledger-tabs" aria-label="Lead ledger views"><button type="button" aria-pressed={mode === 'source'} onClick={() => setMode('source')}><strong>Source evidence</strong><small>Original source-compatible records</small></button><button type="button" aria-pressed={mode === 'analytical'} onClick={() => setMode('analytical')}><strong>Operational analysis</strong><small>Normalised analytical view & timeline</small></button></nav>{mode === 'source' ? <SourceLedger key={selectedClient} sourceFocus={sourceFocus?.tenant === selectedClient ? sourceFocus : undefined} sourceMode={sourceMode} setSourceMode={value => setSource({ tenant: selectedClient, mode: value })} /> : <div className="cx-ledger-analytical"><Suspense fallback={<p role="status">Opening analytical ledger…</p>}><AnalyticalLedger onViewSource={viewSource} /></Suspense></div>}</div>;
}
