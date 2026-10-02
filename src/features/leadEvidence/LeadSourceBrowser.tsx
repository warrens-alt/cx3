import AnalyticsPageLayout from '../../components/AnalyticsPageLayout';
import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useClient } from '../../lib/ClientContext';
import { useAuth } from '../../lib/AuthContext';
import { defaultDateRange, useFilters } from '../../lib/FilterContext';
import { OffernetFilterBar } from '../../components/OffernetFilterBar';
import type { LedgerCell, LedgerCoverage, LedgerLead, LedgerReplicaReport } from '../../../contracts/leadLedgerReplica';
import { ReportActions } from '../../shared/reporting/ReportPresentation';
import { receiveLedgerCsv } from '../leadLedger/download';
import LedgerFieldCoverage from '../leadLedger/LedgerFieldCoverage';
import EvidenceExportPreflight, { returnedEvidenceFields } from '../leadLedger/EvidenceExportPreflight';
import type { LeadEvidenceSelection, SourceFocus } from './leadEvidenceSelection';
import './leadEvidence.css';
const number = (value: number) => value.toLocaleString('en-ZA');
const text = (value: LedgerCell | undefined) => value == null || value === '' ? 'Not recorded' : String(value);
async function json<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, credentials: 'same-origin' });
  const body = await response.json();
  if (!response.ok || body?.success !== true) throw new Error(body?.error || `Request failed (${response.status}).`);
  return body.data as T;
}
function SourceRecordList({ leads, busy, selection, dossierId, onSelect }: { leads: LedgerLead[]; busy: boolean; selection: LeadEvidenceSelection | null; dossierId: string; onSelect: (lead: LedgerLead, trigger: HTMLButtonElement) => void }) {
  if (!leads.length) return <p className="cx-ledger-panel">No source leads were returned in the current source scope.</p>;
  return <section className="cx-ledger-table-panel" aria-label="Source leads on this page" aria-busy={busy}>
    <p className="cx-ledger-table-note">Lead fields use the first returned original record. Select a lead to inspect all its returned source records in the canonical dossier.</p>
    <div className="cx-source-record-scroll" role="region" aria-label="Original source lead records" tabIndex={0}>
      <table className="cx-ledger-source-table"><thead><tr><th scope="col">Lead / source</th><th scope="col">Grade / vetting</th><th scope="col">Vendors</th><th scope="col">Original records / issues</th></tr></thead><tbody>{leads.map(lead => {
        const first = lead.records[0]?.raw || {};
        const selected = selection?.sourceLead?.key === lead.key || Boolean(lead.leadId && selection?.leadId === lead.leadId);
        return <tr key={lead.key} data-selected={selected}><td><button type="button" data-lead-id={lead.leadId || ''} className="cx-ledger-select-lead" aria-label={`Inspect source lead ${lead.leadId || 'Unresolved lead'}`} aria-pressed={selected} aria-controls={dossierId} disabled={busy} onClick={event => onSelect(lead, event.currentTarget)}>{lead.leadId || 'Unresolved lead'}</button><span>{text(first['Offershop Source'])}</span><small>Fetched {text(first.Fetched)}</small></td><td>{text(first['Offershop Grade'])}<small>{text(first['Offershop Color Vetting'])}</small></td><td>{text(first.Vendors)}</td><td>{number(lead.records.length)} original source records<small>{lead.issues.length ? `${number(lead.issues.length)} exception types` : 'No issue type supplied'}</small></td></tr>;
      })}</tbody></table>
    </div>
  </section>;
}
export default function LeadSourceBrowser({ sourceMode, setSourceMode, sourceFocus, workspaceNavigation, selection, dossier, dossierId, onSelect, onSourceResolved, onClearFocus, boundary }: {
  sourceMode: string; setSourceMode: (value: string) => void; sourceFocus?: SourceFocus; workspaceNavigation: React.ReactNode;
  selection: LeadEvidenceSelection | null; dossier: React.ReactNode; dossierId: string;
  onSelect: (lead: LedgerLead, result: LedgerReplicaReport, trigger: HTMLButtonElement) => void;
  onSourceResolved: (report: LedgerReplicaReport | null) => void; onClearFocus: () => void; boundary: string;
}) {
  const { selectedClient, ready } = useClient();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters, filterError, setDateRange } = useFilters();
  const [searchParams, setSearchParams] = useSearchParams();
  // The endpoint already supports this search. Read URL state before the first
  // query so navigation never issues an intermediate unfiltered request.
  const manualSearch = searchParams.get('sourceSearch') || '';
  const search = sourceFocus?.leadId || manualSearch;
  const sourceFilters = sourceFocus?.leadId && !filters.lead_id ? { ...filters, lead_id: { operator: 'equals' as const, value: sourceFocus.leadId } } : filters;
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => { setSearchInput(search); }, [search]);
  const setSearch = (value: string) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (value) next.set('sourceSearch', value); else next.delete('sourceSearch');
    return next;
  }, { replace: true });
  const [page, setPage] = useState(0), [pageSize, setPageSize] = useState(25);
  const [exportReview, setExportReview] = useState<{ mode: 'compatible' | 'available'; scopeKey: string; result: LedgerReplicaReport } | null>(null);
  const scopeKey = JSON.stringify([boundary, selectedClient, startDate, endDate, sourceFilters, sourceMode, search, pageSize]);
  // A new object marks each scope transition, including a later return to the
  // same scope. Feedback from an earlier visit must not reappear on that return.
  const downloadScopeRef = useRef({ key: scopeKey });
  if (downloadScopeRef.current.key !== scopeKey) downloadScopeRef.current = { key: scopeKey };
  const downloadScope = downloadScopeRef.current;
  const [downloadFeedback, setDownloadFeedback] = useState<{ scope: typeof downloadScope; state: string; error: string; downloading: boolean } | null>(null);
  const feedback = downloadFeedback?.scope === downloadScope ? downloadFeedback : null;
  const downloadState = feedback?.state || '', downloadError = feedback?.error || '', downloading = feedback?.downloading || false;
  const controller = useRef<{ scope: typeof downloadScope; abort: AbortController } | null>(null);
  const [previousScope, setPreviousScope] = useState(scopeKey);
  // Reset before paint/query evaluation, not after requesting a stale tenant/page combination.
  if (scopeKey !== previousScope) { setPreviousScope(scopeKey); setPage(0); }
  useEffect(() => () => {
    if (controller.current?.scope !== downloadScope) return;
    controller.current.abort.abort(); controller.current = null;
  }, [downloadScope]);
  const params = new URLSearchParams({ clientId: selectedClient, startDate, endDate, filters: JSON.stringify(sourceFilters), sourceMode, search, limit: String(pageSize), offset: String(page * pageSize) });
  const coverage = useQuery({ queryKey: ['ledger-replica-coverage', selectedClient, sourceMode], queryFn: ({ signal }) => json<LedgerCoverage>(`/api/analytics/lead-ledger/replica/coverage?clientId=${encodeURIComponent(selectedClient)}&sourceMode=${encodeURIComponent(sourceMode)}`, signal), enabled: isAdmin && ready, retry: false, staleTime: 60000 });
  const enabled = Boolean(isAdmin && ready && startDate && endDate && !filterError);
  const query = useQuery({ queryKey: ['ledger-replica', scopeKey, page], queryFn: ({ signal }) => json<LedgerReplicaReport>(`/api/analytics/lead-ledger/replica?${params}`, signal), enabled, retry: false, staleTime: 30000 });
  const data = enabled && !query.isError && query.data?.metadata.clientId === selectedClient ? query.data : undefined;
  useEffect(() => { onSourceResolved(data || null); }, [data, onSourceResolved]);
  const fields = data?.metadata.coverage || coverage.data;
  useEffect(() => { setExportReview(null); }, [scopeKey, page, data, query.isFetching]);
  const error = filterError || (query.error instanceof Error ? query.error.message : '') || (coverage.error instanceof Error ? coverage.error.message : '');
  const download = async (mode: 'compatible' | 'available') => {
    if (!data || downloading || query.isFetching || controller.current?.scope === downloadScope) return;
    controller.current?.abort.abort();
    const abort = new AbortController(), transfer = { scope: downloadScope, abort };
    controller.current = transfer;
    const currentTransfer = () => controller.current === transfer && downloadScopeRef.current === downloadScope;
    const updateFeedback = (update: Partial<{ state: string; error: string; downloading: boolean }>) => {
      if (!currentTransfer()) return;
      setDownloadFeedback(previous => ({ scope: downloadScope, state: '', error: '', downloading: true, ...(previous?.scope === downloadScope ? previous : {}), ...update }));
    };
    updateFeedback({ downloading: true, error: '', state: 'Preparing one complete query snapshot…' });
    try {
      const exportParams = new URLSearchParams(params); exportParams.delete('limit'); exportParams.delete('offset'); exportParams.set('mode', mode);
      const response = await fetch(`/api/analytics/lead-ledger/replica/export?${exportParams}`, { signal: abort.signal, credentials: 'same-origin' });
      const result = await receiveLedgerCsv(response, abort.signal, bytes => { if (!abort.signal.aborted) updateFeedback({ state: `Receiving ${(bytes / 1048576).toFixed(1)} MiB…` }); });
      if (abort.signal.aborted || !currentTransfer()) return;
      const url = URL.createObjectURL(result.blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = result.filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      updateFeedback({ state: `Complete: ${number(result.rows)} source rows. Query job: ${result.jobId || 'not supplied'}.` });
    } catch (cause) {
      if (abort.signal.aborted) updateFeedback({ state: 'Export cancelled. No file was saved.' });
      else updateFeedback({ state: '', error: cause instanceof Error ? cause.message : 'Export failed.' });
    } finally {
      if (currentTransfer()) { updateFeedback({ downloading: false }); controller.current = null; }
    }
  };
  if (!isAdmin) return <AnalyticsPageLayout title="Lead Evidence" status={workspaceNavigation}><p role="status">Source evidence requires authorised administrator access.</p></AnalyticsPageLayout>;
  return <AnalyticsPageLayout className="cx-source-ledger-page" title="Lead Evidence" description="Follow a lead from population membership to journey, outcomes, audit and original source records." actions={<ReportActions analysisContext={{ purpose: 'Inspect original source-compatible records for the fetched cohort.', grain: 'Original lead/vendor source records. Every returned record is retained; repeated lead totals are not additive', basis: `Fetched date selects the cohort; later vendor outcomes remain attached. ${data?.metadata.timestampInterpretation || 'Timestamp interpretation is shown with returned source provenance'}`, nullMeaning: 'Null and empty source fields are shown as Not recorded. Explicit zero and false remain source values. Missing outcome evidence is not a confirmed negative.', originalSource: true }} statusEvidence={<><p>{fields ? `${fields.available.length} / 63 fields available` : 'Source coverage has not been returned.'}</p><p className="cx-ledger-source">{fields?.source || 'Only the selected tenant’s approved source is queried.'}</p>{fields?.missing.length ? <p>Unavailable fields: {fields.missing.join(', ')}. Exports are explicitly partial.</p> : null}<p>Coverage does not establish historical parity or freshness.</p>{data && <><p>{data.metadata.timestampInterpretation}</p><p>Fetched window: {data.metadata.startDate} to {data.metadata.endDate}.</p>{data.metadata.generatedAt && <p>Generated at: {data.metadata.generatedAt}. This describes the response, not source freshness.</p>}{data.metadata.queryJobId && <p>Query job ID: {data.metadata.queryJobId}</p>}</>}</>} />} scope={<OffernetFilterBar onRefresh={() => { void query.refetch(); void coverage.refetch(); }} />} status={workspaceNavigation}>

    <section className="cx-ledger-workspace cx-ledger-workspace-body">
      <div className="cx-lead-evidence-boundary"><strong>Source Evidence</strong><p>Original source-compatible records for the selected fetched cohort. A lead may have multiple source/vendor records.</p></div>
      {sourceFocus && <p className="cx-ledger-source-handoff">Focused on a session-selected lead; identity and field focus are not encoded in the URL. <button type="button" onClick={onClearFocus}>Clear source focus</button></p>}

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
      {fields && <details className="cx-ledger-panel"><summary>Field availability and metric dependencies</summary><LedgerFieldCoverage coverage={fields} /></details>}
      {!enabled && <div className="cx-ledger-panel"><h2>Select a fetched-date window</h2><p>This report requires both dates, with a maximum of 366 days. Later vendor outcomes remain attached to that fetched cohort.</p><button type="button" className="cx-button-secondary" onClick={() => { const dates = defaultDateRange(); setDateRange(dates.start, dates.end); }}>Use last 30 days</button></div>}
      {error && <p role="alert" className="cx-ledger-error">{error}</p>}
      {query.isFetching && enabled && <p role="status">Loading source records…</p>}
      {data && <>
        <div className="cx-ledger-stats">{[['Unique leads', data.summary.leads, 'leads'], ['Source rows', data.summary.rows, 'rows'], ['Lead-only rows', data.summary.leadOnlyRows, 'lead-only'], ['Rows with repeated keys', data.summary.duplicateKeyRows, 'exceptions']].map(([label, value, metric]) => <div key={String(label)} data-metric={metric}><small>{label}</small><strong>{number(Number(value))}</strong><span>{metric === 'leads' ? 'Distinct lead population' : metric === 'rows' ? 'Visible source evidence' : metric === 'lead-only' ? 'No vendor record attached' : 'Requires careful interpretation'}</span></div>)}</div>

      </>}
      <div className="cx-ledger-section-heading"><div><h2>Records in scope</h2>{search && <p>Source search: “{search}”. Matches lead ID, consumer ID or source text within this reporting scope; it is not an exact-match or reconciliation claim.</p>}</div></div><div className="cx-ledger-toolbar"><form onSubmit={event => { event.preventDefault(); onClearFocus(); setSearch(searchInput.trim()); setPage(0); }}><label className="sr-only" htmlFor="ledger-search">Search lead ID, consumer ID or source</label><input id="ledger-search" value={searchInput} maxLength={200} onChange={event => setSearchInput(event.target.value)} placeholder="Lead ID, consumer ID or source" /><button type="submit" className="cx-button-primary">Search</button>{search && <button type="button" className="cx-button-secondary" onClick={() => { onClearFocus(); setSearch(''); setSearchInput(''); }}>Clear</button>}</form><div className="cx-ledger-actions"><label>Source dataset<select value={sourceMode} onChange={event => setSourceMode(event.target.value)}><option value="configured">Configured tenant source</option><option value="rich" disabled={!fields?.richViewEnabled}>Approved richer master view</option></select></label><button type="button" className="cx-button-export" disabled={!data || query.isFetching || downloading || !fields?.compatible} onClick={() => { if (data) setExportReview({ mode: 'compatible', scopeKey, result: data }); }}>Export source-compatible data</button>{fields && !fields.compatible && <button type="button" className="cx-button-export" disabled={!data || query.isFetching || downloading} onClick={() => { if (data) setExportReview({ mode: 'available', scopeKey, result: data }); }}>Export source data with available fields</button>}{downloading && <button type="button" className="cx-button-secondary" onClick={() => controller.current?.abort.abort()}>Cancel export</button>}</div></div>
      <EvidenceExportPreflight open={Boolean(exportReview && exportReview.scopeKey === scopeKey && exportReview.result === data && !query.isFetching && !downloading)} onClose={() => setExportReview(null)} onConfirm={() => { if (exportReview) void download(exportReview.mode); }} fields={data ? returnedEvidenceFields({ metadata: data.metadata }) : []}>
        <strong>{exportReview?.mode === 'available' ? 'All matching source rows · partial fields' : 'All matching source rows · source-compatible 63-column CSV'}</strong>
        <p>Complete source export uses a separate single query snapshot and may differ from the currently displayed interactive page. Current page limits do not limit this export.</p>
        {fields?.missing.length ? <p>Unavailable source fields: {fields.missing.join(', ')}. This export is explicitly partial.</p> : null}
      </EvidenceExportPreflight>
      {downloadState && <p role="status">{downloadState}</p>}{downloadError && <p role="alert" className="cx-ledger-error">{downloadError}</p>}
      {data && <>
        {sourceFocus && search === sourceFocus.leadId && <p className="cx-ledger-source-handoff" role="status">Source evidence for {sourceFocus.leadId}. {data.leads.some(lead => lead.leadId === sourceFocus.leadId) ? 'The matching lead is selected; relevant original fields are highlighted below.' : 'An exact lead match was not returned on this page; source search results are not a reconciliation claim.'}</p>}
        <div className="cx-lead-evidence-master-detail cx-source-evidence-master-detail" data-has-selection={Boolean(selection)}>
          <SourceRecordList leads={data.leads} busy={query.isFetching} selection={selection} dossierId={dossierId} onSelect={(lead, trigger) => onSelect(lead, data, trigger)} />
          {dossier}
        </div>
        <div className="cx-ledger-pagination"><label>Leads per page<select value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{[25, 50, 100].map(value => <option key={value}>{value}</option>)}</select></label><span>Page {page + 1} · {number(data.summary.leads)} leads in scope</span><button type="button" className="cx-button-secondary" disabled={page === 0 || query.isFetching} onClick={() => setPage(value => value - 1)}>Previous</button><button type="button" className="cx-button-secondary" disabled={!data.metadata.hasMore || query.isFetching} onClick={() => setPage(value => value + 1)}>Next</button></div>
        <details className="cx-ledger-portfolio"><summary>Portfolio evidence · Vendor coverage & reported revenue</summary>        <div className="cx-ledger-panels"><section className="cx-ledger-panel cx-ledger-vendor-panel"><div className="cx-ledger-panel-heading"><div><p className="cx-ledger-eyebrow">Distribution</p><h2>Vendor coverage</h2></div><span>Distinct leads</span></div><p>Distinct leads per vendor; a lead can belong to several vendors.</p>{data.vendors.map(vendor => <div className="cx-ledger-vendor" key={vendor.vendor}><span>{vendor.vendor}</span><meter min="0" max={Math.max(data.summary.leads, 1)} value={vendor.leads} aria-label={`${vendor.vendor}: ${vendor.leads} distinct leads`} /><strong>{number(vendor.leads)}</strong></div>)}</section><section className="cx-ledger-panel cx-ledger-revenue-panel"><div className="cx-ledger-panel-heading"><div><p className="cx-ledger-eyebrow">Commercial evidence</p><h2>Reported HLC revenue</h2></div><span>Recorded only</span></div><p>Selected vendor records only. Not repeated lead totals, collected cash or independently reconciled revenue.</p>{data.summary.revenue.map(row => <p className="cx-ledger-money" key={row.currency}><strong>{row.currency} {row.amount ?? 'Not recorded'}</strong><small>{row.missingAmounts ? `${number(row.missingAmounts)} missing amounts; sum is incomplete.` : 'Raw records retained, including repeated transaction keys.'}</small></p>)}<p>Sale, activation and contact evidence remain separate; no upstream event is manufactured from a downstream outcome.</p></section></div></details>
        <details className="cx-ledger-panel"><summary>Source provenance and interpretation</summary><p>{data.metadata.pagination}</p><p>{data.metadata.timestampInterpretation}</p><dl className="cx-ledger-provenance">{returnedEvidenceFields({ metadata: data.metadata }).map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}{data.metadata.version && <div><dt>Report version</dt><dd>{data.metadata.version}</dd></div>}{data.metadata.queryJobId && <div><dt>Query job ID</dt><dd>{data.metadata.queryJobId}</dd></div>}<div><dt>Returned page</dt><dd>Offset {data.metadata.offset} · page size {data.metadata.pageSize}</dd></div></dl><p>Generated at describes this response, not source freshness. Exports use a separate, single query snapshot and may differ from an earlier interactive page. Placeholder dates are retained in raw fields but excluded from milestones. Formula-like CSV strings are escaped for spreadsheet safety. Process fields that are not timestamp-shaped are redacted.</p></details>
      </>}
    </section>
  </AnalyticsPageLayout>;
}
