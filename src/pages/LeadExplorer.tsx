import { VisualTable } from '../components/visuals/DataVisual';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { PageShell } from '../components/PageShell';
import { Search, Download, ChevronLeft, ChevronRight, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { LeadTimelineModal } from '../components/LeadTimelineModal';
import PageHeader from '../components/PageHeader';
import { DataState } from '../components/DataState';
import { useFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { analyticsError, analyticsUrl, saveBlob } from '../lib/analyticsRequest';

interface LeadRecord {
  id: string;
  captured?: string | { value: string };
  source?: string;
  campaign?: string;
  quality?: string;
  calls?: string;
  status?: string;
  value?: string;
}

export default function LeadExplorer() {
  const { startDate, endDate, filters } = useFilters();
  const { selectedClient, clientConfig, reportAuthenticationFailure } = useClient();
  const scope = { clientId: selectedClient, startDate, endDate, filters };
  const scopeKey = JSON.stringify(scope);
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const [pageState, setPage] = useState({ scopeKey, value: 1 });
  const page = pageState.scopeKey === scopeKey ? pageState.value : 1;
  const [selection, setSelection] = useState<{ scopeKey: string; id: string } | null>(null);
  const [searchState, setSearch] = useState({ scopeKey, value: '' });
  const search = searchState.scopeKey === scopeKey ? searchState.value : '';
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');
  const [exportState, setExportState] = useState<{ scopeKey: string; loading: boolean; message: string; error: string | null } | null>(null);
  const exportController = useRef<AbortController | null>(null);
  useEffect(() => {
    // Do not revive a cancelled "Preparing" state when navigating back to its scope.
    setExportState(null);
    return () => { exportController.current?.abort(); };
  }, [scopeKey]);

  const limit = 20;
  const offset = (page - 1) * limit;
  const query = useAnalyticsData<LeadRecord[]>('leads', { limit, offset });
  const error = query.error || (query.data !== null && (!Array.isArray(query.data) || query.data.some(lead => !lead || typeof lead.id !== 'string' || !lead.id)) ? 'The lead-record response is incomplete. Please retry.' : null);
  const leads = !error && Array.isArray(query.data) ? query.data : [];
  const term = search.trim().toLocaleLowerCase();
  const matching = term ? leads.filter(lead => [lead.id, lead.source, lead.campaign, lead.status].some(value => String(value ?? '').toLocaleLowerCase().includes(term))) : leads;
  const activeExport = exportState?.scopeKey === scopeKey ? exportState : null;
  const busy = query.loading || query.fetching;

  const exportScope = async () => {
    exportController.current?.abort();
    const controller = new AbortController();
    exportController.current = controller;
    setExportState({ scopeKey, loading: true, message: '', error: null });
    try {
      const response = await fetch(analyticsUrl('export', scope, { grain: 'lead', format: 'csv', limit: 10000 }), { signal: controller.signal, credentials: 'same-origin' });
      if (!response.ok) throw analyticsError(response, await response.json().catch(() => null));
      if (!response.headers.get('content-type')?.includes('text/csv')) throw new Error('The export response was not a CSV file. Please retry.');
      const blob = await response.blob();
      if (controller.signal.aborted || currentScope.current !== scopeKey) return;
      saveBlob(blob, `conversionx-leads-${startDate}-${endDate}.csv`);
      const count = response.headers.get('x-export-row-count');
      const truncated = response.headers.get('x-export-truncated') === 'true';
      setExportState({ scopeKey, loading: false, error: null, message: `CSV prepared${count ? ` with ${count} records` : ''}. ${truncated ? 'The 10,000-record limit was reached. Narrow the scope for a smaller extract.' : 'The extract reflects the selected scope at export time; source completeness is not certified.'}` });
    } catch (failure) {
      if (controller.signal.aborted || currentScope.current !== scopeKey) return;
      if ((failure as { status?: number }).status === 401) {
        reportAuthenticationFailure((failure as Error).message);
        return;
      }
      setExportState({ scopeKey, loading: false, message: '', error: failure instanceof Error ? failure.message : 'The export could not be prepared.' });
    }
  };

  return <PageShell className="flex flex-col">
    <PageHeader title="Lead Records" description="Inspect returned lead records and their recorded transaction timelines. Active workspace, capture dates and filters apply.">
      <button type="button" onClick={() => void exportScope()} disabled={busy || !!error || !!activeExport?.loading || !leads.length}
        aria-describedby="lead-export-scope" className="cx-button-secondary">
        <Download size={16} />{activeExport?.loading ? 'Preparing CSV…' : 'Export selected scope CSV'}
      </button>
    </PageHeader>
    <p id="lead-export-scope" className="text-sm text-text-sec mb-4">Scope export requests up to 10,000 lead records from the API. It is not limited to this page or the local search, and it is not a pinned reporting snapshot.</p>
    {activeExport?.error && <p role="alert" className="text-sm text-semantic-neg">{activeExport.error}</p>}
    {activeExport?.message && <p role="status" className="text-sm text-text-sec">{activeExport.message}</p>}
    {query.loading || error ? <DataState loading={query.loading} error={error} retry={query.refetch} /> : <section className="enterprise-card flex flex-col min-w-0">
      <div className="p-4 border-b border-border-subtle flex flex-wrap items-center justify-between gap-4 bg-surface-sec/50">
        <div className="flex-1 max-w-md space-y-1">
          <label className="block"><span className="block text-sm font-medium mb-1">Search this loaded page</span>
            <span className="relative block"><Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-mute" />
              <input type="search" value={search} maxLength={200} onChange={event => setSearch({ scopeKey, value: event.target.value })}
                placeholder="Lead ID, source, medium or status" aria-describedby="lead-search-help" className="w-full pl-9 pr-4 py-2 bg-white border border-border-strong rounded-lg text-sm" />
            </span>
          </label>
          <p id="lead-search-help" className="text-xs text-text-sec">Local display filter: {matching.length} of {leads.length} returned records on page {page}.</p>
        </div>

        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
              viewMode === 'table'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('graph')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
              viewMode === 'graph'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Graph</span>
          </button>
        </div>
      </div>
      {query.fetching && <p role="status" className="px-4 py-2 text-xs text-text-sec bg-blue-50 border-b border-blue-100">Updating this page… Export and pagination will resume when the request finishes.</p>}
      {!matching.length ? <p role="status" className="p-6 text-text-sec">{leads.length ? 'No loaded records match this search. Clear the local search to view this page.' : page > 1 ? 'No further records were returned. Go to the previous page or adjust the reporting scope.' : 'No lead records matched the selected reporting scope. Adjust the dates or filters.'}</p> :
        viewMode === 'table' ? (
          <div className="overflow-auto min-w-0" tabIndex={0} role="region" aria-label="Lead records table">
            <VisualTable visual={{ id: 'records.leads', data: matching }} initialView="table" className="enterprise-table">
              <thead><tr>
                <th scope="col">Lead ID</th><th scope="col">Capture time</th><th scope="col">Source</th><th scope="col">Traffic medium</th>
                <th scope="col">Validation status</th><th scope="col" className="text-right">Recorded call attempts</th><th scope="col">Recorded status</th><th scope="col" className="text-right">Recorded revenue ({clientConfig?.currency || 'currency unavailable'})</th>
              </tr></thead>
              <tbody>{matching.map((lead, idx) => {
                const capture = typeof lead.captured === 'object' ? lead.captured?.value : lead.captured;
                const date = capture ? new Date(capture) : null;
                return <tr key={`${lead.id || 'lead'}-${idx}`}>
                  <td><button type="button" className="text-[#315EAD] font-semibold underline underline-offset-4 text-left break-all hover:text-[#294F95]" onClick={() => setSelection({ scopeKey, id: lead.id })} aria-label={`Inspect lead ${lead.id}`}>{lead.id}</button></td>
                  <td className="whitespace-nowrap">{date && Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Unavailable'}</td>
                  <td>{lead.source ?? 'Unavailable'}</td><td>{lead.campaign ?? 'Unavailable'}</td>
                  <td>{lead.quality ?? 'Not independently verified'}</td><td className="text-right tabular-nums">{lead.calls ?? 'Unavailable'}</td>
                  <td>{lead.status ?? 'Unavailable'}</td><td className="text-right tabular-nums">{lead.value ?? 'Unavailable'}</td>
                </tr>;
              })}</tbody>
            </VisualTable>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-50/50">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-4 font-semibold">Leads by Recorded Status</h4>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={Object.entries(
                      matching.reduce((acc, lead) => {
                        const status = lead.status || 'Unknown';
                        acc[status] = (acc[status] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([status, count]) => ({ status, count }))}
                    margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '12px' }}
                      formatter={(val: number) => [val, 'Leads']}
                    />
                    <Bar dataKey="count" name="Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-4 font-semibold">Leads by Source</h4>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={Object.entries(
                      matching.reduce((acc, lead) => {
                        const src = lead.source || 'Unknown';
                        acc[src] = (acc[src] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([source, count]) => ({ source, count }))}
                    margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="source" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '12px' }}
                      formatter={(val: number) => [val, 'Leads']}
                    />
                    <Bar dataKey="count" name="Leads" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )
      }
      <nav aria-label="Lead records pagination" className="p-4 border-t border-border-subtle bg-surface-sec text-sm flex flex-wrap justify-between items-center gap-3">
        <span>Page {page} · {leads.length} returned records{leads.length ? ` · positions ${offset + 1}–${offset + leads.length}` : ''}. Total matching population is not supplied.</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPage({ scopeKey, value: Math.max(1, page - 1) })} disabled={page === 1 || busy} className="cx-button-secondary"><ChevronLeft size={16} />Previous page</button>
          <button type="button" onClick={() => setPage({ scopeKey, value: page + 1 })} disabled={leads.length < limit || busy} className="cx-button-secondary">Next page<ChevronRight size={16} /></button>
        </div>
      </nav>
    </section>}
    {selection?.scopeKey === scopeKey && <LeadTimelineModal leadId={selection.id} onClose={() => setSelection(null)} />}
  </PageShell>;
}
