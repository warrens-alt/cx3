import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  X,
} from 'lucide-react';
import { useFilters, extractOffernetFilters, singleFilterValue } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchRawLeads, fetchLeadTimeline, type RawLeadsData, type LeadTimelineData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { formatCurrency, formatTableNumber } from '../lib/formatters';
import { buildLeadEvidenceExport } from '../lib/analysisExport';
import { downloadCsv } from '../lib/formatters';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import { useOperationalData } from '../lib/useOperationalData';
import { ledgerOutcome } from '../lib/leadLedgerValues';

const DRILL_LABELS: Record<string, string> = {
  'awaiting-first-dial': 'Delivered leads awaiting first dial',
  'missing-disposition': 'Dialled leads missing disposition',
  'unactivated-sales': 'Sales without activation after 14 days',
  'sla-breach': 'First-dial SLA breaches',
  'backlog-age': 'First-dial backlog age cohort',
  'funnel-loss': 'Funnel loss population',
  'funnel-stage': 'Funnel stage population',
  'lead-age': 'First-dial age cohort',
  'high-attempt-no-rpc': '5+ recorded calls without RPC',
  'one-call-only': 'Exactly one recorded call',
  'waiting-over-hour': 'Delivered leads waiting longer than one hour',
  'zero-call-leads': 'Zero recorded calls',
  'sales-awaiting-activation': 'All sales awaiting activation',
  'missing-source': 'Missing source', 'missing-vendor': 'Missing vendor', 'missing-grade': 'Missing grade',
  'invalid-timestamps': 'Out-of-order lifecycle timestamps',
  'delivery-age': 'Delivery to first dial age cohort',
  'lifecycle-segment': 'Lifecycle segment population',
  'call-effort': 'Call effort bucket population',
};

const FUNNEL_LABELS: Record<string, string> = {
  'fetched-to-delivered': 'Fetched → Delivered loss',
  'delivered-to-dialled': 'Delivered → Dialled loss',
  'dialled-to-rpc': 'Dialled → RPC loss',
  'rpc-to-sales': 'RPC → Sales loss',
  'sales-to-activated': 'Sales → Activated loss',
};

const STAGE_LABELS: Record<string, string> = {
  fetched: 'Fetched leads',
  delivered: 'Delivered leads',
  dialled: 'Dialled leads',
  rpc: 'Right-party contact (RPC) leads',
  sales: 'Recorded sales leads',
  activated: 'Activated leads',
};

