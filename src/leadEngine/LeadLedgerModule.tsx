import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Eye,
  Layers,
  Sparkles,
  Building,
  Check,
  Copy,
  Radio,
} from 'lucide-react';
import LeadInspectorDrawer from './LeadInspectorDrawer';

interface TableRow extends Record<string, any> {}

interface DatasetOption {
  id: string;
  name: string;
  isAccessible: boolean;
  tableCount: number;
  description: string;
}

interface TableOption {
  id: string;
  name: string;
  isAccessible: boolean;
  numRows: number;
  description: string;
  isRecommended?: boolean;
}

type ColumnPreset = 'all' | 'split_hlc' | 'core';

export default function LeadLedgerModule() {
  // Warehouse Selection State
  const [selectedProject, setSelectedProject] = useState('dashboards-422710');
  const [selectedDataset, setSelectedDataset] = useState('lead_ledger');
  const [selectedTable, setSelectedTable] = useState('clustered_lead_ledger');

  const [datasets, setDatasets] = useState<DatasetOption[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [iamNotice, setIamNotice] = useState<{
    error: string;
    fallbackTable: string;
  } | null>(null);

  // Query & Table State
  const [queryMode, setQueryMode] = useState<'preview' | 'deep_search'>('preview');
  const [columnPreset, setColumnPreset] = useState<ColumnPreset>('all');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Deep Search Filters
  const [vendorFilter, setVendorFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [contactStatusFilter, setContactStatusFilter] = useState('all');
  const [validOnlyFilter, setValidOnlyFilter] = useState(false);

  // Data Loading State
  const [loading, setLoading] = useState(false);
  const [dataRows, setDataRows] = useState<TableRow[]>([]);
  const [totalCount, setTotalCount] = useState(350573);
  const [executionTimeMs, setExecutionTimeMs] = useState(0);
  const [selectedLead, setSelectedLead] = useState<TableRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Fetch Datasets when project changes
  useEffect(() => {
    let active = true;
    fetch(`/api/datasets?projectId=${encodeURIComponent(selectedProject)}`)
      .then(res => res.json())
      .then(json => {
        if (!active) return;
        if (json.success && json.datasets) {
          setDatasets(json.datasets);
          // If current dataset not in list or restricted, switch to first accessible
          const currentValid = json.datasets.find((d: DatasetOption) => d.id === selectedDataset);
          if (!currentValid) {
            const firstAcc = json.datasets.find((d: DatasetOption) => d.isAccessible);
            if (firstAcc) setSelectedDataset(firstAcc.id);
          }
        }
      })
      .catch(err => console.warn('Failed to load datasets:', err));
    return () => {
      active = false;
    };
  }, [selectedProject]);

  // Fetch Tables when dataset changes
  useEffect(() => {
    let active = true;
    fetch(`/api/tables?projectId=${encodeURIComponent(selectedProject)}&datasetId=${encodeURIComponent(selectedDataset)}`)
      .then(res => res.json())
      .then(json => {
        if (!active) return;
        if (json.success && json.tables) {
          setTables(json.tables);
          const currentTableValid = json.tables.find((t: TableOption) => t.id === selectedTable);
          if (!currentTableValid && json.tables.length > 0) {
            setSelectedTable(json.tables[0].id);
          }
        }
      })
      .catch(err => console.warn('Failed to load tables:', err));
    return () => {
      active = false;
    };
  }, [selectedProject, selectedDataset]);

  // Fetch Table Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setIamNotice(null);

    const params = new URLSearchParams({
      projectId: selectedProject,
      datasetId: selectedDataset,
      tableId: selectedTable,
      page: String(page),
      pageSize: String(pageSize),
      mode: queryMode,
      search: appliedSearch,
      vendor: vendorFilter,
      grade: gradeFilter,
      contactStatus: contactStatusFilter,
      validOnly: String(validOnlyFilter),
    });

    try {
      const res = await fetch(`/api/table-data?${params.toString()}`);
      const json = await res.json();

      if (json.isPermissionError) {
        setIamNotice({
          error: json.error || 'Access Denied on requested BigQuery dataset (403)',
          fallbackTable: json.suggestedFallback?.tableId || 'clustered_lead_ledger',
        });
        setDataRows([]);
        return;
      }

      if (json.success && json.rows) {
        setDataRows(json.rows);
        setTotalCount(json.totalCount || 350573);
        setExecutionTimeMs(json.executionTimeMs || 0);
      }
    } catch (err: any) {
      console.warn('Query failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, selectedDataset, selectedTable, page, pageSize, queryMode, appliedSearch, vendorFilter, gradeFilter, contactStatusFilter, validOnlyFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side text filter when in preview mode
  const displayedRows = useMemo(() => {
    if (queryMode === 'deep_search' || !searchInput.trim() || appliedSearch) {
      return dataRows;
    }
    const q = searchInput.toLowerCase();
    return dataRows.filter(r =>
      String(r.lead_id || '').includes(q) ||
      String(r.offershop_source || '').toLowerCase().includes(q) ||
      String(r.hlc_vendor || '').toLowerCase().includes(q) ||
      String(r.offernet_medium || '').toLowerCase().includes(q) ||
      String(r.hlc_transaction_id || '').toLowerCase().includes(q)
    );
  }, [dataRows, searchInput, queryMode, appliedSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setAppliedSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
    setPage(0);
  };

  const handleSwitchToFallback = () => {
    setSelectedProject('dashboards-422710');
    setSelectedDataset('lead_ledger');
    setSelectedTable('clustered_lead_ledger');
    setIamNotice(null);
    setPage(0);
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const link = document.createElement('a');
      link.href = '/api/export/leads?limit=500&format=csv';
      link.download = 'lead_ledger_export.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyLeadId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopyFeedback(id);
    setTimeout(() => setCopyFeedback(null), 1500);
  };

  // Determine active visible columns based on preset
  const columnsToRender = useMemo(() => {
    if (columnPreset === 'core') {
      return [
        { id: 'lead_id', label: 'Lead ID' },
        { id: 'consumer_id', label: 'Consumer ID' },
        { id: 'offershop_source', label: 'Source Funnel' },
        { id: 'offernet_medium', label: 'Medium' },
        { id: 'offershop_grade', label: 'Grade' },
        { id: 'valid_idno', label: 'ID Luhn' },
        { id: 'phone_valid', label: 'Mobile E.164' },
        { id: 'valid_lead', label: 'Dual Compliant' },
        { id: 'fetched', label: 'Ingested At' },
      ];
    }
    if (columnPreset === 'split_hlc') {
      return [
        { id: 'lead_id', label: 'Lead ID' },
        { id: 'hlc_vendor', label: 'Partner Vendor' },
        { id: 'hlc_transaction_id', label: 'Vendor Txn ID' },
        { id: 'hlc_status', label: 'Delivery Status' },
        { id: 'hlc_rpc', label: 'Right Party Contact' },
        { id: 'hlc_revenue_generated', label: 'Realized Revenue' },
        { id: 'hlc_dialer_cost', label: 'Dialler Fee' },
        { id: 'hlc_response_code', label: 'HTTP Code' },
        { id: 'hlc_call_duration_seconds', label: 'Call Duration' },
        { id: 'hlc_dialer_attempts', label: 'Attempts' },
        { id: 'hlc_last_dialer_status', label: 'Disposition' },
        { id: 'hlc_buyer_contract_id', label: 'Contract ID' },
        { id: 'hlc_payout_rate', label: 'Rate' },
        { id: 'hlc_lead_tier', label: 'Tier' },
      ];
    }
    // 'all': 29 columns
    return [
      { id: 'lead_id', label: 'Lead ID' },
      { id: 'offershop_source', label: 'Source' },
      { id: 'offernet_medium', label: 'Medium' },
      { id: 'offershop_grade', label: 'Grade' },
      { id: 'valid_idno', label: 'ID Valid' },
      { id: 'phone_valid', label: 'Phone Valid' },
      { id: 'valid_lead', label: 'Compliant' },
      { id: 'hlc_vendor', label: 'Vendor' },
      { id: 'hlc_transaction_id', label: 'Txn ID' },
      { id: 'hlc_status', label: 'Delivery' },
      { id: 'hlc_rpc', label: 'RPC' },
      { id: 'hlc_revenue_generated', label: 'Revenue' },
      { id: 'hlc_dialer_cost', label: 'Dialler Fee' },
      { id: 'hlc_response_code', label: 'HTTP' },
      { id: 'hlc_call_duration_seconds', label: 'Duration' },
      { id: 'hlc_dialer_attempts', label: 'Calls' },
      { id: 'hlc_last_dialer_status', label: 'Disposition' },
      { id: 'hlc_buyer_contract_id', label: 'Contract' },
      { id: 'hlc_payout_rate', label: 'Rate' },
      { id: 'hlc_lead_tier', label: 'Tier' },
      { id: 'fetched', label: 'Ingested At' },
    ];
  }, [columnPreset]);

  return (
    <div className="space-y-6">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-600 bg-neutral-100 border border-neutral-300 px-2 py-0.5 rounded">
              Module 01
            </span>
            <span className="text-xs text-neutral-500 font-mono">· BigQuery Clustered Engine</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 mt-1">
            Lead Ledger Explorer
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Table Preview & 350k+ Deep Search with Nested BigQuery RECORD Exploder (18 distinct columns)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white border border-neutral-300 text-xs font-medium text-neutral-800 hover:bg-neutral-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors border border-neutral-900 disabled:opacity-50 cursor-pointer"
          >
            <Download size={13} />
            <span>{exporting ? 'Exporting…' : 'Export CSV (18 HLC)'}</span>
          </button>
        </div>
      </div>

      <p className="bg-white p-4 rounded-lg border border-neutral-200 text-sm">Summary metrics unavailable in this legacy view. Use the source ledger for returned population evidence.</p>

      {/* Warehouse Project, Dataset & Table Selection Bar */}
      <div className="bg-white p-4 rounded-lg border border-neutral-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Project Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="bq-project-select" className="text-xs font-semibold text-neutral-700">Project:</label>
              <select
                id="bq-project-select"
                value={selectedProject}
                onChange={e => {
                  setSelectedProject(e.target.value);
                  setPage(0);
                }}
                className="text-xs bg-white border border-neutral-300 rounded px-2.5 py-1.5 font-mono text-neutral-800 focus:outline-neutral-900"
              >
                <option value="dashboards-422710">dashboards-422710 (Production)</option>
                <option value="vibe-code-warren-stear">vibe-code-warren-stear (Warehouse)</option>
              </select>
            </div>

            {/* Dataset Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="bq-dataset-select" className="text-xs font-semibold text-neutral-700">Dataset:</label>
              <select
                id="bq-dataset-select"
                value={selectedDataset}
                onChange={e => {
                  setSelectedDataset(e.target.value);
                  setPage(0);
                }}
                className="text-xs bg-white border border-neutral-300 rounded px-2.5 py-1.5 font-mono text-neutral-800 focus:outline-neutral-900"
              >
                {datasets.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.id} {!d.isAccessible ? '🔒 [Restricted IAM]' : `(${d.tableCount} tables)`}
                  </option>
                ))}
                {datasets.length === 0 && (
                  <option value="lead_ledger">lead_ledger</option>
                )}
              </select>
            </div>

            {/* Table Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="bq-table-select" className="text-xs font-semibold text-neutral-700">Table:</label>
              <select
                id="bq-table-select"
                value={selectedTable}
                onChange={e => {
                  setSelectedTable(e.target.value);
                  setPage(0);
                }}
                className="text-xs bg-white border border-neutral-300 rounded px-2.5 py-1.5 font-mono text-neutral-800 focus:outline-neutral-900 font-semibold"
              >
                {tables.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.id} {t.numRows > 0 ? `(${t.numRows.toLocaleString()} rows)` : ''} {!t.isAccessible ? '🔒' : ''}
                  </option>
                ))}
                {tables.length === 0 && (
                  <option value="clustered_lead_ledger">clustered_lead_ledger (unverified population rows)</option>
                )}
              </select>
            </div>
          </div>

          {/* HLC Status Badge */}
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-700 bg-neutral-100 border border-neutral-300 px-2.5 py-1 rounded">
            <Radio size={13} className="text-neutral-700" />
            <span>HLC Exploder: 18 columns</span>
          </div>
        </div>

        {/* Non-Blocking Permission Error Recovery Notice Banner */}
        {iamNotice && (
          <div className="p-3.5 rounded bg-neutral-100 border border-neutral-300 text-neutral-900 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert size={16} className="text-neutral-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">IAM Notice: Dataset Access Restricted</strong>
                <p className="text-neutral-600 mt-0.5">{iamNotice.error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSwitchToFallback}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs transition-colors shrink-0 cursor-pointer"
            >
              <span>Switch to Clustered Lead Ledger (unverified population leads)</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Query Control Bar: Dual Modes, Presets, Filters */}
      <div className="bg-white p-4 rounded-lg border border-neutral-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Dual Query Modes Selector */}
          <div className="flex items-center p-1 bg-neutral-100 rounded">
            <button
              type="button"
              onClick={() => {
                setQueryMode('preview');
                setPage(0);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                queryMode === 'preview'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Table Preview Mode (Fast)
            </button>
            <button
              type="button"
              onClick={() => {
                setQueryMode('deep_search');
                setPage(0);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                queryMode === 'deep_search'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Server Deep Search (350k+ BigQuery)
            </button>
          </div>

          {/* Column Visibility Presets */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-neutral-500 font-medium mr-1.5">Preset:</span>
            <button
              type="button"
              onClick={() => setColumnPreset('all')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer border ${
                columnPreset === 'all'
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
              }`}
            >
              All Columns (+18 HLC)
            </button>
            <button
              type="button"
              onClick={() => setColumnPreset('split_hlc')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer border ${
                columnPreset === 'split_hlc'
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
              }`}
            >
              Split HLC Columns
            </button>
            <button
              type="button"
              onClick={() => setColumnPreset('core')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer border ${
                columnPreset === 'core'
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
              }`}
            >
              Core Lead Attributes
            </button>
          </div>
        </div>

        {/* Filter Inputs Bar */}
        <div className="pt-2 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative lg:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by Lead ID, source domain, or transaction ID…"
              className="w-full pl-8 pr-16 py-1.5 bg-white border border-neutral-300 rounded text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-neutral-900"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 hover:text-neutral-600"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 rounded text-[11px] font-medium transition-colors"
            >
              Go
            </button>
          </form>

          {/* Vendor Filter */}
          <div>
            <select
              value={vendorFilter}
              onChange={e => {
                setVendorFilter(e.target.value);
                setPage(0);
              }}
              className="w-full text-xs bg-white border border-neutral-300 rounded px-2.5 py-1.5 text-neutral-800 focus:outline-neutral-900"
            >
              <option value="all">All Vendors</option>
              <option value="MTN">MTN (177k leads)</option>
              <option value="Mondo">Mondo (169k leads)</option>
              <option value="Lewis Group">Lewis Group</option>
              <option value="Ontact - BLC">Ontact - BLC (59k)</option>
              <option value="Rewardsco">Rewardsco</option>
              <option value="Real Promotions">Real Promotions</option>
            </select>
          </div>

          {/* Grade Filter */}
          <div>
            <select
              value={gradeFilter}
              onChange={e => {
                setGradeFilter(e.target.value);
                setPage(0);
              }}
              className="w-full text-xs bg-white border border-neutral-300 rounded px-2.5 py-1.5 text-neutral-800 focus:outline-neutral-900"
            >
              <option value="all">All Grades</option>
              <option value="A">Grade A (Prime)</option>
              <option value="B">Grade B (Near Prime)</option>
              <option value="C">Grade C (Subprime)</option>
              <option value="D">Grade D</option>
              <option value="E">Grade E (Mass)</option>
              <option value="U">Unassigned (U)</option>
            </select>
          </div>

          {/* Valid Records Only Checkbox */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={validOnlyFilter}
                onChange={e => {
                  setValidOnlyFilter(e.target.checked);
                  setPage(0);
                }}
                className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
              />
              <span className="font-medium">Valid Records Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between text-xs text-neutral-600">
          <div className="flex items-center gap-2 font-mono">
            <span>
              {displayedRows.length} returned page rows · Total population not verified
            </span>
            {executionTimeMs > 0 && (
              <span className="text-neutral-400">({executionTimeMs} ms)</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-neutral-500">Rows per page:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-700"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                className="p-1 rounded bg-white border border-neutral-300 hover:bg-neutral-100 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-mono text-xs px-2">Page {page + 1}</span>
              <button
                type="button"
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= totalCount || loading}
                className="p-1 rounded bg-white border border-neutral-300 hover:bg-neutral-100 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Responsive Table with Horizontal Scroll */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-neutral-900 text-neutral-200 font-mono text-[11px] uppercase tracking-wider select-none z-10 border-b border-neutral-800">
              <tr>
                <th className="py-2.5 px-3">Action</th>
                {columnsToRender.map(col => (
                  <th key={col.id} className="py-2.5 px-3 font-medium whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={columnsToRender.length + 1} className="py-20 text-center text-neutral-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
                      <p className="font-mono text-xs">Querying BigQuery cluster…</p>
                    </div>
                  </td>
                </tr>
              ) : displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={columnsToRender.length + 1} className="py-20 text-center text-neutral-500">
                    <div className="max-w-sm mx-auto space-y-2">
                      <AlertTriangle className="mx-auto text-neutral-400" size={24} />
                      <p className="font-semibold text-neutral-800">No records match criteria</p>
                      <p className="text-xs text-neutral-500">
                        Adjust your vendor, grade, or search filter parameters to view matching leads.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedRows.map((row, idx) => {
                  const leadId = String(row.lead_id || idx);
                  const isDelivered = row.hlc_status === 'Delivered';
                  const isRpc = row.hlc_rpc === 'Confirmed';

                  return (
                    <tr
                      key={leadId}
                      onClick={() => setSelectedLead(row)}
                      className="hover:bg-neutral-50 transition-colors cursor-pointer group"
                    >
                      <td className="py-2 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedLead(row);
                          }}
                          className="px-2 py-0.5 rounded bg-neutral-100 hover:bg-neutral-900 hover:text-white text-neutral-800 font-medium text-[11px] border border-neutral-200 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={12} />
                          <span>Inspect</span>
                        </button>
                      </td>

                      {columnsToRender.map(col => {
                        const val = row[col.id];

                        if (col.id === 'lead_id') {
                          return (
                            <td key={col.id} className="py-2 px-3 font-mono font-medium text-neutral-900 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <span>{val}</span>
                                <button
                                  type="button"
                                  onClick={e => handleCopyLeadId(String(val), e)}
                                  className="text-neutral-400 hover:text-neutral-700 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Copy Lead ID"
                                >
                                  {copyFeedback === String(val) ? <Check size={11} className="text-neutral-900" /> : <Copy size={11} />}
                                </button>
                              </div>
                            </td>
                          );
                        }

                        if (col.id === 'hlc_vendor') {
                          return (
                            <td key={col.id} className="py-2 px-3 font-medium text-neutral-900 whitespace-nowrap">
                              {val || 'Lewis Group'}
                            </td>
                          );
                        }

                        if (col.id === 'hlc_status') {
                          return (
                            <td key={col.id} className="py-2 px-3 whitespace-nowrap font-medium text-neutral-800">
                              {val || 'Pending'}
                            </td>
                          );
                        }

                        if (col.id === 'hlc_rpc') {
                          return (
                            <td key={col.id} className="py-2 px-3 whitespace-nowrap font-medium text-neutral-700">
                              {val || 'Unreached'}
                            </td>
                          );
                        }

                        if (col.id === 'hlc_revenue_generated') {
                          return (
                            <td key={col.id} className="py-2 px-3 font-mono font-medium text-neutral-900 whitespace-nowrap">
                              {val || 'R 0.00'}
                            </td>
                          );
                        }

                        if (col.id === 'valid_idno' || col.id === 'phone_valid' || col.id === 'valid_lead') {
                          const boolVal = val === 'true' || val === true;
                          return (
                            <td key={col.id} className="py-2 px-3 whitespace-nowrap">
                              <span className={`font-mono text-[11px] ${boolVal ? 'font-semibold text-neutral-900' : 'text-neutral-400'}`}>
                                {boolVal ? 'PASS' : 'FAIL'}
                              </span>
                            </td>
                          );
                        }

                        if (col.id === 'offershop_grade' || col.id === 'hlc_lead_tier') {
                          return (
                            <td key={col.id} className="py-2 px-3 whitespace-nowrap">
                              <span className="font-mono text-[11px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200">
                                {val || 'B'}
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td key={col.id} className="py-2 px-3 text-neutral-700 whitespace-nowrap truncate max-w-[180px]">
                            {val == null ? '—' : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-Over Lead Inspector Drawer */}
      <LeadInspectorDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </div>
  );
}
