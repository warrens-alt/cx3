import React, { useEffect, useState } from 'react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchTemporal, type TemporalData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { downloadCsv } from '../lib/formatters';
import { Clock, AlertTriangle, Calendar, Sun, CheckCircle, Table as TableIcon, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function TemporalIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<TemporalData | null>(null);
  const [metricView, setMetricView] = useState<'volume' | 'contactRate' | 'saleRate'>('contactRate');
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (isManual = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const activeFilters = extractOffernetFilters(filters);
      const res = await fetchTemporal({
        clientId: selectedClient,
        startDate,
        endDate,
        ...activeFilters
      }, isManual);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load temporal intelligence');
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
      ['Day', 'Hour', 'Volume', 'Contact Rate %', 'Sale Rate %'],
      ...data.heatmap.map(h => [h.dayName, `${h.hour}:00`, h.volume, `${h.contactRate}%`, `${h.saleRate}%`])
    ];
    downloadCsv(`temporal_intelligence_${selectedClient}_${startDate || 'total'}_${endDate || 'all'}`, rows);
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Helper to color heatmap cells
  const getCellColor = (val: number, max: number, type: string) => {
    if (val === 0) return 'bg-slate-100 text-slate-400';
    const intensity = Math.min(1, val / (max || 1));
    if (type === 'contactRate') {
      if (intensity > 0.7) return 'bg-blue-600 text-white font-bold';
      if (intensity > 0.4) return 'bg-blue-400 text-white font-medium';
      if (intensity > 0.2) return 'bg-blue-200 text-blue-900';
      return 'bg-blue-50 text-blue-800';
    } else if (type === 'saleRate') {
      if (intensity > 0.7) return 'bg-emerald-600 text-white font-bold';
      if (intensity > 0.4) return 'bg-emerald-400 text-white font-medium';
      if (intensity > 0.2) return 'bg-emerald-200 text-emerald-900';
      return 'bg-emerald-50 text-emerald-800';
    } else {
      if (intensity > 0.7) return 'bg-purple-600 text-white font-bold';
      if (intensity > 0.4) return 'bg-purple-400 text-white font-medium';
      if (intensity > 0.2) return 'bg-purple-200 text-purple-900';
      return 'bg-purple-50 text-purple-800';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 transition-all duration-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Temporal Intelligence</h1>
            <span className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5 ml-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500" />
              Day × Hour Conversion Heatmaps
            </span>
            {!startDate && !endDate && Object.keys(extractOffernetFilters(filters)).length === 0 && (
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full ml-1">
                Total (Unfiltered)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Receptivity patterns by day-of-week and hour-of-day, peak dialler efficiency windows, and optimal calling schedules.
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
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-3"></div>
            <p>Constructing time-of-day & day-of-week matrix…</p>
          </div>
        )}

        {data && (
          <>
            {/* HEATMAP CARD & HOURLY PROFILE */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-blue-600" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    24-Hour Operational Heatmap
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-medium">
                    <button
                      onClick={() => setMetricView('contactRate')}
                      className={`px-3 py-1 rounded transition-colors ${metricView === 'contactRate' ? 'bg-white shadow-xs text-blue-700 font-bold' : 'text-slate-600'}`}
                    >
                      RPC Rate % (039.0)
                    </button>
                    <button
                      onClick={() => setMetricView('saleRate')}
                      className={`px-3 py-1 rounded transition-colors ${metricView === 'saleRate' ? 'bg-white shadow-xs text-emerald-700 font-bold' : 'text-slate-600'}`}
                    >
                      Sale Rate % (040.0)
                    </button>
                    <button
                      onClick={() => setMetricView('volume')}
                      className={`px-3 py-1 rounded transition-colors ${metricView === 'volume' ? 'bg-white shadow-xs text-purple-700 font-bold' : 'text-slate-600'}`}
                    >
                      Fetched Leads (022.0)
                    </button>
                  </div>

                  <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
                    <button
                      onClick={() => setViewMode('table')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                        viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="View tabular heatmap grid"
                    >
                      <TableIcon size={13} />
                      <span>Table</span>
                    </button>
                    <button
                      onClick={() => setViewMode('graph')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                        viewMode === 'graph' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="View 24-hour diurnal trend graph"
                    >
                      <BarChart3 size={13} />
                      <span>Graph</span>
                    </button>
                  </div>
                </div>
              </div>

              {viewMode === 'table' ? (
                /* Heatmap Grid */
                <div className="overflow-x-auto pb-2">
                  <div className="min-w-[700px]">
                    {/* Hours Header */}
                    <div className="grid grid-cols-25 text-center text-[10px] text-slate-400 font-mono mb-1">
                      <div className="text-left font-sans font-bold">Day / Hour</div>
                      {hours.map(h => (
                        <div key={h} className="truncate">{h}:00</div>
                      ))}
                    </div>

                    {/* Day rows */}
                    <div className="space-y-1">
                      {days.map((dayName, dayIndex) => {
                        const dayRows = data.heatmap.filter(r => r.dayName === dayName);

                        return (
                          <div key={dayName} className="grid grid-cols-25 items-center gap-1 text-[11px] font-mono">
                            <div className="font-sans font-medium text-slate-700 text-xs pr-2 truncate">
                              {dayName}
                            </div>
                            {hours.map(h => {
                              const match = dayRows.find(r => r.hour === h);
                              const val = match 
                                ? (metricView === 'contactRate' ? match.contactRate : metricView === 'saleRate' ? match.saleRate : match.volume)
                                : 0;
                              const maxVal = metricView === 'contactRate' ? 25 : metricView === 'saleRate' ? 10 : 800;
                              const colorClass = getCellColor(val, maxVal, metricView);

                              return (
                                <div
                                  key={h}
                                  title={`${dayName} at ${h}:00 - ${metricView}: ${val}`}
                                  className={`h-8 rounded flex items-center justify-center text-[10px] cursor-pointer transition-transform hover:scale-105 ${colorClass}`}
                                >
                                  {val > 0 ? (metricView === 'volume' ? val : `${val}%`) : '–'}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* Diurnal Trend Chart */
                <div className="py-2">
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={hours.map(h => {
                          const hourRows = data.heatmap.filter(r => r.hour === h);
                          const totalVol = hourRows.reduce((acc, curr) => acc + (curr.volume || 0), 0);
                          const avgContact = hourRows.length ? Number((hourRows.reduce((acc, curr) => acc + (curr.contactRate || 0), 0) / hourRows.length).toFixed(1)) : 0;
                          const avgSale = hourRows.length ? Number((hourRows.reduce((acc, curr) => acc + (curr.saleRate || 0), 0) / hourRows.length).toFixed(1)) : 0;
                          return {
                            hourLabel: `${h}:00`,
                            contactRate: avgContact,
                            saleRate: avgSale,
                            volume: totalVol
                          };
                        })}
                        margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                      >
                        <defs>
                          <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                            <stop 
                              offset="5%" 
                              stopColor={metricView === 'contactRate' ? '#2563eb' : metricView === 'saleRate' ? '#059669' : '#8b5cf6'} 
                              stopOpacity={0.4}
                            />
                            <stop 
                              offset="95%" 
                              stopColor={metricView === 'contactRate' ? '#2563eb' : metricView === 'saleRate' ? '#059669' : '#8b5cf6'} 
                              stopOpacity={0.0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="hourLabel" tick={{ fontSize: 10 }} stroke="#64748b" interval={1} />
                        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" unit={metricView === 'volume' ? '' : '%'} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                          formatter={(value: any, name: any) => [
                            metricView === 'volume' ? Number(value).toLocaleString() : `${value}%`,
                            metricView === 'contactRate' ? 'Avg Contact Rate' : metricView === 'saleRate' ? 'Avg Sale Rate' : 'Total Lead Volume'
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey={metricView}
                          name={metricView === 'contactRate' ? 'Avg Contact Rate' : metricView === 'saleRate' ? 'Avg Sale Rate' : 'Total Lead Volume'}
                          stroke={metricView === 'contactRate' ? '#2563eb' : metricView === 'saleRate' ? '#059669' : '#8b5cf6'}
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorMetric)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* PEAK OPERATING WINDOWS & STRATEGY DIRECTIVES */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
              <div className="flex items-center gap-2 mb-4">
                <Sun size={16} className="text-amber-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Peak Dialler Productivity Windows
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.peakWindows.map((pw, idx) => (
                  <div key={`${pw.window || 'window'}-${idx}`} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900 text-xs">{pw.window}</span>
                      <span className="text-xs font-mono uppercase text-emerald-700 font-bold flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {pw.saleIndex}
                      </span>
                    </div>
                    <div className="text-blue-700 font-bold text-sm mb-1">{pw.contactRate} Contact Yield</div>
                    <p className="text-xs text-slate-600">{pw.verdict}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
