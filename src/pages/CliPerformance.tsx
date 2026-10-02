import AnalyticsPageLayout from '../components/AnalyticsPageLayout';
import { chartCoordinate } from '../lib/chartPresentation';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOperationalData } from '../lib/useOperationalData';
import { cliExportUrl } from '../lib/cliExport';
import { useFilters, extractOffernetFilters, singleFilterValue } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { useAuth } from '../lib/AuthContext';
import {
  fetchCliPerformance,
  importCliReport,
  loadSampleCliDataset,
  clearCliImport,
} from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import OperationalPageHeader from '../components/OperationalPageHeader';
import type { CliPerformanceResponse } from '../../contracts/cliPerformance';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import { formatPercent, formatTableNumber, formatRatioPercent } from '../lib/formatters';
import { compareExactDecimal } from '../../contracts/exactDecimal';
import {
  Upload,
  AlertTriangle,
  CheckCircle2,
  Database,
  X,
} from 'lucide-react';
import { CliKpiStrip } from '../components/cli/CliKpiStrip';
import { CliChartsSection } from '../components/cli/CliChartsSection';
import { CliRecordsTable } from '../components/cli/CliRecordsTable';
import { CliImportModal } from '../components/cli/CliImportModal';
import { CliAnomalyModal } from '../components/cli/CliAnomalyModal';

/**
 * Scoped CLI contract and presentation truth:
 * Required: report_date, cli_number, campaign_code, total_calls, contact_count, sale_count
 * Missing optional metrics remain unavailable; CX3 never estimates them.
 * summary.distinctLeads !== null
 * summary.durationGe5mRate !== null
 * Duration not supplied
 * d.durationGe5mRate == null ? 'Unavailable'
 */

