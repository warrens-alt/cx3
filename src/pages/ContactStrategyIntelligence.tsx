import React, { useEffect, useState } from 'react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchContactStrategy, type ContactStrategyData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { downloadCsv } from '../lib/formatters';
import { PhoneCall, AlertTriangle, TrendingDown, Clock, ShieldAlert, CheckCircle2, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line, Cell } from 'recharts';

export default function ContactStrategyIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<ContactStrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptView, setAttemptView] = useState<'table' | 'graph'>('table');
  const [returnsView, setReturnsView] = useState<'graph' | 'table'>('graph');
  const [cadenceView, setCadenceView] = useState<'list' | 'graph'>('list');

  const loadData = async (isManual = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const activeFilters = extractOffernetFilters(filters);
      const res = await fetchContactStrategy({
        clientId: selectedClient,
        startDate,
        endDate,
        ...activeFilters
      }, isManual);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load contact strategy intelligence');
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
      ['Attempt Bucket', 'Leads', 'Share %', 'Contacts', 'Contact Rate %', 'Sales', 'Sale Rate %', 'Marginal Sales', 'Call Cost (ZAR)'],
      ...data.attemptPerformance.map(a => [
        a.bucket, a.leads, `${a.sharePct}%`, a.contacted, `${a.contactRate}%`, a.sales, `${a.saleRate}%`, a.marginalSales, a.callCost
      ])
    ];
    downloadCsv(`contact_strategy_${selectedClient}_${startDate || 'total'}_${endDate || 'all'}`, rows);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 transition-all duration-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Contact Strategy & Dialling Limits</h1>
            <span className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5 ml-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
              Diminishing Returns & Redial Cadence
            </span>
            {!startDate && !endDate && Object.keys(extractOffernetFilters(filters)).length === 0 && (
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full ml-1">
                Total (Unfiltered)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Analysis of 0 to 5+ call attempts, marginal conversion gains, cost-benefit trade-offs, and optimal fatigue ceilings.
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
            <p>Evaluating dial attempt yields and marginal cost curves…</p>
          </div>
        )}

        {data && (
          <>
            {/* CALL ATTEMPTS BRACKETS TABLE & METRICS */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <PhoneCall size={16} className="text-blue-600" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Call Attempt Distribution (0 to 5+ Calls)
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setAttemptView('table')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                        attemptView === 'table'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <TableIcon size={12} /> Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttemptView('graph')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                        attemptView === 'graph'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <BarChart2 size={12} /> Graph
                    </button>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Marginal Performance</span>
                </div>
              </div>

              {attemptView === 'table' ? (
                <div className="overflow-x-auto">
                  <div role="table" className="w-full text-xs text-left min-w-[800px]">
                    <div role="rowgroup" className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <div role="row" className="grid grid-cols-10 items-center py-2.5">
                        <div role="columnheader" className="px-4">Attempt Band</div>
                        <div role="columnheader" className="px-4 text-right font-mono">Fetched Leads (022.0)</div>
                        <div role="columnheader" className="px-4 text-right font-mono">Share %</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-blue-700">Right Party Contact (039.0)</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-blue-700">RPC Rate %</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-emerald-700">Sales (040.0)</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-emerald-700">Sale Rate %</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-purple-700">Activated Sales (046.0)</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-slate-600">Dial Cost (ZAR)</div>
                        <div role="columnheader" className="px-4 text-right font-mono">Cost / Sale (CP.Sale)</div>
                      </div>
                    </div>
                    <div role="rowgroup" className="divide-y divide-slate-100 font-mono tabular-nums">
                      {data.attemptPerformance.map((a, idx) => (
                        <div role="row" key={`${a.bucket || 'bucket'}-${idx}`} className="grid grid-cols-10 items-center py-3 hover:bg-slate-50/70">
                          <div role="cell" className="px-4 font-sans font-bold text-slate-900">{a.bucket}</div>
                          <div role="cell" className="px-4 text-right text-slate-800">{a.leads.toLocaleString()}</div>
                          <div role="cell" className="px-4 text-right text-slate-500">{a.sharePct}%</div>
                          <div role="cell" className="px-4 text-right font-bold text-blue-700">{a.contacted.toLocaleString()}</div>
                          <div role="cell" className="px-4 text-right font-bold text-blue-700">{a.contactRate}%</div>
                          <div role="cell" className="px-4 text-right font-bold text-emerald-700">{a.sales.toLocaleString()}</div>
                          <div role="cell" className="px-4 text-right font-bold text-emerald-700">{a.saleRate}%</div>
                          <div role="cell" className="px-4 text-right font-bold text-purple-700">{a.activations.toLocaleString()}</div>
                          <div role="cell" className="px-4 text-right text-slate-600">R {a.callCost.toLocaleString()}</div>
                          <div role="cell" className="px-4 text-right text-slate-800">
                            {a.marginalCostPerSale > 0 ? `R ${a.marginalCostPerSale}` : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.attemptPerformance} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 10 }} stroke="#94a3b8" />
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

            {/* MARGINAL YIELD & DIMINISHING RETURNS CURVE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown size={16} className="text-amber-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                      Diminishing Returns by Attempt
                    </h3>
                  </div>
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setReturnsView('graph')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded ${
                        returnsView === 'graph' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <BarChart2 size={11} /> Graph
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnsView('table')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded ${
                        returnsView === 'table' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <TableIcon size={11} /> Table
                    </button>
                  </div>
                </div>

                {returnsView === 'graph' ? (
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.attemptPerformance.filter(a => a.bucket !== '0 calls')}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="bucket" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="sales" name="Sales Realized (040.0)" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="marginalSales" name="Marginal Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-60 overflow-y-auto border border-slate-100 rounded">
                    <table className="w-full text-xs text-left font-mono tabular-nums">
                      <thead className="bg-slate-50 text-slate-600 font-sans font-semibold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Band</th>
                          <th className="py-2 px-3 text-right">Sales (040.0)</th>
                          <th className="py-2 px-3 text-right">Marginal</th>
                          <th className="py-2 px-3 text-right">Cost / Sale (CP.Sale)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.attemptPerformance.filter(a => a.bucket !== '0 calls').map((a, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-sans font-medium text-slate-800">{a.bucket}</td>
                            <td className="py-2 px-3 text-right text-emerald-700 font-bold">{a.sales.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-blue-700 font-medium">+{a.marginalSales.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-slate-600">R {a.marginalCostPerSale}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ATTEMPT SPACING CADENCE */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-blue-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                      Recommended Re-dial Cadence
                    </h3>
                  </div>
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setCadenceView('list')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded ${
                        cadenceView === 'list' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <TableIcon size={11} /> Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setCadenceView('graph')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded ${
                        cadenceView === 'graph' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <BarChart2 size={11} /> Graph
                    </button>
                  </div>
                </div>

                {cadenceView === 'list' ? (
                  <div className="space-y-3 text-xs font-mono">
                    {data.attemptCadence.map((c, idx) => (
                      <div key={`${c.transition || 'transition'}-${idx}`} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                        <div>
                          <div className="font-sans font-bold text-slate-900">{c.transition}</div>
                          <div className="text-[11px] text-slate-500 font-sans mt-0.5">Average Spacing: {c.avgSpacing}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-blue-700 font-bold">{c.marginalRpcYield} RPC Yield</div>
                          <div className={`text-[10px] uppercase font-bold font-sans ${c.costBenefitRatio.includes('High') ? 'text-emerald-600' : c.costBenefitRatio.includes('Moderate') ? 'text-amber-600' : 'text-red-600'}`}>
                            {c.costBenefitRatio}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={data.attemptCadence.map(c => ({
                          transition: c.transition,
                          yield: parseFloat(c.marginalRpcYield.replace('%', '')) || 0,
                          costBenefit: c.costBenefitRatio
                        }))}
                        margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="transition" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" unit="%" />
                        <Tooltip
                          formatter={(val: any) => [`${val}%`, 'Marginal RPC Yield']}
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                        />
                        <Bar dataKey="yield" name="RPC Yield %" radius={[4, 4, 0, 0]}>
                          {data.attemptCadence.map((c, idx) => (
                            <Cell 
                              key={`cell-${idx}`} 
                              fill={c.costBenefitRatio.includes('High') ? '#10b981' : c.costBenefitRatio.includes('Moderate') ? '#f59e0b' : '#ef4444'} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* REPEATED NO-ANSWER ANALYSIS & CEILING RECOMMENDATION */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert size={16} className="text-red-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Contact Fatigue & Optimal Stop Threshold
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-amber-900 block font-sans">Stop Threshold</span>
                  <div className="text-base font-bold text-amber-900 mt-1 font-sans">{data.noAnswerAnalysis.stopThresholdRecommendation}</div>
                  <p className="text-[11px] text-amber-800 mt-1 font-sans">
                    Dialling leads beyond 4 attempts incurs disproportionate carrier penalties and lowers campaign-level reputation.
                  </p>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-blue-900 block font-sans">Callback Execution</span>
                  <div className="text-base font-bold text-blue-900 mt-1 font-sans">{data.noAnswerAnalysis.callbackFollowupRate}</div>
                  <p className="text-[11px] text-blue-800 mt-1 font-sans">
                    Scheduled agent callbacks convert to sales at {data.noAnswerAnalysis.callbackSaleConversion} (3.5x higher than blind redials).
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block font-sans">Operational Directive</span>
                  <p className="text-slate-700 text-xs mt-1 font-sans">
                    Re-allocate dialler capacity from 5th-attempt non-responders to leads aged under 30 minutes in the fresh intake hopper.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
