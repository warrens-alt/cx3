import AnalyticsPageLayout from '../../components/AnalyticsPageLayout';
import InvestigationEvidenceWorkspace from '../../features/investigation/InvestigationEvidenceWorkspace';
import InvestigationWorkflow from '../../features/investigation/InvestigationWorkflow';
import InvestigationCaseRail from '../investigation/InvestigationCaseRail';
import { useInvestigationAnalysis } from '../../features/investigation/useInvestigationAnalysis';
import DriverAnalysis from '../../features/investigation/DriverAnalysis';
import EvidenceConfidence from '../../features/investigation/EvidenceConfidence';
import { useEvidenceTray } from '../../features/investigation/EvidenceTray';
import InvestigationAI from '../../features/investigation/InvestigationAI';
import { investigationLabel } from '../../features/investigation/investigationModel';
import { ReportActions } from '../../shared/reporting/ReportPresentation';
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { useFilters, extractOffernetFilters } from '../../lib/FilterContext';
import { useAuth } from '../../lib/AuthContext';
import { useClient } from '../../lib/ClientContext';
import { fetchRawLeads, type RawLeadsData } from '../../lib/offernetClient';
import { OffernetFilterBar } from '../../components/OffernetFilterBar';
import { formatTableNumber } from '../../lib/formatters';
import { buildLeadEvidenceExport } from '../../lib/analysisExport';
import { downloadCsv } from '../../lib/formatters';
import { useOperationalData } from '../../lib/useOperationalData';
import InvestigationRecordList, { type InvestigationLead } from '../../features/investigation/InvestigationRecordList';
import type { LeadEvidenceSelection } from './leadEvidenceSelection';
import type { InvestigationRecordPreset } from '../investigation/InvestigationRecordList';
import './leadEvidence.css';
import EvidenceExportPreflight, { returnedEvidenceFields } from '../../features/leadLedger/EvidenceExportPreflight';

