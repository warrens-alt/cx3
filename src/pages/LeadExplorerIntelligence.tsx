import InvestigationContextBar from '../features/investigation/InvestigationContextBar';
import DriverAnalysis from '../features/investigation/DriverAnalysis';
import EvidenceConfidence from '../features/investigation/EvidenceConfidence';
import EvidenceTray, { useEvidenceTray } from '../features/investigation/EvidenceTray';
import InvestigationAI from '../features/investigation/InvestigationAI';
import { investigationLabel } from '../features/investigation/investigationModel';
import { ReportActions } from '../shared/reporting/ReportPresentation';
import React, { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useAuth } from '../lib/AuthContext';
import { useClient } from '../lib/ClientContext';
import { fetchRawLeads, fetchLeadTimeline, type RawLeadsData, type LeadTimelineData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { formatTableNumber } from '../lib/formatters';
import { buildLeadEvidenceExport } from '../lib/analysisExport';
import { downloadCsv } from '../lib/formatters';
import { useOperationalData } from '../lib/useOperationalData';
import InvestigationRecordList, { type InvestigationLead } from '../features/investigation/InvestigationRecordList';
import LeadDossier from '../features/investigation/LeadDossier';
import '../features/investigation/investigationRecords.css';
import EvidenceExportPreflight, { returnedEvidenceFields } from '../features/leadLedger/EvidenceExportPreflight';

export default function LeadExplorerIntelligence() {
  const { isAdmin } = useAuth();
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [params, setParams] = useSearchParams();
  const drill = params.get('drill') || '';
  const drillValue = params.get('drillValue') || '';
  const appliedSearch = params.get('search') || '';
  const [search, setSearch] = useState(appliedSearch);
  const [exportError, setExportError] = useState<string | null>(null);
  const segmentVendor = params.get('segmentVendor') || '';
  const segmentSource = params.get('segmentSource') || '';
  const segmentGrade = params.get('segmentGrade') || '';
  const segmentLeadAge = params.get('segmentLeadAge') || '';
  const reportingScopeKey = JSON.stringify([selectedClient, startDate, endDate, filters, drill, drillValue, appliedSearch]);
  const scopeKey = JSON.stringify([reportingScopeKey, segmentVendor, segmentSource, segmentGrade, segmentLeadAge, params.get('investigationMetric')]);
  const [pagination, setPagination] = useState({ scopeKey, page: 0 });
  const page = pagination.scopeKey === scopeKey ? pagination.page : 0;
  const setPage = (value: number | ((previous: number) => number)) => {
    setPagination(previous => ({
      scopeKey,
      page: typeof value === 'function' ? value(previous.scopeKey === scopeKey ? previous.page : 0) : value,
    }));
  };
  const pageSize = 50;

  const dossierId = useId();
  const selectionTrigger = useRef<HTMLButtonElement | null>(null);
  const recordsPanel = useRef<HTMLElement>(null);
  const recordsHeading = useRef<HTMLHeadingElement>(null);
  const [timelineSelection, setTimelineSelection] = useState<{ row: InvestigationLead; result: RawLeadsData; scopeKey: string } | null>(null);
  useEffect(() => {
    setPagination({ scopeKey, page: 0 });
    setTimelineSelection(null);
  }, [scopeKey]);
  const selection = timelineSelection?.scopeKey === scopeKey ? timelineSelection : null;
  const selectedLead = selection ? String(selection.row.lead_id) : null;
  const closeTimeline = () => {
    const leadId = selectedLead;
    const originalTrigger = selectionTrigger.current;
    setTimelineSelection(null);
    // Closing expands the records pane and may replace the visible card with a
    // table row. Resolve the visible control after that layout has committed.
    requestAnimationFrame(() => {
      if (document.getElementById(dossierId)) return;
      const visible = (element: HTMLElement | null) => Boolean(element?.isConnected && element.getClientRects().length);
      const matching = Array.from(recordsPanel.current?.querySelectorAll<HTMLButtonElement>('button[data-lead-id]') || [])
        .find(button => button.dataset.leadId === leadId && visible(button));
      (matching || (visible(originalTrigger) ? originalTrigger : null) || recordsHeading.current)?.focus();
    });
  };
  const { data: timelineData, loading: timelineLoading, error: timelineError } = useOperationalData<LeadTimelineData>('lead-timeline', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
    drill: drill || undefined,
    drillValue: drillValue || undefined,
    segmentVendor: segmentVendor || undefined,
    segmentSource: segmentSource || undefined,
    segmentGrade: segmentGrade || undefined,
    segmentLeadAge: segmentLeadAge || undefined,
    search: appliedSearch || undefined,
    leadId: selectedLead,
  }, ({ leadId, ...scope }, forceRefresh, signal) => fetchLeadTimeline(leadId, scope, forceRefresh, signal), Boolean(selectedLead) && isAdmin);

  const investigation = drill || params.get('investigationMetric') ? investigationLabel(params) : null;
  const { pin, items: pinnedEvidence } = useEvidenceTray();

  const { data, loading, error, loadData, receivedAt } = useOperationalData<RawLeadsData>('lead-explorer', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
    search: appliedSearch || undefined,
    drill: drill || undefined,
    drillValue: drillValue || undefined,
    segmentVendor: segmentVendor || undefined,
    segmentSource: segmentSource || undefined,
    segmentGrade: segmentGrade || undefined,
    segmentLeadAge: segmentLeadAge || undefined,
    limit: pageSize,
    offset: page * pageSize,
  }, fetchRawLeads, isAdmin);

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

  const clearSearch = () => {
    setSearch('');
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete('search');
      return next;
    }, { replace: true });
    setPage(0);
  };

  const handleOpenTimeline = (row: InvestigationLead, trigger: HTMLButtonElement) => {
    if (!data || data.clientId !== selectedClient) return;
    selectionTrigger.current = trigger;
    setTimelineSelection({ row, result: data, scopeKey });
    requestAnimationFrame(() => {
      const dossier = document.getElementById(dossierId);
      dossier?.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 1000px)').matches) dossier?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };

  const isCurrentClientData = Boolean(data && data.clientId === selectedClient);
  const isExportAvailable = Boolean(isCurrentClientData && !loading && !error);
  const [exportReview, setExportReview] = useState<{ scopeKey: string; result: RawLeadsData } | null>(null);
  useEffect(() => { setExportReview(null); }, [scopeKey, page, data, loading, error]);

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

  if (!isAdmin) return <div className="cx-command-page"><div className="cx-command-content"><h1>Record explorer</h1><p role="status">Record access is restricted to authorised administrators. Aggregate investigation evidence remains available in the investigation inbox.</p></div></div>;

  return (
    <div className="cx-command-page">


      <div className="cx-command-content">
        <header className="cx-command-hero">
          <div>
            <span className="cx-command-eyebrow">Investigate</span>
            <h1>Record explorer</h1>
            <p>Follow an affected population from its inclusion reason to lifecycle, outcomes and source evidence.</p>
          </div>
                  <ReportActions />
</header>
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={isExportAvailable ? () => { if (data) setExportReview({ scopeKey, result: data }); } : undefined} />

        <InvestigationContextBar evidenceCount={pinnedEvidence.length} populationCount={data?.totalCount} validationStatus={data?.validationStatus || data?.metadata?.validationStatus} dateBasis={data?.dateBasis || data?.metadata?.dateBasis} countingGrain={data?.countingGrain || data?.metadata?.countingGrain} loading={loading} receivedAt={receivedAt} selectedLead={selectedLead} onClearLead={closeTimeline} />
        {investigation && <DriverAnalysis onPin={item => pin(item, { validationStatus: data?.validationStatus || 'NOT_VERIFIED' })} />}
        {error && <div className="cx-command-error" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
        {exportError && <div className="cx-command-error" role="alert"><AlertTriangle size={17} /><span>{exportError}</span></div>}

        <div className="cx-investigation-record-workspace" data-has-selection={Boolean(selection)}>
        <section ref={recordsPanel} className="cx-command-panel cx-investigation-list-panel">
          <header>
            <div>
              <span className="cx-command-section-kicker">Records</span>
              <h2 ref={recordsHeading} tabIndex={-1}>Affected lead population</h2>
              <p>One representative warehouse row per lead. Inspect evidence alongside this population.</p>
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
            <div className="cx-command-loading" role="status"><div className="cx-command-spinner" />Loading lead population…</div>
          ) : isCurrentClientData && data?.rows.length ? (
            <InvestigationRecordList rows={data.rows} selectedLeadId={selectedLead} investigation={investigation} dossierId={dossierId} observedAt={data.generatedAt || data.metadata?.generatedAt} onSelect={handleOpenTimeline} />
          ) : !loading && isCurrentClientData && data ? (
            <div className="cx-command-empty"><Search size={17} />{data.totalCount != null && data.totalCount > 0 && page > 0 ? <div><p>Page {page + 1} is beyond the available records ({formatTableNumber(data.totalCount)} matching leads in scope).</p><button type="button" className="cx-button-primary" onClick={() => setPage(0)}>Return to page 1</button></div> : <span>No records match this investigation and reporting scope.</span>}</div>
          ) : null}

          <footer className="cx-explorer-pagination">
            <span>Page {page + 1}{isCurrentClientData && data?.totalCount != null ? ` · Total: ${formatTableNumber(data.totalCount)} matching leads` : ''}</span>
            <div>
              <button type="button" className="cx-button-secondary" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft size={14} />Previous</button>
              <button type="button" className="cx-button-secondary" disabled={loading || !data || data.rows.length < pageSize || (data.totalCount != null && shownEnd >= data.totalCount)} onClick={() => setPage(value => value + 1)}>Next<ChevronRight size={14} /></button>
            </div>
          </footer>
        </section>
        {selection && !error && <LeadDossier onPin={item => pin({ ...item, kind: item.type }, { validationStatus: data?.validationStatus || 'NOT_VERIFIED' })} key={scopeKey + selectedLead} id={dossierId} row={selection.row} result={selection.result} investigation={investigation} scopeKey={scopeKey} timeline={timelineData} loading={timelineLoading} error={timelineError} onClose={closeTimeline} segmentVendor={segmentVendor || undefined} />}
        </div>
        <EvidenceConfidence />
        <EvidenceTray />
        <InvestigationAI />
      </div>

      <EvidenceExportPreflight open={Boolean(exportReview && exportReview.scopeKey === scopeKey && exportReview.result === data && isExportAvailable)} onClose={() => setExportReview(null)} onConfirm={handleExportCsv} fields={data ? returnedEvidenceFields(data) : []}>
        <strong>Current returned page · analytical lead evidence CSV</strong>
        <p>Exports {data?.rows.length ?? 0} returned rows with reporting-scope and page audit fields. Pagination limits still apply; this action does not fetch the remaining matching records.</p>
      </EvidenceExportPreflight>

    </div>
  );
}
