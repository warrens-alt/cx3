import { VisualTable } from '../components/visuals/DataVisual';
import React, { useMemo, useState, useDeferredValue } from 'react';
import { PageShell } from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { ArrowUpRight, ArrowDownRight, AlertTriangle, TrendingUp, ChevronRight, Search, X, Download, ArrowUpDown, ArrowUp, ArrowDown, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useNavigate, useLocation } from 'react-router-dom';
import { DataState } from '../components/DataState';
import { compareExactDecimal } from '../lib/breakdown';
import { sumExact } from '../lib/explore/model';
import { decimal, exactLabel } from '../lib/visuals/model';

const METRIC_OPTIONS = [
  { id: 'activations', label: 'Activations' },
  { id: 'sales', label: 'Sales' },
  { id: 'billable_sales', label: 'Sales with Revenue' },
  { id: 'called', label: 'Dialled Leads' },
  { id: 'leads', label: 'Fetched Leads' },
  { id: 'revenue', label: 'Recorded Revenue' },
  { id: 'rpcs', label: 'RPCs' },
];

const DIMENSION_OPTIONS = [
  { id: 'source', label: 'Source' },
  { id: 'medium', label: 'Medium' },
  { id: 'grade', label: 'Grade' },
  { id: 'vetting', label: 'Vetting' },
];

type SortKey = 'segment' | 'previous' | 'current' | 'change';

