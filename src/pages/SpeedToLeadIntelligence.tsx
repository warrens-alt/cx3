import React, { useEffect, useState } from 'react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchSpeedToLead, type SpeedToLeadData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { downloadCsv } from '../lib/formatters';
import { Zap, Clock, AlertTriangle, Moon, Sun, ArrowDown, ArrowUpRight, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell } from 'recharts';

export default function SpeedToLeadIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<SpeedToLeadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stagesView, setStagesView] = useState<'table' | 'graph'>('table');
  const [cohortsView, setCohortsView] = useState<'both' | 'chart' | 'table'>('both');
  const [afterHoursView, setAfterHoursView] = useState<'cards' | 'graph'>('cards');

  const loadData = async (isManual = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const activeFilters = extractOffernetFilters(filters);
      const res = await fetchSpeedToLead({
        clientId: selectedClient,
        startDate,
        endDate,
        ...activeFilters
      }, isManual);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load speed to lead intelligence');
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
      ['Cohort / Stage', 'Leads', 'Contact Rate', 'Sale Rate', 'Activation Rate'],
      ...data.cohorts.map(c => [c.cohort, c.leads, `${c.contactRate}%`, `${c.saleRate}%`, `${c.activationRate}%`])
    ];
    downloadCsv(`speed_to_lead_${selectedClient}_${startDate || 'total'}_${endDate || 'all'}`, rows);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 transition-all duration-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Speed to Lead Intelligence</h1>
            <span className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5 ml-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
              Multi-Stage Latency & Cohort Decay
            </span>
            {!startDate && !endDate && Object.keys(extractOffernetFilters(filters)).length === 0 && (
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full ml-1">
                Total (Unfiltered)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Granular stage timing (Capture → Fetch → Delivery → First Dial → Contact), lead-age decay cohorts, and after-hours operational impact.
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
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mb-3"></div>
            <p>Calculating speed-to-lead percentiles and age cohorts…</p>
          </div>
        )}

        {data && (
          <>
            {/* 5 DISTINCT TIMING STAGES (AVG, MEDIAN, P75, P90) */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-blue-600" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Distinct Lifecycle Latency Stages
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setStagesView('table')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                        stagesView === 'table'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <TableIcon size={12} /> Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setStagesView('graph')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                        stagesView === 'graph'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <BarChart2 size={12} /> Graph
                    </button>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">P50 / P75 / P90 Distributions</span>
                </div>
              </div>

              {stagesView === 'table' ? (
                <div className="overflow-x-auto">
                  <div role="table" className="w-full text-xs text-left min-w-[700px]">
                    <div role="rowgroup" className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <div role="row" className="grid grid-cols-6 items-center py-2.5">
                        <div role="columnheader" className="px-4">Timing Stage</div>
                        <div role="columnheader" className="px-4">Operational Scope</div>
                        <div role="columnheader" className="px-4 text-right font-mono">Average</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-blue-700">Median (P50)</div>
                        <div role="columnheader" className="px-4 text-right font-mono">P75</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-red-700">P90 Tail</div>
                      </div>
                    </div>
                    <div role="rowgroup" className="divide-y divide-slate-100 font-mono tabular-nums">
                      {data.timingStages.map((s, idx) => (
                        <div role="row" key={`${s.stage || 'stage'}-${idx}`} className="grid grid-cols-6 items-center py-3 hover:bg-slate-50/70 transition-colors">
                          <div role="cell" className="px-4 font-sans font-bold text-slate-900 flex items-center gap-1.5">
                            <Zap size={13} className="text-amber-500" />
                            <span>{s.stage}</span>
                          </div>
                          <div role="cell" className="px-4 font-sans text-slate-600 text-[11px]">{s.description}</div>
                          <div role="cell" className="px-4 text-right text-slate-700">{s.avg}</div>
                          <div role="cell" className="px-4 text-right font-bold text-blue-700">{s.median}</div>
                          <div role="cell" className="px-4 text-right text-slate-700">{s.p75}</div>
                          <div role="cell" className="px-4 text-right font-bold text-red-600">{s.p90}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.timingStages} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="stage" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" unit="s" label={{ value: 'Latency (seconds)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                      <Tooltip
                        formatter={(val: any, name: any) => [`${Number(val).toLocaleString()}s`, name]}
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar dataKey="medianSec" name="Median (P50)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="p75Sec" name="P75" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="p90Sec" name="P90 Tail" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* CONVERSION BY LEAD-AGE COHORTS */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-amber-600" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Conversion Rates by Lead-Age Cohort (Time to First Dial)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setCohortsView('both')}
                      className={`px-2 py-0.5 font-medium rounded ${
                        cohortsView === 'both' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Both
                    </button>
                    <button
                      type="button"
                      onClick={() => setCohortsView('chart')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded ${
                        cohortsView === 'chart' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <BarChart2 size={11} /> Graph
                    </button>
                    <button
                      type="button"
                      onClick={() => setCohortsView('table')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded ${
                        cohortsView === 'table' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <TableIcon size={11} /> Table
                    </button>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">0–5m → 24h+ Decay</span>
                </div>
              </div>

              {/* Cohort Chart */}
              {(cohortsView === 'both' || cohortsView === 'chart') && (
                <div className="h-64 w-full mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.cohorts}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="cohort" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#94a3b8" unit="%" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#cbd5e1" />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar yAxisId="left" dataKey="contactRate" name="RPC Rate % (039.0)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="left" dataKey="saleRate" name="Sale Rate % (040.0)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Cohort Grid Table */}
              {(cohortsView === 'both' || cohortsView === 'table') && (
                <div className="overflow-x-auto">
                  <div role="table" className="w-full text-xs text-left min-w-[700px]">
                    <div role="rowgroup" className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <div role="row" className="grid grid-cols-8 items-center py-2">
                        <div role="columnheader" className="px-4">Lead Age Cohort</div>
                        <div role="columnheader" className="px-4 text-right">Fetched Leads (022.0)</div>
                        <div role="columnheader" className="px-4 text-right">Right Party Contact (039.0)</div>
                        <div role="columnheader" className="px-4 text-right text-blue-700">RPC Rate %</div>
                        <div role="columnheader" className="px-4 text-right">Sales (040.0)</div>
                        <div role="columnheader" className="px-4 text-right text-emerald-700">Sale Rate %</div>
                        <div role="columnheader" className="px-4 text-right">Activated Sales (046.0)</div>
                        <div role="columnheader" className="px-4 text-right text-purple-700">Activation Rate %</div>
                      </div>
                    </div>
                    <div role="rowgroup" className="divide-y divide-slate-100 font-mono tabular-nums">
                      {data.cohorts.map((c, idx) => (
                        <div role="row" key={`${c.cohort || 'cohort'}-${idx}`} className="grid grid-cols-8 items-center py-2.5 hover:bg-slate-50/70">
                          <div role="cell" className="px-4 font-sans font-medium text-slate-900">{c.cohort}</div>
                          <div role="cell" className="px-4 text-right text-slate-800">{c.leads.toLocaleString()}</div>
                          <div role="cell" className="px-4 text-right text-slate-700">{c.contacted.toLocaleString()}</div>
                          <div role="cell" className="px-4 text-right font-bold text-blue-700">{c.contactRate}%</div>
                          <div role="cell" className="px-4 text-right text-slate-700">{c.sales.toLocaleString()}</div>
                          <div role="cell" className="px-4 text-right font-bold text-emerald-700">{c.saleRate}%</div>
                          <div role="cell" className="px-4 text-right text-slate-700">{c.activations.toLocaleString()}</div>
                          <div role="cell" className="px-4 text-right font-bold text-purple-700">{c.activationRate}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* AFTER-HOURS VS BUSINESS HOURS ANALYSIS */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Sun size={16} className="text-amber-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Operating Hours vs After-Hours Capture Analysis
                  </h3>
                </div>
                <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAfterHoursView('cards')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                      afterHoursView === 'cards'
                        ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TableIcon size={12} /> Cards & Metrics
                  </button>
                  <button
                    type="button"
                    onClick={() => setAfterHoursView('graph')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                      afterHoursView === 'graph'
                        ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BarChart2 size={12} /> Graph
                  </button>
                </div>
              </div>

              {afterHoursView === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.afterHours.map((ah) => {
                    const isNight = ah.type.includes('After Hours');
                    return (
                      <div 
                        key={ah.type} 
                        className={`p-4 rounded-lg border ${isNight ? 'bg-slate-50 border-slate-300' : 'bg-amber-50/50 border-amber-200'}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {isNight ? <Moon size={16} className="text-slate-600" /> : <Sun size={16} className="text-amber-600" />}
                            <h4 className="font-bold text-slate-900 text-xs">{ah.type}</h4>
                          </div>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                            {ah.leads.toLocaleString()} leads
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                          <div className="bg-white p-2.5 rounded border border-slate-200/80">
                            <span className="text-[10px] text-slate-400 block font-sans">Contact Rate</span>
                            <span className="text-sm font-bold text-blue-700">{ah.contactRate}%</span>
                          </div>
                          <div className="bg-white p-2.5 rounded border border-slate-200/80">
                            <span className="text-[10px] text-slate-400 block font-sans">Sale Rate</span>
                            <span className="text-sm font-bold text-emerald-700">{ah.saleRate}%</span>
                          </div>
                          <div className="bg-white p-2.5 rounded border border-slate-200/80">
                            <span className="text-[10px] text-slate-400 block font-sans">Avg Lag to Dial</span>
                            <span className="text-sm font-bold text-slate-900">{ah.avgTimeToFirstDial}</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 mt-3">
                          {isNight 
                            ? 'Leads captured overnight wait until morning shift start, suffering noticeable decay in consumer receptivity.' 
                            : 'Leads captured during standard operations achieve optimal real-time hopper injection.'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.afterHours} margin={{ top: 10, right: 10, left: 10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="type" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" unit="%" />
                      <Tooltip
                        formatter={(val: any, name: any) => [`${val}%`, name]}
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="contactRate" name="Contact Rate %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="saleRate" name="Sale Rate %" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