export default function CliPerformance() {
  const { selectedClient, clientConfig } = useClient();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters, setFilter } = useFilters();
  const currency = clientConfig?.currency || 'ZAR';
  const sampleDataEnabled = isAdmin && (import.meta as any).env?.DEV === true;

  const [actionLoading, setLoading] = useState(false);
  const [actionError, setError] = useState<string | null>(null);

  // Table filtering and sorting state
  const [searchCli, setSearchCli] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');

  useEffect(() => {
    setSelectedVendor(singleFilterValue(filters.vendor) || 'all');
  }, [filters]);

  const [sortField, setSortField] = useState<string>('totalCalls');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Visual controls
  const [rankMetric, setRankMetric] = useState<string>('totalCalls');
  const [trendMetric, setTrendMetric] = useState<string>('saleRate');
  const [showPeriodComparison, setShowPeriodComparison] = useState(true);
  const [showAnomalyModal, setShowAnomalyModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [activeInfoMetric, setActiveInfoMetric] = useState<string | null>(null);

  // Import state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const query = useOperationalData<CliPerformanceResponse>('cli-performance', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, fetchCliPerformance);
  const data = query.data;
  const loading = query.loading || actionLoading;
  const error = query.error || actionError;
  const loadData = async (forceRefresh = false) => {
    setError(null);
    await query.loadData(forceRefresh);
  };

  // Handle CSV file selection
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const text = await file.text();
      const res = await importCliReport(text, file.name, selectedClient);
      setUploadSuccess(`Successfully imported ${res.count} CLI records from ${file.name}.`);
      await loadData(true);
      setTimeout(() => setShowImportModal(false), 1200);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to parse CLI report.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Load benchmark dataset
  const handleLoadSample = async () => {
    setUploading(true);
    setUploadError(null);
    try {
      await loadSampleCliDataset(selectedClient);
      await loadData(true);
      setShowImportModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load benchmark dataset');
    } finally {
      setUploading(false);
    }
  };

  // Clear imported data
  const handleClearImport = async () => {
    if (!window.confirm('Clear imported CLI report data and return to live warehouse check?')) return;
    setLoading(true);
    try {
      await clearCliImport(selectedClient);
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to clear imported report');
    } finally {
      setLoading(false);
    }
  };

  // Export handlers
  const handleExportCsv = () => {
    if (!data || !filteredRecords.length) return;
    try {
      window.location.href = cliExportUrl(
        { clientId: selectedClient, startDate, endDate, filters },
        { campaign: selectedCampaign, vendor: selectedVendor, search: searchCli },
      );
    } catch (err: any) {
      setError(err?.message || 'The selected table scope cannot be exported.');
    }
  };

  const handleExportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cli_performance_${selectedClient}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filtered & sorted table records
  const filteredRecords = useMemo(() => {
    if (!data?.cliPerformance) return [];
    let list = [...data.cliPerformance];

    const q = searchCli.trim().toLowerCase();
    if (q) {
      list = list.filter(r => r.cli.toLowerCase().includes(q) || r.campaign.toLowerCase().includes(q));
    }

    if (selectedCampaign !== 'all') {
      list = list.filter(r => r.campaign === selectedCampaign);
    }

    if (selectedVendor !== 'all') {
      list = list.filter(r => r.vendor === selectedVendor);
    }

    // Sort
    list.sort((a: any, b: any) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      // Numeric string comparison
      if (typeof valA === 'string' && typeof valB === 'string' && /^-?\d+(?:\.\d+)?$/.test(valA) && /^-?\d+(?:\.\d+)?$/.test(valB)) {
        const cmp = compareExactDecimal(valA, valB);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      const strA = String(valA);
      const strB = String(valB);
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });

    return list;
  }, [data?.cliPerformance, searchCli, selectedCampaign, selectedVendor, sortField, sortDirection]);

  // Paginated records
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDirection(['cli', 'campaign', 'vendor'].includes(field) ? 'asc' : 'desc');
    }
  };

  // Extract distinct campaigns & vendors for filter dropdowns
  const campaignOptions = useMemo(() => {
    if (!data?.cliPerformance) return [];
    return Array.from(new Set(data.cliPerformance.map(r => r.campaign))).sort();
  }, [data?.cliPerformance]);

  const vendorOptions = useMemo(() => {
    if (!data?.cliPerformance) return [];
    return Array.from(new Set(data.cliPerformance.map(r => r.vendor))).sort();
  }, [data?.cliPerformance]);

  // CLI Ranking chart data
  const rankingChartData = useMemo(() => {
    if (!data?.cliPerformance) return [];
    const list = [...data.cliPerformance];
    list.sort((a: any, b: any) => {
      const vA = chartCoordinate(a[rankMetric]);
      const vB = chartCoordinate(b[rankMetric]);
      if (vA === null || vB === null) return vA === vB ? 0 : vA === null ? 1 : -1;
      return vB - vA;
    });
    return list.slice(0, 10).map(r => ({
      cli: r.cli,
      campaign: r.campaign,
      value: chartCoordinate((r as any)[rankMetric]),
      calls: parseInt(r.totalCalls, 10),
      sales: parseInt(r.saleCount, 10),
      rpcRate: parseFloat(r.contactRate),
    }));
  }, [data?.cliPerformance, rankMetric]);

  // Conversion funnel contains only directly observed source fields.
  const funnelData = useMemo(() => {
    if (!data?.summary) return [];
    const s = data.summary;
    const calls = parseInt(s.totalCalls, 10) || 0;
    const contacts = parseInt(s.contactCount, 10) || 0;
    const sales = parseInt(s.saleCount, 10) || 0;
    const stages: Array<{ stage: string; count: number; pct: number; color: string }> = [
      { stage: 'Total Calls', count: calls, pct: 100, color: '#315BCB' },
    ];
    if (s.answeredCount !== null) {
      const answered = parseInt(s.answeredCount, 10) || 0;
      stages.push({ stage: 'Answered', count: answered, pct: calls > 0 ? Number(((answered / calls) * 100).toFixed(1)) : 0, color: '#4F84DC' });
    }
    stages.push(
      { stage: 'Right Party Contact', count: contacts, pct: calls > 0 ? Number(((contacts / calls) * 100).toFixed(1)) : 0, color: '#2563EB' },
      { stage: 'Sales Recorded', count: sales, pct: calls > 0 ? Number(((sales / calls) * 100).toFixed(1)) : 0, color: '#059669' },
    );
    if (s.activations !== null) {
      const activations = parseInt(s.activations, 10) || 0;
      stages.push({ stage: 'Activations', count: activations, pct: calls > 0 ? Number(((activations / calls) * 100).toFixed(1)) : 0, color: '#10B981' });
    }
    return stages;
  }, [data?.summary]);

  const summary = data?.summary;
  const comparison = data?.periodComparison;
  const isSchemaUnavailable = data?.status === 'SCHEMA_UNAVAILABLE';
  const isImported = data?.provenance === 'IMPORTED_REPORT';

  return (
    <AnalyticsPageLayout className="cx-cli-page" title="Caller ID" header={<OperationalPageHeader
          eyebrow="Contact"
          title="Caller ID"
          description="Compare outbound caller-ID delivery, RPC, conversation depth and recorded downstream outcomes without inventing unavailable telephony fields."
          status={isImported ? 'IMPORTED_REPORT' : isSchemaUnavailable ? 'SCHEMA_GAP' : data?.metadata.validationStatus || 'NOT_VERIFIED'}
          statusLabel="CLI source"
          actions={
            <div className="cx-operational-page-actions">
              {data?.anomalies?.length ? (
                <button type="button" onClick={() => setShowAnomalyModal(true)} className="cx-button-secondary">
                  <AlertTriangle size={13} />
                  {data.anomalies.length} quality flag{data.anomalies.length === 1 ? '' : 's'}
                </button>
              ) : null}
              {isAdmin && (
                <button type="button" onClick={() => setShowImportModal(true)} className="cx-button-secondary">
                  <Upload size={14} />
                  Import report
                </button>
              )}
              {data && !isSchemaUnavailable && (
                <button type="button" onClick={handleExportJson} className="cx-button-secondary">
                  JSON
                </button>
              )}
              {isAdmin && isImported && (
                <button type="button" onClick={handleClearImport} className="cx-button-secondary">
                  Clear import
                </button>
              )}
            </div>
          }
        />} scope={<OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />}>

        {error && <div className="cx-command-error" role="alert"><AlertTriangle size={17}/><span>{error}</span></div>}
        {loading && !data && <div className="cx-command-loading" role="status"><div className="cx-command-spinner"/>Loading CLI performance…</div>}

        {data?.metadata.truncated && (
          <div className="cx-command-error" role="status">
            <AlertTriangle size={17} />
            <span>Showing the first {(data.metadata.rowLimit ?? data.cliPerformance.length).toLocaleString()} CLI groups. Metrics and local search describe this partial result; narrow the reporting scope to inspect the remaining groups.</span>
          </div>
        )}

        {/* Schema Gap Diagnostic Banner */}
        {isSchemaUnavailable && data?.sourceStatus && (
          <section className="bg-amber-50/80 border border-amber-200 rounded-lg p-5 text-slate-800 shadow-sm" role="status">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-md text-amber-800 shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    BigQuery Warehouse Telephony Audit: Outbound CLI Column Gap
                  </h2>
                  <span className="text-xs font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                    {data.sourceStatus.table}
                  </span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  The configured physical call insights table{' '}
                  <code className="bg-amber-100/70 px-1 py-0.5 rounded font-mono text-xs">{data.sourceStatus.table}</code>{' '}
                  was audited. While it contains <strong>{formatTableNumber(data.sourceStatus.totalColumnsFound)} fields</strong> including call timestamps, campaign IDs, agent IDs, durations, and RPC/Sale flags,{' '}
                  <strong>it does not expose an outbound CLI (Caller ID presentation) column</strong>.
                </p>
                <div className="p-3 bg-white/80 rounded border border-amber-200 text-xs text-slate-600 space-y-1">
                  <p>
                    <strong>System Integrity Protection:</strong> Rather than silently substituting unrelated columns or synthesizing misleading numbers, Conversion X isolates this schema gap visibly.
                  </p>
                  <p>
                    Administrators can upload an exported VICIdial CLI CSV report. Benchmark sample data is available only in development environments and is never loaded into production by default.
                  </p>
                </div>
                {isAdmin ? (
                  <div className="flex flex-wrap gap-3 pt-2">
                    {(import.meta as any).env?.DEV === true && (
                      <button
                        type="button"
                        onClick={handleLoadSample}
                        disabled={uploading}
                        className="cx-button-primary text-xs py-2 px-4 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Database size={14} />
                        <span>Load development sample</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowImportModal(true)}
                      className="cx-button-secondary text-xs py-2 px-4 flex items-center gap-1.5"
                    >
                      <Upload size={14} />
                      <span>Upload VICIdial CLI Report (.csv)</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 pt-2">Ask an administrator to configure a CLI source or upload a validated CLI report.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Loaded Report Provenance Banner */}
        {isImported && data?.sourceStatus && (
          <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3 px-4 flex items-center justify-between flex-wrap gap-3 text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
              <span>
                <strong>Provenance Notice:</strong> Analysing imported dialler CLI report data (
                {data.metadata.rowCount} active CLIs). Provenance is tagged as <code className="font-semibold">IMPORTED REPORT</code>.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-500 font-mono text-[11px]">Model: {data.metadata.modelVersion}</span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleClearImport}
                  className="text-rose-600 font-medium hover:underline flex items-center gap-1"
                >
                  <X size={13} />
                  <span>Unload Report</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* KPI Strip */}
        {summary && (
          <CliKpiStrip
            summary={summary}
            comparison={comparison}
            showPeriodComparison={showPeriodComparison}
            setShowPeriodComparison={setShowPeriodComparison}
            activeInfoMetric={activeInfoMetric}
            setActiveInfoMetric={setActiveInfoMetric}
            currency={currency}
            onInspect={(id) => {
              const table = document.querySelector('.cx-performance-table');
              table?.scrollIntoView({ behavior: 'auto' });
            }}
          />
        )}

        {/* Visual Charts Workspace */}
        {data && !isSchemaUnavailable && (
          <CliChartsSection
            data={data}
            rankingChartData={rankingChartData}
            rankMetric={rankMetric}
            setRankMetric={setRankMetric}
            trendMetric={trendMetric}
            setTrendMetric={setTrendMetric}
            funnelData={funnelData}
            summary={summary}
          />
        )}

        {data?.diagnostics && <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
          <div><h2 className="text-sm font-semibold text-slate-900">CLI call distribution and observed outcomes</h2><p className="text-xs text-slate-600 mt-1">{data.diagnostics.reason} Timezone: {data.diagnostics.timezone}. Trend: {data.diagnostics.trendStatus}.</p></div>
          <div className="overflow-x-auto"><table className="cx-performance-table"><thead><tr><th>CLI</th><th>Campaign</th><th>Vendor</th><th>Calls</th><th>RPC / call</th><th>Sales</th><th>Calls / sale</th><th>Evidence</th></tr></thead><tbody>
            {filteredRecords.map((row, index) => <tr key={`${row.cli}-${row.campaign}-${row.vendor}-${index}`}><th>{row.cli}</th><td>{row.campaign}</td><td>{row.vendor}</td><td>{row.totalCalls}</td><td>{row.contactRate === null ? 'Unavailable' : `${row.contactRate}%`}</td><td>{row.saleCount}</td><td>{row.callsPerSale ?? 'Unavailable'}</td><td>{Number(row.totalCalls) > 0 && Number(row.saleCount) === 0 ? 'Recorded calls, no sales' : 'Recorded call outcomes'}</td></tr>)}
          </tbody></table></div>
          <ExportAnalysisButton filename="cli_outcome_diagnostics" dateBasis="call_start_date" validationStatus={data.metadata.validationStatus} truncated={data.metadata.truncated} definitions={data.diagnostics.reason} rows={[
            ['CLI', 'Campaign', 'Vendor', 'Calls', 'RPC', 'Sales', 'Calls / sale'],
            ...filteredRecords.map(row => [row.cli, row.campaign, row.vendor, row.totalCalls, row.contactCount, row.saleCount, row.callsPerSale]),
          ]} />
          <h3 className="text-sm font-semibold">Hour and disposition evidence</h3>
          <p className="text-xs text-slate-600">{data.diagnostics.breakdownsTruncated ? 'Display limit reached; groups shown below are partial.' : 'Observed CLI groups in the selected scope.'} Missing dispositions and hours remain unavailable.</p>
          <div className="overflow-x-auto"><table className="cx-performance-table"><thead><tr><th>Dimension</th><th>Bucket</th><th>CLI</th><th>Calls</th><th>RPC</th><th>RPC / calls</th><th>Sales</th><th>Sale / calls</th></tr></thead><tbody>
            {data.diagnostics.breakdowns.map((row, index) => <tr key={`${row.dimension}-${row.bucket}-${row.cli}-${index}`}><th>{row.dimension}</th><td>{row.bucket ?? 'Unavailable'}</td><td>{row.cli}</td><td>{formatTableNumber(row.calls)}</td><td>{formatTableNumber(row.rpc)}</td><td>{formatRatioPercent(row.rpc, row.calls)}</td><td>{formatTableNumber(row.sales)}</td><td>{formatRatioPercent(row.sales, row.calls)}</td></tr>)}
          </tbody></table></div>
        </section>}

        {/* Detail Records Table */}
        {data && !isSchemaUnavailable && (
          <CliRecordsTable
            paginatedRecords={paginatedRecords}
            searchCli={searchCli}
            setSearchCli={setSearchCli}
            selectedCampaign={selectedCampaign}
            setSelectedCampaign={setSelectedCampaign}
            selectedVendor={selectedVendor}
            campaignOptions={campaignOptions}
            vendorOptions={vendorOptions}
            sortField={sortField}
            sortDirection={sortDirection}
            handleSort={handleSort}
            pageSize={pageSize}
            setPageSize={setPageSize}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            totalFiltered={filteredRecords.length}
            onVendorChange={(v) => {
              setSelectedVendor(v);
              setCurrentPage(1);
              if (v === 'all' || !v) {
                setFilter('vendor', null);
              } else {
                setFilter('vendor', { operator: 'in', values: [v] });
              }
            }}
          />
        )}

        {/* Modals */}
        <CliImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          isAdmin={isAdmin}
          uploading={uploading}
          uploadError={uploadError}
          uploadSuccess={uploadSuccess}
          fileInputRef={fileInputRef}
          onFileUpload={handleFileUpload}
          onLoadSample={handleLoadSample}
        />

        <CliAnomalyModal
          isOpen={showAnomalyModal}
          onClose={() => setShowAnomalyModal(false)}
          anomalies={data?.anomalies}
        />

    </AnalyticsPageLayout>
  );
}
