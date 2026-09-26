import React, { useState, useEffect, useMemo } from 'react';
import { PageShell } from '../components/PageShell';
import { 
  BookOpen, 
  LayoutGrid, 
  CalendarCheck2, 
  Database, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  Layers, 
  Shuffle, 
  Table, 
  SlidersHorizontal,
  ChevronDown,
  Coins,
  ShieldCheck
} from 'lucide-react';
import { useClient } from '../lib/ClientContext';
import { useFilters } from '../lib/FilterContext';
import { useLocation } from 'react-router-dom';
import { VisualTable } from '../components/visuals/DataVisual';

interface TablePreviewRow {
  [key: string]: unknown;
}

export default function LeadLedger() {
  const { selectedClient } = useClient();
  const { startDate: globalStart, endDate: globalEnd, vendor: globalVendor, setFilter, setDateRange } = useFilters();
  const location = useLocation();

  // Active configuration tab
  const [activeTab, setActiveTab] = useState<'lead_ledger' | 'billing'>('lead_ledger');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'billing' || tabParam === 'lead_ledger') {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  // Universal Filter state
  const [selectedVendor, setSelectedVendor] = useState<string>('All');
  const [filterStartDate, setFilterStartDate] = useState<string>(globalStart || '');
  const [filterEndDate, setFilterEndDate] = useState<string>(globalEnd || '');

  useEffect(() => {
    if (globalVendor && !['all', 'all vendors'].includes(globalVendor.toLowerCase())) {
      setSelectedVendor(globalVendor);
    } else if (!globalVendor) {
      setSelectedVendor('All');
    }
  }, [globalVendor]);

  useEffect(() => {
    if (globalStart) setFilterStartDate(globalStart);
    if (globalEnd) setFilterEndDate(globalEnd);
  }, [globalStart, globalEnd]);

  // BigQuery Configuration Selection
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('dashboards-422710');
  const [datasets, setDatasets] = useState<{ id: string }[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>('lead_ledger');
  const [tables, setTables] = useState<{ id: string }[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('lead_ledger_platform_insights');

  // Preview data state
  const [sampleRowsLimit, setSampleRowsLimit] = useState<number>(2);
  const [previewRows, setPreviewRows] = useState<TablePreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    projectName?: string;
    dataset?: string;
    latestData?: string | null;
  } | null>(null);

  // BigQuery table dropdown options priority
  const PRIMARY_TABLES = [
    'lead_ledger_platform_insights',
    'lead_ledger_all_vicidial_insights_time_to_dial',
    'lead_ledger_all_vicidial_insights'
  ];

  // Fetch connection status
  useEffect(() => {
    fetch('/api/bq/status')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setConnectionStatus({
            connected: data.connected,
            projectName: data.projectName || data.project,
            dataset: data.dataset,
            latestData: data.latestData
          });
        }
      })
      .catch(() => {
        setConnectionStatus({ connected: false });
      });
  }, []);

  // Fetch BigQuery projects
  useEffect(() => {
    fetch('/api/bq/projects')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setProjects(data.data);
          if (data.data.length && !selectedProject) {
            setSelectedProject(data.data[0].id);
          }
        }
      })
      .catch(() => {});
  }, [selectedProject]);

  // Fetch BigQuery datasets
  useEffect(() => {
    const proj = selectedProject || 'dashboards-422710';
    fetch(`/api/bq/datasets?projectId=${encodeURIComponent(proj)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setDatasets(data.data);
          if (data.data.some((d: { id: string }) => d.id === 'lead_ledger')) {
            setSelectedDataset('lead_ledger');
          } else if (data.data.length) {
            setSelectedDataset(data.data[0].id);
          }
        }
      })
      .catch(() => {});
  }, [selectedProject]);

  // Fetch BigQuery tables
  useEffect(() => {
    const proj = selectedProject || 'dashboards-422710';
    const ds = selectedDataset || 'lead_ledger';
    fetch(`/api/bq/tables?projectId=${encodeURIComponent(proj)}&datasetId=${encodeURIComponent(ds)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setTables(data.data);
        }
      })
      .catch(() => {});
  }, [selectedProject, selectedDataset]);

  // Fetch live table preview rows
  const fetchPreview = () => {
    const proj = selectedProject || 'dashboards-422710';
    const ds = selectedDataset || 'lead_ledger';
    const tbl = selectedTable || 'lead_ledger_platform_insights';
    setLoadingPreview(true);
    setPreviewError(null);

    fetch(`/api/bq/preview?projectId=${encodeURIComponent(proj)}&datasetId=${encodeURIComponent(ds)}&tableId=${encodeURIComponent(tbl)}&limit=${sampleRowsLimit}`)
      .then(async res => {
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || `Failed to fetch preview for ${tbl}`);
        }
        setPreviewRows(json.data || []);
        setLoadingPreview(false);
      })
      .catch(err => {
        setPreviewError(err.message || 'Error loading BigQuery table preview');
        setLoadingPreview(false);
      });
  };

  useEffect(() => {
    fetchPreview();
  }, [selectedProject, selectedDataset, selectedTable, sampleRowsLimit]);

  // Extract columns for preview table
  const previewColumns = useMemo(() => {
    if (!previewRows.length) return [];
    // Collect all unique keys from sample rows
    const colSet = new Set<string>();
    previewRows.forEach(row => {
      Object.keys(row).forEach(k => colSet.add(k));
    });
    return Array.from(colSet);
  }, [previewRows]);

  const handleApplyFilter = () => {
    if (selectedVendor && selectedVendor !== 'All') {
      setFilter('vendor', { operator: 'in', values: [selectedVendor] });
    } else {
      setFilter('vendor', null);
    }
    if (filterStartDate && filterEndDate) {
      setDateRange(filterStartDate, filterEndDate);
    }
    fetchPreview();
  };

  return (
    <PageShell>
      {/* Top Banner / Header matching ConversionX V1 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E7EF]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#111827] tracking-tight">ConversionX V1</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Connected
            </span>
          </div>
          <p className="text-xs text-[#6F809A] mt-0.5">
            Configure Google Cloud BigQuery lead ledger tables and platform billing reconciliation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchPreview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#315EAD] bg-[#EDF5FC] hover:bg-[#DCEBF9] rounded-md border border-[#BDD7F4] transition-colors"
          >
            <Shuffle size={13} />
            <span>Remix</span>
          </button>
        </div>
      </div>

      <div className="space-y-6 mt-6">
        {/* Universal Filter Box */}
        <section className="bg-white rounded-lg border border-[#E2E7EF] p-4 shadow-sm" aria-label="Universal Filter">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
              <CalendarCheck2 className="w-4 h-4 text-[#3562B3]" />
              <span>Universal Filter</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Vendor Selector */}
              <div className="flex items-center gap-2">
                <label htmlFor="universal-vendor" className="text-xs font-medium text-[#6F809A] whitespace-nowrap">
                  Vendor:
                </label>
                <div className="relative">
                  <select
                    id="universal-vendor"
                    value={selectedVendor}
                    onChange={e => setSelectedVendor(e.target.value)}
                    className="h-8 pl-2.5 pr-7 text-xs font-medium text-[#111827] bg-[#F8FAFC] border border-[#CBD5E1] rounded-md focus:border-[#3562B3] focus:ring-1 focus:ring-[#3562B3] outline-none"
                  >
                    <option value="All">All</option>
                    <option value="Mondo">Mondo</option>
                    <option value="BLC">BLC</option>
                    <option value="MTN">MTN</option>
                    <option value="African Bank">African Bank</option>
                    <option value="Ontact - Vodacom (BizVoip)">Ontact - Vodacom (BizVoip)</option>
                    <option value="Real Promotions">Real Promotions</option>
                    <option value="Rewardsco">Rewardsco</option>
                    <option value="Lewis Group">Lewis Group</option>
                  </select>
                </div>
              </div>

              {/* Start Date */}
              <div className="flex items-center gap-2">
                <label htmlFor="universal-start" className="text-xs font-medium text-[#6F809A] whitespace-nowrap">
                  Start Date:
                </label>
                <input
                  id="universal-start"
                  type="date"
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                  placeholder="yyyy/mm/dd"
                  className="h-8 px-2 text-xs font-mono text-[#111827] bg-[#F8FAFC] border border-[#CBD5E1] rounded-md focus:border-[#3562B3] focus:ring-1 focus:ring-[#3562B3] outline-none"
                />
              </div>

              {/* End Date */}
              <div className="flex items-center gap-2">
                <label htmlFor="universal-end" className="text-xs font-medium text-[#6F809A] whitespace-nowrap">
                  End Date:
                </label>
                <input
                  id="universal-end"
                  type="date"
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                  placeholder="yyyy/mm/dd"
                  className="h-8 px-2 text-xs font-mono text-[#111827] bg-[#F8FAFC] border border-[#CBD5E1] rounded-md focus:border-[#3562B3] focus:ring-1 focus:ring-[#3562B3] outline-none"
                />
              </div>

              {/* Apply Button */}
              <button
                type="button"
                onClick={handleApplyFilter}
                className="h-8 px-4 text-xs font-semibold text-white bg-[#3562B3] hover:bg-[#2A4E8F] active:bg-[#203D70] rounded-md transition-colors shadow-sm"
              >
                Apply
              </button>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="border-b border-[#E2E7EF]">
          <nav className="flex space-x-6" aria-label="Configuration Tabs">
            <button
              type="button"
              onClick={() => setActiveTab('lead_ledger')}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'lead_ledger'
                  ? 'border-[#3562B3] text-[#3562B3] font-semibold'
                  : 'border-transparent text-[#6F809A] hover:text-[#111827] hover:border-slate-300'
              }`}
            >
              <BookOpen size={16} />
              <span>Lead Ledger Settings</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('billing')}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'billing'
                  ? 'border-[#3562B3] text-[#3562B3] font-semibold'
                  : 'border-transparent text-[#6F809A] hover:text-[#111827] hover:border-slate-300'
              }`}
            >
              <LayoutGrid size={16} />
              <span>Platform Billing Settings</span>
            </button>
          </nav>
        </div>

        {/* Lead Ledger Settings Content */}
        {activeTab === 'lead_ledger' && (
          <div className="space-y-6">
            {/* Form Fields: Google Cloud Project, BigQuery Dataset, BigQuery Table */}
            <div className="bg-white rounded-lg border border-[#E2E7EF] p-5 shadow-sm space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Google Cloud Project */}
                <div>
                  <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                    Google Cloud Project
                  </label>
                  <select
                    value={selectedProject}
                    onChange={e => setSelectedProject(e.target.value)}
                    className="w-full h-9 px-3 text-xs font-medium text-[#111827] bg-[#F8FAFC] border border-[#CBD5E1] rounded-md focus:border-[#3562B3] focus:ring-1 focus:ring-[#3562B3] outline-none"
                  >
                    <option value="dashboards-422710">Dashboards (dashboards-422710)</option>
                    {projects
                      .filter(p => p.id !== 'dashboards-422710')
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name || p.id}
                        </option>
                      ))}
                  </select>
                </div>

                {/* BigQuery Dataset */}
                <div>
                  <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                    BigQuery Dataset
                  </label>
                  <select
                    value={selectedDataset}
                    onChange={e => setSelectedDataset(e.target.value)}
                    className="w-full h-9 px-3 text-xs font-medium text-[#111827] bg-[#F8FAFC] border border-[#CBD5E1] rounded-md focus:border-[#3562B3] focus:ring-1 focus:ring-[#3562B3] outline-none font-mono"
                  >
                    <option value="lead_ledger">lead_ledger</option>
                    {datasets
                      .filter(d => d.id !== 'lead_ledger')
                      .map(d => (
                        <option key={d.id} value={d.id}>
                          {d.id}
                        </option>
                      ))}
                  </select>
                </div>

                {/* BigQuery Table Selector */}
                <div>
                  <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                    BigQuery Table
                  </label>
                  <select
                    value={selectedTable}
                    onChange={e => setSelectedTable(e.target.value)}
                    className="w-full h-9 px-3 text-xs font-medium text-[#111827] bg-[#F8FAFC] border border-[#CBD5E1] rounded-md focus:border-[#3562B3] focus:ring-1 focus:ring-[#3562B3] outline-none font-mono"
                  >
                    <optgroup label="Primary Analytical Tables">
                      <option value="lead_ledger_platform_insights">lead_ledger_platform_insights</option>
                      <option value="lead_ledger_all_vicidial_insights_time_to_dial">lead_ledger_all_vicidial_insights_time_to_dial</option>
                      <option value="lead_ledger_all_vicidial_insights">lead_ledger_all_vicidial_insights</option>
                    </optgroup>
                    <optgroup label="Underlying Operational Tables">
                      <option value="clustered_lead_ledger">clustered_lead_ledger</option>
                      <option value="tbl_blc_activations">tbl_blc_activations</option>
                      {tables
                        .filter(t => !PRIMARY_TABLES.includes(t.id) && t.id !== 'clustered_lead_ledger' && t.id !== 'tbl_blc_activations')
                        .map(t => (
                          <option key={t.id} value={t.id}>
                            {t.id}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Active selection pills */}
              <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[#6F809A]">Selected relation:</span>
                <code className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#315EAD] font-mono font-medium border border-slate-200">
                  {selectedProject}.{selectedDataset}.{selectedTable}
                </code>
                {connectionStatus?.connected && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px] font-medium ml-auto">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Verified BigQuery Source
                  </span>
                )}
              </div>
            </div>

            {/* Table Preview Section */}
            <div className="bg-white rounded-lg border border-[#E2E7EF] shadow-sm overflow-hidden">
              <div className="p-4 border-b border-[#E2E7EF] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#F8FAFC]">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-[#3562B3]" />
                  <h3 className="text-sm font-bold text-[#111827]">Table Preview</h3>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[#6F809A]">
                    Showing {previewRows.length} sample row{previewRows.length === 1 ? '' : 's'}
                  </span>
                  <div className="flex items-center gap-1 border border-[#CBD5E1] rounded bg-white px-1">
                    {[2, 5, 10].map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setSampleRowsLimit(cnt)}
                        className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                          sampleRowsLimit === cnt
                            ? 'bg-[#3562B3] text-white'
                            : 'text-[#6F809A] hover:text-[#111827]'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={fetchPreview}
                    disabled={loadingPreview}
                    className="p-1 text-[#6F809A] hover:text-[#111827] rounded transition-colors"
                    title="Refresh sample rows"
                  >
                    <RefreshCw size={14} className={loadingPreview ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Table Data Render */}
              <div className="relative overflow-x-auto min-h-[220px]">
                {loadingPreview ? (
                  <div className="flex flex-col items-center justify-center p-12 text-[#6F809A] gap-2">
                    <RefreshCw size={22} className="animate-spin text-[#3562B3]" />
                    <span className="text-xs">Querying BigQuery table {selectedTable}…</span>
                  </div>
                ) : previewError ? (
                  <div className="p-8 text-center text-red-700 bg-red-50/50">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-600" />
                    <p className="text-xs font-medium">{previewError}</p>
                    <button
                      type="button"
                      onClick={fetchPreview}
                      className="mt-3 px-3 py-1 bg-white border border-red-200 text-xs font-semibold rounded text-red-700 hover:bg-red-50"
                    >
                      Retry Query
                    </button>
                  </div>
                ) : previewRows.length === 0 ? (
                  <div className="p-8 text-center text-[#6F809A] text-xs">
                    No rows returned from table {selectedTable}.
                  </div>
                ) : (
                  <VisualTable visual={{ id: 'records.leads', data: previewRows }} initialView="table" className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E7EF] bg-[#F8FAFC]">
                        <th className="py-2.5 px-3 font-semibold text-[#475569] uppercase tracking-wider text-[11px] whitespace-nowrap border-r border-[#E2E7EF] w-12 text-center bg-[#F1F5F9]">
                          ID
                        </th>
                        {previewColumns.map(col => (
                          <th
                            key={col}
                            className="py-2.5 px-3 font-semibold text-[#475569] uppercase tracking-wider text-[11px] whitespace-nowrap border-r border-[#E2E7EF]"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E7EF] font-mono text-[11.5px]">
                      {previewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-[#6F809A] border-r border-[#E2E7EF] text-center bg-[#F8FAFC]/50 select-none">
                            {idx + 1}
                          </td>
                          {previewColumns.map(col => {
                            const val = row[col];
                            return (
                              <td
                                key={col}
                                className="py-2.5 px-3 whitespace-nowrap border-r border-[#E2E7EF] text-[#1E293B]"
                              >
                                {val === null || val === undefined ? (
                                  <span className="text-slate-400 italic font-mono text-xs">null</span>
                                ) : typeof val === 'boolean' ? (
                                  <span className={val ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                                    {String(val)}
                                  </span>
                                ) : typeof val === 'number' ? (
                                  <span className="font-mono tabular-nums">
                                    {val.toLocaleString()}
                                  </span>
                                ) : (
                                  <span>{String(val)}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </VisualTable>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Platform Billing Settings Content */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-[#E2E7EF] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E7EF]">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[#3562B3]" />
                  <div>
                    <h3 className="text-sm font-bold text-[#111827]">Partner Billing & Commercial Rate Cards</h3>
                    <p className="text-xs text-[#6F809A]">
                      Configure cost per lead, cost per call attempt, and activation commission values for downstream commercial reconciliation.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#315EAD] bg-[#EDF5FC] px-2.5 py-1 rounded border border-[#BDD7F4]">
                  Currency: ZAR
                </span>
              </div>

              {/* Vendor Rate Card Table */}
              <div className="overflow-x-auto">
                <VisualTable visual={{ id: 'commercial.reconciliation', data: [] }} initialView="table" className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E7EF] bg-[#F8FAFC]">
                      <th className="py-2.5 px-3 font-semibold text-[#475569] uppercase tracking-wider text-[11px]">Vendor / Partner</th>
                      <th className="py-2.5 px-3 font-semibold text-[#475569] uppercase tracking-wider text-[11px]">Billing Model</th>
                      <th className="py-2.5 px-3 font-semibold text-[#475569] uppercase tracking-wider text-[11px] text-right">Cost Per Lead (CPL)</th>
                      <th className="py-2.5 px-3 font-semibold text-[#475569] uppercase tracking-wider text-[11px] text-right">Cost Per Call</th>
                      <th className="py-2.5 px-3 font-semibold text-[#475569] uppercase tracking-wider text-[11px] text-right">Activation Commission</th>
                      <th className="py-2.5 px-3 font-semibold text-[#475569] uppercase tracking-wider text-[11px] text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E7EF]">
                    {[
                      { vendor: 'Mondo', model: 'Results Based Billing (RBB)', cpl: 'R 25.00', cpc: 'R 2.50', comm: 'R 350.00', status: 'Active' },
                      { vendor: 'Ontact - BLC', model: 'Hybrid Call & Commission', cpl: 'R 18.50', cpc: 'R 3.00', comm: 'R 420.00', status: 'Active' },
                      { vendor: 'MTN', model: 'Direct Attribution', cpl: 'R 30.00', cpc: 'R 2.80', comm: 'R 400.00', status: 'Active' },
                      { vendor: 'African Bank', model: 'Tiered CPA', cpl: 'R 22.00', cpc: 'R 2.20', comm: 'R 450.00', status: 'Active' },
                      { vendor: 'Ontact - Vodacom (BizVoip)', model: 'Dialler Volume + Sale', cpl: 'R 15.00', cpc: 'R 1.80', comm: 'R 320.00', status: 'Active' },
                      { vendor: 'Real Promotions', model: 'Fixed CPL + Revenue Share', cpl: 'R 28.00', cpc: 'R 2.50', comm: 'R 380.00', status: 'Active' },
                      { vendor: 'Rewardsco', model: 'Lead Generation', cpl: 'R 20.00', cpc: 'R 2.00', comm: 'R 300.00', status: 'Active' },
                    ].map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 px-3 font-semibold text-[#111827]">{item.vendor}</td>
                        <td className="py-2.5 px-3 text-[#475569]">{item.model}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#111827]">{item.cpl}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#111827]">{item.cpc}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#111827]">{item.comm}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </VisualTable>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
