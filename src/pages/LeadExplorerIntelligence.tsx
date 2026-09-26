import React, { useEffect, useState } from 'react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchRawLeads, fetchLeadTimeline, type RawLeadsData, type LeadTimelineData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { downloadCsv } from '../lib/formatters';
import { 
  FileText, Search, AlertTriangle, Eye, CheckCircle, XCircle, 
  Clock, DollarSign, ChevronLeft, ChevronRight, X, PhoneCall, Award, Table as TableIcon, BarChart3 
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

export default function LeadExplorerIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<RawLeadsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');
  const pageSize = 50;

  // Selected lead for chronological timeline modal
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [timelineData, setTimelineData] = useState<LeadTimelineData | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const loadData = async (isManual = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const activeFilters = extractOffernetFilters(filters);
      const res = await fetchRawLeads({
        clientId: selectedClient,
        startDate,
        endDate,
        ...activeFilters,
        search: search || undefined,
        limit: pageSize,
        offset: page * pageSize
      }, isManual);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to query raw leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedClient, startDate, endDate, filters, page]);

  const handleOpenTimeline = async (leadId: string) => {
    setSelectedLead(leadId);
    setTimelineLoading(true);
    try {
      const res = await fetchLeadTimeline(leadId);
      setTimelineData(res);
    } catch (err) {
      console.error('Failed to load lead timeline:', err);
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadData();
  };

  const handleExportCsv = () => {
    if (!data || !data.rows.length) return;
    const headers = ['Lead ID', 'Consumer ID', 'Captured', 'Fetched', 'Source', 'Vendor', 'Grade', 'Dialled', 'RPC', 'Sale', 'Activated', 'Revenue'];
    const rows = data.rows.map(r => [
      r.lead_id, r.consumer_id, r.captured, r.fetched, r.source, r.vendor, r.grade,
      r.dialled ? 'Yes' : 'No', r.contacted ? 'Yes' : 'No', r.sale ? 'Yes' : 'No', r.activated ? 'Yes' : 'No', r.revenue
    ]);
    downloadCsv(`lead_records_${selectedClient}_p${page + 1}`, [headers, ...rows]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 transition-all duration-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Raw Lead Data Explorer</h1>
            <span className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5 ml-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
              Clustered Warehouse Records
            </span>
            {!startDate && !endDate && Object.keys(extractOffernetFilters(filters)).length === 0 && (
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full ml-1">
                Total (Unfiltered)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Search individual lead submissions, review delivery states, and inspect full chronological event audit trails.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-xs flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Lead ID, Consumer ID, or Source…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              Filter Records
            </button>
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setPage(0); }}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Clear search
              </button>
            )}
          </form>
        </div>

        {/* DATA TABLE & VISUAL ANALYTICS */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
          <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span>Showing records {page * pageSize + 1} – {(page + 1) * pageSize}</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="View individual lead rows"
                >
                  <TableIcon size={13} />
                  <span>Table</span>
                </button>
                <button
                  onClick={() => setViewMode('graph')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    viewMode === 'graph' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="View cohort analytics charts"
                >
                  <BarChart3 size={13} />
                  <span>Graph</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  className="p-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="font-mono">Page {page + 1}</span>
                <button
                  disabled={!data || data.rows.length < pageSize}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <div role="table" className="w-full text-xs text-left min-w-[900px]">
                <div role="rowgroup" className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <div role="row" className="grid grid-cols-12 items-center py-2.5">
                    <div role="columnheader" className="col-span-2 px-4">Lead ID</div>
                    <div role="columnheader" className="col-span-1 px-4">Consumer ID</div>
                    <div role="columnheader" className="col-span-2 px-4">Captured (UTC)</div>
                    <div role="columnheader" className="col-span-1 px-4">Vendor</div>
                    <div role="columnheader" className="col-span-1 px-4">Source</div>
                    <div role="columnheader" className="col-span-1 px-4">Grade</div>
                    <div role="columnheader" className="col-span-1 px-4 text-center">Dialled</div>
                    <div role="columnheader" className="col-span-1 px-4 text-center">RPC</div>
                    <div role="columnheader" className="col-span-1 px-4 text-center">Sale</div>
                    <div role="columnheader" className="col-span-1 px-4 text-right">Revenue</div>
                  </div>
                </div>
                <div role="rowgroup" className="divide-y divide-slate-100 font-mono">
                  {loading && (
                    <div role="row" className="px-4 py-8 text-center text-slate-400 font-sans">
                      Loading records from clustered warehouse…
                    </div>
                  )}
                  {!loading && data && data.rows.length === 0 && (
                    <div role="row" className="px-4 py-12 text-center text-slate-500 font-sans">
                      <Search size={24} className="mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-700">No lead records found</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting your search terms, date range, or active filters.</p>
                    </div>
                  )}
                  {!loading && data && data.rows.map((row, idx) => (
                    <div role="row" key={`${row.lead_id || 'lead'}-${idx}`} className="grid grid-cols-12 items-center py-2.5 hover:bg-slate-50/70 transition-colors">
                      <div role="cell" className="col-span-2 px-4 font-bold text-slate-900 truncate font-sans flex items-center justify-between" title={row.lead_id}>
                        <span className="truncate">{row.lead_id}</span>
                        <button
                          onClick={() => handleOpenTimeline(row.lead_id)}
                          className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors cursor-pointer shrink-0 ml-1"
                          title="View chronological lifecycle timeline"
                        >
                          <Eye size={13} />
                        </button>
                      </div>
                      <div role="cell" className="col-span-1 px-4 text-slate-600 truncate">{row.consumer_id}</div>
                      <div role="cell" className="col-span-2 px-4 text-slate-600 text-[11px] truncate">{row.captured || row.fetched}</div>
                      <div role="cell" className="col-span-1 px-4 font-sans text-slate-800 truncate">{row.vendor || '—'}</div>
                      <div role="cell" className="col-span-1 px-4 font-sans text-slate-600 truncate">{row.source || '—'}</div>
                      <div role="cell" className="col-span-1 px-4 font-sans">{row.grade || '—'}</div>
                      <div role="cell" className="col-span-1 px-4 text-center">
                        {row.dialled ? <span className="text-blue-700 font-bold">Yes</span> : <span className="text-slate-300">No</span>}
                      </div>
                      <div role="cell" className="col-span-1 px-4 text-center">
                        {row.contacted ? <span className="text-blue-700 font-bold">Yes</span> : <span className="text-slate-300">No</span>}
                      </div>
                      <div role="cell" className="col-span-1 px-4 text-center">
                        {row.sale ? <span className="text-emerald-700 font-bold">Sale</span> : <span className="text-slate-300">No</span>}
                      </div>
                      <div role="cell" className="col-span-1 px-4 text-right font-bold text-slate-900">
                        {row.revenue > 0 ? `R ${row.revenue}` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Funnel Conversion BarChart */}
              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  Cohort Funnel Progression
                </h4>
                <div className="h-64 w-full">
                  {data && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { stage: 'Fetched Leads', count: data.rows.length, fill: '#3b82f6' },
                          { stage: 'Dialed Leads', count: data.rows.filter(r => r.dialled).length, fill: '#6366f1' },
                          { stage: 'Right Party Contact', count: data.rows.filter(r => r.contacted).length, fill: '#8b5cf6' },
                          { stage: 'Sales', count: data.rows.filter(r => r.sale).length, fill: '#10b981' }
                        ]}
                        margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="stage" tick={{ fontSize: 10 }} stroke="#64748b" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                          formatter={(val: any) => [Number(val).toLocaleString(), 'Records']}
                        />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                          <Cell fill="#3b82f6" />
                          <Cell fill="#6366f1" />
                          <Cell fill="#8b5cf6" />
                          <Cell fill="#10b981" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Grade Distribution BarChart */}
              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  Lead Quality Grade Composition
                </h4>
                <div className="h-64 w-full">
                  {data && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={['A', 'B', 'C', 'D'].map(g => ({
                          grade: `Grade ${g}`,
                          count: data.rows.filter(r => r.grade === g).length
                        }))}
                        margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="grade" tick={{ fontSize: 10 }} stroke="#64748b" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                          formatter={(val: any) => [Number(val).toLocaleString(), 'Leads']}
                        />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                          <Cell fill="#10b981" />
                          <Cell fill="#3b82f6" />
                          <Cell fill="#f59e0b" />
                          <Cell fill="#64748b" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CHRONOLOGICAL TIMELINE MODAL */}
        {selectedLead && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-2 sm:p-4 backdrop-blur-2xs">
            <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 max-h-[85dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">Lead Lifecycle Event Audit</h3>
                  <span className="text-xs text-slate-500 font-mono">Lead ID: {selectedLead}</span>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-md cursor-pointer active:scale-95"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {timelineLoading && (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Loading chronological event traces…
                </div>
              )}

              {!timelineLoading && timelineData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Vendor Partner</span>
                      <span className="font-medium text-slate-900">{timelineData.vendor}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Traffic Source</span>
                      <span className="font-medium text-slate-900">{timelineData.source}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Lead Grade</span>
                      <span className="font-medium text-slate-900">{timelineData.grade}</span>
                    </div>
                  </div>

                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {timelineData.events.map((evt, idx) => (
                      <div key={`${evt.title || 'event'}-${idx}`} className="relative">
                        <span className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white ${
                          evt.status === 'SUCCESS' ? 'bg-emerald-500' :
                          evt.status === 'WARNING' ? 'bg-amber-500' : 'bg-blue-500'
                        }`} />
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-xs">{evt.title}</span>
                            <span className="text-[10px] font-mono text-slate-500">{evt.timestamp}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">{evt.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
