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
import { downloadCsv } from '../lib/formatters';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import { useOperationalData } from '../lib/useOperationalData';

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
};

const FUNNEL_LABELS: Record<string, string> = {
  'fetched-to-delivered': 'Fetched → Delivered loss',
  'delivered-to-dialled': 'Delivered → Dialled loss',
  'dialled-to-rpc': 'Dialled → RPC loss',
  'rpc-to-sales': 'RPC → Sales loss',
  'sales-to-activated': 'Sales → Activated loss',
};

export default function LeadExplorerIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [params, setParams] = useSearchParams();
  const drill = params.get('drill') || '';
  const drillValue = params.get('drillValue') || '';
  const appliedSearch = params.get('search') || '';
  const [search, setSearch] = useState(appliedSearch);
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

  const handleExportCsv = () => {
    if (!data?.rows.length) return;
    const headers = ['Lead ID', 'Consumer ID', 'Fetched', 'Source', 'Vendor', 'Grade', 'Dialled', 'RPC', 'Sale', 'Activated', 'Revenue'];
    const rows = data.rows.map(row => [
      row.lead_id,
      row.consumer_id,
      row.fetched,
      row.source,
      row.vendor,
      row.grade,
      row.dialled ? 'Yes' : 'No',
      row.contacted ? 'Yes' : 'No',
      row.sale ? 'Yes' : 'No',
      row.activated ? 'Yes' : 'No',
      row.revenue,
    ]);
    downloadCsv(`lead_records_${selectedClient}_p${page + 1}`, [headers, ...rows]);
  };

  const shownStart = data?.rows.length ? page * pageSize + 1 : 0;
  const shownEnd = data ? page * pageSize + data.rows.length : 0;

  return (
    <div className="cx-command-page">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />

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
            <button type="button" onClick={clearInvestigation}><ArrowLeft size={13} />Clear investigation</button>
          </section>
        )}

        {error && <div className="cx-command-error" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}

        <section className="cx-command-panel">
          <header>
            <div>
              <span className="cx-command-section-kicker">Records</span>
              <h2>Affected lead population</h2>
              <p>One representative warehouse row per lead. Open a lead to inspect its chronological source events.</p>
            </div>
            <span className="cx-explorer-count">{shownStart}–{shownEnd}</span>
          </header>

          <form onSubmit={handleSearchSubmit} className="cx-explorer-search">
            <label>
              <Search size={14} />
              <input
                type="text"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Lead ID, consumer ID, vendor, source or disposition"
              />
            </label>
            <button type="submit" className="cx-button-primary">Search</button>
            {search && <button type="button" className="cx-button-secondary" onClick={clearSearch}>Clear</button>}
          </form>

          {loading && !data ? (
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
                    <th>First dial</th>
                    <th>RPC</th>
                    <th>Sale</th>
                    <th>Activated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data?.rows.map((row, index) => (
                    <tr key={`${row.lead_id}-${index}`}>
                      <th title={row.lead_id}>{row.lead_id}</th>
                      <td>{row.consumer_id || '—'}</td>
                      <td>{row.fetched || '—'}</td>
                      <td>{row.vendor || '—'}</td>
                      <td>{row.source || '—'}</td>
                      <td>{row.grade || '—'}</td>
                      <td>{row.first_call_time || '—'}</td>
                      <td>{row.contacted ? 'Yes' : 'No'}</td>
                      <td>{row.sale ? 'Yes' : 'No'}</td>
                      <td>{row.activated ? 'Yes' : 'No'}</td>
                      <td>
                        <button type="button" className="cx-record-open" onClick={() => handleOpenTimeline(row.lead_id, row.vendor)} title="Open lead timeline" aria-label={`Open timeline for lead ${row.lead_id}`}>
                          <Eye size={14} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && data && data.rows.length === 0 && (
                    <tr><td colSpan={11}><div className="cx-command-empty"><Search size={17} />No records match this investigation and reporting scope.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <footer className="cx-explorer-pagination">
            <span>Page {page + 1}</span>
            <div>
              <button type="button" className="cx-button-secondary" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft size={14} />Previous</button>
              <button type="button" className="cx-button-secondary" disabled={loading || !data || data.rows.length < pageSize} onClick={() => setPage(value => value + 1)}>Next<ChevronRight size={14} /></button>
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