export default function LeadPopulationBrowser({ navigation, selection, onSelect, onClose, dossier, dossierId, scopeKey, focusLeadId, onClearFocus, onPopulationResolved }: {
  navigation: React.ReactNode; selection: LeadEvidenceSelection | null;
  onSelect: (row: InvestigationLead, result: RawLeadsData, trigger: HTMLButtonElement) => void;
  onClose: () => void; dossier: React.ReactNode; dossierId: string; scopeKey: string; focusLeadId?: string; onClearFocus: () => void;
  onPopulationResolved: (data: RawLeadsData) => void;
}) {
  const { isAdmin } = useAuth();
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [params, setParams] = useSearchParams();
  const analysis = useInvestigationAnalysis();
  const drill = params.get('drill') || '';
  const drillValue = params.get('drillValue') || '';
  const appliedSearch = params.get('search') || '';
  const [search, setSearch] = useState(appliedSearch);
  const [exportError, setExportError] = useState<string | null>(null);
  const segmentVendor = params.get('segmentVendor') || '';
  const segmentSource = params.get('segmentSource') || '';
  const segmentGrade = params.get('segmentGrade') || '';
  const segmentLeadAge = params.get('segmentLeadAge') || '';
  const [pageSize, setPageSize] = useState(50);
  const populationKey = JSON.stringify([scopeKey, pageSize, focusLeadId]);
  const [pagination, setPagination] = useState({ scopeKey: populationKey, page: 0 });
  const page = pagination.scopeKey === populationKey ? pagination.page : 0;
  const setPage = (value: number | ((previous: number) => number)) => {
    setPagination(previous => ({
      scopeKey: populationKey,
      page: typeof value === 'function' ? value(previous.scopeKey === populationKey ? previous.page : 0) : value,
    }));
  };
  const selectedLead = selection?.row ? String(selection.row.lead_id) : null;
  const recordsPanel = useRef<HTMLElement>(null);
  const recordsHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { setPagination({ scopeKey: populationKey, page: 0 }); }, [populationKey]);
  const supportedPresets: InvestigationRecordPreset[] = ['investigation', 'journey', 'contact', 'outcomes', 'full'];
  const preset = supportedPresets.includes(params.get('preset') as InvestigationRecordPreset) ? params.get('preset') as InvestigationRecordPreset : 'investigation';
  const changePreset = (value: InvestigationRecordPreset) => setParams(previous => { const next = new URLSearchParams(previous); next.set('preset', value); return next; });
  const investigation = drill || params.get('investigationMetric') ? investigationLabel(params) : null;
  const { pin, items: pinnedEvidence } = useEvidenceTray();

  const { data, loading, error, loadData, receivedAt } = useOperationalData<RawLeadsData>('lead-explorer', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(focusLeadId && !filters.lead_id ? { ...filters, lead_id: { operator: 'equals', value: focusLeadId } } : filters),
    search: appliedSearch || focusLeadId || undefined,
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
    if (!data || data.clientId !== selectedClient || loading || error) return;
    onSelect(row, data, trigger);
  };

  const isCurrentClientData = Boolean(data && data.clientId === selectedClient);
  useEffect(() => { if (data && isCurrentClientData && !loading && !error) onPopulationResolved(data); }, [data, isCurrentClientData, loading, error, onPopulationResolved]);
  useEffect(() => {
    if (selection?.row && data && isCurrentClientData && !loading && !error && !data.rows.some(row => String(row.lead_id) === selectedLead)) onClose();
  }, [data, isCurrentClientData, loading, error, selectedLead, selection?.row, onClose]);
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

  if (!isAdmin) return <AnalyticsPageLayout title="Lead Evidence"><p role="status">Record access is restricted to authorised administrators. Aggregate investigation evidence remains available in the investigation inbox.</p></AnalyticsPageLayout>;

  return (
    <AnalyticsPageLayout title="Lead Evidence" description="Follow a lead from population membership to journey, outcomes, audit and original source records."
      status={navigation} actions={<ReportActions />}
      scope={<OffernetFilterBar onRefresh={() => { analysis.refresh(); return loadData(true); }} />}>
        <InvestigationWorkflow analysis={analysis.summary} recordsLoaded={isCurrentClientData && !error} requestError={error} evidenceCount={pinnedEvidence.length} populationCount={data?.totalCount} validationStatus={data?.validationStatus || data?.metadata?.validationStatus} dateBasis={data?.dateBasis || data?.metadata?.dateBasis} countingGrain={data?.countingGrain || data?.metadata?.countingGrain} loading={loading} receivedAt={receivedAt} selectedLead={selectedLead} onClearLead={onClose} />
        {focusLeadId && <p className="cx-lead-evidence-boundary" role="status">Focused analytical lead: {focusLeadId}, within the selected reporting/investigation scope. This focus is session-local. <button type="button" className="cx-button-secondary" onClick={onClearFocus}>Clear analytical focus</button></p>}
        <InvestigationEvidenceWorkspace confidence={<EvidenceConfidence />} signals={<InvestigationCaseRail populationCount={error ? undefined : data?.totalCount} validationStatus={data?.validationStatus || data?.metadata?.validationStatus} />}>
        {investigation && <DriverAnalysis summaryScopeKey={analysis.scopeKey} refreshToken={analysis.refreshToken} onSummary={analysis.onSummary} onPin={item => pin(item, { validationStatus: data?.validationStatus || 'NOT_VERIFIED' })} />}
        {error && <div className="cx-command-error" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
        {exportError && <div className="cx-command-error" role="alert"><AlertTriangle size={17} /><span>{exportError}</span></div>}

        <div className="cx-investigation-record-workspace cx-lead-evidence-master-detail" data-has-selection={Boolean(selection)}>
        <section id="investigation-records" tabIndex={-1} ref={recordsPanel} className="cx-command-panel cx-investigation-list-panel">
          <header>
            <div>
              <span className="cx-command-section-kicker">Records</span>
              <h2 ref={recordsHeading} tabIndex={-1}>Affected lead population</h2>
              <p>One normalized analytical lead representation per row. Source records remain a separate evidence grain.</p>
            </div>
            <span className="cx-explorer-count">{shownStart}–{shownEnd}{totalCountText}</span>
          </header>

          <button type="button" className="cx-button-secondary cx-analytical-export" disabled={!isExportAvailable} onClick={() => { if (data) setExportReview({ scopeKey, result: data }); }}>Export current analytical page</button>
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
            <InvestigationRecordList rows={data.rows} selectedLeadId={selectedLead} investigation={investigation} dossierId={dossierId} observedAt={data.generatedAt || data.metadata?.generatedAt} onSelect={handleOpenTimeline} preset={preset} onPresetChange={changePreset} />
          ) : !loading && isCurrentClientData && data ? (
            <div className="cx-command-empty"><Search size={17} />{data.totalCount != null && data.totalCount > 0 && page > 0 ? <div><p>Page {page + 1} is beyond the available records ({formatTableNumber(data.totalCount)} matching leads in scope).</p><button type="button" className="cx-button-primary" onClick={() => setPage(0)}>Return to page 1</button></div> : <span>No leads match the selected reporting/investigation scope.</span>}</div>
          ) : null}

          <footer className="cx-explorer-pagination">
            <label>Leads per page <select aria-label="Analytical leads per page" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{[25, 50, 100].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <span>Page {page + 1}{isCurrentClientData && data?.totalCount != null ? ` · Total: ${formatTableNumber(data.totalCount)} matching leads` : ''}</span>
            <div>
              <button type="button" className="cx-button-secondary" disabled={page === 0 || loading} onClick={() => setPage(0)}>First</button>
              <button type="button" className="cx-button-secondary" disabled={page === 0 || loading} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft size={14} />Previous</button>
              <button type="button" className="cx-button-secondary" disabled={loading || !data || data.rows.length < pageSize || (data.totalCount != null && shownEnd >= data.totalCount)} onClick={() => setPage(value => value + 1)}>Next<ChevronRight size={14} /></button>
              <button type="button" className="cx-button-secondary" disabled={loading || data?.totalCount == null || shownEnd >= data.totalCount} onClick={() => setPage(Math.max(0, Math.ceil((data?.totalCount || 0) / pageSize) - 1))}>Last</button>
            </div>
          </footer>
        </section>
        {!error && dossier}
        </div>
        <InvestigationAI />
        </InvestigationEvidenceWorkspace>

      <EvidenceExportPreflight open={Boolean(exportReview && exportReview.scopeKey === scopeKey && exportReview.result === data && isExportAvailable)} onClose={() => setExportReview(null)} onConfirm={handleExportCsv} fields={data ? returnedEvidenceFields(data) : []}>
        <strong>Current returned page · analytical lead evidence CSV</strong>
        <p>Exports {data?.rows.length ?? 0} returned rows with reporting-scope and page audit fields. Pagination limits still apply; this action does not fetch the remaining matching records.</p>
      </EvidenceExportPreflight>

    </AnalyticsPageLayout>
  );
}
