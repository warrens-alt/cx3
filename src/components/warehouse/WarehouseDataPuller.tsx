import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Play,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Copy,
  Check,
  HardDrive,
  Cpu,
} from 'lucide-react';
import {
  fetchWarehouseProjectsAndTables,
  pullWarehouseTableData,
  fetchSyncedCloudSqlRecords,
  type WarehouseProjectInfo,
  type PulledTableDataResult,
  type CloudSqlSyncedRecord,
} from '../../lib/warehousePullClient';

interface WarehouseDataPullerProps {
  initialProject?: string;
  initialDataset?: string;
  initialTable?: string;
}

export default function WarehouseDataPuller({
  initialProject,
  initialDataset,
  initialTable,
}: WarehouseDataPullerProps) {
  const [projects, setProjects] = useState<WarehouseProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(
    initialProject || 'vibe-code-warren-stear'
  );
  const [selectedDataset, setSelectedDataset] = useState<string>(
    initialDataset || 'analytics_warehouse'
  );
  const [selectedTable, setSelectedTable] = useState<string>(
    initialTable || 'ontact_raw_data'
  );

  // Sync internal state when external selection props change
  useEffect(() => {
    if (initialProject) setSelectedProject(initialProject);
    if (initialDataset) setSelectedDataset(initialDataset);
    if (initialTable) setSelectedTable(initialTable);
  }, [initialProject, initialDataset, initialTable]);
  const [limit, setLimit] = useState<number>(50);
  const [offset, setOffset] = useState<number>(0);
  const [syncToCloudSql, setSyncToCloudSql] = useState<boolean>(true);

  const [pulling, setPulling] = useState<boolean>(false);
  const [result, setResult] = useState<PulledTableDataResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search filter inside pulled rows
  const [rowSearch, setRowSearch] = useState<string>('');

  // JSON modal viewer
  const [activeJson, setActiveJson] = useState<{ title: string; content: any } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Cloud SQL view subtab
  const [viewMode, setViewMode] = useState<'pull' | 'cloudsql'>('pull');
  const [cloudSqlRecords, setCloudSqlRecords] = useState<CloudSqlSyncedRecord[]>([]);
  const [loadingCloudSql, setLoadingCloudSql] = useState<boolean>(false);

  // Load project hierarchy
  useEffect(() => {
    fetchWarehouseProjectsAndTables()
      .then(data => {
        if (data && data.length > 0) {
          setProjects(data);
        }
      })
      .catch(() => {});
  }, []);

  // Update datasets when project changes
  const availableDatasets = useMemo(() => {
    const proj = projects.find(p => p.projectId === selectedProject);
    return proj?.datasets || [];
  }, [projects, selectedProject]);

  // Update tables when dataset changes
  const availableTables = useMemo(() => {
    const ds = availableDatasets.find(d => d.datasetId === selectedDataset);
    return ds?.tables || [];
  }, [availableDatasets, selectedDataset]);

  // Ensure dataset & table stay valid on project change
  useEffect(() => {
    if (availableDatasets.length > 0 && !availableDatasets.some(d => d.datasetId === selectedDataset)) {
      const firstDs = availableDatasets[0];
      setSelectedDataset(firstDs.datasetId);
      if (firstDs.tables.length > 0) {
        setSelectedTable(firstDs.tables[0].tableName);
      }
    }
  }, [availableDatasets, selectedDataset]);

  useEffect(() => {
    if (availableTables.length > 0 && !availableTables.some(t => t.tableName === selectedTable)) {
      setSelectedTable(availableTables[0].tableName);
    }
  }, [availableTables, selectedTable]);

  // Execute pull
  const handlePullData = async (newOffset = offset) => {
    setPulling(true);
    setError(null);
    try {
      const data = await pullWarehouseTableData({
        project: selectedProject,
        dataset: selectedDataset,
        table: selectedTable,
        limit,
        offset: newOffset,
        syncToCloudSql,
      });
      setResult(data);
      setOffset(newOffset);
    } catch (err: any) {
      setError(err?.message || 'Failed to pull data from Google Cloud BigQuery API');
    } finally {
      setPulling(false);
    }
  };

  // Load Cloud SQL synced records
  const loadCloudSqlRecords = async () => {
    setLoadingCloudSql(true);
    try {
      const res = await fetchSyncedCloudSqlRecords({
        project: selectedProject,
        dataset: selectedDataset,
        tableName: selectedTable,
        limit: 50,
      });
      setCloudSqlRecords(res.data);
    } catch {
      // Non-blocking
    } finally {
      setLoadingCloudSql(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'cloudsql') {
      loadCloudSqlRecords();
    }
  }, [viewMode, selectedProject, selectedDataset, selectedTable]);

  // Quick preset tables
  const quickPresets = [
    {
      label: 'ontact_raw_data (39k)',
      project: 'vibe-code-warren-stear',
      dataset: 'analytics_warehouse',
      table: 'ontact_raw_data',
      tag: 'Dialler Telemetry (JSON)',
    },
    {
      label: 'onvest_raw_data (1.5k)',
      project: 'vibe-code-warren-stear',
      dataset: 'analytics_warehouse',
      table: 'onvest_raw_data',
      tag: 'Touchpoints & Spend (JSON)',
    },
    {
      label: 'tbl_vibe_code_warren_stear_ontact_analytics_api (71k)',
      project: 'dashboards-422710',
      dataset: 'vibe_coding_data',
      table: 'tbl_vibe_code_warren_stear_ontact_analytics_api',
      tag: 'Warren Stear Telephony Table',
    },
    {
      label: 'tbl_offershop_lead_ledger (62k)',
      project: 'dashboards-422710',
      dataset: 'vibe_coding_data',
      table: 'tbl_offershop_lead_ledger',
      tag: 'OfferShop Lead Ledger',
    },
    {
      label: 'tbl_vibe_code_warren_stear_ontact_ofline_data (3.9k)',
      project: 'dashboards-422710',
      dataset: 'vibe_coding_data',
      table: 'tbl_vibe_code_warren_stear_ontact_ofline_data',
      tag: 'Offline Acquisition Aggregates',
    },
    {
      label: 'clustered_lead_ledger (350k)',
      project: 'dashboards-422710',
      dataset: 'lead_ledger',
      table: 'clustered_lead_ledger',
      tag: 'Master Clustered Ledger',
    },
  ];

  const handleSelectPreset = (preset: typeof quickPresets[0]) => {
    setSelectedProject(preset.project);
    setSelectedDataset(preset.dataset);
    setSelectedTable(preset.table);
    setOffset(0);
    // Auto pull
    setTimeout(() => {
      pullWarehouseTableData({
        project: preset.project,
        dataset: preset.dataset,
        table: preset.table,
        limit,
        offset: 0,
        syncToCloudSql,
      })
        .then(d => setResult(d))
        .catch(e => setError(e?.message || 'Error pulling data'));
    }, 50);
  };

  // Filtered rows for display
  const filteredRows = useMemo(() => {
    if (!result?.rows) return [];
    if (!rowSearch.trim()) return result.rows;
    const q = rowSearch.toLowerCase().trim();
    return result.rows.filter(row => {
      return Object.values(row).some(val => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [result?.rows, rowSearch]);

  const handleCopyJson = () => {
    if (!activeJson) return;
    navigator.clipboard.writeText(JSON.stringify(activeJson.content, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCsv = () => {
    if (!result || !result.rows || result.rows.length === 0) return;
    const headers = result.columns.map(c => c.name);
    const csvLines = [headers.join(',')];
    for (const r of result.rows) {
      const line = headers.map(h => {
        const val = r[h];
        if (val === null || val === undefined) return '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      });
      csvLines.push(line.join(','));
    }
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.project}_${result.dataset}_${result.table}_records.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    if (!result || !result.rows) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.project}_${result.dataset}_${result.table}_bundle.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header controls & Quick Presets */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Database size={18} />
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                Google Cloud BigQuery API Data Puller
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select any Google Cloud project and table to pull live warehouse records directly via Google Cloud API, inspect columns, and optionally sync to Cloud SQL.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('pull')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'pull'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Live Warehouse Pull
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cloudsql')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'cloudsql'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <HardDrive size={13} />
              <span>Cloud SQL Synced Cache</span>
            </button>
          </div>
        </div>

        {/* Quick Presets Bar */}
        <div>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
            Verified Project Tables (Quick Presets)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {quickPresets.map(preset => {
              const isSelected =
                selectedProject === preset.project &&
                selectedDataset === preset.dataset &&
                selectedTable === preset.table;
              return (
                <button
                  key={`${preset.project}.${preset.table}`}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-600 text-blue-900 dark:text-blue-100'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono font-semibold truncate text-[11px]">
                      {preset.label}
                    </span>
                    {preset.project === 'vibe-code-warren-stear' && (
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium shrink-0">
                        Target Project
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                    {preset.project}.{preset.dataset} · {preset.tag}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Project, Dataset & Table Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Google Cloud Project:
            </label>
            <select
              value={selectedProject}
              onChange={e => {
                setSelectedProject(e.target.value);
                setOffset(0);
              }}
              className="w-full text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="vibe-code-warren-stear">vibe-code-warren-stear (Your Project)</option>
              <option value="dashboards-422710">dashboards-422710 (Enterprise Warehouse)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              BigQuery Dataset:
            </label>
            <select
              value={selectedDataset}
              onChange={e => {
                setSelectedDataset(e.target.value);
                setOffset(0);
              }}
              className="w-full text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-blue-500"
            >
              {availableDatasets.map(d => (
                <option key={d.datasetId} value={d.datasetId}>
                  {d.datasetId}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Target Table or View:
            </label>
            <select
              value={selectedTable}
              onChange={e => {
                setSelectedTable(e.target.value);
                setOffset(0);
              }}
              className="w-full text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-blue-500 font-semibold text-blue-700 dark:text-blue-300"
            >
              {availableTables.map(t => (
                <option key={t.tableName} value={t.tableName}>
                  {t.tableName} ({t.tableType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Batch Limit & Options:
            </label>
            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
                className="w-24 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2"
              >
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
                <option value={200}>200 rows</option>
              </select>

              <button
                type="button"
                disabled={pulling}
                onClick={() => handlePullData(0)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs disabled:opacity-50"
              >
                {pulling ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                <span>{pulling ? 'Pulling…' : 'Pull Live Data'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sync toggle */}
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={syncToCloudSql}
              onChange={e => setSyncToCloudSql(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Automatically sync pulled records to Cloud SQL (PostgreSQL instance in vibe-code-warren-stear)
            </span>
          </label>

          <span className="text-[11px] font-mono text-slate-500">
            Source: <strong className="text-slate-700 dark:text-slate-300">{selectedProject}.{selectedDataset}.{selectedTable}</strong>
          </span>
        </div>
      </section>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-3">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <div>
            <strong>Google Cloud API Pull Failed:</strong>
            <p className="mt-0.5 font-mono text-[11px]">{error}</p>
          </div>
        </div>
      )}

      {/* VIEW MODE 1: LIVE PULLED WAREHOUSE DATA */}
      {viewMode === 'pull' && (
        <>
          {/* Telemetry Strip */}
          {result && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                  Warehouse Rows
                </span>
                <strong className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                  {result.totalRows.toLocaleString()}
                </strong>
                <span className="text-[10px] text-slate-500 block">Total records in table</span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                  Batch Fetched
                </span>
                <strong className="text-base font-bold text-blue-600 dark:text-blue-400 font-mono">
                  {result.rows.length} rows
                </strong>
                <span className="text-[10px] text-slate-500 block">Offset: {result.offset}</span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                  API Latency
                </span>
                <strong className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {result.latencyMs} ms
                </strong>
                <span className="text-[10px] text-slate-500 block">Google BigQuery query</span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                  Bytes Scanned
                </span>
                <strong className="text-base font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {Number(result.bytesProcessed) > 1048576
                    ? `${(Number(result.bytesProcessed) / 1048576).toFixed(1)} MB`
                    : `${(Number(result.bytesProcessed) / 1024).toFixed(1)} KB`}
                </strong>
                <span className="text-[10px] text-slate-500 block">Read-only job</span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                  Cloud SQL Sync
                </span>
                <strong
                  className={`text-base font-bold font-mono ${
                    result.syncedToCloudSql ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {result.syncedToCloudSql ? `${result.syncedCount || result.rows.length} synced` : 'Disabled'}
                </strong>
                <span className="text-[10px] text-slate-500 block">PostgreSQL DB</span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                  BigQuery Job ID
                </span>
                <span
                  className="font-mono text-[11px] text-slate-700 dark:text-slate-300 block truncate font-semibold"
                  title={result.queryJobId}
                >
                  {result.queryJobId.slice(0, 14)}…
                </span>
                <span className="text-[10px] text-slate-500 block">Verified Google Cloud Job</span>
              </div>
            </div>
          )}

          {/* Interactive Data Table */}
          {result && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
              {/* Toolbar */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={rowSearch}
                      onChange={e => setRowSearch(e.target.value)}
                      placeholder="Filter in fetched batch…"
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono w-48 sm:w-64"
                    />
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    Showing {filteredRows.length} of {result.rows.length} batch rows
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Download size={13} />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Download size={13} />
                    <span>Export JSON</span>
                  </button>

                  <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                  {/* Pagination */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={offset === 0 || pulling}
                      onClick={() => handlePullData(Math.max(0, offset - limit))}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800"
                      title="Previous batch"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-[11px] font-mono px-2 text-slate-600 dark:text-slate-400">
                      Offset {offset} - {offset + result.rows.length}
                    </span>
                    <button
                      type="button"
                      disabled={result.rows.length < limit || pulling}
                      onClick={() => handlePullData(offset + limit)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800"
                      title="Next batch"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Table view */}
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950 z-10 border-b border-slate-200 dark:border-slate-800 shadow-2xs">
                    <tr className="font-mono text-slate-600 dark:text-slate-300">
                      <th className="py-2.5 px-3 w-12 text-center text-slate-400 font-semibold">#</th>
                      {result.columns.map(col => (
                        <th key={col.name} className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          <div className="flex flex-col">
                            <span>{col.name}</span>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">
                              {col.type}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
                    {filteredRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-2 px-3 text-center text-slate-400 font-sans text-[10px]">
                          {offset + idx + 1}
                        </td>
                        {result.columns.map(col => {
                          const val = row[col.name];
                          const isJson =
                            typeof val === 'object' && val !== null
                              ? true
                              : typeof val === 'string' && (val.startsWith('{') || val.startsWith('['));

                          return (
                            <td key={col.name} className="py-2 px-3 whitespace-nowrap max-w-xs truncate">
                              {val === null || val === undefined ? (
                                <span className="text-slate-300 dark:text-slate-600 italic">null</span>
                              ) : isJson ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    let parsed = val;
                                    if (typeof val === 'string') {
                                      try {
                                        parsed = JSON.parse(val);
                                      } catch {}
                                    }
                                    setActiveJson({
                                      title: `${col.name} (Row ${offset + idx + 1})`,
                                      content: parsed,
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors text-[10px] font-semibold"
                                >
                                  <Eye size={11} />
                                  <span>Inspect JSON</span>
                                </button>
                              ) : (
                                <span className="text-slate-800 dark:text-slate-200">
                                  {String(val)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {!result && !pulling && !error && (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <span className="p-3 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 inline-block">
                <Database size={24} />
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Ready to pull records from Google Cloud
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click any of the quick presets above or select your Google Cloud project and table, then click &quot;Pull Live Data&quot; to execute a verified BigQuery query.
              </p>
              <button
                type="button"
                onClick={() => handlePullData(0)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs"
              >
                <Play size={14} />
                <span>Pull {selectedTable}</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* VIEW MODE 2: CLOUD SQL SYNCED RECORDS */}
      {viewMode === 'cloudsql' && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HardDrive size={16} className="text-blue-600" />
                <span>Cloud SQL Cached Records (PostgreSQL instance in vibe-code-warren-stear)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Records pulled from BigQuery and persisted into the &quot;synced_records&quot; table in Cloud SQL.
              </p>
            </div>
            <button
              type="button"
              onClick={loadCloudSqlRecords}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <RefreshCw size={13} className={loadingCloudSql ? 'animate-spin' : ''} />
              <span>Refresh Cloud SQL</span>
            </button>
          </div>

          {loadingCloudSql ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-blue-600" />
              <span>Querying Cloud SQL PostgreSQL instance…</span>
            </div>
          ) : cloudSqlRecords.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No synced records found in Cloud SQL yet. Check &quot;Automatically sync pulled records to Cloud SQL&quot; and pull data above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2 px-3">ID</th>
                    <th className="py-2 px-3">Project & Table</th>
                    <th className="py-2 px-3">Record Key</th>
                    <th className="py-2 px-3">Synced At</th>
                    <th className="py-2 px-3">Synced By</th>
                    <th className="py-2 px-3 text-center">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cloudSqlRecords.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">{rec.id}</td>
                      <td className="py-2 px-3 text-blue-600 dark:text-blue-400">
                        {rec.project}.{rec.tableName}
                      </td>
                      <td className="py-2 px-3 font-semibold">{rec.recordKey || '—'}</td>
                      <td className="py-2 px-3 text-slate-500">{new Date(rec.syncedAt).toLocaleString()}</td>
                      <td className="py-2 px-3 text-slate-500">{rec.syncedBy || 'system'}</td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setActiveJson({ title: `Cloud SQL Record #${rec.id}`, content: rec.data })}
                          className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[11px]"
                        >
                          View Payload
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* JSON Inspection Modal */}
      {activeJson && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                {activeJson.title}
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1"
                >
                  {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveJson(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto">
              <pre className="text-xs font-mono bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(activeJson.content, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
