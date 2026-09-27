import { VisualTable } from '../components/visuals/DataVisual';
import React, { useState } from 'react';
import { PageShell } from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import KpiCard from '../components/KpiCard';
import { TableSkeleton } from '../components/Skeleton';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { useAuth } from '../lib/AuthContext';
import { useClient } from '../lib/ClientContext';
import { DataState } from '../components/DataState';
import { Users, Repeat, DollarSign, TrendingDown, Layers, CheckCircle2, ShieldCheck, AlertCircle, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function ConsumerReentry() {
  const { clientConfig } = useClient();
  const { isAdmin } = useAuth();
  const currencyPrefix = clientConfig?.currency === 'ZAR' ? 'R ' : clientConfig?.currency === 'GBP' ? '£' : '$';
  const { data, loading, error, refetch } = useAnalyticsData('consumers');
  const [activeTab, setActiveTab] = useState<'tiers' | 'sequence' | 'sample'>('tiers');
  const [tiersView, setTiersView] = useState<'table' | 'graph'>('table');
  const [sequenceView, setSequenceView] = useState<'table' | 'graph'>('table');
  const [sampleView, setSampleView] = useState<'table' | 'graph'>('table');

  if (error) return <PageShell><PageHeader title="Consumer Re-entry"/><DataState error={error} retry={refetch}/></PageShell>;

  if (loading) {
    return (
      <PageShell>
        <TableSkeleton />
      </PageShell>
    );
  }

  if (error || !data || !data.overview) {
    return (
      <PageShell>
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-xl mx-auto my-12 shadow-sm">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Unable to Load Consumer Re-entry Data</h2>
          <p className="text-slate-600 text-sm mb-4">
            {error || 'No consumer entities detected in the current filter range.'}
          </p>
        </div>
      </PageShell>
    );
  }

  const { overview, tiers, sequenceEconomics, repeatConsumersSample } = data;

  return (
    <PageShell>
      <PageHeader
        title="Consumer Re-entry & Recycle Intelligence"
        description="Consumer-level deduplication, repeat entry frequency, sequence decay economics, and multi-lead lifecycle value."
      >
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Entity: vw_consumers (Grain: consumer_id)</span>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-4 lg:gap-5 mb-6 sm:mb-8">
        <KpiCard
          title="Total Consumers"
          value={overview.total_consumers || 0}
          subtitle={`${Number(overview.avg_leads_per_consumer || 0).toFixed(2)} leads / consumer`}
        />
        <KpiCard
          title="Repeat Consumers"
          value={overview.repeat_consumers || 0}
          subtitle={`${Number(overview.repeat_consumer_share_pct || 0).toFixed(1)}% re-entry rate`}
        />
        <KpiCard
          title="Revenue-Matched Sale Share (Single-Lead Consumers)"
          value={`${Number(overview.single_billable_sale_rate_pct || 0).toFixed(1)}%`}
          subtitle="Consumers with a revenue-matched sale / single-lead consumers"
        />
        <KpiCard
          title="Revenue-Matched Sale Share (Repeat Consumers)"
          value={`${Number(overview.repeat_billable_sale_rate_pct || 0).toFixed(1)}%`}
          subtitle="Consumers with a revenue-matched sale / repeat consumers"
        />
        <KpiCard
          title="Recorded Revenue (Single-Lead Consumers)"
          value={Math.round(overview.single_consumer_revenue || 0)}
          prefix={currencyPrefix}
          subtitle={`${currencyPrefix}${Number(overview.rev_per_single_consumer || 0).toFixed(2)} / consumer`}
        />
        <KpiCard
          title="Recorded Revenue (Repeat Consumers)"
          value={Math.round(overview.repeat_consumer_revenue || 0)}
          prefix={currencyPrefix}
          subtitle={`${currencyPrefix}${Number(overview.rev_per_repeat_consumer || 0).toFixed(2)} / consumer`}
        />
        <KpiCard
          title="Recorded Revenue (All Consumers)"
          value={Math.round(overview.total_revenue || 0)}
          prefix={currencyPrefix}
          subtitle="Revenue summed by recorded consumer ID; not verified lifetime value"
        />
      </div>

      {/* Sub Navigation */}
      <nav aria-label="Consumer reentry sub sections" className="cx-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('tiers')}
          data-active={activeTab === 'tiers'}
          className="cx-tab-item"
        >
          <Layers className="w-4 h-4" />
          <span>Volume Tiers Distribution</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sequence')}
          data-active={activeTab === 'sequence'}
          className="cx-tab-item"
        >
          <TrendingDown className="w-4 h-4" />
          <span>Sequential Entry Economics</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sample')}
          disabled={!isAdmin} title={!isAdmin ? 'Individual consumer records require administrator access' : undefined}
          data-active={activeTab === 'sample'}
          className="cx-tab-item"
        >
          <Repeat className="w-4 h-4" />
          <span>High-Frequency Repeat Consumers</span>
        </button>
      </nav>

      {activeTab === 'tiers' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Consumer Volume Tier Distribution</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Breakdown of consumer base by lifetime lead submission count and revenue yield.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTiersView('table')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                    tiersView === 'table'
                      ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TableIcon size={12} /> Table
                </button>
                <button
                  type="button"
                  onClick={() => setTiersView('graph')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                    tiersView === 'graph'
                      ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart2 size={12} /> Graph
                </button>
              </div>
              <div className="text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded">
                Rule: Count(DISTINCT consumer_id)
              </div>
            </div>
          </div>

          {tiersView === 'table' ? (
            <div className="overflow-x-auto">
              <VisualTable visual={{id:'consumers.tiers',data:(tiers)}} className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Lead Tier</th>
                    <th className="py-3 px-4 text-right">Consumers</th>
                    <th className="py-3 px-4 text-right">Consumer Share</th>
                    <th className="py-3 px-4 text-right">Total Leads</th>
                    <th className="py-3 px-4 text-right">Consumers w/ Sale</th>
                    <th className="py-3 px-4 text-right">Consumers with Sales / Consumers (%)</th>
                    <th className="py-3 px-4 text-right">Revenue-Matched Consumers with Sales / Consumers (%)</th>
                    <th className="py-3 px-4 text-right">Recorded Revenue</th>
                    <th className="py-3 px-4 text-right">Recorded Revenue / Consumer</th>
                    <th className="py-3 px-4 text-right">Recorded Revenue / Lead</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {tiers.map((tier: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-sans font-medium text-slate-900">
                        {tier.lead_tier}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900">{Number(tier.consumer_count || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-slate-600">{Number(tier.consumer_share_pct || 0).toFixed(1)}%</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900">{Number(tier.total_leads || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-slate-600">{Number(tier.consumers_with_sale || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-slate-600">{Number(tier.sale_rate_pct || 0).toFixed(1)}%</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-700">{Number(tier.billable_sale_rate_pct || 0).toFixed(1)}%</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">{currencyPrefix}{Math.round(tier.total_revenue || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-bold text-[#315EAD]">{currencyPrefix}{Number(tier.rev_per_consumer || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-700 bg-slate-50/50">{currencyPrefix}{Number(tier.rev_per_lead || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </VisualTable>
            </div>
          ) : (
            <div className="p-5 h-72 w-full">
              {!tiers.length ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 p-4">
                  <span className="font-medium text-slate-600 mb-1">No consumer tier observations recorded.</span>
                  <span className="text-[11px] text-slate-400">Try adjusting your filters or date range.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
                  <BarChart data={tiers} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="lead_tier" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" axisLine={false} tickLine={false} tickFormatter={v => Number(v).toLocaleString()} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-3 text-xs min-w-[190px] ring-1 ring-black/5 dark:ring-white/5 font-mono">
                            <div className="font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1 mb-2 font-mono">
                              Tier: {label}
                            </div>
                            <div className="space-y-1.5">
                              {payload.map((entry: any, i: number) => (
                                <div key={i} className="flex items-center justify-between gap-3">
                                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-sans">
                                    <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: entry.color }} />
                                    <span>{entry.name}</span>
                                  </span>
                                  <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                                    {Number(entry.value || 0).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="consumer_count" name="Consumers" fill="var(--cx-brand-primary, #315BCB)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="total_leads" name="Total Leads" fill="var(--cx-data-fetched, #4F5FB7)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="consumers_with_sale" name="Consumers with Sale" fill="var(--cx-data-sales, #426D80)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'sequence' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Sequential Entry Conversion & Economics</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                How contact, reach, sales, and revenue decay or perform across sequential submissions by the same consumer.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSequenceView('table')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                    sequenceView === 'table'
                      ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TableIcon size={12} /> Table
                </button>
                <button
                  type="button"
                  onClick={() => setSequenceView('graph')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                    sequenceView === 'graph'
                      ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart2 size={12} /> Graph
                </button>
              </div>
              <div className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded">
                Order: ROW_NUMBER() OVER(PARTITION BY consumer_id ORDER BY capture_timestamp ASC)
              </div>
            </div>
          </div>

          {sequenceView === 'table' ? (
            <div className="overflow-x-auto">
              <VisualTable visual={{id:'consumers.sequence',data:(sequenceEconomics)}} className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Sequential Stage</th>
                    <th className="py-3 px-4 text-right">Lead Count</th>
                    <th className="py-3 px-4 text-right">Delivered / Fetched Leads (%)</th>
                    <th className="py-3 px-4 text-right">Dialled / Fetched Leads (%)</th>
                    <th className="py-3 px-4 text-right">RPC / Fetched Leads (%)</th>
                    <th className="py-3 px-4 text-right">Sales / Fetched Leads (%)</th>
                    <th className="py-3 px-4 text-right">Revenue-Matched Sales / Fetched Leads (%)</th>
                    <th className="py-3 px-4 text-right">Recorded Revenue</th>
                    <th className="py-3 px-4 text-right">Recorded Revenue / Lead</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {sequenceEconomics.map((seq: any, idx: number) => {
                    const isFirst = seq.entry_stage === '1st Entry';
                    return (
                      <tr key={idx} className={isFirst ? 'bg-[#EDF5FC]/50 font-medium' : 'hover:bg-slate-50/60'}>
                        <td className="py-3.5 px-4 font-sans font-semibold text-slate-900">
                          {seq.entry_stage}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-900">{Number(seq.leads || 0).toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right text-slate-600">{Number(seq.delivery_rate_pct || 0).toFixed(1)}%</td>
                        <td className="py-3.5 px-4 text-right text-slate-600">{Number(seq.call_rate_pct || 0).toFixed(1)}%</td>
                        <td className="py-3.5 px-4 text-right text-slate-600">{Number(seq.rpc_rate_pct || 0).toFixed(1)}%</td>
                        <td className="py-3.5 px-4 text-right text-slate-600">{Number(seq.sale_rate_pct || 0).toFixed(1)}%</td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-700">{Number(seq.billable_sale_rate_pct || 0).toFixed(1)}%</td>
                        <td className="py-3.5 px-4 text-right font-semibold text-slate-900">{currencyPrefix}{Math.round(seq.total_revenue || 0).toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#315EAD] bg-[#EDF5FC]/70">{currencyPrefix}{Number(seq.rev_per_lead || 0).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </VisualTable>
            </div>
          ) : (
            <div className="p-5 h-72 w-full">
              {!sequenceEconomics.length ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 p-4">
                  <span className="font-medium text-slate-600 mb-1">No sequential entry observations recorded.</span>
                  <span className="text-[11px] text-slate-400">Try adjusting your filters or date range.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
                  <AreaChart data={sequenceEconomics} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorSeqRpc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#315BCB" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#315BCB" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSeqSale" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="entry_stage" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" unit="%" axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-3 text-xs min-w-[190px] ring-1 ring-black/5 dark:ring-white/5 font-mono">
                            <div className="font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1 mb-2 font-mono">
                              Entry: {label}
                            </div>
                            <div className="space-y-1.5">
                              {payload.map((entry: any, i: number) => (
                                <div key={i} className="flex items-center justify-between gap-3">
                                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-sans">
                                    <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: entry.stroke || entry.color }} />
                                    <span>{entry.name}</span>
                                  </span>
                                  <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                                    {Number(entry.value || 0).toFixed(1)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="rpc_rate_pct" name="RPC Rate %" stroke="#315BCB" strokeWidth={2} fillOpacity={1} fill="url(#colorSeqRpc)" />
                    <Area type="monotone" dataKey="billable_sale_rate_pct" name="Sale Rate %" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#colorSeqSale)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
      )}

      {isAdmin && activeTab === 'sample' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Highest-Value Multi-Lead Consumers</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Top repeat consumers ranked by recorded revenue across retained entries.
              </p>
            </div>
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSampleView('table')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                  sampleView === 'table'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon size={12} /> Table
              </button>
              <button
                type="button"
                onClick={() => setSampleView('graph')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                  sampleView === 'graph'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart2 size={12} /> Graph
              </button>
            </div>
          </div>

          {sampleView === 'table' ? (
            <div className="overflow-x-auto">
              <VisualTable visual={{id:'consumers.sample',data:(repeatConsumersSample)}} className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Consumer ID</th>
                    <th className="py-3 px-4 text-center">Recorded Leads</th>
                    <th className="py-3 px-4 text-center">Unique Sources</th>
                    <th className="py-3 px-4 text-center">Unique Vendors</th>
                    <th className="py-3 px-4 text-center">Transactions</th>
                    <th className="py-3 px-4">First Lead Date</th>
                    <th className="py-3 px-4">Latest Lead Date</th>
                    <th className="py-3 px-4 text-center">Sale Flag with Recorded Revenue</th>
                    <th className="py-3 px-4 text-right">Recorded Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {repeatConsumersSample.map((c: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-sans font-medium text-slate-900">{c.consumer_id}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">{c.lead_count}</span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-700">{c.unique_source_count}</td>
                      <td className="py-3 px-4 text-center text-slate-700">{c.unique_vendor_count}</td>
                      <td className="py-3 px-4 text-center text-slate-700">{c.transaction_count}</td>
                      <td className="py-3 px-4 text-slate-600">{c.first_lead_date?.value || c.first_lead_date || 'N/A'}</td>
                      <td className="py-3 px-4 text-slate-600">{c.latest_lead_date?.value || c.latest_lead_date || 'N/A'}</td>
                      <td className="py-3 px-4 text-center">
                        {c.has_billable_sale ? (
                          <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700">Yes</span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded text-xs text-slate-400">No</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">{currencyPrefix}{Number(c.total_revenue || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </VisualTable>
            </div>
          ) : (
            <div className="p-5 h-72 w-full">
              {!repeatConsumersSample.length ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 p-4">
                  <span className="font-medium text-slate-600 mb-1">No repeat consumer sample observations recorded.</span>
                  <span className="text-[11px] text-slate-400">Try adjusting your filters or date range.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
                  <BarChart data={repeatConsumersSample} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="consumer_id" tick={{ fontSize: 9, fill: '#64748b' }} stroke="#cbd5e1" interval={0} angle={-25} textAnchor="end" height={45} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-3 text-xs min-w-[200px] ring-1 ring-black/5 dark:ring-white/5 font-mono">
                            <div className="font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1 mb-2">
                              Consumer: {label}
                            </div>
                            <div className="space-y-1.5">
                              {payload.map((entry: any, i: number) => {
                                const isRev = entry.dataKey === 'total_revenue';
                                return (
                                  <div key={i} className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-sans">
                                      <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: entry.fill || entry.color }} />
                                      <span>{isRev ? 'Recorded Revenue' : 'Recorded Leads'}</span>
                                    </span>
                                    <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                                      {isRev ? `${currencyPrefix}${Number(entry.value || 0).toLocaleString()}` : Number(entry.value || 0).toLocaleString()}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="total_revenue" name="Recorded Revenue" fill="var(--cx-favourable, #17744A)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="lead_count" name="Recorded Leads" fill="var(--cx-data-fetched, #4F5FB7)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
