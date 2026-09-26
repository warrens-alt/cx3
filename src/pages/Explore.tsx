import React, { useState, useEffect } from 'react';
import { PageShell } from '../components/PageShell';
import { useClient } from '../lib/ClientContext';
import { useFilters } from '../lib/FilterContext';
import PageHeader from '../components/PageHeader';
import { formatTableNumber, formatTableCurrency, formatChartAxis } from '../lib/formatters';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { ChartSkeleton } from '../components/Skeleton';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend 
} from 'recharts';
import { 
  Play, 
  Settings2, 
  BarChart2, 
  TrendingUp, 
  PieChart as PieIcon, 
  Table as TableIcon,
  Activity,
  Award,
  Layers
} from 'lucide-react';

const METRICS = [
  { id: 'leads', label: 'Fetched Leads' },
  { id: 'delivered', label: 'Delivered Leads' },
  { id: 'called', label: 'Dialed Leads' },
  { id: 'rpcs', label: 'Right Party Contact' },
  { id: 'sales', label: 'Sales' },
  { id: 'billable_sales', label: 'Delivered Sales' },
  { id: 'activations', label: 'Activated Sales' },
  { id: 'revenue', label: 'Recorded Revenue' },
  { id: 'delivery_rate', label: 'Fetched-to-Delivered Lead Rate (%)' },
  { id: 'dial_rate', label: 'Fetched-to-Dialed Lead Rate (%)' },
  { id: 'call_coverage', label: 'Dialed / Delivered Leads (%)' },
  { id: 'rpc_rate', label: 'RPC / Dialed Leads (%)' },
  { id: 'sale_rate', label: 'Sales / Dialed Leads (%)' },
  { id: 'lead_to_sale_rate', label: 'Sales / Fetched Leads (%)' },
  { id: 'billable_sale_rate', label: 'Revenue-Matched Sales / Sales (%)' },
  { id: 'activation_rate', label: 'Activations / Sales (%)' },
  { id: 'revenue_per_lead', label: 'Recorded Revenue per Fetched Lead' },
  { id: 'revenue_per_sale', label: 'Recorded Revenue per Lead with a Sale' },
  { id: 'calls_per_lead', label: 'Call Attempts per Fetched Lead' }
];

const DIMENSIONS = [
  { id: 'date', label: 'Date (Daily)' },
  { id: 'source', label: 'Lead Source' },
  { id: 'vendor', label: 'HLC Vendor' },
  { id: 'routing_depth', label: 'Routing Depth' },
  { id: 'revet_status', label: 'Revet Status' },
  { id: 'valid_lead', label: 'Validation Flag' }
];

const DONUT_COLORS = [
  '#247F7D', '#18364F', '#0284c7', '#6366f1', 
  '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#64748b'
];

