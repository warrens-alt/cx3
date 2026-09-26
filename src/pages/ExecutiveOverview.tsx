import React, { useEffect, useState } from 'react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchOverview, type OverviewData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { 
  Users, CheckCircle, PhoneCall, TrendingUp, Award, DollarSign, 
  ArrowUpRight, ArrowDownRight, AlertTriangle, HelpCircle, Layers, Activity,
  Table as TableIcon, BarChart2
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend } from 'recharts';

export default function ExecutiveOverview() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lifecycleView, setLifecycleView] = useState<'cards' | 'graph'>('cards');
  const [commercialView, setCommercialView] = useState<'table' | 'graph'>('table');
  const [dailyView, setDailyView] = useState<'graph' | 'table'>('graph');
  const [dailyMetricFilter, setDailyMetricFilter] = useState<'dual' | 'leads' | 'sales' | 'rate'>('dual');

  const loadData = async (isManual = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const activeFilters = extractOffernetFilters(filters);
      const res = await fetchOverview({
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...activeFilters
      }, isManual);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load executive overview');
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
      ['Metric', 'Value', 'Unit'],
      ['Fetched Leads', data.kpis.fetchedLeads, 'leads'],
      ['Delivered Leads', data.kpis.deliveredLeads, 'leads'],
      ['Delivery Rate', `${data.kpis.deliveryRate}%`, 'percentage'],
      ['Dialled Leads', data.kpis.dialledLeads, 'leads'],
      ['Dial Rate', `${data.kpis.dialRate}%`, 'percentage'],
      ['Contacted Leads (RPC)', data.kpis.contactedLeads, 'leads'],
      ['Contact Rate', `${data.kpis.contactRate}%`, 'percentage'],
      ['Sales Recorded', data.kpis.saleLeads, 'leads'],
      ['Lead to Sale Rate', `${data.kpis.leadToSaleRate}%`, 'percentage'],
      ['Contact to Sale Rate', `${data.kpis.contactToSaleRate}%`, 'percentage'],
      ['Activations', data.kpis.activatedLeads, 'leads'],
      ['Activation Rate', `${data.kpis.activationRate}%`, 'percentage'],
      ['Total Calls Dialled', data.kpis.totalCalls, 'calls'],
      ['Calls per Lead', data.kpis.callsPerLead, 'ratio'],
      ['Recorded Revenue', `R ${data.kpis.revenue.toLocaleString()}`, 'ZAR'],
      ['Recorded Revenue per Lead', `R ${data.kpis.revenuePerLead}`, 'ZAR']
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `executive_overview_${selectedClient}_${startDate || 'total'}_${endDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const kpis = data?.kpis;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Filter Bar */}
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 transition-all duration-200">
        {/* Header & Sub-title */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Executive Overview</h1>
              <span className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5 ml-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live Ledger Sync
              </span>
              {!startDate && !endDate && Object.keys(extractOffernetFilters(filters)).length === 0 && (
                <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full ml-1">
                  Total (Unfiltered)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              End-to-end operational funnel across {data?.clientName || 'Master Platform'}. Commercial cost and profitability outputs remain withheld until approved cost contracts are available.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-2xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Reporting Window</span>
              <span className="font-semibold text-slate-800">{startDate && endDate ? `${startDate} → ${endDate}` : 'All Time (Total - Unfiltered)'}</span>
            </div>
            <div className="border-l border-slate-200 pl-3">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Base Currency</span>
              <span className="font-semibold text-slate-800">ZAR (R)</span>
            </div>
          </div>
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
            <p>Aggregating warehouse operational intelligence…</p>
          </div>
        )}

        {data && kpis && (
          <>
            {/* FULL LIFECYCLE STAGE-BY-STAGE WATERFALL */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-blue-600" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Full Lifecycle Progression
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setLifecycleView('cards')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                        lifecycleView === 'cards'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <TableIcon size={12} /> Cards & Drop-off
                    </button>
                    <button
                      type="button"
                      onClick={() => setLifecycleView('graph')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                        lifecycleView === 'graph'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <BarChart2 size={12} /> Graph
                    </button>
                  </div>
                  <span className="hidden md:inline text-xs text-slate-500 font-mono">
                    Fetched → Activation
                  </span>
                </div>
              </div>

              {lifecycleView === 'cards' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                  {data.funnelStages.map((stage, idx) => (
                    <div 
                      key={stage.name} 
                      className={`relative p-3 rounded-lg border transition-all ${
                        idx === 5 ? 'bg-emerald-50/50 border-emerald-200/90' :
                        idx === 6 ? 'bg-purple-50/50 border-purple-200/90' :
                        idx === 3 ? 'bg-blue-50/50 border-blue-200/90' :
                        'bg-white border-slate-200/90'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5 font-mono">
                        <span className="font-semibold text-slate-700 truncate">{idx + 1}. {stage.name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{stage.rate}%</span>
                      </div>
                      <div className="text-lg font-bold text-slate-900 tracking-tight font-mono tabular-nums">
                        {stage.volume.toLocaleString()}
                      </div>
                      {idx < data.funnelStages.length - 1 ? (
                        <div className="mt-2 text-[10.5px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5 font-mono">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Drop-off:</span>
                          <span className={`font-semibold tabular-nums ${stage.dropoffPct > 50 ? 'text-amber-700' : 'text-slate-600'}`}>
                            {stage.dropoffPct}%
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 text-[10.5px] text-emerald-700 flex items-center justify-between border-t border-emerald-100 pt-1.5 font-mono font-semibold">
                          <span className="text-[10px] uppercase">Final Stage</span>
                          <span>Active</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.funnelStages} margin={{ top: 12, right: 10, left: 0, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" angle={-15} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const stage = payload[0].payload;
                          const firstVal = data.funnelStages[0]?.volume || 1;
                          const ofFirst = ((stage.volume / firstVal) * 100).toFixed(1);
                          return (
                            <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[190px] ring-1 ring-black/5">
                              <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-2 flex items-center justify-between">
                                <span>{stage.name}</span>
                                <span className="text-[10px] font-mono text-slate-400">Milestone</span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-slate-500">Volume</span>
                                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                                    {stage.volume.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3 text-blue-700">
                                  <span>From Inbound</span>
                                  <span className="font-mono font-semibold tabular-nums">
                                    {ofFirst}%
                                  </span>
                                </div>
                                {stage.dropoffPct > 0 && (
                                  <div className="flex items-center justify-between gap-3 text-rose-700 pt-1 border-t border-slate-100 text-[11px]">
                                    <span>Drop-off to Next</span>
                                    <span className="font-mono font-semibold tabular-nums">
                                      {stage.dropoffPct}%
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="volume" radius={[4, 4, 0, 0]} maxBarSize={48}>
                        {data.funnelStages.map((_, idx) => (
                          <Cell 
                            key={`cell-${idx}`} 
                            fill={idx === 5 ? '#059669' : idx === 6 ? '#7c3aed' : idx === 3 ? '#2563eb' : idx === 2 ? '#4f46e5' : '#1e3a52'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* CORE OPERATIONAL KPIs GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="bg-white border border-slate-200/90 rounded-lg p-3 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-[10.5px] uppercase font-semibold text-slate-500 tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span>Total Leads</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums tracking-tight">
                    {kpis.fetchedLeads.toLocaleString()}
                  </div>
                </div>
                <div className={`text-[10px] font-semibold flex items-center gap-0.5 mt-2 pt-1.5 border-t border-slate-100 ${
                  (data.comparison?.fetchedDelta ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  <ArrowUpRight size={11} className={(data.comparison?.fetchedDelta ?? 0) < 0 ? 'rotate-90' : ''} />
                  {(data.comparison?.fetchedDelta ?? 0) >= 0 ? `+${data.comparison?.fetchedDelta}%` : `${data.comparison?.fetchedDelta}%`} vs Prior
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-lg p-3 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-[10.5px] uppercase font-semibold text-slate-500 tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>Delivery Rate</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums tracking-tight">
                    {kpis.deliveryRate}%
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="font-mono tabular-nums font-medium">{kpis.deliveredLeads.toLocaleString()} dispatched</span>
                  {data.comparison?.deliveryRateDelta !== undefined && (
                    <span className={`font-mono text-[9px] font-semibold ${data.comparison.deliveryRateDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {data.comparison.deliveryRateDelta >= 0 ? `+${data.comparison.deliveryRateDelta}%` : `${data.comparison.deliveryRateDelta}%`}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-lg p-3 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-[10.5px] uppercase font-semibold text-slate-500 tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span>Dial Rate</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums tracking-tight">
                    {kpis.dialRate}%
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="font-mono tabular-nums font-medium">{kpis.dialledLeads.toLocaleString()} attempted</span>
                  {data.comparison?.dialRateDelta !== undefined && (
                    <span className={`font-mono text-[9px] font-semibold ${data.comparison.dialRateDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {data.comparison.dialRateDelta >= 0 ? `+${data.comparison.dialRateDelta}%` : `${data.comparison.dialRateDelta}%`}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-lg p-3 shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-[10.5px] uppercase font-semibold text-blue-700 tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    <span>Contact Rate</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-blue-700 mt-1 font-mono tabular-nums tracking-tight">
                    {kpis.contactRate}%
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="font-mono tabular-nums font-medium text-slate-700">{kpis.contactedLeads.toLocaleString()} RPCs</span>
                  {data.comparison?.contactRateDelta !== undefined && (
                    <span className={`font-mono text-[9px] font-semibold ${data.comparison.contactRateDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {data.comparison.contactRateDelta >= 0 ? `+${data.comparison.contactRateDelta}%` : `${data.comparison.contactRateDelta}%`}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-lg p-3 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-[10.5px] uppercase font-semibold text-emerald-800 tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Lead-to-Sale</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1 font-mono tabular-nums tracking-tight">
                    {kpis.leadToSaleRate}%
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="font-mono tabular-nums font-medium text-slate-700">{kpis.saleLeads.toLocaleString()} sales</span>
                  {data.comparison?.saleRateDelta !== undefined && (
                    <span className={`font-mono text-[9px] font-semibold ${data.comparison.saleRateDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {data.comparison.saleRateDelta >= 0 ? `+${data.comparison.saleRateDelta}%` : `${data.comparison.saleRateDelta}%`}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-lg p-3 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-[10.5px] uppercase font-semibold text-emerald-800 tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <span>RPC-to-Sale</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1 font-mono tabular-nums tracking-tight">
                    {kpis.contactToSaleRate}%
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-slate-100">
                  Sale per contact
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-lg p-3 shadow-2xs hover:border-purple-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-[10.5px] uppercase font-semibold text-purple-800 tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <span>Activation</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-purple-700 mt-1 font-mono tabular-nums tracking-tight">
                    {kpis.activationRate}%
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="font-mono tabular-nums font-medium text-slate-700">{kpis.activatedLeads.toLocaleString()} active</span>
                  {data.comparison?.activationRateDelta !== undefined && (
                    <span className={`font-mono text-[9px] font-semibold ${data.comparison.activationRateDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {data.comparison.activationRateDelta >= 0 ? `+${data.comparison.activationRateDelta}%` : `${data.comparison.activationRateDelta}%`}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-lg p-3 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-[10.5px] uppercase font-semibold text-slate-500 tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span>Dials / Lead</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums tracking-tight">
                    {kpis.callsPerLead}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-slate-100 truncate">
                  <span className="font-mono tabular-nums font-medium">{kpis.totalCalls.toLocaleString()}</span> total dials
                </div>
              </div>
            </div>

            {/* COMMERCIAL DATA STATUS */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign size={16} className="text-blue-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Recorded Revenue & Commercial Status
                </h3>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 mb-4">
                <span className="font-semibold">Profitability metrics withheld.</span>{' '}
                {data.commercialReason || 'Approved incurred-cost and rate-card contracts are required before contribution, margin, CPS, CPA or break-even values can be reported.'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Recorded Revenue</div>
                  <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">R {kpis.revenue.toLocaleString()}</div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Recorded Revenue / Lead</div>
                  <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">R {kpis.revenuePerLead}</div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Commercial Validation</div>
                  <div className="mt-1 text-sm font-bold font-mono text-amber-700">{data.commercialStatus || 'UNAVAILABLE'}</div>
                </div>
              </div>
            </div>

            {/* DAILY OPERATIONAL RUN-RATE CHARTS */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-blue-600" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Daily Volume & Revenue Run-Rate
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                    {(['dual', 'leads', 'sales', 'rate'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDailyMetricFilter(m)}
                        className={`px-2 py-1 font-medium rounded capitalize transition-colors ${
                          dailyMetricFilter === m
                            ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {m === 'dual' ? 'Dual Axes' : m === 'rate' ? 'Conv Rate %' : m}
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setDailyView('graph')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                        dailyView === 'graph'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <BarChart2 size={12} /> Graph
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyView('table')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                        dailyView === 'table'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <TableIcon size={12} /> Table
                    </button>
                  </div>
                  <span className="hidden sm:inline text-xs text-slate-400">Past 30 Days</span>
                </div>
              </div>

              {dailyView === 'graph' ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={data.dailyTrends.map(d => ({
                        ...d,
                        convRate: d.leads > 0 ? Number(((d.sales / d.leads) * 100).toFixed(2)) : 0
                      }))}
                      margin={{ top: 10, right: 14, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01}/>
                        </linearGradient>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#059669" stopOpacity={0.01}/>
                        </linearGradient>
                        <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" dy={5} />
                      
                      {dailyMetricFilter === 'dual' ? (
                        <>
                          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                        </>
                      ) : dailyMetricFilter === 'rate' ? (
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" unit="%" />
                      ) : (
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                      )}

                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          const point = payload[0].payload;
                          return (
                            <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[190px] ring-1 ring-black/5">
                              <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-2 font-mono">
                                {label}
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-1.5 text-slate-600">
                                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                                    <span>Leads Fetched</span>
                                  </div>
                                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                                    {point.leads.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-1.5 text-slate-600">
                                    <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                                    <span>Sales Recorded</span>
                                  </div>
                                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                                    {point.sales.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3 text-purple-700 pt-1 border-t border-slate-100 font-semibold">
                                  <span>Daily Conv Rate</span>
                                  <span className="font-mono tabular-nums">{point.convRate}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />

                      {(dailyMetricFilter === 'dual' || dailyMetricFilter === 'leads') && (
                        <Area 
                          yAxisId={dailyMetricFilter === 'dual' ? 'left' : undefined}
                          type="monotone" 
                          dataKey="leads" 
                          name="Leads Fetched" 
                          stroke="#2563eb" 
                          strokeWidth={2} 
                          fillOpacity={1} 
                          fill="url(#colorLeads)" 
                        />
                      )}

                      {(dailyMetricFilter === 'dual' || dailyMetricFilter === 'sales') && (
                        <Area 
                          yAxisId={dailyMetricFilter === 'dual' ? 'right' : undefined}
                          type="monotone" 
                          dataKey="sales" 
                          name="Sales Recorded" 
                          stroke="#059669" 
                          strokeWidth={2.2} 
                          fillOpacity={1} 
                          fill="url(#colorSales)" 
                        />
                      )}

                      {dailyMetricFilter === 'rate' && (
                        <Area 
                          type="monotone" 
                          dataKey="convRate" 
                          name="Conversion Rate %" 
                          stroke="#7c3aed" 
                          strokeWidth={2.2} 
                          fillOpacity={1} 
                          fill="url(#colorRate)" 
                        />
                      )}
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-64 overflow-y-auto border border-slate-200 rounded">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3 text-right">Fetched Leads (022.0)</th>
                        <th className="py-2 px-3 text-right">Sales (040.0)</th>
                        <th className="py-2 px-3 text-right">Lead-to-Sale Rate (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {data.dailyTrends.map((d, i) => {
                        const conv = d.leads > 0 ? ((d.sales / d.leads) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-slate-700">{d.date}</td>
                            <td className="py-2 px-3 text-right text-blue-700 font-medium">{d.leads.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-emerald-700 font-medium">{d.sales.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-slate-600">{conv}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