export default function LeadExplorerIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [params, setParams] = useSearchParams();
  const drill = params.get('drill') || '';
  const drillValue = params.get('drillValue') || '';
  const appliedSearch = params.get('search') || '';
  const [search, setSearch] = useState(appliedSearch);
  const [exportError, setExportError] = useState<string | null>(null);
  const scopeKey = JSON.stringify([selectedClient, startDate, endDate, filters, drill, drillValue, appliedSearch]);
  const [pagination, setPagination] = useState({ scopeKey, page: 0 });
  const page = pagination.scopeKey === scopeKey ? pagination.page : 0;
  const setPage = (value: number | ((previous: number) => number)) => {
    setPagination(previous => ({
      scopeKey,
      page: typeof value === 'function' ? value(previous.scopeKey === scopeKey ? previous.page : 0) : value,
    }));
  };
  const pageSize = 50;

  const [timelineSelection, setTimelineSelection] = useState<{ leadId: string; vendor?: string; scopeKey: string } | null>(null);
  useEffect(() => {
    setPagination({ scopeKey, page: 0 });
    setTimelineSelection(null);
  }, [scopeKey]);
  const selectedLead = timelineSelection?.scopeKey === scopeKey ? timelineSelection.leadId : null;
  const closeTimeline = () => setTimelineSelection(null);
  const timelineDialogRef = useDialogAccessibility<HTMLElement>(Boolean(selectedLead), closeTimeline);
  const { data: timelineData, loading: timelineLoading, error: timelineError } = useOperationalData<LeadTimelineData>('lead-timeline', {
    clientId: selectedClient,
    leadId: selectedLead,
    vendor: timelineSelection?.vendor,
  }, ({ leadId, ...scope }, forceRefresh, signal) => fetchLeadTimeline(leadId, scope, forceRefresh, signal), Boolean(selectedLead));

  const investigation = useMemo(() => {
    if (!drill) return null;
    const base = DRILL_LABELS[drill] || 'Investigation population';
    if (drill === 'funnel-loss' && drillValue) return FUNNEL_LABELS[drillValue] || base;
    if (drill === 'funnel-stage' && drillValue) return STAGE_LABELS[drillValue] ? `Funnel stage: ${STAGE_LABELS[drillValue]}` : `${base}: ${drillValue}`;
    if (drill === 'lifecycle-segment' && drillValue) {
      const colonIdx = drillValue.indexOf(':');
      if (colonIdx !== -1) {
        const dim = drillValue.slice(0, colonIdx);
        const val = drillValue.slice(colonIdx + 1);
        const dimLabel = dim ? dim.charAt(0).toUpperCase() + dim.slice(1) : 'Segment';
        return `Lifecycle segment (${dimLabel}): ${val}`;
      }
      return `Lifecycle segment: ${drillValue}`;
    }
    if (drill === 'call-effort' && drillValue) return `Call effort bucket: ${drillValue}`;
    return drillValue ? `${base}: ${drillValue}` : base;
  }, [drill, drillValue]);

  const { data, loading, error, loadData } = useOperationalData<RawLeadsData>('lead-explorer', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
    search: appliedSearch || undefined,
    drill: drill || undefined,
    drillValue: drillValue || undefined,
    limit: pageSize,
    offset: page * pageSize,
  }, fetchRawLeads);

  useEffect(() => {
    setSearch(appliedSearch);
  }, [appliedSearch]);

  useEffect(() => {
    setExportError(null);
  }, [selectedClient, scopeKey]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(0);
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (search.trim()) next.set('search', search.trim());
      else next.delete('search');
      return next;
    }, { replace: true });
  };

  const clearInvestigation = () => {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete('drill');
      next.delete('drillValue');
      return next;
    }, { replace: true });
  };

  const clearSearch = () => {
    setSearch('');
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete('search');
      return next;
    }, { replace: true });
    setPage(0);
  };

  const handleOpenTimeline = (leadId: string, vendor?: string) => {
    setTimelineSelection({ leadId, vendor: vendor || singleFilterValue(filters.vendor), scopeKey });
  };

  const isCurrentClientData = Boolean(data && data.clientId === selectedClient);
  const isExportAvailable = Boolean(isCurrentClientData && !loading && !error);

  const handleExportCsv = () => {
    if (!isExportAvailable || !data) return;
    setExportError(null);
    try {
      const exportResult = buildLeadEvidenceExport(data, {
        investigation: investigation || undefined,
        exportCreatedAt: new Date().toISOString(),
      });
      downloadCsv(exportResult.filename, exportResult.rows);
    } catch (err: any) {
      setExportError(err?.message || 'Failed to export lead evidence CSV');
    }
  };

  const shownStart = isCurrentClientData && data?.rows.length ? page * pageSize + 1 : 0;
  const shownEnd = isCurrentClientData && data ? page * pageSize + data.rows.length : 0;
  const totalCountText = isCurrentClientData && data?.totalCount != null ? ` of ${formatTableNumber(data.totalCount)}` : '';

  return (
    <div className="cx-command-page">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={isExportAvailable ? handleExportCsv : undefined} />

      <div className="cx-command-content">
        <header className="cx-command-hero">
          <div>
            <span className="cx-command-eyebrow">Investigate</span>
            <h1>Explore</h1>
            <p>Inspect the lead population behind an operational metric, exception, cohort, vendor or funnel transition.</p>
          </div>
        </header>

        {investigation && (
          <section className="cx-investigation-banner">
            <div>
              <span>Active investigation</span>
              <strong>{investigation}</strong>
              <small>The records below are constrained by the selected client, dates and global filters.</small>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={clearInvestigation}><ArrowLeft size={13} />Clear investigation</button>
            </div>
          </section>
        )}

        {error && <div className="cx-command-error" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
        {exportError && <div className="cx-command-error" role="alert"><AlertTriangle size={17} /><span>{exportError}</span></div>}

        <section className="cx-command-panel">
          <header>
            <div>
              <span className="cx-command-section-kicker">Records</span>
              <h2>Affected lead population</h2>
              <p>One representative warehouse row per lead. Open a lead to inspect its chronological source events.</p>
            </div>
            <span className="cx-explorer-count">{shownStart}–{shownEnd}{totalCountText}</span>
          </header>

          <form onSubmit={handleSearchSubmit} className="cx-explorer-search">
            <label>
              <Search size={14} />
              <input aria-label="Search lead records"
                type="text"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Lead ID, consumer ID, vendor, source or disposition"
              />
            </label>
            <button type="submit" className="cx-button-primary">Search</button>
            {search && <button type="button" className="cx-button-secondary" onClick={clearSearch}>Clear</button>}
          </form>

          {loading && !isCurrentClientData ? (
            <div className="cx-command-loading"><div className="cx-command-spinner" />Loading lead population…</div>
          ) : (
            <div className="cx-performance-table-wrap">
              <table className="cx-performance-table cx-explorer-table">
                <thead>
                  <tr>
                    <th>Lead ID</th>
                    <th>Consumer</th>
                    <th>Fetched</th>
                    <th>Vendor</th>
                    <th>Source</th>
                    <th>Grade</th>
                    <th>Delivered</th>
                    <th>First dial</th>
                    <th className="text-right">Calls</th>
                    <th>Disposition</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-center">RPC</th>
                    <th className="text-center">Sale</th>
                    <th className="text-center">Activated</th>
                    <th className="w-10 text-center" />
                  </tr>
                </thead>
                <tbody>
                  {isCurrentClientData && data?.rows.map((row, index) => (
                    <tr key={`${row.lead_id}-${index}`}>
                      <th title={row.lead_id} className="font-mono text-xs">{row.lead_id}</th>
                      <td className="font-mono text-xs text-text-sec">{row.consumer_id || '—'}</td>
                      <td className="text-xs whitespace-nowrap">{row.fetched || '—'}</td>
                      <td className="text-xs font-medium">{row.vendor || '—'}</td>
                      <td className="text-xs text-text-sec">{row.source || '—'}</td>
                      <td className="text-xs">{row.grade || '—'}</td>
                      <td className="text-xs whitespace-nowrap">{row.delivered_time || '—'}</td>
                      <td className="text-xs whitespace-nowrap">{row.first_call_time || '—'}</td>
                      <td className="text-right font-mono tabular-nums text-xs">{formatTableNumber(row.total_calls)}</td>
                      <td className="text-xs max-w-[140px] truncate" title={row.last_dialer_status}>{row.last_dialer_status || 'Unavailable'}</td>
                      <td className="text-right font-mono tabular-nums font-semibold text-xs text-text-main">{formatCurrency(row.revenue)}</td>
                      <td className="text-center text-xs">
                        {ledgerOutcome(row.contacted) === 'Unavailable' ? 'Unavailable' : ledgerOutcome(row.contacted) === 'TRUE' ? 'Yes' : 'No'}
                      </td>
                      <td className="text-center text-xs">
                        {ledgerOutcome(row.sale) === 'Unavailable' ? 'Unavailable' : ledgerOutcome(row.sale) === 'TRUE' ? 'Yes' : 'No'}
                      </td>
                      <td className="text-center text-xs">
                        {ledgerOutcome(row.activated) === 'Unavailable' ? 'Unavailable' : ledgerOutcome(row.activated) === 'TRUE' ? 'Yes' : 'No'}
                      </td>
                      <td className="text-center">
                        <button type="button" className="cx-record-open" onClick={() => handleOpenTimeline(row.lead_id, row.vendor)} title="Open lead timeline" aria-label={`Open timeline for lead ${row.lead_id}`}>
                          <Eye size={14} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && isCurrentClientData && data && data.rows.length === 0 && (
                    <tr>
                      <td colSpan={15}>
                        <div className="cx-command-empty">
                          <Search size={17} />
                          {data.totalCount != null && data.totalCount > 0 && page > 0 ? (
                            <div className="space-y-2">
                              <p>Page {page + 1} is beyond the available records ({formatTableNumber(data.totalCount)} matching leads in scope).</p>
                              <button type="button" className="cx-button-primary" onClick={() => setPage(0)}>
                                Return to page 1
                              </button>
                            </div>
                          ) : (
                            <span>No records match this investigation and reporting scope.</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <footer className="cx-explorer-pagination">
            <span>Page {page + 1}{data?.totalCount != null ? ` · Total: ${formatTableNumber(data.totalCount)} matching leads` : ''}</span>
            <div>
              <button type="button" className="cx-button-secondary" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft size={14} />Previous</button>
              <button type="button" className="cx-button-secondary" disabled={loading || !data || data.rows.length < pageSize || (data.totalCount != null && shownEnd >= data.totalCount)} onClick={() => setPage(value => value + 1)}>Next<ChevronRight size={14} /></button>
            </div>
          </footer>
        </section>
      </div>

      {selectedLead && (
        <div className="cx-timeline-backdrop" onMouseDown={event => { if (event.currentTarget === event.target) closeTimeline(); }}>
          <aside ref={timelineDialogRef} tabIndex={-1} className="cx-timeline-modal" role="dialog" aria-modal="true" aria-label="Lead timeline">
            <header>
              <div><span>Lead audit trail</span><h2>{selectedLead}</h2></div>
              <button type="button" onClick={closeTimeline} aria-label="Close lead timeline"><X size={18} /></button>
            </header>

            {timelineLoading ? (
              <div className="cx-command-loading"><div className="cx-command-spinner" />Loading source events…</div>
            ) : timelineError ? (
              <div className="cx-command-error" role="alert">{timelineError}</div>
            ) : timelineData ? (
              <div className="cx-timeline-body">
                <div className="cx-timeline-context">
                  <div><span>Vendor</span><strong>{timelineData.vendor || '—'}</strong></div>
                  <div><span>Source</span><strong>{timelineData.source || '—'}</strong></div>
                  <div><span>Grade</span><strong>{timelineData.grade || '—'}</strong></div>
                </div>
                <p className="text-xs text-slate-500">{timelineData.callEvidence?.reason} {timelineData.callEvidence?.status}</p>
                <div className="cx-timeline-events">
                  {timelineData.events.map((event, index) => (
                    <article key={`${event.stage}-${event.timestamp}-${index}`}>
                      <i />
                      <div>
                        <span>{event.stage}</span>
                        <strong>{event.title}</strong>
                        <time>{event.timestamp || 'Timestamp unavailable'}</time>
                        <p>{event.details}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : <div className="cx-command-empty">No timeline evidence is available for this lead.</div>}
          </aside>
        </div>
      )}
    </div>
  );
}
