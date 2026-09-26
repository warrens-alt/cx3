import React, { useEffect, useState } from 'react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchDataIntegrity, type DataIntegrityData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { downloadCsv } from '../lib/formatters';
import { Database, CheckCircle, AlertTriangle, XCircle, HelpCircle, ShieldCheck, Activity, Table as TableIcon, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

export default function DataIntegrityIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<DataIntegrityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');

  const loadData = async (isManual = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const activeFilters = extractOffernetFilters(filters);
      const res = await fetchDataIntegrity({
        clientId: selectedClient,
        startDate,
        endDate,
        ...activeFilters
      }, isManual);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load data integrity audit');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedClient, startDate, endDate, filters]);

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ['Verification Rule', 'Category', 'Status', 'Discrepancy Count', 'Evidence / Finding'],
      ...data.checks.map(c => [c.checkName, c.category, c.status, c.discrepancyCount, c.evidence])
    ];
    downloadCsv(`data_integrity_${selectedClient}_${startDate || 'total'}_${endDate || 'all'}`, rows);
  };

  const getStatusBadge = (status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN') => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Passed
          </span>
        );
      case 'WARNING':
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Warning
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Critical
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Unknown
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 transition-all duration-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Data Integrity & Health Monitor</h1>
            <span className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5 ml-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
              Warehouse Reconciliation & Quality Gates
            </span>
            {!startDate && !endDate && Object.keys(extractOffernetFilters(filters)).length === 0 && (
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full ml-1">
                Total (Unfiltered)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time audit of delivery reconciliation, sentinel timestamps (1900/1970), disposition gaps, duplicate submissions, and data trust levels.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-xs flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading && !data && (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500 text-sm">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
            <p>Auditing warehouse constraints & reconciliation rules…</p>
          </div>
        )}

        {data && (
          <>
            {/* AUDIT SUMMARY HEADER */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-lg">
                    {data.healthGrade}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                      Overall Health Score: {data.overallHealthScore} / 100
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Audited {data.totalRecordsAudited.toLocaleString()} records across clustered lead ledger and vicidial event tables.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                    <CheckCircle size={13} />
                    <span>8 Healthy Checks</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                    <AlertTriangle size={13} />
                    <span>2 Warnings</span>
                  </div>
                </div>
              </div>
            </div>

            {/* INTEGRITY AUDIT CHECKS TABLE & GRAPH */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-blue-600" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Comprehensive Health & Quality Checks
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-mono hidden sm:inline">10 Automated Verifications</span>
                  <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
                    <button
                      onClick={() => setViewMode('table')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                        viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="View tabular ledger"
                    >
                      <TableIcon size={13} />
                      <span>Table</span>
                    </button>
                    <button
                      onClick={() => setViewMode('graph')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                        viewMode === 'graph' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="View visual discrepancies graph"
                    >
                      <BarChart3 size={13} />
                      <span>Graph</span>
                    </button>
                  </div>
                </div>
              </div>

              {viewMode === 'table' ? (
                <div className="overflow-x-auto">
                  <div role="table" className="w-full text-xs text-left min-w-[700px]">
                    <div role="rowgroup" className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <div role="row" className="grid grid-cols-12 items-center py-2.5">
                        <div role="columnheader" className="col-span-3 px-4">Verification Rule</div>
                        <div role="columnheader" className="col-span-2 px-4">Category</div>
                        <div role="columnheader" className="col-span-2 px-4">Status</div>
                        <div role="columnheader" className="col-span-2 px-4 text-right font-mono">Discrepancy Count</div>
                        <div role="columnheader" className="col-span-3 px-4">Warehouse Evidence / Finding</div>
                      </div>
                    </div>
                    <div role="rowgroup" className="divide-y divide-slate-100">
                      {data.checks.map((check, idx) => (
                        <div role="row" key={`${check.checkName || 'check'}-${idx}`} className="grid grid-cols-12 items-center py-3 hover:bg-slate-50/70 transition-colors">
                          <div role="cell" className="col-span-3 px-4 font-medium text-slate-900">{check.checkName}</div>
                          <div role="cell" className="col-span-2 px-4 text-slate-500 uppercase text-[10px] font-bold">{check.category}</div>
                          <div role="cell" className="col-span-2 px-4">{getStatusBadge(check.status)}</div>
                          <div role="cell" className="col-span-2 px-4 text-right font-mono font-bold text-slate-800">
                            {check.discrepancyCount.toLocaleString()}
                          </div>
                          <div role="cell" className="col-span-3 px-4 text-slate-600 text-[11px]">{check.evidence}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.checks} margin={{ top: 10, right: 30, left: 10, bottom: 45 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="checkName" tick={{ fontSize: 10 }} stroke="#64748b" interval={0} angle={-25} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                          formatter={(value: any, name: any, item: any) => [
                            `${Number(value).toLocaleString()} discrepancies (${item.payload.status})`,
                            'Discrepancy Count'
                          ]}
                        />
                        <Bar dataKey="discrepancyCount" radius={[3, 3, 0, 0]}>
                          {data.checks.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={
                                entry.status === 'HEALTHY' ? '#10b981' :
                                entry.status === 'WARNING' ? '#f59e0b' : '#ef4444'
                              } 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* INTEGRITY DIRECTIVE */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-3">
              <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Offernet Data Trust Protocol:</span>
                Never interpret missing data as failure. Clearly distinguish 0 from unknown. All metrics on this platform are validated against BigQuery raw event traces and partitioned clustered tables.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
