import { VisualTable } from '../components/visuals/DataVisual';
import React, { useState } from 'react';
import { PageShell } from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import KpiCard from '../components/KpiCard';
import { TableSkeleton } from '../components/Skeleton';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { useClient } from '../lib/ClientContext';
import { DataState } from '../components/DataState';
import { ShieldCheck, AlertCircle, CheckCircle2, Award, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function Revetting() {
  const { clientConfig } = useClient();
  const currencyPrefix = clientConfig?.currency === 'ZAR' ? 'R ' : clientConfig?.currency === 'GBP' ? '£' : '$';
  const { data, loading, error, refetch } = useAnalyticsData('revetting');
  const [comparisonView, setComparisonView] = useState<'table' | 'graph'>('table');
  const [tierView, setTierView] = useState<'table' | 'graph'>('table');

  if (error) return <PageShell><PageHeader title="Re-vetting"/><DataState error={error} retry={refetch}/></PageShell>;

  if (loading) {
    return (
      <PageShell>
        <TableSkeleton />
      </PageShell>
    );
  }

  if (error || !data || !data.comparison) {
    return (
      <PageShell>
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-xl mx-auto my-12 shadow-sm">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Unable to Load Re-vetting Data</h2>
          <p className="text-slate-600 text-sm mb-4">{error || 'No vetting status data available.'}</p>
        </div>
      </PageShell>
    );
  }

  const { comparison, vettingColorBreakdown } = data;
  const original = comparison.find((c: any) => !c.is_revetted) || comparison[0] || {};
  const revetted = comparison.find((c: any) => c.is_revetted) || {};

  return (
    <PageShell>
      <PageHeader
        title="Re-vetting & Quality Vetting Performance"
        description="Comparative analysis of first-pass leads versus re-vetted leads, vetting score tiering, and commercial outcomes."
      >
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Vetting Grain: vw_leads (is_revetted flag)</span>
        </div>
      </PageHeader>

      {/* Comparison KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-5 mb-6 sm:mb-8">
        <KpiCard
          title="Original Leads"
          value={original.leads || 0}
          subtitle="First-pass evaluation"
        />
        <KpiCard
          title="Re-vetted Leads"
          value={revetted.leads || 0}
          subtitle="Secondary vetting pass"
        />
        <KpiCard
          title="Revenue-Matched Sale Share (Original Leads)"
          value={`${Number(original.billable_sale_rate_pct || 0).toFixed(1)}%`}
          subtitle="Conversion rate"
        />
        <KpiCard
          title="Revenue-Matched Sale Share (Re-vetted Leads)"
          value={`${Number(revetted.billable_sale_rate_pct || 0).toFixed(1)}%`}
          subtitle="Conversion rate"
        />
        <KpiCard
          title="Original Recorded Revenue / Lead"
          value={Number(original.rev_per_lead || 0).toFixed(2)}
          prefix={currencyPrefix}
          subtitle="Monetization per lead"
        />
        <KpiCard
          title="Re-vetted Recorded Revenue / Lead"
          value={Number(revetted.rev_per_lead || 0).toFixed(2)}
          prefix={currencyPrefix}
          subtitle="Monetization per lead"
        />
      </div>

      {/* Comparison Table */}
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Original vs Re-vetted Cohort Comparison</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluation of full-funnel progression and revenue realization across vetting status.
              </p>
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setComparisonView('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                  comparisonView === 'table'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setComparisonView('graph')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                  comparisonView === 'graph'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Graph</span>
              </button>
            </div>
          </div>

          {comparisonView === 'table' ? (
            <div className="overflow-x-auto">
              <VisualTable visual={{id:'revetting.comparison',data:(comparison)}} className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Cohort</th>
                    <th className="py-3 px-4 text-right">Fetched Leads (022.0)</th>
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
                  {comparison.map((c: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-3.5 px-4 font-sans font-medium text-slate-900 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${c.is_revetted ? 'bg-indigo-600' : 'bg-[#3562B3]'}`}></span>
                        {c.is_revetted ? 'Re-vetted Leads' : 'Original Leads'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-900">{Number(c.leads || 0).toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-right text-slate-600">{Number(c.delivery_rate_pct || 0).toFixed(1)}%</td>
                      <td className="py-3.5 px-4 text-right text-slate-600">{Number(c.call_rate_pct || 0).toFixed(1)}%</td>
                      <td className="py-3.5 px-4 text-right text-slate-600">{Number(c.rpc_rate_pct || 0).toFixed(1)}%</td>
                      <td className="py-3.5 px-4 text-right text-slate-600">{Number(c.sale_rate_pct || 0).toFixed(1)}%</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-700">{Number(c.billable_sale_rate_pct || 0).toFixed(1)}%</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900">{currencyPrefix}{Math.round(c.total_revenue || 0).toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#315EAD] bg-[#EDF5FC]/50">{currencyPrefix}{Number(c.rev_per_lead || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </VisualTable>
            </div>
          ) : (
            <div className="p-6">
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={comparison.map((c: any) => ({
                      cohort: c.is_revetted ? 'Re-vetted Leads' : 'Original Leads',
                      leads: Number(c.leads || 0),
                      deliveryRate: Number(c.delivery_rate_pct || 0),
                      callRate: Number(c.call_rate_pct || 0),
                      rpcRate: Number(c.rpc_rate_pct || 0),
                      saleRate: Number(c.sale_rate_pct || 0),
                      billableSaleRate: Number(c.billable_sale_rate_pct || 0),
                    }))}
                    margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="cohort" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                    <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '12px' }}
                      formatter={(val: number) => [`${val}%`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="deliveryRate" name="Delivery %" fill="#3b82f6" />
                    <Bar dataKey="callRate" name="Call Rate %" fill="#6366f1" />
                    <Bar dataKey="rpcRate" name="RPC %" fill="#8b5cf6" />
                    <Bar dataKey="saleRate" name="Sale %" fill="#0284c7" />
                    <Bar dataKey="billableSaleRate" name="Billable Sale %" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Vetting Score Tier Breakdown */}
        {vettingColorBreakdown.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Vetting Score Tier Breakdown</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Performance cross-tabulated by vetting tier rating (Green, Orange, Charcoal) and re-vetting status.
                </p>
              </div>
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setTierView('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                    tierView === 'table'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTierView('graph')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                    tierView === 'graph'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Graph</span>
                </button>
              </div>
            </div>

            {tierView === 'table' ? (
              <div className="overflow-x-auto">
                <VisualTable visual={{id:'revetting.vetting',data:(vettingColorBreakdown)}} className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Vetting Tier</th>
                      <th className="py-3 px-4 text-center">Re-vetted</th>
                      <th className="py-3 px-4 text-right">Unique Leads</th>
                      <th className="py-3 px-4 text-right">Sales / Fetched Leads (%)</th>
                      <th className="py-3 px-4 text-right">Revenue-Matched Sales / Fetched Leads (%)</th>
                      <th className="py-3 px-4 text-right">Recorded Revenue</th>
                      <th className="py-3 px-4 text-right">Recorded Revenue / Lead</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {vettingColorBreakdown.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-sans font-medium text-slate-900">{row.vetting || 'Unassigned'}</td>
                        <td className="py-3 px-4 text-center font-sans">
                          <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                            row.is_revetted ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {row.is_revetted ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-900">{Number(row.leads || 0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-slate-600">{Number(row.sale_rate_pct || 0).toFixed(1)}%</td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-700">{Number(row.billable_sale_rate_pct || 0).toFixed(1)}%</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900">{currencyPrefix}{Math.round(row.total_revenue || 0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-bold text-[#315EAD]">{currencyPrefix}{Number(row.rev_per_lead || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </VisualTable>
              </div>
            ) : (
              <div className="p-6">
                <div className="h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={vettingColorBreakdown.map((row: any) => ({
                        tier: `${row.vetting || 'Unassigned'} (${row.is_revetted ? 'Re-vetted' : 'Original'})`,
                        leads: Number(row.leads || 0),
                        saleRate: Number(row.sale_rate_pct || 0),
                        billableSaleRate: Number(row.billable_sale_rate_pct || 0),
                        revenue: Number(row.total_revenue || 0),
                      }))}
                      margin={{ top: 20, right: 30, left: 10, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="tier" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" angle={-15} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(v) => Number(v).toLocaleString()} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '12px' }}
                        formatter={(val: number) => [Number(val).toLocaleString(), '']}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} verticalAlign="top" />
                      <Bar dataKey="leads" name="Unique Leads" fill="#3b82f6" />
                      <Bar dataKey="revenue" name="Recorded Revenue (ZAR)" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