export default function Explore() {
  const { startDate, endDate, filters } = useFilters();
  const { clientId } = useClient();
  const [metric, setMetric] = useState('leads');
  const [dimension, setDimension] = useState('source');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area' | 'donut' | 'table'>('bar');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeQuery = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric,
          dimension,
          startDate,
          endDate,
          filters,
          clientId: clientId || 'default'
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Query failed');
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeQuery();
  }, [startDate, endDate, filters, metric, dimension]);

  const rows: any[] = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.data?.data)
      ? data.data.data
      : [];

  const totalSampleSize = rows.reduce((acc: number, r: any) => acc + (Number(r?.sampleSize) || 0), 0);
  const isRate = metric.includes('rate');
  const currencyPrefix = data?.metadata?.currency || 'R ';

  const formatY = (val: number) => 
    isRate ? `${(val * 100).toFixed(1)}%` : metric.includes('revenue') ? `${currencyPrefix}${formatChartAxis(val)}` : formatChartAxis(val);

  const formatTooltip = (val: number) => 
    isRate ? `${(val * 100).toFixed(2)}%` : metric.includes('revenue') ? formatTableCurrency(val, currencyPrefix) : formatTableNumber(val);

  // Derived statistics for the results header
  const metricValues = rows.map(r => Number(r.value) || 0);
  const totalMetricSum = metricValues.reduce((a, b) => a + b, 0);
  const avgMetricVal = rows.length > 0 ? totalMetricSum / rows.length : 0;
  
  const sortedRows = [...rows].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  const topContributor = sortedRows[0];
  const top3Sum = sortedRows.slice(0, 3).reduce((acc, r) => acc + (Number(r.value) || 0), 0);
  const top3Share = totalMetricSum > 0 ? ((top3Sum / totalMetricSum) * 100).toFixed(1) : '0';

  // Prepare top-N + other data for donut chart
  const donutData = React.useMemo(() => {
    if (rows.length <= 7) {
      return rows.map(r => ({ name: r.dim1 || '(None)', value: Number(r.value) || 0 }));
    }
    const top6 = sortedRows.slice(0, 6).map(r => ({
      name: r.dim1 || '(None)',
      value: Number(r.value) || 0
    }));
    const othersVal = sortedRows.slice(6).reduce((sum, r) => sum + (Number(r.value) || 0), 0);
    return [...top6, { name: 'Other Segments', value: othersVal }];
  }, [rows, sortedRows]);

  return (
    <PageShell className="flex flex-col">
      <PageHeader 
        title="Explore" 
        description="Dynamic semantic query engine. Build and visualize custom slice-and-dice analyses safely." 
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        
        {/* Controls Sidebar */}
        <div className="enterprise-card p-5 h-fit space-y-5">
          <div className="flex items-center gap-2 pb-4 border-b border-border-subtle text-text-main font-semibold">
            <Settings2 className="w-5 h-5 text-text-sec" />
            Query Builder
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-text-sec uppercase tracking-wider mb-1.5">Measure</label>
              <select 
                value={metric}
                onChange={e => setMetric(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 bg-surface text-sm text-text-main focus:border-teal focus:ring-1 focus:ring-teal outline-none"
              >
                {METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-text-sec uppercase tracking-wider mb-1.5">Dimension</label>
              <select 
                value={dimension}
                onChange={e => setDimension(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 bg-surface text-sm text-text-main focus:border-teal focus:ring-1 focus:ring-teal outline-none"
              >
                {DIMENSIONS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-text-sec uppercase tracking-wider mb-1.5">Visualisation</label>
              <select 
                value={chartType}
                onChange={e => setChartType(e.target.value as any)}
                className="w-full border border-border rounded-lg px-3 py-2 bg-surface text-sm text-text-main focus:border-teal focus:ring-1 focus:ring-teal outline-none"
              >
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
                <option value="area">Area Chart</option>
                <option value="donut">Donut Composition</option>
                <option value="table">Data Table</option>
              </select>
            </div>

            <div className="pt-3">
              <button 
                onClick={executeQuery}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal text-white text-sm font-semibold rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                Run Query
              </button>
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div className="lg:col-span-3 enterprise-card flex flex-col min-h-[550px]">
          {loading ? (
            <div className="flex-1 p-6"><ChartSkeleton /></div>
          ) : error ? (
            <div className="flex-1 p-6"><ErrorState message={error} onRetry={executeQuery} /></div>
          ) : !data ? (
            <div className="flex-1 p-6"><EmptyState title="Ready to Explore" message="Configure your query on the left and hit Run Query to begin." /></div>
          ) : (
            <div className="flex-1 flex flex-col p-6 space-y-5">
              
              {/* Header & Visualization Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-subtle">
                <div>
                  <h3 className="text-base font-semibold text-text-main capitalize flex items-center gap-2">
                    <span>{METRICS.find(m => m.id === metric)?.label}</span>
                    <span className="text-text-mute font-normal">by</span>
                    <span className="text-teal">{DIMENSIONS.find(d => d.id === dimension)?.label}</span>
                  </h3>
                  <p className="text-xs text-text-sec mt-0.5">
                    Analyzing {rows.length} segment slices across {formatTableNumber(totalSampleSize)} underlying records.
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-surface-sec p-1 rounded-lg border border-border-subtle shrink-0">
                  <button
                    onClick={() => setChartType('bar')}
                    className={`p-1.5 rounded transition-colors ${chartType === 'bar' ? 'bg-surface shadow-xs text-teal font-semibold' : 'text-text-sec hover:text-text-main'}`}
                    title="Bar Chart"
                  >
                    <BarChart2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setChartType('line')}
                    className={`p-1.5 rounded transition-colors ${chartType === 'line' ? 'bg-surface shadow-xs text-teal font-semibold' : 'text-text-sec hover:text-text-main'}`}
                    title="Line Chart"
                  >
                    <TrendingUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setChartType('area')}
                    className={`p-1.5 rounded transition-colors ${chartType === 'area' ? 'bg-surface shadow-xs text-teal font-semibold' : 'text-text-sec hover:text-text-main'}`}
                    title="Area Chart"
                  >
                    <Activity className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setChartType('donut')}
                    className={`p-1.5 rounded transition-colors ${chartType === 'donut' ? 'bg-surface shadow-xs text-teal font-semibold' : 'text-text-sec hover:text-text-main'}`}
                    title="Donut Chart"
                  >
                    <PieIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setChartType('table')}
                    className={`p-1.5 rounded transition-colors ${chartType === 'table' ? 'bg-surface shadow-xs text-teal font-semibold' : 'text-text-sec hover:text-text-main'}`}
                    title="Data Table"
                  >
                    <TableIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Statistical Summary Strip */}
              {rows.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-surface-sec/50 p-4 rounded-xl border border-border-subtle text-xs">
                  <div>
                    <span className="text-xs font-semibold text-text-mute uppercase block">Aggregate Total</span>
                    <span className="text-base sm:text-lg font-bold font-mono text-text-main">
                      {isRate ? `${(avgMetricVal * 100).toFixed(1)}% (Avg)` : formatTooltip(totalMetricSum)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-text-mute uppercase block">Segment Average</span>
                    <span className="text-base sm:text-lg font-bold font-mono text-text-sec">
                      {formatTooltip(avgMetricVal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-text-mute uppercase block">Top Contributor</span>
                    <span className="text-sm font-semibold text-teal block" title={topContributor?.dim1}>
                      {topContributor?.dim1 || 'None'}
                    </span>
                    <span className="text-xs text-text-mute font-mono">
                      {formatTooltip(Number(topContributor?.value) || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-text-mute uppercase block">Top 3 Concentration</span>
                    <span className="text-base sm:text-lg font-bold font-mono text-text-main">
                      {top3Share}%
                    </span>
                    <span className="text-xs text-text-mute block">of total volume</span>
                  </div>
                </div>
              )}

              {/* Main Visual Presentation */}
              <div className="flex-1 min-h-[420px]">
                {rows.length === 0 ? (
                  <EmptyState title="No Records Found" message="No data matches the selected filters and dimensions." />
                ) : chartType === 'table' ? (
                  <div className="overflow-x-auto border border-border-subtle rounded-lg">
                    <table className="enterprise-table w-full">
                      <thead className="bg-surface-sec text-text-sec font-semibold text-xs uppercase tracking-wider">
                        <tr>
                          <th>{DIMENSIONS.find(d => d.id === dimension)?.label}</th>
                          <th className="text-right">{METRICS.find(m => m.id === metric)?.label}</th>
                          <th className="text-right">Share of Total</th>
                          <th className="text-right">Sample Size</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle text-xs font-mono">
                        {rows.map((row: any, i: number) => {
                          const share = totalMetricSum > 0 ? ((Number(row.value) / totalMetricSum) * 100).toFixed(1) : '0';
                          return (
                            <tr key={i} className="hover:bg-surface-sec/70 transition-colors">
                              <td className="font-sans font-medium text-text-main">{row.dim1 || '(None)'}</td>
                              <td className="text-right font-semibold text-teal">{formatTooltip(row.value)}</td>
                              <td className="text-right text-text-sec">{share}%</td>
                              <td className="text-right text-text-mute">{formatTableNumber(row.sampleSize)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : chartType === 'donut' ? (
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <RechartsTooltip 
                          formatter={(val: number) => [formatTooltip(val), METRICS.find(m => m.id === metric)?.label]}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Pie
                          data={donutData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={120}
                          paddingAngle={3}
                          isAnimationActive={false}
                        >
                          {donutData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} stroke="#ffffff" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Legend 
                          layout="horizontal" 
                          verticalAlign="bottom" 
                          align="center"
                          wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : chartType === 'area' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={rows} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                      <defs>
                        <linearGradient id="exploreAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#247F7D" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#247F7D" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="dim1" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 11, fill: '#64748b' }} 
                        angle={dimension === 'date' || rows.length > 8 ? -35 : 0} 
                        textAnchor={dimension === 'date' || rows.length > 8 ? 'end' : 'middle'} 
                        height={45}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={formatY} />
                      <RechartsTooltip 
                        formatter={(val: number) => [formatTooltip(val), METRICS.find(m => m.id === metric)?.label]}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Area 
                        isAnimationActive={false} 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#247F7D" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#exploreAreaGrad)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : chartType === 'line' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rows} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="dim1" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 11, fill: '#64748b' }} 
                        angle={dimension === 'date' || rows.length > 8 ? -35 : 0} 
                        textAnchor={dimension === 'date' || rows.length > 8 ? 'end' : 'middle'} 
                        height={45}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={formatY} />
                      <RechartsTooltip 
                        formatter={(val: number) => [formatTooltip(val), METRICS.find(m => m.id === metric)?.label]}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Line 
                        isAnimationActive={false} 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#247F7D" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: '#247F7D', strokeWidth: 2, stroke: '#fff' }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rows} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="dim1" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 11, fill: '#64748b' }} 
                        angle={dimension === 'date' || rows.length > 8 ? -35 : 0} 
                        textAnchor={dimension === 'date' || rows.length > 8 ? 'end' : 'middle'} 
                        height={45}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={formatY} />
                      <RechartsTooltip 
                        formatter={(val: number) => [formatTooltip(val), METRICS.find(m => m.id === metric)?.label]}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar 
                        isAnimationActive={false} 
                        dataKey="value" 
                        fill="#247F7D" 
                        radius={[4, 4, 0, 0]} 
                        maxBarSize={50}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Execution Details Footer */}
              <div className="pt-3 flex items-center justify-between text-xs font-mono text-text-mute border-t border-border-subtle">
                <span>View: vw_leads (BigQuery)</span>
                <span>Latency: {data.metadata?.durationMs || 0}ms &bull; Billed: {data.metadata?.bytesBilled ? (data.metadata.bytesBilled / 1024 / 1024).toFixed(2) : 0}MB</span>
              </div>

            </div>
          )}
        </div>

      </div>
    </PageShell>
  );
}
