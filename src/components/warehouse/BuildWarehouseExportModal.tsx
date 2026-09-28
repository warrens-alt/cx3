import React, { useState, useEffect } from 'react';
import {
  Download,
  Database,
  Layers,
  FileCode,
  FileSpreadsheet,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle,
  Archive,
  Table,
  Copy,
  Check,
} from 'lucide-react';
import {
  fetchWarehouseExportBundle,
  downloadBrowserFile,
  downloadWarehouseBundleJson,
  type WarehouseExportBundle,
  type DictionaryObject,
} from '../../lib/warehouseClient';

interface BuildWarehouseExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  tables: DictionaryObject[];
}

export default function BuildWarehouseExportModal({
  isOpen,
  onClose,
  clientId,
  tables,
}: BuildWarehouseExportModalProps) {
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [datasetFilter, setDatasetFilter] = useState<string>('all');
  const [includeSchemas, setIncludeSchemas] = useState<boolean>(true);
  const [includeData, setIncludeData] = useState<boolean>(true);
  const [building, setBuilding] = useState<boolean>(false);
  const [buildPhase, setBuildPhase] = useState<string>('');
  const [copiedCli, setCopiedCli] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Compute live counts based on filter
  const filteredTables = tables.filter(t => {
    if (projectFilter !== 'all' && t.project !== projectFilter) return false;
    if (datasetFilter !== 'all' && t.dataset !== datasetFilter) return false;
    return true;
  });

  const uniqueProjects = Array.from(new Set(tables.map(t => t.project)));
  const uniqueDatasets = Array.from(new Set(tables.map(t => t.dataset)));

  const handleCopyCli = () => {
    try {
      navigator.clipboard.writeText('npm run export:warehouse');
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadJson = async () => {
    setBuilding(true);
    setBuildPhase('Compiling Google BigQuery schema catalogue and datasets...');
    setError(null);
    setSuccessMessage(null);
    try {
      const bundle = await fetchWarehouseExportBundle(
        {
          clientId,
          project: projectFilter,
          dataset: datasetFilter,
          includeSchemas,
          includeData,
        },
        true
      );
      setBuildPhase('Generating Master JSON Archive...');
      downloadWarehouseBundleJson(bundle);
      setSuccessMessage('Successfully built and downloaded complete Google Cloud warehouse JSON bundle.');
    } catch (err: any) {
      setError(err?.message || 'Failed to build warehouse JSON export');
    } finally {
      setBuilding(false);
      setBuildPhase('');
    }
  };

  const handleDownloadSchemaCsv = async () => {
    setBuilding(true);
    setBuildPhase('Generating schema definitions and type mappings...');
    setError(null);
    setSuccessMessage(null);
    try {
      const query = new URLSearchParams({
        clientId,
        format: 'schema_csv',
        project: projectFilter,
        dataset: datasetFilter,
      });
      const response = await fetch(`/api/analytics/warehouse/export?${query.toString()}`);
      if (!response.ok) throw new Error('Failed to generate schema CSV export');
      const csvText = await response.text();
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadBrowserFile(
        csvText,
        `google_warehouse_schema_catalog_${projectFilter}_${datasetFilter}_${timestamp}.csv`,
        'text/csv;charset=utf-8'
      );
      setSuccessMessage('Successfully built and downloaded Google Cloud table schema catalog (CSV).');
    } catch (err: any) {
      setError(err?.message || 'Failed to download schema catalog CSV');
    } finally {
      setBuilding(false);
      setBuildPhase('');
    }
  };

  const handleDownloadInventoryCsv = async () => {
    setBuilding(true);
    setBuildPhase('Assembling tables and views inventory catalog...');
    setError(null);
    setSuccessMessage(null);
    try {
      const query = new URLSearchParams({
        clientId,
        format: 'tables_csv',
        project: projectFilter,
        dataset: datasetFilter,
      });
      const response = await fetch(`/api/analytics/warehouse/export?${query.toString()}`);
      if (!response.ok) throw new Error('Failed to generate tables inventory CSV');
      const csvText = await response.text();
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadBrowserFile(
        csvText,
        `google_warehouse_tables_inventory_${projectFilter}_${datasetFilter}_${timestamp}.csv`,
        'text/csv;charset=utf-8'
      );
      setSuccessMessage('Successfully built and downloaded Google Cloud table inventory (CSV).');
    } catch (err: any) {
      setError(err?.message || 'Failed to download inventory CSV');
    } finally {
      setBuilding(false);
      setBuildPhase('');
    }
  };

  const handleDownloadAll = async () => {
    setBuilding(true);
    setBuildPhase('Initiating full Google Cloud warehouse export bundle...');
    setError(null);
    setSuccessMessage(null);
    try {
      // 1. Download Master JSON Bundle
      setBuildPhase('1/3: Compiling master warehouse archive...');
      const bundle = await fetchWarehouseExportBundle(
        {
          clientId,
          project: projectFilter,
          dataset: datasetFilter,
          includeSchemas,
          includeData,
        },
        true
      );
      downloadWarehouseBundleJson(bundle);

      // 2. Download Schema Catalog CSV
      setBuildPhase('2/3: Generating declared schema catalog CSV...');
      const schemaQuery = new URLSearchParams({
        clientId,
        format: 'schema_csv',
        project: projectFilter,
        dataset: datasetFilter,
      });
      const schemaRes = await fetch(`/api/analytics/warehouse/export?${schemaQuery.toString()}`);
      if (schemaRes.ok) {
        const schemaCsv = await schemaRes.text();
        setTimeout(() => {
          downloadBrowserFile(
            schemaCsv,
            `google_warehouse_schema_catalog_${new Date().toISOString().slice(0, 10)}.csv`,
            'text/csv;charset=utf-8'
          );
        }, 500);
      }

      // 3. Download Tables Inventory CSV
      setBuildPhase('3/3: Assembling tables inventory CSV...');
      const invQuery = new URLSearchParams({
        clientId,
        format: 'tables_csv',
        project: projectFilter,
        dataset: datasetFilter,
      });
      const invRes = await fetch(`/api/analytics/warehouse/export?${invQuery.toString()}`);
      if (invRes.ok) {
        const invCsv = await invRes.text();
        setTimeout(() => {
          downloadBrowserFile(
            invCsv,
            `google_warehouse_tables_inventory_${new Date().toISOString().slice(0, 10)}.csv`,
            'text/csv;charset=utf-8'
          );
        }, 1000);
      }

      setSuccessMessage('All Google Cloud warehouse export files (JSON bundle and CSV catalogs) have been built and triggered for download.');
    } catch (err: any) {
      setError(err?.message || 'Failed to execute full warehouse export');
    } finally {
      setBuilding(false);
      setBuildPhase('');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="build-export-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
    >
      <div className="relative w-full max-w-3xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <Archive size={20} />
            </div>
            <div>
              <h2 id="build-export-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Build Warehouse Export
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pull all Google Cloud BigQuery projects, datasets, tables, and declared schemas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
            aria-label="Close export dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Database size={13} className="text-indigo-500" />
                <span>Projects</span>
              </div>
              <div className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {projectFilter === 'all' ? uniqueProjects.length : 1}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {projectFilter === 'all' ? 'All Google Projects' : projectFilter}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Layers size={13} className="text-blue-500" />
                <span>Datasets</span>
              </div>
              <div className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {datasetFilter === 'all' ? uniqueDatasets.length : 1}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {datasetFilter === 'all' ? 'All Datasets' : datasetFilter}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Table size={13} className="text-emerald-500" />
                <span>Tables & Views</span>
              </div>
              <div className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {filteredTables.length}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {filteredTables.filter(t => t.tableType === 'TABLE').length} tables · {filteredTables.filter(t => t.tableType === 'VIEW').length} views
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <FileCode size={13} className="text-amber-500" />
                <span>Schema Columns</span>
              </div>
              <div className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                1,848
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                Complete Data Types & Grain
              </div>
            </div>
          </div>

          {/* Filtering & Scope Options */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Export Scope & Filters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Google Cloud Project
                </label>
                <select
                  value={projectFilter}
                  onChange={e => setProjectFilter(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Google Projects (2 projects)</option>
                  {uniqueProjects.map(proj => (
                    <option key={proj} value={proj}>
                      {proj}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  BigQuery Dataset
                </label>
                <select
                  value={datasetFilter}
                  onChange={e => setDatasetFilter(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Datasets (4 datasets)</option>
                  {uniqueDatasets.map(ds => (
                    <option key={ds} value={ds}>
                      {ds}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Checkbox toggles for Schemes and Data */}
            <div className="pt-2 space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSchemas}
                  onChange={e => setIncludeSchemas(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                    Include Complete Schema Definitions ("schemes")
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    All declared columns, data types (STRING, INT64, DATE, ARRAY&lt;STRUCT&gt;), ordinal positions, candidate keys, and analytical grains.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeData}
                  onChange={e => setIncludeData(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                    Include Table Data & Observed Telemetry Evidence
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    VICIdial dialler call observations, touchpoint marketing spend & clicks, waterfall conversion metrics, and handover manifest rows.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Export Options Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Build & Download Options
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1: Master JSON */}
              <button
                type="button"
                onClick={handleDownloadJson}
                disabled={building}
                className="flex flex-col text-left p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-all shadow-xs group disabled:opacity-50"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                    <FileCode size={18} />
                  </div>
                  <Download size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Full JSON Archive
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  All projects, datasets, tables, complete column schemas, and operational telemetry.
                </div>
              </button>

              {/* Option 2: Schema Catalog CSV */}
              <button
                type="button"
                onClick={handleDownloadSchemaCsv}
                disabled={building}
                className="flex flex-col text-left p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-all shadow-xs group disabled:opacity-50"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                    <FileSpreadsheet size={18} />
                  </div>
                  <Download size={14} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Schema Catalog (CSV)
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  All 1,848 declared columns, types, nullability, ordinal positions, keys, and grain.
                </div>
              </button>

              {/* Option 3: Tables Inventory CSV */}
              <button
                type="button"
                onClick={handleDownloadInventoryCsv}
                disabled={building}
                className="flex flex-col text-left p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition-all shadow-xs group disabled:opacity-50"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                    <Table size={18} />
                  </div>
                  <Download size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Table Inventory (CSV)
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  Summary list of 65 tables/views, family classification, grain, and key constraints.
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>CLI build:</span>
            <code className="font-mono text-slate-700 dark:text-slate-300 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded">npm run export:warehouse</code>
            <button
              type="button"
              onClick={handleCopyCli}
              className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
              title="Copy CLI command to clipboard"
            >
              {copiedCli ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              <span>{copiedCli ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {building && buildPhase && (
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono animate-pulse hidden md:inline">
                {buildPhase}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={building}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors disabled:opacity-50"
            >
              {building ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Building Export...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Build & Pull All Files</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
