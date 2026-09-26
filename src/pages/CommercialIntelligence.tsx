import React, { useEffect, useState } from 'react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchCommercial, type CommercialData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { downloadCsv } from '../lib/formatters';
import { DollarSign, AlertTriangle, TrendingUp, Sliders, RefreshCw, Layers, Table as TableIcon, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

export default function CommercialIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<CommercialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pnlViewMode, setPnlViewMode] = useState<'table' | 'graph'>('table');

  // Scenario Simulator Inputs
  const [volumeDeltaPct, setVolumeDeltaPct] = useState<number>(0);
  const [cplAdjustment, setCplAdjustment] = useState<number>(45);
  const [conversionRateDeltaPct, setConversionRateDeltaPct] = useState<number>(0);
  const [costPerMinute, setCostPerMinute] = useState<number>(1.25);

  const loadData = async (isManual = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const activeFilters = extractOffernetFilters(filters);
      const res = await fetchCommercial({
        clientId: selectedClient,
        startDate,
        endDate,
        ...activeFilters
      }, isManual);
      setData(res);
      if (res.baseline) {
        setCplAdjustment(res.baseline.cpl || 45);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load commercial intelligence');
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
      ['P&L Line Item', 'Amount (ZAR)', 'Type'],
      ...data.pAndLBreakdown.map(p => [p.item, p.amount, p.type]),
      ['---', '---', '---'],
      ['Simulated Scenario', 'Volume', 'Revenue (ZAR)', 'Contribution (ZAR)', 'Margin %', 'Cost / Sale (ZAR)'],
      ['Simulated Output', simVolume, Math.round(simRevenue), Math.round(simContribution), `${simMarginPct}%`, simCps]
    ];
    downloadCsv(`commercial_intelligence_${selectedClient}_${startDate || 'total'}_${endDate || 'all'}`, rows);
  };

  // Dynamic Scenario Calculations
  const baseline = data?.baseline;
  const simVolume = baseline ? Math.round(baseline.volume * (1 + volumeDeltaPct / 100)) : 0;
  const simConvRate = baseline ? (baseline.conversionRate * (1 + conversionRateDeltaPct / 100)) : 0;
  const simSales = Math.round(simVolume * (simConvRate / 100));
  const simRevPerSale = baseline?.revenuePerSale && baseline.revenuePerSale > 0 ? baseline.revenuePerSale : 350;
  const simRevenue = simSales * simRevPerSale;
  const simDirectCost = simVolume * cplAdjustment;
  const simTelephonyCost = simVolume * (baseline?.cpc || 14.5) * (costPerMinute / 1.25);
  const simOverhead = (baseline?.fixedOverhead || 15000) + (simRevenue * 0.1);
  const simTotalCost = simDirectCost + simTelephonyCost + simOverhead;
  const simContribution = simRevenue - simTotalCost;
  const simMarginPct = simRevenue > 0 ? ((simContribution / simRevenue) * 100).toFixed(1) : '0';
  const simCps = simSales > 0 ? (simTotalCost / simSales).toFixed(2) : '0';
  const simBreakEvenVolume = simRevPerSale > 0 ? Math.ceil(simTotalCost / simRevPerSale) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 transition-all duration-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Commercial Intelligence & Unit Economics</h1>
            <span className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5 ml-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              P&L Model & Scenario Simulator
            </span>
            {!startDate && !endDate && Object.keys(extractOffernetFilters(filters)).length === 0 && (
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full ml-1">
                Total (Unfiltered)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reconciliation of gross revenue, media acquisition cost, dialler telephony expenses, net contribution, and break-even simulation.
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
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-3"></div>
            <p>Compiling commercial ledger and unit cost breakdown…</p>
          </div>
        )}

        {data && baseline && (
          <>
            {/* CURRENT PERIOD P&L TABLE */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-emerald-600" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                      Standard Operational P&L (Current Scope)
                    </h2>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-mono hidden sm:inline">Currency: ZAR (R)</span>
                    <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
                      <button
                        onClick={() => setPnlViewMode('table')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                          pnlViewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="View tabular ledger"
                      >
                        <TableIcon size={13} />
                        <span>Table</span>
                      </button>
                      <button
                        onClick={() => setPnlViewMode('graph')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                          pnlViewMode === 'graph' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="View visual ledger breakdown"
                      >
                        <BarChart3 size={13} />
                        <span>Graph</span>
                      </button>
                    </div>
                  </div>
                </div>

                {pnlViewMode === 'table' ? (
                  <div className="space-y-3 text-xs">
                    {data.pAndLBreakdown.map((row, idx) => {
                      const isTotal = row.type === 'total';
                      const isSubtotal = row.type === 'subtotal';
                      const isExpense = row.type === 'expense';

                      return (
                        <div 
                          key={`${row.item || 'item'}-${idx}`} 
                          className={`flex items-center justify-between py-2 ${
                            isTotal ? 'border-t-2 border-slate-300 font-bold text-sm bg-slate-50 px-2 rounded' :
                            isSubtotal ? 'border-t border-slate-200 font-bold text-slate-900' :
                            'border-b border-slate-100 text-slate-700'
                          }`}
                        >
                          <span className={isExpense ? 'text-red-700' : isTotal ? 'text-slate-900' : ''}>
                            {row.item}
                          </span>
                          <span className={`font-mono ${isExpense ? 'text-red-700 font-semibold' : 'font-bold text-slate-900'}`}>
                            {row.amount < 0 ? `-R ${Math.abs(row.amount).toLocaleString()}` : `R ${row.amount.toLocaleString()}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-2">
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.pAndLBreakdown.map(r => ({
                            item: r.item.replace('Less: ', '').replace('Net ', ''),
                            amount: r.amount,
                            isNegative: r.amount < 0,
                            absAmount: Math.abs(r.amount),
                            type: r.type
                          }))}
                          margin={{ top: 10, right: 20, left: 10, bottom: 40 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="item" tick={{ fontSize: 10 }} stroke="#64748b" interval={0} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                            formatter={(value: any, name: any, item: any) => [
                              item.payload.amount < 0 ? `-R ${Number(value).toLocaleString()}` : `R ${Number(value).toLocaleString()}`,
                              'Amount'
                            ]}
                          />
                          <Bar dataKey="absAmount" radius={[3, 3, 0, 0]}>
                            {data.pAndLBreakdown.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={
                                  entry.type === 'total' ? '#059669' :
                                  entry.type === 'expense' ? '#ef4444' :
                                  entry.type === 'subtotal' ? '#3b82f6' : '#10b981'
                                } 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-100">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Contribution Margin</span>
                    <div className="text-base font-bold text-slate-900 mt-1">{baseline.marginPct}%</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Cost per Sale (CP.Sale - 040.0)</span>
                    <div className="text-base font-bold text-slate-900 mt-1">R {baseline.costPerSale}</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Cost per Activation (CPS.Activated - 046.0)</span>
                    <div className="text-base font-bold text-slate-900 mt-1">R {baseline.costPerActivation.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* COMMERCIAL SUMMARY METRICS */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-3">
                    Unit Economics Summary
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fetched Leads (022.0):</span>
                      <span className="font-bold text-slate-800">{baseline.volume.toLocaleString()} leads</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Average CPL.Fetched:</span>
                      <span className="font-bold text-slate-800">R {baseline.cpl.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Recorded Revenue:</span>
                      <span className="font-bold text-slate-800">R {baseline.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Costs:</span>
                      <span className="font-bold text-red-600">-R {baseline.totalCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-2">
                      <span className="text-slate-500">Break-even Sales (040.0):</span>
                      <span className="font-bold text-slate-900">{baseline.breakEvenVolume.toLocaleString()} sales</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
                  <span className="font-bold block mb-1">Profitability Lever:</span>
                  Reducing lead acquisition cost from R45 to R38 lifts net contribution by over R550,000 across the active cohort.
                </div>
              </div>
            </div>

            {/* INTERACTIVE SCENARIO SIMULATOR */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sliders size={16} className="text-blue-600" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Interactive Commercial Scenario Simulator
                  </h3>
                </div>

                <button
                  onClick={() => {
                    setVolumeDeltaPct(0);
                    setCplAdjustment(baseline.cpl || 45);
                    setConversionRateDeltaPct(0);
                    setCostPerMinute(1.25);
                  }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <RefreshCw size={12} />
                  <span>Reset to Baseline</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs mb-4">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">
                    Volume Shift: <span className="font-bold text-slate-900">{volumeDeltaPct > 0 ? `+${volumeDeltaPct}%` : `${volumeDeltaPct}%`}</span>
                  </label>
                  <input
                    type="range"
                    min="-50"
                    max="100"
                    step="5"
                    value={volumeDeltaPct}
                    onChange={(e) => setVolumeDeltaPct(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>-50%</span>
                    <span>Baseline</span>
                    <span>+100%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">
                    Lead Acquisition Cost (CPL): <span className="font-bold text-slate-900">R {cplAdjustment}</span>
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="80"
                    step="1"
                    value={cplAdjustment}
                    onChange={(e) => setCplAdjustment(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>R20</span>
                    <span>R45</span>
                    <span>R80</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">
                    Conversion Rate Shift: <span className="font-bold text-slate-900">{conversionRateDeltaPct > 0 ? `+${conversionRateDeltaPct}%` : `${conversionRateDeltaPct}%`}</span>
                  </label>
                  <input
                    type="range"
                    min="-40"
                    max="60"
                    step="5"
                    value={conversionRateDeltaPct}
                    onChange={(e) => setConversionRateDeltaPct(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>-40%</span>
                    <span>Baseline</span>
                    <span>+60%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">
                    Dialler Cost / Min: <span className="font-bold text-slate-900">R {costPerMinute.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min="0.80"
                    max="2.50"
                    step="0.05"
                    value={costPerMinute}
                    onChange={(e) => setCostPerMinute(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>R0.80</span>
                    <span>R1.25</span>
                    <span>R2.50</span>
                  </div>
                </div>
              </div>

              {/* SIMULATED OUTCOMES CARD */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Simulated Volume</span>
                  <div className="text-base font-bold text-slate-900 mt-1">{simVolume.toLocaleString()}</div>
                  <span className="text-[10px] text-slate-500">{simSales.toLocaleString()} sales</span>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Simulated Revenue</span>
                  <div className="text-base font-bold text-slate-900 mt-1">R {Math.round(simRevenue).toLocaleString()}</div>
                  <span className="text-[10px] text-slate-500">Gross realization</span>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Simulated Contribution</span>
                  <div className={`text-base font-bold mt-1 ${simContribution >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    R {Math.round(simContribution).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500">Margin: {simMarginPct}%</span>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Simulated CPS</span>
                  <div className="text-base font-bold text-slate-900 mt-1">R {simCps}</div>
                  <span className="text-[10px] text-slate-500">Cost / Sale</span>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Required Break-even</span>
                  <div className="text-base font-bold text-slate-900 mt-1">{simBreakEvenVolume.toLocaleString()}</div>
                  <span className="text-[10px] text-slate-500">Target volume</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
