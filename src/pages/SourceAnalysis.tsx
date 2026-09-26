import { VisualTable } from '../components/visuals/DataVisual';
import React from 'react';
import { useClient } from '../lib/ClientContext';
import { PageShell } from '../components/PageShell';
import { formatTableNumber, formatChartAxis } from '../lib/formatters';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';
import PageHeader from '../components/PageHeader';
import { HorizontalBarChart } from '../components/charts/HorizontalBarChart';
import { ScatterPlot } from '../components/charts/ScatterPlot';
import { MetricCompositionDonut } from '../components/charts/MetricCompositionDonut';
import KpiCard from '../components/KpiCard';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { Compass, Sparkles, TrendingUp, DollarSign, Table as TableIcon, BarChart2 } from 'lucide-react';
import { DataState } from '../components/DataState';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function SourceAnalysis() {
  const { clientConfig } = useClient();
  const currencyPrefix = clientConfig?.currency === 'ZAR' ? 'R ' : clientConfig?.currency === 'GBP' ? '£' : '$';
  const { data: sourceData, loading, error, refetch } = useAnalyticsData('sources');

  // Keep hook order stable while the API moves between loading, data and empty states.
  const sortedByVolume = React.useMemo(() => [...(sourceData || [])].sort((a: any, b: any) => b.leads - a.leads), [sourceData]);
  // Group top 6 + other for composition donut
  const donutData = React.useMemo(() => {
    if (sortedByVolume.length <= 6) {
      return sortedByVolume.map((s: any) => ({ name: s.source, value: s.leads }));
    }
    const top5 = sortedByVolume.slice(0, 5).map((s: any) => ({ name: s.source, value: s.leads }));
    const others = sortedByVolume.slice(5).reduce((sum: number, s: any) => sum + s.leads, 0);
    return [...top5, { name: 'Other Sources', value: others }];
  }, [sortedByVolume]);

  const [viewMode, setViewMode] = React.useState<'full' | 'rates' | 'volume'>('full');
  const [displayMode, setDisplayMode] = React.useState<'table' | 'graph'>('table');


  if (error) return <PageShell><PageHeader title="Lead Sources"/><DataState error={error} retry={refetch}/></PageShell>;
  if (loading) {
    return (
      <PageShell>
        <TableSkeleton />
      </PageShell>
    );
  }

  if (!sourceData || sourceData.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Source Analysis" />
        <EmptyState message="Configure BigQuery in settings or adjust your date filters." />
      </PageShell>
    );
  }

  const sortedBySaleRate = [...sourceData].sort((a: any, b: any) => b.saleRate - a.saleRate);
  const sortedByRevPerLead = [...sourceData].sort((a: any, b: any) => b.revPerLead - a.revPerLead);

  const topVolume = sortedByVolume[0];
  const topConversion = sortedBySaleRate[0];
  const topYield = sortedByRevPerLead[0];

  const totalLeads = sourceData.reduce((sum: number, s: any) => sum + (s.leads || 0), 0);

  return (
    <PageShell>
      <PageHeader 
        title="Source Analysis & Channel Portfolio" 
        category="Channel Economics & Yield"
        description="Benchmark acquisition channels across lead volume, delivery compliance, contact yield, and commercial revenue."
      />

      {/* Top Channel Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <KpiCard 
          title="Top Volume Channel" 
          value={topVolume?.source || 'N/A'} 
          subtitle={`${formatTableNumber(topVolume?.leads || 0)} leads (${topVolume?.share || 0}% share)`}
        />
        <KpiCard 
          title="Highest Conversion" 
          value={topConversion?.saleRate ? `${topConversion.saleRate}%` : 'N/A'} 
          subtitle={`${topConversion?.source || 'N/A'} channel`}
        />
        <KpiCard 
          title="Best Revenue / Lead" 
          value={Number(topYield?.revPerLead || 0).toFixed(2)} 
          prefix={currencyPrefix}
          subtitle={`${topYield?.source || 'N/A'} channel`}
        />
        <KpiCard 
          title="Active Channels" 
          value={sourceData.length} 
          subtitle={`${formatTableNumber(totalLeads)} total acquisition volume`}
        />
      </div>

      {/* 3-Way Comparative Visual Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="min-h-[420px] flex flex-col">
          <MetricCompositionDonut
            title="Channel Volume Share"
            subtitle="Acquisition concentration across traffic sources."
            data={donutData}
            centerLabel="Total Leads"
            centerValue={formatChartAxis(totalLeads)}
            height={290}
          />
        </div>

        <div className="min-h-[420px] flex flex-col">
          <HorizontalBarChart 
            title="Lead Volume by Source" 
            subtitle="Top 8 acquisition sources by volume."
            data={sortedByVolume.slice(0, 8)}
            categoryKey="source"
            valueKey="leads"
            height={320}
          />
        </div>

        <div className="min-h-[420px] flex flex-col">
          <HorizontalBarChart 
            title="Revenue Yield by Source" 
            subtitle="Top 8 sources by revenue per lead."
            data={sortedByRevPerLead.slice(0, 8)}
            categoryKey="source"
            valueKey="revPerLead"
            valuePrefix={currencyPrefix}
            height={320}
          />
        </div>
      </div>

      {/* Portfolio Map & Strategic Quadrants */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          <div className="enterprise-card p-4 border-l-4 border-l-emerald-500 text-xs">
            <span className="font-semibold text-text-main text-sm block">Scale & Quality (Stars)</span>
            <span className="text-text-sec text-xs block mt-1 leading-relaxed">High volume + above-average sale conversion. Scale acquisition budget here.</span>
          </div>
          <div className="enterprise-card p-4 border-l-4 border-l-[#3562B3] text-xs">
            <span className="font-semibold text-text-main text-sm block">High-Yield Niches</span>
            <span className="text-text-sec text-xs block mt-1 leading-relaxed">Lower volume with high conversion rates. Test capacity expansion.</span>
          </div>
          <div className="enterprise-card p-4 border-l-4 border-l-amber-500 text-xs">
            <span className="font-semibold text-text-main text-sm block">Volume Drivers</span>
            <span className="text-text-sec text-xs block mt-1 leading-relaxed">Significant lead intake with moderate conversion. Focus on vetting & script optimization.</span>
          </div>
          <div className="enterprise-card p-4 border-l-4 border-l-rose-500 text-xs">
            <span className="font-semibold text-text-main text-sm block">Triage / Drag</span>
            <span className="text-text-sec text-xs block mt-1 leading-relaxed">Low yield and low conversion. Audit duplicate rates and lead validity.</span>
          </div>
        </div>

        <div className="min-h-[480px] flex flex-col">
          <ScatterPlot 
            title="Source Portfolio Map"
            subtitle="Evaluating channel efficiency: Lead Volume (X-axis) vs. Sale Conversion Rate (Y-axis) sized by Revenue per Lead."
            data={sourceData}
            xKey="leads"
            yKey="saleRate"
            zKey="revPerLead"
            nameKey="source"
            xLabel="Total Leads"
            yLabel="Sale Rate (%)"
            height={380}
          />
        </div>
      </div>

      {/* Granular Source Performance Table */}
      <div className="enterprise-card overflow-hidden">
        <div className="p-5 border-b border-border-subtle bg-surface-sec flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-card-title font-semibold text-text-main">Granular Channel Full Funnel Matrix</h3>
            <p className="text-xs text-text-sec mt-0.5">Comprehensive lead-to-activation conversion funnel and commercial yield per acquisition source.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setDisplayMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                  displayMode === 'table'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('graph')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                  displayMode === 'graph'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Graph</span>
              </button>
            </div>
            {displayMode === 'table' && (
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-border-strong text-xs">
                <button
                  onClick={() => setViewMode('full')}
                  className={`px-3 py-1 rounded font-medium transition-colors ${
                    viewMode === 'full' ? 'bg-brand text-white shadow-xs' : 'text-text-sec hover:text-text-main'
                  }`}
                >
                  Full Funnel
                </button>
                <button
                  onClick={() => setViewMode('rates')}
                  className={`px-3 py-1 rounded font-medium transition-colors ${
                    viewMode === 'rates' ? 'bg-brand text-white shadow-xs' : 'text-text-sec hover:text-text-main'
                  }`}
                >
                  Conversion Rates
                </button>
                <button
                  onClick={() => setViewMode('volume')}
                  className={`px-3 py-1 rounded font-medium transition-colors ${
                    viewMode === 'volume' ? 'bg-brand text-white shadow-xs' : 'text-text-sec hover:text-text-main'
                  }`}
                >
                  Volume Counts
                </button>
              </div>
            )}
          </div>
        </div>
        
        {displayMode === 'table' ? (
          <div className="overflow-x-auto">
            <VisualTable visual={{id:'sources.performance',data:(sourceData)}} className="enterprise-table w-full">
            <thead className="bg-surface-sec text-text-sec font-semibold border-b border-border-subtle uppercase tracking-wider text-xs">
              {viewMode === 'full' && (
                <tr>
                  <th className="px-5 py-3">Source</th>
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
              )}
              {viewMode === 'rates' && (
                <tr>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Fetched Leads</th>
                  <th className="px-4 py-3 text-right">Delivery %</th>
                  <th className="px-4 py-3 text-right">Dialed / Delivered (%)</th>
                  <th className="px-4 py-3 text-right">RPC / Dialed Leads (%)</th>
                  <th className="px-4 py-3 text-right">Sales / Fetched Leads (%)</th>
                  <th className="px-4 py-3 text-right">Revenue-Matched Sales / Sales (%)</th>
                  <th className="px-4 py-3 text-right">Activations / Revenue-Matched Sales (%)</th>
                  <th className="px-4 py-3 text-right">Recorded Revenue / Lead</th>
                </tr>
              )}
              {viewMode === 'volume' && (
                <tr>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Fetched Leads</th>
                  <th className="px-4 py-3 text-right">Delivered Leads</th>
                  <th className="px-4 py-3 text-right">Dialed Leads</th>
                  <th className="px-4 py-3 text-right">Right Party Contact</th>
                  <th className="px-4 py-3 text-right">Sales</th>
                  <th className="px-4 py-3 text-right">Delivered Sales</th>
                  <th className="px-4 py-3 text-right">Activated Sales</th>
                  <th className="px-4 py-3 text-right">Recorded Revenue</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-border-subtle font-mono text-xs">
              {sourceData.map((row: any, i: number) => {
                if (viewMode === 'full') {
                  return (
                    <tr key={i} className="hover:bg-surface-sec/70 transition-colors">
                      <td className="font-sans font-medium text-text-main px-5 py-3">{row.source}</td>
                      <td className="px-4 py-3 text-right font-medium text-text-main">{formatTableNumber(row.leads)}</td>
                      <td className="px-4 py-3 text-right text-text-sec">
                        {formatTableNumber(row.delivered || 0)}
                        <span className="text-[11px] text-text-mute block font-sans">{row.delivery || 0}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-text-sec">
                        {formatTableNumber(row.called || 0)}
                        <span className="text-[11px] text-text-mute block font-sans">{row.callCoverage ?? 0}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-text-sec">
                        {formatTableNumber(row.rpcs || 0)}
                        <span className="text-[11px] text-text-mute block font-sans">{row.rpcRate || 0}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-[#315EAD] font-medium">
                        {formatTableNumber(row.sales || 0)}
                        <span className="text-[11px] text-text-mute block font-sans">{row.saleRate || 0}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-text-sec">
                        {formatTableNumber(row.billableSales || 0)}
                        <span className="text-[11px] text-text-mute block font-sans">{row.billableSaleRate || 0}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                        {formatTableNumber(row.activations || 0)}
                        <span className="text-[11px] text-text-mute block font-sans">{row.activationRate || 0}%</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-text-main">{currencyPrefix}{formatTableNumber(row.revenue || 0)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#315EAD]">{currencyPrefix}{Number(row.revPerLead || 0).toFixed(2)}</td>
                    </tr>
                  );
                }
                if (viewMode === 'rates') {
                  return (
                    <tr key={i} className="hover:bg-surface-sec/70 transition-colors">
                      <td className="font-sans font-medium text-text-main px-5 py-3">{row.source}</td>
                      <td className="px-4 py-3 text-right font-medium text-text-main">{formatTableNumber(row.leads)}</td>
                      <td className="px-4 py-3 text-right text-text-sec">{row.delivery || 0}%</td>
                      <td className="px-4 py-3 text-right text-text-sec">{row.callCoverage ?? 0}%</td>
                      <td className="px-4 py-3 text-right text-text-sec">{row.rpcRate || 0}%</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#315EAD]">{row.leadToSaleRate ?? 0}%</td>
                      <td className="px-4 py-3 text-right text-text-sec">{row.billableSaleRate || 0}%</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{row.activationRate || 0}%</td>
                      <td className="px-4 py-3 text-right font-bold text-text-main">{currencyPrefix}{Number(row.revPerLead || 0).toFixed(2)}</td>
                    </tr>
                  );
                }
                return (
                  <tr key={i} className="hover:bg-surface-sec/70 transition-colors">
                    <td className="font-sans font-medium text-text-main px-5 py-3">{row.source}</td>
                    <td className="px-4 py-3 text-right font-medium text-text-main">{formatTableNumber(row.leads)}</td>
                    <td className="px-4 py-3 text-right text-text-sec">{formatTableNumber(row.delivered || 0)}</td>
                    <td className="px-4 py-3 text-right text-text-sec">{formatTableNumber(row.called || 0)}</td>
                    <td className="px-4 py-3 text-right text-text-sec">{formatTableNumber(row.rpcs || 0)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#315EAD]">{formatTableNumber(row.sales || 0)}</td>
                    <td className="px-4 py-3 text-right text-text-sec">{formatTableNumber(row.billableSales || 0)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{formatTableNumber(row.activations || 0)}</td>
                    <td className="px-4 py-3 text-right font-bold text-text-main">{currencyPrefix}{formatTableNumber(row.revenue || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </VisualTable>
        </div>
        ) : (
          <div className="p-6">
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sourceData.map((row: any) => ({
                    source: row.source,
                    leads: Number(row.leads || 0),
                    called: Number(row.called || 0),
                    sales: Number(row.sales || 0),
                    revenue: Number(row.revenue || 0),
                  }))}
                  margin={{ top: 20, right: 30, left: 10, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="source" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(v) => Number(v).toLocaleString()} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '12px' }}
                    formatter={(val: number) => [Number(val).toLocaleString(), '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} verticalAlign="top" />
                  <Bar dataKey="leads" name="Leads" fill="#64748b" />
                  <Bar dataKey="called" name="Dialled" fill="#6366f1" />
                  <Bar dataKey="sales" name="Sales" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
