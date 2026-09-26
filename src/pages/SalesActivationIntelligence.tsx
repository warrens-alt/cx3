import React, { useEffect, useState } from 'react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchSalesActivation, type SalesActivationData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { downloadCsv } from '../lib/formatters';
import { Award, AlertTriangle, CheckCircle, Clock, DollarSign, Building2, Table as TableIcon, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from 'recharts';

export default function SalesActivationIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<SalesActivationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorViewMode, setVendorViewMode] = useState<'table' | 'graph'>('table');
  const [vendorGraphMetric, setVendorGraphMetric] = useState<'volume' | 'revenue'>('volume');

  const loadData = async (isManual = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const activeFilters = extractOffernetFilters(filters);
      const res = await fetchSalesActivation({
        clientId: selectedClient,
        startDate,
        endDate,
        ...activeFilters
      }, isManual);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales and activation intelligence');
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
      ['Vendor Partner', 'Total Sales', 'Activations', 'Activation Rate %', 'Recorded Revenue'],
      ...data.byVendor.map(v => [
        v.vendor, v.sales, v.activations, v.sales > 0 ? ((v.activations / v.sales) * 100).toFixed(1) : '0', v.revenue
      ])
    ];
    downloadCsv(`sales_activation_${selectedClient}_${startDate || 'total'}_${endDate || 'all'}`, rows);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 transition-all duration-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Sales & Activation Intelligence</h1>
            <span className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5 ml-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Contract Fulfillment & Cash Realization
            </span>
            {!startDate && !endDate && Object.keys(extractOffernetFilters(filters)).length === 0 && (
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full ml-1">
                Total (Unfiltered)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tracking sales reconciliation, billable versus non-billable contracts, activation maturation lag curves, and realized revenue.
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
            <p>Reconciling contract activations & fulfillment cohorts…</p>
          </div>
        )}

        {data && (
          <>
            {/* KPI METRIC CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Recorded Sales</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{data.reconciliation.totalSales.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-1">Contract logged in CRM/Vicidial</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
                <div className="text-[10px] uppercase font-bold text-slate-400">Sales with Recorded Revenue</div>
                <div className="text-xl font-bold text-emerald-700 mt-1">{data.reconciliation.billableSales.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-1">Revenue field is non-zero in the source</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
                <div className="text-[10px] uppercase font-bold text-slate-400">Recorded Activations</div>
                <div className="text-xl font-bold text-purple-700 mt-1">{data.reconciliation.totalActivations.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-1">Activation Rate: {data.reconciliation.activationRate}%</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
                <div className="text-[10px] uppercase font-bold text-slate-400">Recorded Revenue</div>
                <div className="text-xl font-bold text-slate-900 mt-1">R {data.reconciliation.realizedRevenue.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-1">Revenue value recorded in the selected source</div>
              </div>
            </div>

            {/* ACTIVATION MATURATION CURVE (DAY 0 TO DAY 60) */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-blue-600" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Activation Maturation Lag Curve (Days Post-Sale)
                  </h2>
                </div>
                <span className="text-xs text-slate-400 font-mono">Fulfillment Cycle: ~{data.reconciliation.avgTimeToActivation}</span>
              </div>

              {data.maturationCurve.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.maturationCurve}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" unit="%" />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }} />
                      <Area type="monotone" dataKey="cumulativePct" name="Cumulative Activated %" stroke="#8b5cf6" strokeWidth={2} fillOpacity={0.15} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
                  <div className="font-semibold">{data.maturationStatus || 'UNAVAILABLE'}</div>
                  <p className="mt-1">{data.maturationReason || 'Activation maturation is withheld until event-level joins are independently validated.'}</p>
                </div>
              )}
            </div>

            {/* VENDOR SALES & ACTIVATION BREAKDOWN */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-blue-600" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Sales Realization by Vendor Partner
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  {vendorViewMode === 'graph' && (
                    <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
                      <button
                        onClick={() => setVendorGraphMetric('volume')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          vendorGraphMetric === 'volume' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Sales & Activations
                      </button>
                      <button
                        onClick={() => setVendorGraphMetric('revenue')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          vendorGraphMetric === 'revenue' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Recorded Revenue (ZAR)
                      </button>
                    </div>
                  )}

                  <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
                    <button
                      onClick={() => setVendorViewMode('table')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                        vendorViewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="View as detailed tabular ledger"
                    >
                      <TableIcon size={13} />
                      <span>Table</span>
                    </button>
                    <button
                      onClick={() => setVendorViewMode('graph')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                        vendorViewMode === 'graph' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="View as interactive graph"
                    >
                      <BarChart3 size={13} />
                      <span>Graph</span>
                    </button>
                  </div>
                </div>
              </div>

              {vendorViewMode === 'table' ? (
                <div className="overflow-x-auto">
                  <div role="table" className="w-full text-xs text-left min-w-[600px]">
                    <div role="rowgroup" className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <div role="row" className="grid grid-cols-5 items-center py-2.5">
                        <div role="columnheader" className="px-4">Vendor Partner</div>
                        <div role="columnheader" className="px-4 text-right font-mono">Sales (040.0)</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-purple-700">Activated Sales (046.0)</div>
                        <div role="columnheader" className="px-4 text-right font-mono">Activation Rate %</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-slate-900">Recorded Revenue (ZAR)</div>
                      </div>
                    </div>
                    <div role="rowgroup" className="divide-y divide-slate-100 font-mono">
                      {data.byVendor.map((v, idx) => {
                        const actPct = v.sales > 0 ? ((v.activations / v.sales) * 100).toFixed(1) : '0';
                        return (
                          <div role="row" key={`${v.vendor || 'vendor'}-${idx}`} className="grid grid-cols-5 items-center py-3 hover:bg-slate-50/70">
                            <div role="cell" className="px-4 font-sans font-bold text-slate-900">{v.vendor}</div>
                            <div role="cell" className="px-4 text-right text-slate-800">{v.sales.toLocaleString()}</div>
                            <div role="cell" className="px-4 text-right font-bold text-purple-700">{v.activations.toLocaleString()}</div>
                            <div role="cell" className="px-4 text-right text-slate-600">{actPct}%</div>
                            <div role="cell" className="px-4 text-right font-bold text-slate-900">R {v.revenue.toLocaleString()}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byVendor} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="vendor" tick={{ fontSize: 11 }} stroke="#64748b" interval={0} />
                        <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                          formatter={(value: any, name: any) => [
                            vendorGraphMetric === 'revenue' ? `R ${Number(value).toLocaleString()}` : Number(value).toLocaleString(),
                            name
                          ]}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        {vendorGraphMetric === 'volume' ? (
                          <>
                            <Bar dataKey="sales" name="Sales (040.0)" fill="#059669" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="activations" name="Activated Sales (046.0)" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                          </>
                        ) : (
                          <Bar dataKey="revenue" name="Recorded Revenue (ZAR)" fill="#0284c7" radius={[3, 3, 0, 0]} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
