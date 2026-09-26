import { VisualTable } from '../components/visuals/DataVisual';
import React, { useState } from 'react';
import { PageShell } from '../components/PageShell';
import { formatTableNumber } from '../lib/formatters';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';
import PageHeader from '../components/PageHeader';
import { DistributionBar } from '../components/charts/DistributionBar';
import KpiCard from '../components/KpiCard';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { useClient } from '../lib/ClientContext';
import { DataState } from '../components/DataState';
import { Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function QualityVetting() {
  const { data: qualityData, loading, error, refetch } = useAnalyticsData('quality');
  const { clientConfig } = useClient();
  const [gradesViewMode, setGradesViewMode] = useState<'table' | 'graph'>('table');
  const [reasonsViewMode, setReasonsViewMode] = useState<'table' | 'graph'>('table');
  const currencyPrefix = clientConfig?.currency === 'ZAR' ? 'R' : '$';

  if (error) return <PageShell><PageHeader title="Lead Validation & Vetting"/><DataState error={error} retry={refetch}/></PageShell>;

  if (loading) {
    return (
      <PageShell><TableSkeleton /></PageShell>
    );
  }

  if (!qualityData) {
    return (
      <PageShell><EmptyState message="Configure BigQuery in settings or adjust your date filters." /></PageShell>
    );
  }

  const summary = qualityData.fullFunnelSummary || {};
  const gradeBreakdown = qualityData.fullFunnelByGrade || [];

  return (
    <PageShell>
      <PageHeader 
        title="Quality & Vetting" 
        category="Lead Verification & Scoring"
        description="Analyse lead quality grades, fraud and duplicate vetting outcomes, and downstream commercial conversion."
      />

      <div className="space-y-6 sm:space-y-8">
        {/* Quality KPIs */}
        <div>
          <div className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-2.5">
            Validation & Verification Efficiency
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            <KpiCard 
              title="Recorded Validation Pass Rate" 
              value={qualityData.passRate || 0} 
              suffix="%" 
              subtitle={`${(summary.passed || 0).toLocaleString()} valid leads`}
            />
            <KpiCard 
              title="Recorded Validation Failure Rate" 
              value={summary.leads ? Number(((summary.failed / summary.leads) * 100).toFixed(1)) : 0} 
              suffix="%" 
              subtitle={`${(summary.failed || 0).toLocaleString()} failed-validation records`}
              isPositiveGood={false}
            />
            <KpiCard 
              title="Fetched-to-Delivered Lead Rate" 
              value={summary.deliveryRate || 0} 
              suffix="%" 
              subtitle={`${(summary.delivered || 0).toLocaleString()} passed to vendor`}
            />
            <KpiCard 
              title="Recorded Revenue per Fetched Lead" 
              value={summary.revPerLead || 0} 
              prefix={currencyPrefix} 
              subtitle={`${currencyPrefix}${(summary.revenue || 0).toLocaleString()} total revenue`}
            />
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="min-h-[380px] flex flex-col">
            <DistributionBar 
              title="Validation Flag Distribution" 
              subtitle="Pass and fail counts from the recorded validity flag; not a grade distribution."
              data={qualityData.grades}
              bucketKey="name"
              valueKey="value"
              height={300}
            />
          </div>
          <div className="min-h-[380px] flex flex-col">
            <DistributionBar 
              title="Recorded Validation Outcomes" 
              subtitle="Recorded validity flags; duplicate causes are not classified."
              data={qualityData.vetting}
              bucketKey="name"
              valueKey="value"
              height={300}
            />
          </div>
        </div>

        {/* Full Funnel Performance by Quality Grade */}
        {gradeBreakdown.length > 0 && (
          <div className="enterprise-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border-subtle bg-surface-sec flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-card-title text-text-main font-semibold">Full Funnel Commercial Performance by Quality Grade</h3>
                <p className="text-xs text-text-sec mt-0.5">Observe how lead quality grading directly drives dial coverage, contactability, and commercial sales.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-text-mute px-2.5 py-1 bg-surface rounded border border-border-subtle">
                  Tiered validation
                </span>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setGradesViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                      gradesViewMode === 'table'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGradesViewMode('graph')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                      gradesViewMode === 'graph'
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

            {gradesViewMode === 'table' ? (
              <div className="overflow-x-auto">
                <VisualTable visual={{id:'quality.grades',data:(gradeBreakdown)}} className="enterprise-table w-full">
                  <thead className="bg-surface-sec text-text-sec font-semibold border-b border-border-subtle uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-5 py-3">Quality Grade</th>
                      <th className="px-4 py-3 text-right">Fetched Leads</th>
                      <th className="px-4 py-3 text-right">Delivered Leads</th>
                      <th className="px-4 py-3 text-right">Dialed Leads</th>
                      <th className="px-4 py-3 text-right">Right Party Contact (RPC)</th>
                      <th className="px-4 py-3 text-right">Sales</th>
                      <th className="px-4 py-3 text-right">Delivered Sales</th>
                      <th className="px-4 py-3 text-right">Activated Sales</th>
                      <th className="px-4 py-3 text-right">Recorded Revenue</th>
                      <th className="px-4 py-3 text-right">Recorded Revenue / Lead</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle font-mono text-xs">
                    {gradeBreakdown.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-surface-sec/70 transition-colors">
                        <td className="px-5 py-3 font-sans font-medium text-text-main flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-emerald-500' : i === 1 ? 'bg-[#3562B3]' : 'bg-slate-400'}`} />
                          {row.grade}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-text-main">{formatTableNumber(row.leads)}</td>
                        <td className="px-4 py-3 text-right text-text-sec">
                          {formatTableNumber(row.delivered || 0)}
                          <span className="text-[11px] text-text-mute block font-sans">{row.deliveryRate || 0}%</span>
                        </td>
                        <td className="px-4 py-3 text-right text-text-sec">
                          {formatTableNumber(row.called || 0)}
                          <span className="text-[11px] text-text-mute block font-sans">{row.callRate || 0}%</span>
                        </td>
                        <td className="px-4 py-3 text-right text-text-sec">
                          {formatTableNumber(row.rpcs || 0)}
                          <span className="text-[11px] text-text-mute block font-sans">{row.rpcRate || 0}%</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-[#315EAD]">
                          {formatTableNumber(row.sales || 0)}
                          <span className="text-[11px] text-text-mute block font-sans">{row.saleRate || 0}%</span>
                        </td>
                        <td className="px-4 py-3 text-right text-text-sec">
                          {formatTableNumber(row.billableSales || 0)}
                          <span className="text-[11px] text-text-mute block font-sans">{row.billableSaleRate || 0}%</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-600">
                          {formatTableNumber(row.activations || 0)}
                          <span className="text-[11px] text-text-mute block font-sans">{row.activationRate || 0}%</span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-text-main">
                          {currencyPrefix}{formatTableNumber(row.revenue || 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[#315EAD]">
                          {currencyPrefix}{Number(row.revPerLead || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </VisualTable>
              </div>
            ) : (
              <div className="p-6">
                <div className="h-[360px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={gradeBreakdown.map((row: any) => ({
                        grade: row.grade,
                        leads: Number(row.leads || 0),
                        delivered: Number(row.delivered || 0),
                        called: Number(row.called || 0),
                        rpcs: Number(row.rpcs || 0),
                        sales: Number(row.sales || 0),
                        billableSales: Number(row.billableSales || 0),
                        activations: Number(row.activations || 0),
                      }))}
                      margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="grade" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(v) => Number(v).toLocaleString()} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '12px' }}
                        formatter={(val: number) => [Number(val).toLocaleString(), '']}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar dataKey="leads" name="Leads" fill="#64748b" />
                      <Bar dataKey="delivered" name="Delivered" fill="#3b82f6" />
                      <Bar dataKey="called" name="Dialled" fill="#6366f1" />
                      <Bar dataKey="rpcs" name="RPC" fill="#8b5cf6" />
                      <Bar dataKey="sales" name="Sales" fill="#0284c7" />
                      <Bar dataKey="billableSales" name="Billable Sales" fill="#10b981" />
                      <Bar dataKey="activations" name="Activations" fill="#059669" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Rejection Reasons */}
        <div className="enterprise-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-text-main">Vetting & Suppressions Breakdown</h3>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setReasonsViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                  reasonsViewMode === 'table'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setReasonsViewMode('graph')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                  reasonsViewMode === 'graph'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Graph</span>
              </button>
            </div>
          </div>

          {reasonsViewMode === 'table' ? (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <VisualTable visual={{id:'quality.reasons',data:(qualityData.reasons || [])}} className="enterprise-table w-full">
                <thead className="bg-surface-sec text-text-sec font-semibold border-b border-slate-200 uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-4">Classification</th>
                    <th className="px-6 py-4 text-right">Volume</th>
                    <th className="px-6 py-4 text-right">Percentage of Capture</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {(qualityData.reasons || []).map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-surface-sec">
                      <td className="font-sans font-medium text-text-main px-6 py-4">{row.reason}</td>
                      <td className="px-6 py-4 text-right">{formatTableNumber(row.count)}</td>
                      <td className="px-6 py-4 text-right font-medium text-text-sec">{row.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </VisualTable>
            </div>
          ) : (
            <div className="h-[300px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={qualityData.reasons || []}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 120, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                  <YAxis type="category" dataKey="reason" tick={{ fontSize: 11, fill: '#334155' }} stroke="#cbd5e1" width={140} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '12px' }}
                    formatter={(val: number) => [formatTableNumber(val), 'Volume']}
                  />
                  <Bar dataKey="count" name="Volume" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
