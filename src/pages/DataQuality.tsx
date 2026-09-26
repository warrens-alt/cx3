import { VisualTable } from '../components/visuals/DataVisual';
import React, { useState } from 'react';
import { PageShell } from '../components/PageShell';
import { formatTableNumber, formatTableCurrency } from '../lib/formatters';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';
import { ShieldAlert, AlertTriangle, CheckCircle, Clock, Loader2, Table as TableIcon, BarChart2 } from 'lucide-react';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import PageHeader from '../components/PageHeader';
import { DataState } from '../components/DataState';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend } from 'recharts';

export default function DataQuality() {
  const { data, loading, error, refetch } = useAnalyticsData('data-quality');
  const [anomalyView, setAnomalyView] = useState<'table' | 'graph'>('table');

  if (error) return <PageShell><PageHeader title="Data Quality & Timestamps"/><DataState error={error} retry={refetch}/></PageShell>;

  if (loading) {
    return (
      <PageShell>
        <TableSkeleton />
      </PageShell>
    );
  }

  if (!data) {
    return (
      <PageShell>
        <EmptyState message="Configure BigQuery in settings or adjust your date filters." />
      </PageShell>
    );
  }

  const { issues: issuesData, freshness } = data;

  const hasCritical = issuesData?.some((i: any) => i.severity === 'Critical');

  return (
    <PageShell>
      <PageHeader 
        title="Data Quality & Pipeline Telemetry" 
        category="Telemetry Verification"
        description="Monitor BigQuery streaming ingestion health, timestamp freshness, and semantic integrity."
      >
        {hasCritical ? (
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-lg text-xs font-semibold">
            <AlertTriangle className="w-4 h-4" />
            Critical Issues Detected
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-lg text-xs font-semibold">
            <CheckCircle className="w-4 h-4" />
            No critical issues returned
          </div>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <div className="enterprise-card p-4 flex items-center gap-3.5">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-0.5">Latest Lead Ingest</div>
            <div className="text-base font-bold text-text-main font-mono">{freshness?.latestCapture || 'Synchronized'}</div>
          </div>
        </div>
        <div className="enterprise-card p-4 flex items-center gap-3.5">
          <div className="p-2.5 bg-[#EDF5FC] text-[#315EAD] rounded-lg shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-0.5">Latest Delivery</div>
            <div className="text-base font-bold text-text-main font-mono">{freshness?.latestDelivery || 'Synchronized'}</div>
          </div>
        </div>
        <div className="enterprise-card p-4 flex items-center gap-3.5">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-0.5">Latest Call Event</div>
            <div className="text-base font-bold text-text-main font-mono">{freshness?.latestCall || 'Synchronized'}</div>
          </div>
        </div>
        <div className="enterprise-card p-4 flex items-center gap-3.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-0.5">Latest Capture among Leads with Sales Realization</div>
            <div className="text-base font-bold text-text-main font-mono">{freshness?.latestSale || 'Synchronized'}</div>
          </div>
        </div>
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-base sm:text-lg font-semibold text-text-main">Detected Anomalies</h3>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setAnomalyView('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                anomalyView === 'table'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setAnomalyView('graph')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                anomalyView === 'graph'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Graph</span>
            </button>
          </div>
        </div>
        
        {anomalyView === 'table' ? (
          <div className="overflow-x-auto">
            <VisualTable visual={{id:'quality.issues',data:(issuesData)}} className="enterprise-table">
              <thead className="bg-surface-sec text-text-sec font-semibold border-b border-slate-200 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4">Issue Description</th>
                  <th className="px-6 py-4">Severity</th>
                  <th className="px-6 py-4 text-right">Affected Records</th>
                  <th className="px-6 py-4 text-right">% of Total</th>
                  <th className="px-6 py-4">Last Seen</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issuesData.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-surface-sec/50 transition-colors">
                    <td className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-text-mute shrink-0" />
                      <span className="font-medium text-text-main">{row.issue}</span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        row.severity === 'Critical' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'
                      }`}>
                        {row.severity}
                      </span>
                    </td>
                    <td>{formatTableNumber(row.affected)}</td>
                    <td>{row.percentage}%</td>
                    <td>{row.lastSeen}</td>
                    <td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        Audit Logged
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </VisualTable>
          </div>
        ) : (
          <div className="p-6">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={issuesData.map((row: any) => ({
                    issue: row.issue.length > 25 ? row.issue.slice(0, 22) + '...' : row.issue,
                    fullIssue: row.issue,
                    affected: Number(row.affected) || 0,
                    percentage: Number(row.percentage) || 0,
                    severity: row.severity,
                  }))}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                  <YAxis type="category" dataKey="issue" tick={{ fontSize: 11, fill: '#334155' }} stroke="#cbd5e1" width={140} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '12px' }}
                    formatter={(val: number, name: string) => [formatTableNumber(val), name === 'affected' ? 'Affected Records' : '% of Total']}
                    labelFormatter={(label: string, payload: any[]) => payload?.[0]?.payload?.fullIssue || label}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="affected" name="Affected Records" radius={[0, 4, 4, 0]}>
                    {issuesData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.severity === 'Critical' ? '#e11d48' : '#f59e0b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
