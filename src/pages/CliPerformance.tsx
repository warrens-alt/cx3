import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
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
import {
  type CliPerformanceResponse,
  CLI_METRIC_DEFINITIONS,
} from '../../contracts/cliPerformance';
import { exactNumber } from '../../contracts/format';
import { compareExactDecimal } from '../../contracts/exactDecimal';
import {
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  Layers,
  ArrowUpDown,
  Search,
  X,
  Clock,
  Sparkles,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

export default function CliPerformance() {
  const { selectedClient, clientConfig } = useClient();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters, setFilter } = useFilters();
  const currency = clientConfig?.currency || 'ZAR';
  const sampleDataEnabled = isAdmin && import.meta.env.DEV;

  const [data, setData] = useState<CliPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Table filtering and sorting state
  const [searchCli, setSearchCli] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');

  useEffect(() => {
    const activeFilters = extractOffernetFilters(filters);
    if (activeFilters.vendor) {
      setSelectedVendor(activeFilters.vendor);
    } else {
      setSelectedVendor('all');
    }
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

  const loadData = async (forceRefresh = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const activeFilters = extractOffernetFilters(filters);
      const res = await fetchCliPerformance(
        {
          clientId: selectedClient,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          ...activeFilters,
        },
        forceRefresh
      );
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load CLI performance analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedClient, startDate, endDate, filters]);

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
    if (!data) return;
    const url = `/api/analytics/export?grain=cli&clientId=${selectedClient}&startDate=${startDate || ''}&endDate=${endDate || ''}`;
    window.location.href = url;
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
      const vA = parseFloat(a[rankMetric] || '0');
      const vB = parseFloat(b[rankMetric] || '0');
      return vB - vA;
    });
    return list.slice(0, 10).map(r => ({
      cli: r.cli,
      campaign: r.campaign,
      value: parseFloat((r as any)[rankMetric] || '0'),
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
      { stage: 'Total Calls', count: calls, pct: 100, color: '#3562B3' },
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
    <div className="cx-command-page">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />
      <div className="cx-command-content">
      <OperationalPageHeader
        eyebrow="Contact"
        title="CLI performance"
        description="Compare outbound caller-ID delivery, RPC, conversation depth and recorded downstream outcomes without inventing unavailable telephony fields."
        status={isImported ? 'IMPORTED_REPORT' : isSchemaUnavailable ? 'SCHEMA_GAP' : data?.metadata.validationStatus || 'NOT_VERIFIED'}
        statusLabel="CLI source"
        actions={
          <div className="cx-operational-page-actions">
            {data?.anomalies?.length ? (
              <button type="button" onClick={() => setShowAnomalyModal(true)} className="cx-button-secondary">
                <AlertTriangle size={13}/>{data.anomalies.length} quality flag{data.anomalies.length === 1 ? '' : 's'}
              </button>
            ) : null}
            {isAdmin && (
              <button type="button" onClick={() => setShowImportModal(true)} className="cx-button-secondary">
                <Upload size={14}/>Import report
              </button>
            )}
            {data && !isSchemaUnavailable && (
              <button type="button" onClick={handleExportJson} className="cx-button-secondary">JSON</button>
            )}
            {isAdmin && isImported && (
              <button type="button" onClick={handleClearImport} className="cx-button-secondary">Clear import</button>
            )}
          </div>
        }
      />

      {/* 3. Schema Gap Diagnostic Banner (when live table has no CLI column and no imported report exists) */}
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
                was audited. While it contains <strong>{data.sourceStatus.totalColumnsFound || 24} fields</strong> including call timestamps, campaign IDs, agent IDs, durations, and RPC/Sale flags,{' '}
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
                  {import.meta.env.DEV && (
                    <button
                      type="button"
                      onClick={handleLoadSample}
                      disabled={uploading}
                      className="cx-button-primary text-xs py-2 px-4 flex items-center gap-1.5"
                    >
                      <Sparkles size={14} />
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

      {/* 4. Loaded Report Provenance Banner (when imported report is active) */}
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

      {/* 5. Executive KPI Strip (Always calculated using exact SUM / SUM math) */}
      {summary && (
        <section aria-label="Executive CLI Summary" className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers size={14} />
              <span>Core Dialler & Outcome KPIs</span>
            </h2>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={Boolean(comparison) && showPeriodComparison}
                  disabled={!comparison}
                  onChange={e => setShowPeriodComparison(e.target.checked)}
                  className="rounded text-[#3562B3] focus:ring-[#3562B3]"
                />
                <span>Period comparison</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 1. Total Calls */}
            <div className="cx-kpi-card relative">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Total Calls</span>
                <button
                  type="button"
                  onClick={() => setActiveInfoMetric(activeInfoMetric === 'totalCalls' ? null : 'totalCalls')}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Metric details"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="text-xl font-bold text-slate-900 tracking-tight">
                {exactNumber(summary.totalCalls)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                <span>{summary.activeClis} active CLIs</span>
                {showPeriodComparison && comparison?.metrics.calls.pctChange && (
                  <span className={`font-medium ${parseFloat(comparison.metrics.calls.pctChange) >= 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {parseFloat(comparison.metrics.calls.pctChange) >= 0 ? '+' : ''}{comparison.metrics.calls.pctChange}%
                  </span>
                )}
              </div>
            </div>

            {/* 2. Distinct Leads & Calls/Lead */}
            <div className="cx-kpi-card relative">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Leads Dialled</span>
                <button
                  type="button"
                  onClick={() => setActiveInfoMetric(activeInfoMetric === 'distinctLeads' ? null : 'distinctLeads')}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Metric details"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="text-xl font-bold text-slate-900 tracking-tight">
                {exactNumber(summary.distinctLeads)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                <span>{summary.callsPerLead ? `${summary.callsPerLead} calls/lead` : 'Distinct lead count unavailable'}</span>
                <span className="text-slate-400">Dial density</span>
              </div>
            </div>

            {/* 3. ASR Rate (Answer Seizure Ratio) */}
            <div className="cx-kpi-card relative">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Carrier ASR Rate</span>
                <button
                  type="button"
                  onClick={() => setActiveInfoMetric(activeInfoMetric === 'asrRate' ? null : 'asrRate')}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Metric details"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="text-xl font-bold text-slate-900 tracking-tight">
                {summary.asrRate ? `${summary.asrRate}%` : <span className="text-xs text-slate-400 font-normal">Not Provided</span>}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                <span>Carrier seizure</span>
                <span className="text-slate-400">Switch telemetry</span>
              </div>
            </div>

            {/* 4. Answer Rate */}
            <div className="cx-kpi-card relative">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Answer Rate</span>
                <button
                  type="button"
                  onClick={() => setActiveInfoMetric(activeInfoMetric === 'answeredRate' ? null : 'answeredRate')}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Metric details"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="text-xl font-bold text-slate-900 tracking-tight">
                {summary.answeredRate ? `${summary.answeredRate}%` : <span className="text-xs text-slate-400 font-normal">N/A</span>}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                <span>Human + Machine</span>
                <span className="text-slate-400">Talk &gt; 0s</span>
              </div>
            </div>

            {/* 5. Right Party Contact (RPC) */}
            <div className="cx-kpi-card relative bg-[#EDF5FC]/40 border-[#BDD7F4]">
              <div className="flex items-center justify-between text-xs text-[#315EAD] font-medium mb-1">
                <span>RPC / Contact Rate</span>
                <button
                  type="button"
                  onClick={() => setActiveInfoMetric(activeInfoMetric === 'contactRate' ? null : 'contactRate')}
                  className="text-[#3562B3] hover:text-[#254A8C]"
                  aria-label="Metric details"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="text-xl font-bold text-[#1E3A8A] tracking-tight">
                {summary.contactRate}%
              </div>
              <div className="text-[11px] text-slate-600 mt-1 flex items-center justify-between">
                <span>{exactNumber(summary.contactCount)} contacts</span>
                {showPeriodComparison && comparison?.metrics.contactRate.delta && (
                  <span className={`font-semibold ${parseFloat(comparison.metrics.contactRate.delta) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {parseFloat(comparison.metrics.contactRate.delta) >= 0 ? '+' : ''}{comparison.metrics.contactRate.delta} pp
                  </span>
                )}
              </div>
            </div>

            {/* 6. Sale / Call Rate */}
            <div className="cx-kpi-card relative bg-emerald-50/40 border-emerald-200">
              <div className="flex items-center justify-between text-xs text-emerald-800 font-medium mb-1">
                <span>Sale / Call Rate</span>
                <button
                  type="button"
                  onClick={() => setActiveInfoMetric(activeInfoMetric === 'salePerCallRate' ? null : 'salePerCallRate')}
                  className="text-emerald-700 hover:text-emerald-900"
                  aria-label="Metric details"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="text-xl font-bold text-emerald-900 tracking-tight">
                {summary.salePerCallRate}%
              </div>
              <div className="text-[11px] text-emerald-700 mt-1 flex items-center justify-between">
                <span>{exactNumber(summary.saleCount)} sales</span>
                {showPeriodComparison && comparison?.metrics.saleRate.delta && (
                  <span className={`font-semibold ${parseFloat(comparison.metrics.saleRate.delta) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {parseFloat(comparison.metrics.saleRate.delta) >= 0 ? '+' : ''}{comparison.metrics.saleRate.delta} pp
                  </span>
                )}
              </div>
            </div>

            {/* 7. Sale / Contact Rate */}
            <div className="cx-kpi-card relative">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Sale / Contact Rate</span>
                <button
                  type="button"
                  onClick={() => setActiveInfoMetric(activeInfoMetric === 'salePerContactRate' ? null : 'salePerContactRate')}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Metric details"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="text-xl font-bold text-slate-900 tracking-tight">
                {summary.salePerContactRate ? `${summary.salePerContactRate}%` : <span className="text-xs text-slate-400">N/A</span>}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                <span>Pitch-to-close</span>
                <span className="text-slate-400">RPC denominator</span>
              </div>
            </div>

            {/* 8. Conversation >= 5m Share */}
            <div className="cx-kpi-card relative">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Talk &gt;= 5m Share</span>
                <button
                  type="button"
                  onClick={() => setActiveInfoMetric(activeInfoMetric === 'durationGe5mPct' ? null : 'durationGe5mPct')}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Metric details"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="text-xl font-bold text-slate-900 tracking-tight">
                {summary.durationGe5mRate}%
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                <span>Avg: {summary.avgDurationSeconds}s</span>
                <span className="text-slate-400">Engagement</span>
              </div>
            </div>

            {/* 9. Average Lead Age */}
            <div className="cx-kpi-card relative">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Avg Lead Age</span>
                <button
                  type="button"
                  onClick={() => setActiveInfoMetric(activeInfoMetric === 'avgLeadAgeDays' ? null : 'avgLeadAgeDays')}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Metric details"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="text-xl font-bold text-slate-900 tracking-tight">
                {summary.avgLeadAgeDays ? `${summary.avgLeadAgeDays}d` : <span className="text-xs text-slate-400">N/A</span>}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                <span>Capture-to-dial</span>
                <span className="text-slate-400">Latency</span>
              </div>
            </div>

            {/* 10. Commercial Outcomes */}
            <div className="cx-kpi-card relative">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Recorded Value</span>
                <span className="text-[11px] font-mono text-slate-400">{currency}</span>
              </div>
              <div className="text-xl font-bold text-slate-900 tracking-tight">
                {summary.recordedValue ? `${currency} ${exactNumber(summary.recordedValue.split('.')[0])}` : <span className="text-xs text-slate-400">Unmatched</span>}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                <span>{summary.activations ? `${summary.activations} activations` : 'Downstream'}</span>
                <span className="text-slate-400">Ledger</span>
              </div>
            </div>
          </div>

          {/* Metric Details Explanation Drawer */}
          {activeInfoMetric && CLI_METRIC_DEFINITIONS[activeInfoMetric] && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 flex items-start justify-between gap-3 animate-fadeIn">
              <div className="space-y-1">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Info size={13} className="text-[#3562B3]" />
                  <span>{CLI_METRIC_DEFINITIONS[activeInfoMetric].label}</span>
                  <span className="font-mono text-[11px] bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded">
                    Formula: {CLI_METRIC_DEFINITIONS[activeInfoMetric].formula}
                  </span>
                </div>
                <p>
                  <strong>Numerator:</strong> {CLI_METRIC_DEFINITIONS[activeInfoMetric].numerator} &bull;{' '}
                  <strong>Denominator:</strong> {CLI_METRIC_DEFINITIONS[activeInfoMetric].denominator}
                </p>
                <p className="text-slate-500 italic">{CLI_METRIC_DEFINITIONS[activeInfoMetric].note}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveInfoMetric(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close formula details"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Deterministic Period Comparison Observations */}
          {showPeriodComparison && comparison?.observations && comparison.observations.length > 0 && (
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1.5">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Clock size={13} className="text-[#3562B3]" />
                <span>Observed Movement vs Prior Period:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
                {comparison.observations.map((obs, idx) => (
                  <li key={idx}>{obs}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* 6. Visual Analytics Workspace (5 Multi-Dimensional Views) */}
      {data && !isSchemaUnavailable && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart 1: CLI Performance Ranking (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">CLI Performance Ranking</h3>
                <p className="text-xs text-slate-500">Compare top outbound caller-IDs by key operational metric</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">Metric:</span>
                <select
                  value={rankMetric}
                  onChange={e => setRankMetric(e.target.value)}
                  className="text-xs border border-slate-300 rounded px-2 py-1 bg-white font-medium text-slate-700"
                >
                  <option value="totalCalls">Total Calls</option>
                  <option value="contactRate">Right Party Contact (RPC %)</option>
                  <option value="salePerCallRate">Sale / Call Rate (%)</option>
                  <option value="saleCount">Total Sales</option>
                  <option value="durationGe5mPct">Talk &gt;= 5m Share (%)</option>
                  <option value="answeredRate">Answer Rate (%)</option>
                </select>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankingChartData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis type="category" dataKey="cli" tick={{ fontSize: 11, fill: '#334155' }} width={80} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded shadow-lg text-xs space-y-1">
                          <p className="font-semibold text-blue-300">{d.cli}</p>
                          <p className="text-slate-300">{d.campaign}</p>
                          <hr className="border-slate-700 my-1" />
                          <p>Total Calls: <span className="font-bold">{d.calls.toLocaleString()}</span></p>
                          <p>RPC Rate: <span className="font-bold">{d.rpcRate}%</span></p>
                          <p>Sales: <span className="font-bold">{d.sales}</span></p>
                          <p>Selected Metric Value: <span className="font-bold text-amber-400">{d.value}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" fill="#3562B3" radius={[0, 4, 4, 0]}>
                    {rankingChartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#1E3A8A' : index < 3 ? '#2563EB' : '#3B82F6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Telephony Conversion Funnel (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">CLI Dialler Conversion Funnel</h3>
              <p className="text-xs text-slate-500">Observed drop-off from call attempt to commercial activation</p>
            </div>

            <div className="space-y-2 pt-1">
              {funnelData.map((stage, idx) => (
                <div key={stage.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{stage.stage}</span>
                    <span className="font-bold text-slate-900">
                      {stage.count.toLocaleString()}{' '}
                      <span className="font-normal text-slate-500">({stage.pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(3, stage.pct)}%`,
                        backgroundColor: stage.color,
                      }}
                    />
                  </div>
                  {idx < funnelData.length - 1 && (
                    <div className="text-[10px] text-slate-400 text-right pr-1">
                      Conversion: {stage.count > 0 ? ((funnelData[idx + 1].count / stage.count) * 100).toFixed(1) : 0}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Chart 3: Conversation Quality (Duration Bands) (6 cols) */}
          <div className="lg:col-span-6 bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Conversation Quality & Duration Bands</h3>
                <p className="text-xs text-slate-500">Shown only when duration counts are supplied by the source.</p>
              </div>
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Avg: {data.durationBands.avgDurationSeconds ? `${data.durationBands.avgDurationSeconds}s` : 'Unavailable'}
              </span>
            </div>

            {data.durationBands.under1mCount !== null ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  {[
                    ['< 1 minute', data.durationBands.under1mCount, data.durationBands.under1mPct],
                    ['1 – 5 minutes', data.durationBands.oneTo5mCount, data.durationBands.oneTo5mPct],
                    ['5 – 15 minutes', data.durationBands.fiveTo15mCount, data.durationBands.fiveTo15mPct],
                    ['15+ minutes', data.durationBands.over15mCount, data.durationBands.over15mPct],
                  ].map(([label, count, share]) => (
                    <div key={label as string} className="bg-slate-50 p-2.5 rounded border border-slate-200 text-center">
                      <span className="text-[11px] text-slate-500 block">{label}</span>
                      <span className="text-sm font-bold text-slate-800">{exactNumber(count as string | null)}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{share ?? '—'}{share !== null ? '%' : ''}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2">
                  <span>Total recorded talk time: {data.durationBands.totalDurationSeconds ? (parseInt(data.durationBands.totalDurationSeconds, 10) / 3600).toFixed(1) + ' hrs' : 'Unavailable'}</span>
                  <span>Calls ≥5m: {summary?.durationGe5mRate ? `${summary.durationGe5mRate}%` : 'Unavailable'}</span>
                </div>
              </>
            ) : (
              <div className="cx-command-empty">Duration bands are unavailable because the source report did not supply the required duration counts.</div>
            )}
          </div>

          {/* Chart 4: Lead Age evidence (6 cols) */}
          <div className="lg:col-span-6 bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Lead Age at Dial</h3>
                <p className="text-xs text-slate-500">CX3 shows only source-observed latency evidence and does not infer a distribution from aggregate averages.</p>
              </div>
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Avg Age: {data.leadAgeBands.avgLeadAgeDays ? `${data.leadAgeBands.avgLeadAgeDays}d` : 'Unavailable'}
              </span>
            </div>
            {data.leadAgeBands.bands.some(band => Number(band.callCount) > 0) ? (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.leadAgeBands.bands} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="band" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                    <Tooltip />
                    <Bar dataKey="contactRatePct" name="RPC Rate %" fill="#3562B3" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="salePerCallRatePct" name="Sale / Call Rate %" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="cx-command-empty">{data.leadAgeBands.disclaimer}</div>
            )}
          </div>

          {/* Chart 5: Daily Performance Trend (12 cols) */}
          {data.trend && data.trend.length > 0 && (
            <div className="lg:col-span-12 bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">CLI Dialler Trend Timeline</h3>
                  <p className="text-xs text-slate-500">Daily trajectory of volume, contact efficiency, and conversions</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">Trend Focus:</span>
                  <select
                    value={trendMetric}
                    onChange={e => setTrendMetric(e.target.value)}
                    className="text-xs border border-slate-300 rounded px-2 py-1 bg-white font-medium text-slate-700"
                  >
                    <option value="saleRate">Sale / Call Rate (%)</option>
                    <option value="contactRate">Right Party Contact (RPC %)</option>
                    <option value="totalCalls">Daily Call Volume</option>
                    <option value="durationGe5mRate">Talk &gt;= 5m Share (%)</option>
                  </select>
                </div>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="cliTrendColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3562B3" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3562B3" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded shadow-lg text-xs space-y-1">
                            <p className="font-semibold text-blue-300">{d.date}</p>
                            <p>Total Calls: <span className="font-bold">{d.totalCalls.toLocaleString()}</span></p>
                            <p>Contact Rate: <span className="font-bold text-blue-400">{d.contactRate}%</span></p>
                            <p>Sale Rate: <span className="font-bold text-emerald-400">{d.saleRate}%</span></p>
                            <p>Talk &gt;= 5m: <span className="font-bold">{d.durationGe5mRate}%</span></p>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={trendMetric}
                      stroke="#3562B3"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#cliTrendColor)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. Primary Sortable Enterprise Table */}
      {data && !isSchemaUnavailable && (
        <section aria-label="CLI Detail Records" className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden space-y-3 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">CLI Dialler Performance Ledger</h2>
              <p className="text-xs text-slate-500">
                Individual presentation number performance, answer rates, conversation quality and downstream sales.
              </p>
            </div>

            {/* Quick Filters */}
            <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
              {/* CLI Search */}
              <div className="relative flex-1 sm:flex-initial">
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search CLI or Campaign…"
                  value={searchCli}
                  onChange={e => {
                    setSearchCli(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs border border-slate-300 rounded pl-8 pr-7 py-1.5 w-full sm:w-48 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3562B3] min-h-[34px]"
                />
                {searchCli && (
                  <button
                    type="button"
                    onClick={() => setSearchCli('')}
                    className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Campaign Filter */}
              {campaignOptions.length > 1 && (
                <select
                  value={selectedCampaign}
                  onChange={e => {
                    setSelectedCampaign(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50 text-slate-700 min-h-[34px] max-w-full"
                >
                  <option value="all">All Campaigns ({campaignOptions.length})</option>
                  {campaignOptions.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}

              {/* Vendor Filter */}
              {vendorOptions.length > 1 && (
                <select
                  value={selectedVendor}
                  onChange={e => {
                    const v = e.target.value;
                    setSelectedVendor(v);
                    setCurrentPage(1);
                    if (v === 'all' || !v) {
                      setFilter('vendor', null);
                    } else {
                      setFilter('vendor', { operator: 'in', values: [v] });
                    }
                  }}
                  className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50 text-slate-700 min-h-[34px] max-w-full"
                >
                  <option value="all">All Vendors ({vendorOptions.length})</option>
                  {vendorOptions.map(v => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="enterprise-table w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <th
                    scope="col"
                    onClick={() => handleSort('cli')}
                    className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-left font-semibold"
                  >
                    <div className="flex items-center gap-1">
                      <span>CLI Number</span>
                      <ArrowUpDown size={11} className={sortField === 'cli' ? 'text-[#3562B3]' : 'text-slate-300'} />
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('campaign')}
                    className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-left font-semibold"
                  >
                    <div className="flex items-center gap-1">
                      <span>Campaign</span>
                      <ArrowUpDown size={11} className={sortField === 'campaign' ? 'text-[#3562B3]' : 'text-slate-300'} />
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('totalCalls')}
                    className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Calls</span>
                      <ArrowUpDown size={11} className={sortField === 'totalCalls' ? 'text-[#3562B3]' : 'text-slate-300'} />
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('distinctLeads')}
                    className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Dialed Leads</span>
                      <ArrowUpDown size={11} className={sortField === 'distinctLeads' ? 'text-[#3562B3]' : 'text-slate-300'} />
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('asrRate')}
                    className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>ASR %</span>
                      <ArrowUpDown size={11} className={sortField === 'asrRate' ? 'text-[#3562B3]' : 'text-slate-300'} />
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('answeredRate')}
                    className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Answer %</span>
                      <ArrowUpDown size={11} className={sortField === 'answeredRate' ? 'text-[#3562B3]' : 'text-slate-300'} />
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('contactRate')}
                    className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold text-[#315EAD]"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>RPC %</span>
                      <ArrowUpDown size={11} className={sortField === 'contactRate' ? 'text-[#3562B3]' : 'text-slate-300'} />
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('saleCount')}
                    className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold text-emerald-800"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Sales</span>
                      <ArrowUpDown size={11} className={sortField === 'saleCount' ? 'text-[#3562B3]' : 'text-slate-300'} />
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('salePerCallRate')}
                    className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold text-emerald-800"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Sale/Call %</span>
                      <ArrowUpDown size={11} className={sortField === 'salePerCallRate' ? 'text-[#3562B3]' : 'text-slate-300'} />
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('salePerContactRate')}
                    className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Sale/RPC %</span>
                      <ArrowUpDown size={11} className={sortField === 'salePerContactRate' ? 'text-[#3562B3]' : 'text-slate-300'} />
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('durationGe5mPct')}
                    className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>&gt;= 5m %</span>
                      <ArrowUpDown size={11} className={sortField === 'durationGe5mPct' ? 'text-[#3562B3]' : 'text-slate-300'} />
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('avgDurationSeconds')}
                    className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Avg Sec</span>
                      <ArrowUpDown size={11} className={sortField === 'avgDurationSeconds' ? 'text-[#3562B3]' : 'text-slate-300'} />
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('avgLeadAgeDays')}
                    className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Lead Age</span>
                      <ArrowUpDown size={11} className={sortField === 'avgLeadAgeDays' ? 'text-[#3562B3]' : 'text-slate-300'} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRecords.map(r => (
                  <tr key={r.cli} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 font-mono font-medium text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{r.cli}</span>
                        {r.hasAnomalies && (
                          <span
                            title={r.anomalies.join('; ')}
                            className="bg-amber-100 text-amber-800 text-[10px] px-1 rounded font-sans cursor-help"
                          >
                            Flag
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-[160px] truncate" title={r.campaign}>
                      {r.campaign}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-800">
                      {exactNumber(r.totalCalls)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                      {exactNumber(r.distinctLeads)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                      {r.asrRate ? `${r.asrRate}%` : <span className="text-slate-400">N/A</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                      {r.answeredRate ? `${r.answeredRate}%` : <span className="text-slate-400">N/A</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#315EAD]">
                      {r.contactRate}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-800">
                      {exactNumber(r.saleCount)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-800">
                      {r.salePerCallRate}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                      {r.salePerContactRate ? `${r.salePerContactRate}%` : <span className="text-slate-400">N/A</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                      {r.durationGe5mPct}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                      {r.avgDurationSeconds}s
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                      {r.avgLeadAgeDays ? `${r.avgLeadAgeDays}d` : <span className="text-slate-400">N/A</span>}
                    </td>
                  </tr>
                ))}

                {!paginatedRecords.length && (
                  <tr>
                    <td colSpan={13} className="text-center py-8 text-slate-400 text-xs">
                      No CLI records match the current filter selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredRecords.length > 0 && (
            <div className="flex items-center justify-between pt-3 text-xs text-slate-500 border-t border-slate-100 flex-wrap gap-2">
              <div>
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length} CLIs
              </div>
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border border-slate-200 rounded px-1.5 py-1 text-xs"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="cx-button-secondary text-xs py-1 px-2.5 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="px-2 font-mono">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="cx-button-secondary text-xs py-1 px-2.5 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 8. Modal: Import / Benchmark Data Modal */}
      {showImportModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Upload size={18} className="text-[#3562B3]" />
                <span>Import VICIdial CLI Report</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Upload a VICIdial CLI performance export (.csv). Imported data is tenant-scoped and remains explicitly tagged as an imported report.
            </p>

            {uploadError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded text-xs">
                {uploadError}
              </div>
            )}

            {uploadSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded text-xs flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {/* Option A: Upload File */}
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-5 text-center hover:border-[#3562B3] transition-colors space-y-2">
              <FileSpreadsheet size={32} className="mx-auto text-slate-400" />
              <div>
                <label className="cx-button-primary text-xs py-1.5 px-3 cursor-pointer inline-block">
                  <span>Browse CSV File</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
              <p className="text-[11px] text-slate-500">
                Required columns: <code className="text-slate-700 font-semibold">cli_number, total_calls, contact_count, sale_count</code>.<br />
                Optional: <code className="text-slate-700">report_date, campaign_code, vendor, distinct_leads, asr_count, answered_count, duration_ge_1m_count, duration_ge_5m_count, duration_ge_15m_count, avg_duration_sec, avg_lead_age_days</code>.
              </p>
            </div>

            {import.meta.env.DEV && (
              <>
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400 uppercase">Development only</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <strong className="text-xs font-semibold text-slate-900 block">Synthetic benchmark dataset</strong>
                    <p className="text-[11px] text-slate-500 mt-0.5">Available only in development. Never used as live production evidence.</p>
                  </div>
                  <button type="button" onClick={handleLoadSample} disabled={uploading} className="cx-button-secondary text-xs py-1.5 px-3 whitespace-nowrap shrink-0 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-[#3562B3]" />
                    <span>Load sample</span>
                  </button>
                </div>
              </>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="cx-button-secondary text-xs py-1.5 px-4"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal: Data Quality Anomalies Details */}
      {showAnomalyModal && data?.anomalies && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-600" />
                <span>Data Quality &amp; Validation Anomalies</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAnomalyModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              The mathematical validation engine flagged the following integrity issues during schema and count derivation:
            </p>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs space-y-2">
              {data.anomalies.map((anom, i) => (
                <div key={i} className="pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 font-mono">{anom.cli}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        anom.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800'
                          : anom.severity === 'WARNING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {anom.severity}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-1">{anom.message}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAnomalyModal(false)}
                className="cx-button-primary text-xs py-1.5 px-4"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
