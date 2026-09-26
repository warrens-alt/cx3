import { VisualTable } from '../components/visuals/DataVisual';
import React, { useState } from 'react';
import { PageShell } from '../components/PageShell';
import { formatTableNumber } from '../lib/formatters';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';
import PageHeader from '../components/PageHeader';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { useClient } from '../lib/ClientContext';
import { DataState } from '../components/DataState';
import { Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function Cohorts() {
  const [cohortType, setCohortType] = useState('weekly');
  const [metricType, setMetricType] = useState('sale');
  const [matrixView, setMatrixView] = useState<'table' | 'graph'>('table');
  const [funnelView, setFunnelView] = useState<'table' | 'graph'>('table');
  const { clientConfig } = useClient();
  const currencyPrefix = clientConfig?.currency === 'ZAR' ? 'R' : '$';
  
  const { data: cohorts, loading, error, refetch } = useAnalyticsData('cohorts', { cohortType, metricType });

  if (error) return <PageShell><PageHeader title="Lead Cohorts"/><DataState error={error} retry={refetch}/></PageShell>;

  if (loading) {
    return (
      <PageShell><TableSkeleton /></PageShell>
    );
  }

  if (!cohorts || cohorts.length === 0) {
    return (
      <PageShell>
        <PageHeader 
          title="Cohort Analysis" 
          category="Maturation & Lifecycle"
          description="Track metric maturation and full funnel yield over time based on capture date."
        />
        <EmptyState message="No cohort records found for the selected tenant and date range." />
      </PageShell>
    );
  }

  const getHeatmapColor = (value: number | null) => {
    if (value === null) return 'bg-surface-sec text-text-mute';
    if (metricType === 'revenue') {
      if (value >= 100) return 'bg-brand text-white font-bold';
      if (value >= 50) return 'bg-[#1e6967] text-white';
      if (value >= 25) return 'bg-[#2a9391] text-white';
      if (value >= 10) return 'bg-[#7dc4c3] text-[#0f2d2c]';
      return 'bg-[#cce8e8] text-[#0f2d2c]';
    }
    if (value >= 90) return 'bg-brand text-white';
    if (value >= 75) return 'bg-[#1e6967] text-white';
    if (value >= 50) return 'bg-[#2a9391] text-white';
    if (value >= 25) return 'bg-[#7dc4c3] text-[#0f2d2c]';
    if (value >= 10) return 'bg-[#cce8e8] text-[#0f2d2c]';
    return 'bg-[#f0f7f7] text-text-sec';
  };

  const heatmapLabel = { call_coverage: 'Dialled / Fetched Leads', sale: 'Sales / Fetched Leads', activation: 'Activations / Fetched Leads' }[metricType];

  const formatHeatmapVal = (val: number | null) => {
    if (val === null) return '-';
    if (metricType === 'revenue') return `${currencyPrefix}${val.toFixed(2)}`;
    return `${val}%`;
  };

  return (
    <PageShell>
      <PageHeader 
        title="Cohort & Funnel Maturation" 
        category="Maturation & Lifecycle Yield"
        description="Benchmark end-to-end funnel maturation rates and complete lifecycle yields by capture cohort."
      >
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="cohort-grain" className="text-xs text-text-sec font-medium">Grain:</label>
          <select 
            id="cohort-grain"
            value={cohortType} 
            onChange={(e) => setCohortType(e.target.value)}
            className="px-3 py-1.5 bg-white border border-border-strong rounded-lg text-xs text-text-main outline-none focus:border-brand font-medium shadow-xs"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <label htmlFor="cohort-metric" className="text-xs text-text-sec font-medium ml-2">Metric:</label>
          <select 
            id="cohort-metric"
            value={metricType} 
            onChange={(e) => setMetricType(e.target.value)}
            className="px-3 py-1.5 bg-white border border-border-strong rounded-lg text-xs text-text-main outline-none focus:border-brand font-medium shadow-xs"
          >
            <option value="call_coverage">Dialled / Fetched Leads (%)</option>
            <option value="sale">Sales / Fetched Leads (%)</option>
            <option value="activation">Activations / Fetched Leads (%)</option>
          </select>
        </div>
      </PageHeader>

      <div className="space-y-6 sm:space-y-8">
        {/* Heatmap Section */}
        <div className="enterprise-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle bg-surface-sec flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-card-title font-semibold text-text-main">Conversion Maturation Matrix</h2>
              <p className="text-xs text-text-sec mt-0.5">Cumulative {heatmapLabel} progression by calendar days since capture; the denominator is fetched leads in each cohort.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMatrixView('table')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                    matrixView === 'table'
                      ? 'bg-slate-100 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TableIcon size={12} /> Table
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixView('graph')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                    matrixView === 'graph'
                      ? 'bg-slate-100 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart2 size={12} /> Graph
                </button>
              </div>
              <span className="text-xs font-mono text-text-mute px-2.5 py-1 bg-surface rounded border border-border-subtle">
                D0 through D30 maturation
              </span>
            </div>
          </div>
          {matrixView === 'table' ? (
            <div className="overflow-x-auto p-4">
              <VisualTable visual={{id:'cohorts.maturity',data:(cohorts)}} className="min-w-full text-sm text-left border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="px-4 py-3 font-semibold text-text-sec uppercase tracking-wider text-xs w-32">Cohort</th>
                    <th className="px-4 py-3 text-right font-semibold text-text-sec uppercase tracking-wider text-xs w-24">Size</th>
                    <th className="px-2 py-3 text-center font-semibold text-text-sec uppercase tracking-wider text-xs w-20">D0</th>
                    <th className="px-2 py-3 text-center font-semibold text-text-sec uppercase tracking-wider text-xs w-20">D1</th>
                    <th className="px-2 py-3 text-center font-semibold text-text-sec uppercase tracking-wider text-xs w-20">D3</th>
                    <th className="px-2 py-3 text-center font-semibold text-text-sec uppercase tracking-wider text-xs w-20">D7</th>
                    <th className="px-2 py-3 text-center font-semibold text-text-sec uppercase tracking-wider text-xs w-20">D14</th>
                    <th className="px-2 py-3 text-center font-semibold text-text-sec uppercase tracking-wider text-xs w-20">D30</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((row: any, i: number) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-medium text-text-main whitespace-nowrap font-mono text-xs">{row.cohort}</td>
                      <td className="px-4 py-2 text-right text-text-main font-semibold font-mono text-xs">{formatTableNumber(row.size)}</td>
                      <td className="p-0.5">
                        <div className={`h-9 flex items-center justify-center rounded-md font-mono text-xs font-medium transition-colors ${getHeatmapColor(row.metrics?.d0)}`}>
                          {formatHeatmapVal(row.metrics?.d0)}
                        </div>
                      </td>
                      <td className="p-0.5">
                        <div className={`h-9 flex items-center justify-center rounded-md font-mono text-xs font-medium transition-colors ${getHeatmapColor(row.metrics?.d1)}`}>
                          {formatHeatmapVal(row.metrics?.d1)}
                        </div>
                      </td>
                      <td className="p-0.5">
                        <div className={`h-9 flex items-center justify-center rounded-md font-mono text-xs font-medium transition-colors ${getHeatmapColor(row.metrics?.d3)}`}>
                          {formatHeatmapVal(row.metrics?.d3)}
                        </div>
                      </td>
                      <td className="p-0.5">
                        <div className={`h-9 flex items-center justify-center rounded-md font-mono text-xs font-medium transition-colors ${getHeatmapColor(row.metrics?.d7)}`}>
                          {formatHeatmapVal(row.metrics?.d7)}
                        </div>
                      </td>
                      <td className="p-0.5">
                        <div className={`h-9 flex items-center justify-center rounded-md font-mono text-xs font-medium transition-colors ${getHeatmapColor(row.metrics?.d14)}`}>
                          {formatHeatmapVal(row.metrics?.d14)}
                        </div>
                      </td>
                      <td className="p-0.5">
                        <div className={`h-9 flex items-center justify-center rounded-md font-mono text-xs font-medium transition-colors ${getHeatmapColor(row.metrics?.d30)}`}>
                          {formatHeatmapVal(row.metrics?.d30)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </VisualTable>
            </div>
          ) : (
            <div className="p-5 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={['d0', 'd1', 'd3', 'd7', 'd14', 'd30'].map(interval => {
                    const obj: any = { interval: interval.toUpperCase() };
                    cohorts.slice(0, 5).forEach((c: any) => {
                      obj[c.cohort] = Number(c.metrics?.[interval]) || 0;
                    });
                    return obj;
                  })}
                  margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="interval" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" unit={metricType === 'revenue' ? '' : '%'} />
                  <Tooltip
                    formatter={(val: any, name: any) => [metricType === 'revenue' ? `${currencyPrefix}${Number(val).toFixed(2)}` : `${val}%`, name]}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  {cohorts.slice(0, 5).map((c: any, idx: number) => {
                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
                    return (
                      <Line
                        key={c.cohort}
                        type="monotone"
                        dataKey={c.cohort}
                        name={c.cohort}
                        stroke={colors[idx % colors.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Full Funnel Cohort Performance Table */}
        <div className="enterprise-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle bg-surface-sec flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-card-title font-semibold text-text-main">Full Funnel Performance by Cohort</h2>
              <p className="text-xs text-text-sec mt-0.5">Complete volume and conversion rates across all 8 lifecycle stages for each cohort.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setFunnelView('table')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                    funnelView === 'table'
                      ? 'bg-slate-100 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TableIcon size={12} /> Table
                </button>
                <button
                  type="button"
                  onClick={() => setFunnelView('graph')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                    funnelView === 'graph'
                      ? 'bg-slate-100 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart2 size={12} /> Graph
                </button>
              </div>
              <span className="text-xs font-medium text-text-sec">
                Showing {cohorts.length} cohorts
              </span>
            </div>
          </div>
          {funnelView === 'table' ? (
            <div className="overflow-x-auto">
              <VisualTable visual={{id:'cohorts.funnel',data:(cohorts)}} className="enterprise-table w-full">
                <thead className="bg-surface-sec text-text-sec font-semibold border-b border-border-subtle uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-5 py-3">Cohort</th>
                    <th className="px-4 py-3 text-right">Fetched Leads</th>
                    <th className="px-4 py-3 text-right">Delivered Leads</th>
                    <th className="px-4 py-3 text-right">Dialed Leads</th>
                    <th className="px-4 py-3 text-right">Right Party Contact</th>
                    <th className="px-4 py-3 text-right">Sales</th>
                    <th className="px-4 py-3 text-right">Delivered Sales</th>
                    <th className="px-4 py-3 text-right">Activated Sales</th>
                    <th className="px-4 py-3 text-right">Recorded Revenue</th>
                    <th className="px-4 py-3 text-right">Recorded Revenue / Lead</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-mono text-xs">
                  {cohorts.map((c: any, idx: number) => (
                    <tr key={idx} className="hover:bg-surface-sec/70 transition-colors">
                      <td className="px-5 py-3 font-sans font-medium text-text-main">{c.cohort}</td>
                      <td className="px-4 py-3 text-right font-medium text-text-main">{formatTableNumber(c.size)}</td>
                      <td className="px-4 py-3 text-right text-text-sec">
                        {formatTableNumber(c.delivered || 0)}
                        <span className="text-[11px] text-text-mute block font-sans">{c.deliveryRate || 0}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-text-sec">
                        {formatTableNumber(c.called || 0)}
                        <span className="text-[11px] text-text-mute block font-sans">{c.callCoverage || c.callRate || 0}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-text-sec">
                        {formatTableNumber(c.rpcs || 0)}
                        <span className="text-[11px] text-text-mute block font-sans">{c.rpcRate || 0}%</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[#315EAD]">
                        {formatTableNumber(c.sales || 0)}
                        <span className="text-[11px] text-text-mute block font-sans">{c.saleRate || 0}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-text-sec">
                        {formatTableNumber(c.billableSales || 0)}
                        <span className="text-[11px] text-text-mute block font-sans">{c.billableSaleRate || 0}%</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">
                        {formatTableNumber(c.activations || 0)}
                        <span className="text-[11px] text-text-mute block font-sans">{c.activationRate || 0}%</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-text-main">
                        {currencyPrefix}{formatTableNumber(c.revenue || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#315EAD]">
                        {currencyPrefix}{Number(c.revPerLead || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </VisualTable>
            </div>
          ) : (
            <div className="p-5 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cohorts.slice(0, 10).map((c: any) => ({
                  cohort: c.cohort,
                  leads: Number(c.size) || 0,
                  sales: Number(c.sales) || 0,
                  activations: Number(c.activations) || 0,
                  revenue: Number(c.revenue) || 0,
                }))} margin={{ top: 10, right: 30, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="cohort" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} angle={-20} textAnchor="end" height={35} />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(val: any, name: any) => [Number(val).toLocaleString(), name]}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="leads" name="Leads" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="sales" name="Sales" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="activations" name="Activations" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