export default function Insights() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedMetric, setSelectedMetric] = useState('activations');
  const [selectedDimension, setSelectedDimension] = useState('source');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [sortKey, setSortKey] = useState<SortKey>('change');
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');
  
  const { data: insightsResponse, loading, error, refetch } = useAnalyticsData('insights', {
    metric: selectedMetric,
    dimension: selectedDimension
  });

  const rawList = insightsResponse?.data || insightsResponse || [];
  const rows: any[] = useMemo(() => Array.isArray(rawList) ? rawList : [], [rawList]);

  const changeOf = (row: any) => decimal(row.change);
  const absolute = (value: string) => value.startsWith('-') ? value.slice(1) : value;
  const label = (value: unknown) => exactLabel(decimal(value));

  const topLosers = useMemo(() => {
    return [...rows]
      .filter(d => changeOf(d) !== null && compareExactDecimal(changeOf(d)!, '0') < 0)
      .sort((a, b) => compareExactDecimal(changeOf(a)!, changeOf(b)!))
      .slice(0, 3);
  }, [rows]);

  const totalChange = useMemo(() => sumExact(rows.map(changeOf)), [rows]);
  const totalDirection = totalChange === null ? null : compareExactDecimal(totalChange, '0');

  const filteredAndSortedRows = useMemo(() => {
    let list = rows;
    const q = deferredSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(r => String(r.segment || '').toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'segment') {
        cmp = String(a.segment || '').localeCompare(String(b.segment || ''));
      } else if (sortKey === 'previous') {
        cmp = compareExactDecimal(decimal(a.previous) ?? '0', decimal(b.previous) ?? '0');
      } else if (sortKey === 'current') {
        cmp = compareExactDecimal(decimal(a.current) ?? '0', decimal(b.current) ?? '0');
      } else if (sortKey === 'change') {
        cmp = compareExactDecimal(decimal(a.change) ?? '0', decimal(b.change) ?? '0');
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [rows, deferredSearch, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const exportInsightsCsv = () => {
    const headers = [`${selectedDimension.charAt(0).toUpperCase() + selectedDimension.slice(1)} Segment`, 'Previous Period', 'Current Period', 'Absolute Change', 'Percent Change (%)', 'Previous Volume', 'Current Volume'];
    const csvRows = filteredAndSortedRows.map(r => [
      `"${String(r.segment ?? '').replace(/"/g, '""')}"`,
      `"${r.previous ?? ''}"`,
      `"${r.current ?? ''}"`,
      `"${r.change ?? ''}"`,
      `"${r.pctChange ?? ''}"`,
      `"${r.previousVolume ?? ''}"`,
      `"${r.currentVolume ?? ''}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows.map(r => r.join(','))].join('\r\n');
    const href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = href;
    a.download = `cx-insights-${selectedMetric}-${selectedDimension}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  const metricLabel = METRIC_OPTIONS.find(m => m.id === selectedMetric)?.label || selectedMetric;

  return (
    <PageShell>
      <PageHeader 
        title="Analytical Insights" 
        category="Automated Variance Decomposition"
        description="Observed differences across matched periods. Source contributions describe changes, not their causes."
      />

      <div className="flex flex-wrap items-center justify-between gap-4 p-4 enterprise-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-sec uppercase tracking-wider">Metric:</span>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="text-xs font-medium bg-surface border border-border-subtle rounded px-2.5 py-1.5 focus:outline-none focus:border-[#3562B3]"
            >
              {METRIC_OPTIONS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-sec uppercase tracking-wider">Dimension:</span>
            <select
              value={selectedDimension}
              onChange={(e) => setSelectedDimension(e.target.value)}
              className="text-xs font-medium bg-surface border border-border-subtle rounded px-2.5 py-1.5 focus:outline-none focus:border-[#3562B3]"
            >
              {DIMENSION_OPTIONS.map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-text-mute">
          Comparing matched chronological window
        </div>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <DataState error={error} retry={refetch}/>
      ) : rows.length === 0 ? (
        <EmptyState message="Not enough historical data to generate driver insights for the selected filter range." />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Summary Card */}
            <div className="enterprise-card p-6 lg:col-span-1 bg-surface-sec/30 border-l-4 border-l-[#3562B3] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-text-main font-semibold mb-3">
                  <TrendingUp className="w-5 h-5 text-[#3562B3]" />
                  {metricLabel} Variance Drivers
                </div>
                <div className="text-[14px] text-text-sec leading-relaxed">
                  During the selected period, overall {metricLabel.toLowerCase()} shifted by <strong className={`font-semibold ${totalDirection !== null && totalDirection > 0 ? 'text-semantic-pos' : totalDirection !== null && totalDirection < 0 ? 'text-semantic-neg' : ''}`}>{totalDirection !== null && totalDirection > 0 ? '+' : ''}{label(totalChange)}</strong>.
                  Below are the recorded segment contributions to this movement compared to the preceding matched period. This does not establish causation.
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border-subtle text-xs text-text-mute">
                Diagnostic grain: {selectedDimension.charAt(0).toUpperCase() + selectedDimension.slice(1)}
              </div>
            </div>

            {/* Attention Panel */}
            <div className="enterprise-card p-6 lg:col-span-2">
              <div className="flex items-center gap-2 text-text-main font-semibold mb-4">
                <AlertTriangle className="w-5 h-5 text-semantic-warn" />
                Negative Contributors ({topLosers.length})
              </div>
              <div className="space-y-3">
                {topLosers.length > 0 ? topLosers.map((loser, i) => (
                  <div 
                    key={i} 
                    onClick={() => navigate({pathname:'/explore',search:location.search})}
                    className="p-3 border border-border-subtle rounded-lg bg-surface hover:bg-surface-sec cursor-pointer transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-[13px] font-medium text-text-main">
                        Segment <span className="text-semantic-neg bg-semantic-neg/10 px-1.5 py-0.5 rounded ml-1">{loser.segment}</span> dropped by {label(absolute(changeOf(loser)!))}
                      </div>
                      <div className="text-[12px] text-text-mute mt-1">
                        Fell from {label(loser.previous)} to {label(loser.current)}. Click to investigate in Explore.
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-mute group-hover:text-[#3562B3] transition-colors" />
                  </div>
                )) : (
                  <div className="text-[13px] text-text-sec">No negative changes recorded for this metric.</div>
                )}
              </div>
            </div>
          </div>

          <div className="enterprise-card overflow-hidden">
            <div className="p-4 border-b border-border-strong bg-surface-sec flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="font-semibold text-text-main">Segment Contribution Waterfall</h2>
                <p className="text-xs text-text-sec">Decomposition across {filteredAndSortedRows.length} observed segments.</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                      viewMode === 'table'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('graph')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                      viewMode === 'graph'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>Graph</span>
                  </button>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-mute" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search segment..."
                    className="text-xs pl-8 pr-7 py-1.5 bg-surface border border-border-subtle rounded focus:outline-none focus:border-[#3562B3] w-44"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-mute hover:text-text-main"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {rows.length > 0 && (
                  <button
                    type="button"
                    onClick={exportInsightsCsv}
                    className="cx-button-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                  >
                    <Download size={13} /> Export CSV
                  </button>
                )}
              </div>
            </div>

            {viewMode === 'table' ? (
              <div className="overflow-x-auto">
                <VisualTable visual={{id:'comparison',data:rows, context:{metric:selectedMetric}}} className="enterprise-table w-full">
                  <thead>
                    <tr>
                      <th onClick={() => toggleSort('segment')} className="cursor-pointer select-none">
                        <div className="inline-flex items-center gap-1">
                          <span>Segment</span>
                          {sortKey === 'segment' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
                        </div>
                      </th>
                      <th onClick={() => toggleSort('previous')} className="cursor-pointer select-none text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <span>Previous Period</span>
                          {sortKey === 'previous' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
                        </div>
                      </th>
                      <th onClick={() => toggleSort('current')} className="cursor-pointer select-none text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <span>Current Period</span>
                          {sortKey === 'current' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
                        </div>
                      </th>
                      <th onClick={() => toggleSort('change')} className="cursor-pointer select-none text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <span>Absolute Change</span>
                          {sortKey === 'change' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
                        </div>
                      </th>
                      <th>Impact Direction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {filteredAndSortedRows.map((row: any, i: number) => {
                      const change = changeOf(row);
                      const direction = change === null ? null : compareExactDecimal(change, '0');
                      const isPositive = direction !== null && direction > 0;
                      const isNegative = direction !== null && direction < 0;
                      return (
                        <tr key={row.segment || i} className="hover:bg-surface-sec">
                          <td className="font-medium"><strong>{row.segment}</strong></td>
                          <td className="text-right text-text-sec">{label(row.previous)}</td>
                          <td className="text-right font-medium">{label(row.current)}</td>
                          <td className="text-right font-semibold">
                            {direction !== null && direction !== 0 && change !== null && (
                              <span className={`inline-flex items-center ${isPositive ? 'text-semantic-pos' : 'text-semantic-neg'}`}>
                                {isPositive ? '+' : ''}{label(change)}
                              </span>
                            )}
                            {direction === 0 && <span className="text-text-mute">-</span>}
                            {direction === null && <span className="text-text-mute">Unavailable</span>}
                          </td>
                          <td>
                            {isPositive && <div className="flex items-center text-semantic-pos text-[12px]"><ArrowUpRight className="w-3.5 h-3.5 mr-1" /> Positive Driver</div>}
                            {isNegative && <div className="flex items-center text-semantic-neg text-[12px]"><ArrowDownRight className="w-3.5 h-3.5 mr-1" /> Negative Driver</div>}
                            {direction === 0 && <div className="text-text-mute text-[12px]">Neutral</div>}
                            {direction === null && <div className="text-text-mute text-[12px]">Unavailable</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </VisualTable>
              </div>
            ) : (
              <div className="p-6">
                <div className="h-[360px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={filteredAndSortedRows.slice(0, 15).map((row: any) => ({
                        segment: row.segment,
                        previous: Number(row.previous || 0),
                        current: Number(row.current || 0),
                      }))}
                      margin={{ top: 20, right: 30, left: 10, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="segment" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" angle={-15} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(v) => Number(v).toLocaleString()} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '12px' }}
                        formatter={(val: number) => [Number(val).toLocaleString(), '']}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar dataKey="previous" name="Previous Period" fill="#94a3b8" />
                      <Bar dataKey="current" name="Current Period" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
