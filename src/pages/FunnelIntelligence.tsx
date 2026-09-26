import React, { useEffect, useState } from 'react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchFunnel, type FunnelData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { downloadCsv } from '../lib/formatters';
import { Filter, Clock, AlertTriangle, Layers, Building2, Share2, Award, ChevronRight, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell } from 'recharts';

export default function FunnelIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorView, setVendorView] = useState<'table' | 'graph'>('table');
  const [sourceView, setSourceView] = useState<'table' | 'graph'>('table');
  const [gradeView, setGradeView] = useState<'table' | 'graph'>('table');

  const loadData = async (isManual = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const activeFilters = extractOffernetFilters(filters);
      const res = await fetchFunnel({
        clientId: selectedClient,
        startDate,
        endDate,
        ...activeFilters
      }, isManual);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load funnel intelligence');
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
      ['Dimension', 'Segment', 'Leads', 'Contacted', 'Sales', 'Activations'],
      ...data.byVendor.map(v => ['Vendor', v.vendor, v.leads, v.contacted, v.sales, v.activations]),
      ...data.bySource.map(s => ['Source', s.source, s.leads, s.contacted, s.sales, s.activations]),
      ...data.byGrade.map(g => ['Grade', g.grade, g.leads, g.contacted, g.sales, g.activations])
    ];
    downloadCsv(`funnel_intelligence_${selectedClient}_${startDate || 'total'}_${endDate || 'all'}`, rows);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 transition-all duration-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Funnel</h1>
            <span className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5 ml-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
              Stage progression & loss
            </span>
            {!startDate && !endDate && Object.keys(extractOffernetFilters(filters)).length === 0 && (
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full ml-1">
                Total (Unfiltered)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Stage progression duration, drop-off velocities, and multi-dimensional breakdown across vendors, sources, and lead grades.
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
            <p>Analyzing stage progression & drop-off velocities…</p>
          </div>
        )}

        {data && (
          <>
            {/* STAGE PROGRESSION VELOCITY */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-blue-600" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Stage Velocity & Progression Latency
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="text-[10.5px] uppercase font-semibold text-slate-500 tracking-wider">Capture → Delivery</div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums tracking-tight">{data.velocity.fetchToDelivery}</div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-slate-200/60">Routing & dispatch</div>
                </div>

                <div className="p-3.5 bg-amber-50/50 rounded-lg border border-amber-200/80 hover:border-amber-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="text-[10.5px] uppercase font-semibold text-amber-800 tracking-wider">Delivery → First Dial</div>
                    <div className="text-xl sm:text-2xl font-bold text-amber-700 mt-1 font-mono tabular-nums tracking-tight">{data.velocity.deliveryToFirstDial}</div>
                  </div>
                  <div className="text-[10px] text-amber-700 font-medium mt-2 pt-1.5 border-t border-amber-200/60">Dialler hopper intake</div>
                </div>

                <div className="p-3.5 bg-blue-50/40 rounded-lg border border-blue-200/80 hover:border-blue-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="text-[10.5px] uppercase font-semibold text-blue-800 tracking-wider">First Dial → Contact</div>
                    <div className="text-xl sm:text-2xl font-bold text-blue-700 mt-1 font-mono tabular-nums tracking-tight">{data.velocity.firstDialToContact}</div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-blue-200/60">RPC event timestamp is not independently modelled</div>
                </div>

                <div className="p-3.5 bg-emerald-50/40 rounded-lg border border-emerald-200/80 hover:border-emerald-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="text-[10.5px] uppercase font-semibold text-emerald-800 tracking-wider">Contact → Sale</div>
                    <div className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1 font-mono tabular-nums tracking-tight">{data.velocity.contactToSale}</div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-emerald-200/60">Callback & QA closing</div>
                </div>

                <div className="p-3.5 bg-purple-50/40 rounded-lg border border-purple-200/80 hover:border-purple-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="text-[10.5px] uppercase font-semibold text-purple-800 tracking-wider">Sale → Activation</div>
                    <div className="text-xl sm:text-2xl font-bold text-purple-700 mt-1 font-mono tabular-nums tracking-tight">{data.velocity.saleToActivation}</div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-purple-200/60">Fulfillment & billing</div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-md flex items-start gap-2 text-xs text-slate-700">
                <AlertTriangle size={15} className="text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Latency interpretation:</span> delivery → first dial is measured from source timestamps. First dial → RPC remains unavailable until an RPC event timestamp is independently validated.
                </div>
              </div>
            </div>

            {/* VENDOR FUNNEL COMPARISON TABLE */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-blue-600" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Vendor Conversion Performance
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setVendorView('table')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                        vendorView === 'table'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <TableIcon size={12} /> Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setVendorView('graph')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                        vendorView === 'graph'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <BarChart2 size={12} /> Graph
                    </button>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Stage Volumes</span>
                </div>
              </div>

              {vendorView === 'table' ? (
                <div className="overflow-x-auto">
                  <div role="table" className="w-full text-xs text-left min-w-[800px]">
                    <div role="rowgroup" className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <div role="row" className="grid grid-cols-11 items-center py-2.5">
                        <div role="columnheader" className="px-3">Vendor</div>
                        <div role="columnheader" className="px-3 text-right">Fetched Leads (022.0)</div>
                        <div role="columnheader" className="px-3 text-right">Delivered Leads (033.0)</div>
                        <div role="columnheader" className="px-3 text-right">Delivery Rate %</div>
                        <div role="columnheader" className="px-3 text-right">Dialed Leads (037.0)</div>
                        <div role="columnheader" className="px-3 text-right">RPC (039.0)</div>
                        <div role="columnheader" className="px-3 text-right">RPC Rate %</div>
                        <div role="columnheader" className="px-3 text-right">Sales (040.0)</div>
                        <div role="columnheader" className="px-3 text-right">Sale Rate %</div>
                        <div role="columnheader" className="px-3 text-right">Activated Sales (046.0)</div>
                        <div role="columnheader" className="px-3 text-right">Activation Rate %</div>
                      </div>
                    </div>
                    <div role="rowgroup" className="divide-y divide-slate-100 font-mono tabular-nums">
                      {data.byVendor.map((v, idx) => {
                        const delivRate = v.leads > 0 ? ((v.delivered / v.leads) * 100).toFixed(1) : '0.0';
                        const contactRate = v.dialled > 0 ? ((v.contacted / v.dialled) * 100).toFixed(1) : (v.delivered > 0 ? ((v.contacted / v.delivered) * 100).toFixed(1) : '0.0');
                        const saleRate = v.contacted > 0 ? ((v.sales / v.contacted) * 100).toFixed(1) : '0.0';
                        const actRate = v.sales > 0 ? ((v.activations / v.sales) * 100).toFixed(1) : '0.0';

                        return (
                          <div role="row" key={`${v.vendor || 'vendor'}-${idx}`} className="grid grid-cols-11 items-center py-2.5 hover:bg-slate-50/70 transition-colors">
                            <div role="cell" className="px-3 font-sans font-medium text-slate-900 truncate">{v.vendor}</div>
                            <div role="cell" className="px-3 text-right text-slate-800">{v.leads.toLocaleString()}</div>
                            <div role="cell" className="px-3 text-right text-slate-700">{v.delivered.toLocaleString()}</div>
                            <div role="cell" className="px-3 text-right text-slate-700">{delivRate}%</div>
                            <div role="cell" className="px-3 text-right text-slate-700">{v.dialled.toLocaleString()}</div>
                            <div role="cell" className="px-3 text-right text-blue-700 font-bold">{v.contacted.toLocaleString()}</div>
                            <div role="cell" className="px-3 text-right text-blue-700 font-bold">{contactRate}%</div>
                            <div role="cell" className="px-3 text-right text-emerald-700 font-bold">{v.sales.toLocaleString()}</div>
                            <div role="cell" className="px-3 text-right text-emerald-700 font-bold">{saleRate}%</div>
                            <div role="cell" className="px-3 text-right text-purple-700 font-bold">{v.activations.toLocaleString()}</div>
                            <div role="cell" className="px-3 text-right text-purple-700 font-bold">{actRate}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byVendor} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="vendor" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-15} textAnchor="end" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                      <Tooltip
                        formatter={(val: any, name: any) => [Number(val).toLocaleString(), name]}
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar dataKey="leads" name="Fetched Leads" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="contacted" name="Right Party Contact (RPC)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="sales" name="Sales" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="activations" name="Activated Sales" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* SOURCE & GRADE BREAKDOWNS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* By Source */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Share2 size={16} className="text-blue-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                      Lead Source Conversion
                    </h3>
                  </div>
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setSourceView('table')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded ${
                        sourceView === 'table'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <TableIcon size={11} /> Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceView('graph')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded ${
                        sourceView === 'graph'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <BarChart2 size={11} /> Graph
                    </button>
                  </div>
                </div>

                {sourceView === 'table' ? (
                  <div className="space-y-2 text-xs font-mono tabular-nums">
                    {data.bySource.map((s, idx) => {
                      const conv = s.leads > 0 ? ((s.sales / s.leads) * 100).toFixed(2) : '0.00';
                      return (
                        <div key={`${s.source || 'source'}-${idx}`} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                          <span className="font-sans font-medium text-slate-800">{s.source}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-slate-500">{s.leads.toLocaleString()} leads</span>
                            <span className="text-blue-700 font-bold">{s.contacted.toLocaleString()} RPCs</span>
                            <span className="text-emerald-700 font-bold">{s.sales.toLocaleString()} sales ({conv}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-56 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.bySource} margin={{ top: 10, right: 10, left: 10, bottom: 15 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="source" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <Tooltip
                          formatter={(val: any, name: any) => [Number(val).toLocaleString(), name]}
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar dataKey="leads" name="Leads" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="contacted" name="RPCs" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="sales" name="Sales" fill="#10b981" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* By Grade */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Award size={16} className="text-purple-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                      Lead Grade Conversion
                    </h3>
                  </div>
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setGradeView('table')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded ${
                        gradeView === 'table'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <TableIcon size={11} /> Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setGradeView('graph')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded ${
                        gradeView === 'graph'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <BarChart2 size={11} /> Graph
                    </button>
                  </div>
                </div>

                {gradeView === 'table' ? (
                  <div className="space-y-2 text-xs font-mono tabular-nums">
                    {data.byGrade.map((g, idx) => {
                      const conv = g.leads > 0 ? ((g.sales / g.leads) * 100).toFixed(2) : '0.00';
                      return (
                        <div key={`${g.grade || 'grade'}-${idx}`} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                          <span className="font-sans font-medium text-slate-800">{g.grade}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-slate-500">{g.leads.toLocaleString()} leads</span>
                            <span className="text-blue-700 font-bold">{g.contacted.toLocaleString()} RPCs</span>
                            <span className="text-emerald-700 font-bold">{g.sales.toLocaleString()} sales ({conv}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-56 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byGrade} margin={{ top: 10, right: 10, left: 10, bottom: 15 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="grade" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <Tooltip
                          formatter={(val: any, name: any) => [Number(val).toLocaleString(), name]}
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar dataKey="leads" name="Leads" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="contacted" name="RPCs" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="sales" name="Sales" fill="#10b981" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
