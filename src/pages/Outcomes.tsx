import { VisualTable } from '../components/visuals/DataVisual';
import React, { useState } from 'react';
import { PageShell } from '../components/PageShell';
import { useClient } from '../lib/ClientContext';
import { TableSkeleton } from '../components/Skeleton';
import KpiCard from '../components/KpiCard';
import PageHeader from '../components/PageHeader';
import { TrendChart } from '../components/charts/TrendChart';
import { HorizontalBarChart } from '../components/charts/HorizontalBarChart';
import { FunnelWaterfall, FunnelStep } from '../components/charts/FunnelWaterfall';
import { MetricCompositionDonut } from '../components/charts/MetricCompositionDonut';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { METRICS } from '../lib/metrics';
import { DollarSign, ShieldAlert, CheckCircle2, TrendingUp, Layers, Table as TableIcon, BarChart2 } from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend 
} from 'recharts';
import { formatTableNumber, formatChartAxis } from '../lib/formatters';
import { DataState } from '../components/DataState';

export default function Outcomes() {
  const { clientConfig } = useClient();
  const currencyPrefix = clientConfig?.currency === 'ZAR' ? 'R ' : clientConfig?.currency === 'GBP' ? '£' : '$';
  const { data: outcomesData, loading: outcomesLoading, error: outcomesError, refetch: retryOutcomes } = useAnalyticsData('outcomes');
  const { data: qualityData, loading: qualityLoading, error: qualityError, refetch: retryQuality } = useAnalyticsData('outcomes-quality');
  const [activeTab, setActiveTab] = useState<'trends' | 'quality' | 'funnel'>('quality');
  const [vendorStatusView, setVendorStatusView] = useState<'table' | 'graph'>('table');

  const loading = outcomesLoading || qualityLoading;

  if (outcomesError || qualityError) return <PageShell><PageHeader title="Sales, Activations & Recorded Revenue"/><DataState error={outcomesError || qualityError} retry={()=>{retryOutcomes?.();retryQuality?.();}}/></PageShell>;
  if (!loading && (!outcomesData || !qualityData)) return <PageShell><PageHeader title="Sales, Activations & Recorded Revenue"/><DataState empty/></PageShell>;

  if (loading) {
    return (
      <PageShell>
        <TableSkeleton />
      </PageShell>
    );
  }

  const summary = qualityData?.summary || {};
  const vendorStatusEconomics = qualityData?.vendorStatusEconomics || [];
  const funnel = qualityData?.funnel || {};

  // Build 7-stage commercial funnel steps for FunnelWaterfall matching Master Taxonomy
  const commercialFunnelSteps: FunnelStep[] = [
    { label: 'Fetched Leads', value: Number(funnel.step_1_captured_leads ?? 0), isTerminal: false, costMetric: 'CPL', itemNo: 22 },
    { label: 'Delivered Leads', value: Number(funnel.step_2_delivered_leads || 0), isTerminal: false, costMetric: 'CPL.Delivered', itemNo: 33 },
    { label: 'Dialled Leads', value: Number(funnel.step_3_called_leads || 0), isTerminal: false, costMetric: 'CPL.Dialed', itemNo: 37 },
    { label: 'Leads with RPC', value: Number(funnel.step_4_rpc_leads || 0), isTerminal: false, costMetric: 'CP.RPC', itemNo: 39 },
    { label: 'Leads with Sales', value: Number(funnel.step_5_sale_leads ?? 0), isTerminal: false, costMetric: 'CP.Sale', itemNo: 40 },
    { label: 'Leads with Sales and Recorded Revenue', value: Number(funnel.step_6_billable_sale_leads ?? 0), isTerminal: false, costMetric: undefined, itemNo: undefined },
    { label: 'Leads with Activations', value: Number(funnel.step_7_activated_leads || 0), isTerminal: true, costMetric: 'CPS.Activated', itemNo: 46 }
  ];

  // Aggregate vendor-level billable vs unbilled sales for stacked visual comparison
  const vendorLeakageMap = new Map<string, { vendor: string; billable: number; unbilled: number; revenue: number }>();
  vendorStatusEconomics.forEach((row: any) => {
    const v = row.vendor || 'Unknown';
    if (!vendorLeakageMap.has(v)) {
      vendorLeakageMap.set(v, { vendor: v, billable: 0, unbilled: 0, revenue: 0 });
    }
    const cur = vendorLeakageMap.get(v)!;
    cur.billable += Number(row.billable_sales || 0);
    cur.unbilled += Number(row.unbilled_sales || 0);
    cur.revenue += Number(row.total_revenue || 0);
  });
  const vendorStackedData = Array.from(vendorLeakageMap.values()).sort((a, b) => (b.billable + b.unbilled) - (a.billable + a.unbilled));

  // Vendor revenue share donut data
  const vendorDonutData = vendorStackedData.map(v => ({
    name: v.vendor,
    value: Math.round(v.revenue)
  }));

  return (
    <PageShell>
      <PageHeader 
        title="Commercial Outcomes & Revenue Intelligence" 
        description="Lead-level funnel counts and transaction-row sale flags. Positive recorded revenue does not prove sale delivery, billability or collection."
      >
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Entity: vw_commercial_events & vw_lead_vendor_transactions</span>
        </div>
      </PageHeader>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4 lg:gap-5">
        <KpiCard
          title="Fetched Leads"
          value={funnel.step_1_captured_leads ?? 0}
          subtitle="Distinct fetched lead records"
          lineage={METRICS.total_leads}
        />
        <KpiCard
          title="Sale Flags (Transaction Rows)"
          value={summary.total_sales || 0}
          subtitle="Transaction rows with a sale flag"
          lineage={METRICS.transaction_sale_flags}
        />
        <KpiCard
          title="Sale Flags with Recorded Revenue"
          value={summary.billable_sales || 0}
          subtitle={`${Number(summary.billable_conversion_pct || 0).toFixed(1)}% of sale flag rows`}
          lineage={METRICS.transaction_sales_with_revenue}
        />
        <KpiCard
          title="Sale Flags without Matched Revenue"
          value={summary.unbilled_sales || 0}
          subtitle={`${Number(summary.revenue_leakage_pct || 0).toFixed(1)}% of sale flag rows without matched revenue`}
        />
        <KpiCard
          title="Recorded Revenue"
          value={Math.round(summary.total_revenue || 0)}
          prefix={currencyPrefix}
          subtitle="Expected or recorded value; not verified cash"
          lineage={METRICS.revenue}
        />
        <KpiCard
          title="Revenue / Revenue-Matched Sale"
          value={Number(summary.avg_revenue_per_billable_sale || 0).toFixed(2)}
          prefix={currencyPrefix}
          subtitle="Recorded revenue / sale flag rows with recorded revenue"
        />
        <KpiCard
          title="Recorded Revenue per Fetched Lead"
          value={Number(summary.avg_revenue_per_lead || 0).toFixed(2)}
          prefix={currencyPrefix}
          subtitle="Recorded revenue / distinct lead IDs"
        />
      </div>

      {/* Missing Revenue Matches Alert Banner */}
      {Number(summary.unbilled_sales || 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <span className="font-semibold text-amber-950">Commercial Quality Audit Notice: </span>
            <span className="font-bold">{Number(summary.unbilled_sales).toLocaleString()} transaction rows with sale flags</span> have no positive matched recorded revenue. Missing reporting, timing or non-billable outcomes may explain this; the amount is not a measured financial loss.

          </div>
        </div>
      )}

      {/* Sub Navigation */}
      <nav aria-label="Outcomes sub sections" className="cx-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('quality')}
          data-active={activeTab === 'quality'}
          className="cx-tab-item"
        >
          <DollarSign className="w-4 h-4" />
          <span>Vendor Status Economics ({vendorStatusEconomics.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('funnel')}
          data-active={activeTab === 'funnel'}
          className="cx-tab-item"
        >
          <Layers className="w-4 h-4" />
          <span>Commercial Drop-Off Funnel</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trends')}
          data-active={activeTab === 'trends'}
          className="cx-tab-item"
        >
          <TrendingUp className="w-4 h-4" />
          <span>Macro Trends & Distribution</span>
        </button>
      </nav>

      {activeTab === 'quality' && (
        <div className="space-y-6">
          {/* Stacked Sales Integrity Visualizer */}
          <div className="enterprise-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-border-subtle">
              <div>
                <h3 className="font-display text-sm sm:text-base font-semibold text-text-main tracking-tight">Vendor Sale Flags by Revenue Match</h3>
                <p className="text-xs text-text-sec mt-0.5">
                  Transaction sale flags with positive matched revenue versus sale flags without positive matched revenue, by vendor.
                </p>
              </div>
              <div className="text-[11px] font-mono text-text-mute bg-surface-sec px-2.5 py-1 rounded-md border border-border-subtle">
                Entity: vw_lead_vendor_transactions
              </div>
            </div>

            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendorStackedData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="vendor" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => formatChartAxis(v)} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.08)', backgroundColor: '#ffffff', padding: '10px 14px' }}
                    labelStyle={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px', fontSize: '12px' }}
                    itemStyle={{ fontSize: '12px', padding: '2px 0' }}
                    formatter={(val: number, name: string) => [formatTableNumber(val), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="billable" name="Sale Flags with Recorded Revenue" fill="#059669" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="unbilled" name="Sale Flags without Matched Missing Revenue Matches (R0)" fill="#d97706" stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Granular Vendor Status Table */}
          <div className="enterprise-card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface-sec/50">
              <div>
                <h3 className="font-display text-sm sm:text-base font-semibold text-text-main tracking-tight">Vendor Status Economics & Revenue Integrity</h3>
                <p className="text-xs text-text-sec mt-0.5">
                  Outcome performance cross-tabulated by vendor and canonical status family.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-[11px] font-mono font-medium text-text-sec bg-surface px-2.5 py-1 rounded-md border border-border-subtle">
                  Rule: is_billable_sale = (sale AND revenue &gt; 0)
                </div>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setVendorStatusView('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                      vendorStatusView === 'table'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVendorStatusView('graph')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                      vendorStatusView === 'graph'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>Graph</span>
                  </button>
                </div>
              </div>
            </div>

            {vendorStatusView === 'table' ? (
              <div className="overflow-x-auto">
                <VisualTable visual={{id:'outcomes.status',data:(vendorStatusEconomics)}} className="enterprise-table w-full text-left text-sm">
                  <thead className="bg-surface-sec text-xs font-semibold text-text-sec uppercase tracking-wider border-b border-border-subtle">
                    <tr>
                      <th className="py-3 px-4">Vendor</th>
                      <th className="py-3 px-4">Status Family</th>
                      <th className="py-3 px-4 text-right">Transactions</th>
                      <th className="py-3 px-4 text-right">Sale Flag Rows</th>
                      <th className="py-3 px-4 text-right">Sale Flags with Recorded Revenue</th>
                      <th className="py-3 px-4 text-right">Sales without Matched Revenue</th>
                      <th className="py-3 px-4 text-right">Revenue-Matched / Sale Flag Rows (%)</th>
                      <th className="py-3 px-4 text-right">Recorded Revenue</th>
                      <th className="py-3 px-4 text-right">Rev / Transaction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle font-mono text-xs">
                    {vendorStatusEconomics.map((row: any, idx: number) => {
                      const hasUnbilled = Number(row.unbilled_sales || 0) > 0;
                      return (
                        <tr key={idx} className={hasUnbilled ? 'bg-amber-50/20 hover:bg-amber-50/40' : 'hover:bg-surface-sec/60'}>
                          <td className="py-3 px-4 font-sans font-medium text-text-main">{row.vendor}</td>
                          <td className="py-3 px-4 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              row.status_family === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
                              row.status_family === 'Declined' ? 'bg-rose-50 text-rose-700' :
                              row.status_family === 'Duplicate' ? 'bg-amber-50 text-amber-700' :
                              row.status_family === 'Quality / Vetting' ? 'bg-blue-50 text-blue-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {row.status_family}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-text-main">{Number(row.transactions || 0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-text-sec">{Number(row.sales || 0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-semibold text-emerald-700">{Number(row.billable_sales || 0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-semibold text-amber-700">
                            {hasUnbilled ? Number(row.unbilled_sales).toLocaleString() : '0'}
                          </td>
                          <td className="py-3 px-4 text-right text-text-sec">{Number(row.billable_conversion_pct || 0).toFixed(1)}%</td>
                          <td className="py-3 px-4 text-right font-semibold text-text-main">{currencyPrefix}{Math.round(row.total_revenue || 0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-bold text-[#315EAD]">{currencyPrefix}{Number(row.rev_per_transaction || 0).toFixed(2)}</td>
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
                      data={vendorStatusEconomics.map((row: any) => ({
                        label: `${row.vendor} - ${row.status_family}`,
                        vendor: row.vendor,
                        status: row.status_family,
                        transactions: Number(row.transactions || 0),
                        sales: Number(row.sales || 0),
                        billableSales: Number(row.billable_sales || 0),
                        revenue: Number(row.total_revenue || 0),
                      }))}
                      margin={{ top: 20, right: 30, left: 10, bottom: 50 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        stroke="#cbd5e1"
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(v) => Number(v).toLocaleString()} />
                      <RechartsTooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '12px' }}
                        formatter={(val: number) => [Number(val).toLocaleString(), '']}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} verticalAlign="top" />
                      <Bar dataKey="transactions" name="Transactions" fill="#94a3b8" />
                      <Bar dataKey="sales" name="Sales" fill="#3b82f6" />
                      <Bar dataKey="billableSales" name="Billable Sales" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'funnel' && (
        <div className="space-y-6">
          <div className="h-[520px]">
            <FunnelWaterfall
              title="Full Commercial Conversion Funnel"
              subtitle="Distinct lead IDs at each recorded stage. Sales with revenue are not necessarily delivered or contractually billable."
              steps={commercialFunnelSteps}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            {[
              { label: '1. Captured', val: funnel.step_1_captured_leads, color: 'bg-slate-100 text-slate-800' },
              { label: '2. Delivered', val: funnel.step_2_delivered_leads, color: 'bg-blue-50 text-blue-800' },
              { label: '3. Called', val: funnel.step_3_called_leads, color: 'bg-indigo-50 text-indigo-800' },
              { label: '4. RPC', val: funnel.step_4_rpc_leads, color: 'bg-purple-50 text-purple-800' },
              { label: '5. Leads with Sales', val: funnel.step_5_sale_leads, color: 'bg-amber-50 text-amber-800' },
              { label: '6. Leads with Sales and Recorded Revenue', val: funnel.step_6_billable_sale_leads, color: 'bg-emerald-50 text-emerald-800' },
              { label: '7. Activated', val: funnel.step_7_activated_leads, color: 'bg-[#EDF5FC] text-[#315EAD]' }
            ].map((step, idx) => {
              const base = Number(funnel.step_1_captured_leads || 1);
              const pct = ((Number(step.val || 0) / base) * 100).toFixed(1);
              return (
                <div key={idx} className={`p-4 rounded-xl border border-border-subtle ${step.color} space-y-1`}>
                  <span className="text-xs font-semibold uppercase tracking-wider block opacity-75">{step.label}</span>
                  <p className="text-2xl font-bold font-mono">{Number(step.val || 0).toLocaleString()}</p>
                  <p className="text-xs opacity-80">{pct}% of captured</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'trends' && outcomesData && (
        <div className="space-y-6">
          <div className="h-[400px]">
            <TrendChart 
              title="Revenue Realization Trend" 
              subtitle="Daily commercial revenue generation across active periods."
              data={outcomesData.timeseries || []}
              xAxisKey="date"
              currentKey="revenue"
              valuePrefix={currencyPrefix}
              height={330}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-[400px]">
              <MetricCompositionDonut
                title="Revenue by Vendor Share"
                subtitle="Financial realization distribution by delivery partner."
                data={vendorDonutData}
                valuePrefix={currencyPrefix}
                centerLabel="Total Rev"
                centerValue={`${currencyPrefix}${formatChartAxis(vendorDonutData.reduce((s, i) => s + i.value, 0))}`}
                height={280}
              />
            </div>
            <div className="h-[400px]">
              <HorizontalBarChart 
                title="Revenue by Source" 
                subtitle="Top revenue generating acquisition channels."
                data={(outcomesData.sources || []).slice(0, 8)}
                categoryKey="source"
                valueKey="total_revenue"
                valuePrefix={currencyPrefix}
                height={300}
              />
            </div>
            <div className="h-[400px]">
              <HorizontalBarChart 
                title="Revenue by Vendor" 
                subtitle="Top revenue generating delivery partners."
                data={(outcomesData.vendors || []).slice(0, 8)}
                categoryKey="vendor"
                valueKey="total_revenue"
                valuePrefix={currencyPrefix}
                height={300}
              />
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
