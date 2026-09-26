import { VisualTable } from '../components/visuals/DataVisual';
import React, { useMemo, useState } from 'react';
import { PageShell } from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import KpiCard from '../components/KpiCard';
import { TableSkeleton } from '../components/Skeleton';
import { DistributionBar } from '../components/charts/DistributionBar';
import { DiminishingReturnsChart } from '../components/charts/DiminishingReturnsChart';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { useClient } from '../lib/ClientContext';
import { Download, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const labels = ['0–5 Whole Minutes','>5–15 Whole Minutes','>15–60 Whole Minutes','>60 Whole Minutes'];

export default function SpeedToLead() {
  const {data,loading,error,refetch}=useAnalyticsData('speed-to-lead');
  const {clientConfig}=useClient();
  const [timingView, setTimingView] = useState<'table' | 'graph'>('table');

  const buckets = useMemo(() => {
    return (data?.buckets || []).map((b: any, i: number) => ({
      ...b,
      bucket: labels[i] || b.bucket,
    }));
  }, [data?.buckets]);

  const capture = useMemo(() => data?.metrics?.find((m: any) => m.id === 'capture_to_delivery' || m.name === 'Capture to Delivery'), [data?.metrics]);
  const firstDial = useMemo(() => data?.metrics?.find((m: any) => m.id === 'delivery_to_first_dial' || m.name === 'Delivery to First Call'), [data?.metrics]);

  const n = (v: any) => v == null ? 'Unavailable' : Number(v).toLocaleString('en-GB', { maximumFractionDigits: 2 });
  const pct = (v: any) => v == null ? 'Unavailable' : n(v) + '%';
  const currency = clientConfig?.currency || 'ZAR';

  const exportTimingCsv = () => {
    const headers = ['Elapsed Whole Minutes', 'Transaction Rows', 'RPC Flag Rows', 'RPC Share (%)', 'Sale Flag Rows', 'Sale Share (%)', 'Sale Flags with Recorded Revenue', 'Activation Flag Rows', 'Recorded Revenue', 'Recorded Revenue / Row'];
    const rows = buckets.map((b: any) => [
      `"${b.bucket}"`,
      `"${b.leads ?? ''}"`,
      `"${b.rpcCount ?? ''}"`,
      `"${b.rpc ?? ''}"`,
      `"${b.saleCount ?? ''}"`,
      `"${b.sale ?? ''}"`,
      `"${b.billableCount ?? ''}"`,
      `"${b.actCount ?? ''}"`,
      `"${b.revenue ?? ''}"`,
      `"${b.revPerLead ?? ''}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = href;
    a.download = 'cx-speed-to-lead.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  if (loading) return <PageShell><PageHeader title="Delivery & First-Dial Timing"/><TableSkeleton/></PageShell>;
  if (error || !data?.buckets) return <PageShell><PageHeader title="Delivery & First-Dial Timing"/><div role="alert">{error||'No timing report was returned.'}<button className="block underline" onClick={()=>refetch?.()}>Retry</button></div></PageShell>;

  const rowsAt0to60 = buckets.slice(0, 3).reduce((sum: number, b: any) => sum + Number(b.leads || 0), 0);

  return <PageShell><PageHeader title="Delivery & First-Dial Timing" description="Elapsed timing for vendor transaction rows with recorded delivery and first-dial timestamps."/>
    <div className="space-y-6">
      <p className="text-sm text-text-sec">Both averages use the dialled transaction subset, not every delivered lead. The legacy query measures whole elapsed minutes, excludes first dials before delivery, and does not adjust for operating hours. A first dial is not first contact.</p>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Capture-to-Delivery Mean" value={capture?.avg ?? 'Unavailable'} subtitle="Dialled transaction rows with valid capture-to-delivery chronology"/>
        <KpiCard title="Delivery-to-First-Dial Mean" value={firstDial?.avg ?? 'Unavailable'} subtitle="Dialled transaction rows; elapsed time"/>
        <KpiCard title="Rows at 0–5 Whole Minutes" value={buckets[0]?.leads ?? null} subtitle="Transaction rows, not distinct leads"/>
        <KpiCard title="Rows at 0–60 Whole Minutes" value={rowsAt0to60} subtitle="Includes the 60-whole-minute boundary"/>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <DistributionBar title="Transaction Rows by First-Dial Delay" subtitle="Whole-minute delivery-to-first-dial intervals." data={buckets} bucketKey="bucket" valueKey="leads"/>
        <DiminishingReturnsChart title="Recorded Outcome Shares by Delay" subtitle="Outcome flag rows / rows in each interval; no causal effect or target is implied." data={buckets}
          volumeKey="leads" volumeName="Transaction Rows" primaryLineKey="rpc" primaryLineName="RPC Flag Rows / Rows in Band (%)" secondaryLineKey="sale" secondaryLineName="Sale Flag Rows / Rows in Band (%)"/>
      </div>
      <section className="enterprise-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Transaction-Level Timing and Outcome Flags</h2>
            <p className="text-xs text-text-sec">Whole-minute buckets with recorded outcomes and revenue.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setTimingView('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                  timingView === 'table'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setTimingView('graph')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                  timingView === 'graph'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Graph</span>
              </button>
            </div>
            {buckets.length > 0 && (
              <button type="button" onClick={exportTimingCsv} className="cx-button-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5">
                <Download size={13} /> Export CSV
              </button>
            )}
          </div>
        </div>

        {timingView === 'table' ? (
          <div className="overflow-x-auto">
            <VisualTable visual={{id:'speed.bands',data:buckets}} className="enterprise-table w-full">
              <thead>
                <tr>
                  {['Elapsed Whole Minutes','Transaction Rows','RPC Flag Rows','Sale Flag Rows','Sale Flags with Recorded Revenue','Activation Flag Rows','Recorded Revenue','Recorded Revenue / Row'].map(h=><th key={h} scope="col">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {buckets.map((b:any)=>(
                  <tr key={b.bucket}>
                    <th scope="row"><strong>{b.bucket}</strong></th>
                    <td>{n(b.leads)}</td>
                    <td>{n(b.rpcCount)}<small className="block text-text-mute">{pct(b.rpc)} of rows in band</small></td>
                    <td>{n(b.saleCount)}<small className="block text-text-mute">{pct(b.sale)} of rows in band</small></td>
                    <td>{n(b.billableCount)}<small className="block text-text-mute">{pct(b.billableRate)} of sale flag rows</small></td>
                    <td>{n(b.actCount)}<small className="block text-text-mute">{pct(b.activation)} of sale flag rows</small></td>
                    <td>{currency} {n(b.revenue)}</td>
                    <td>{currency} {n(b.revPerLead)}</td>
                  </tr>
                ))}
              </tbody>
            </VisualTable>
          </div>
        ) : (
          <div className="p-4">
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={buckets.map((b: any) => ({
                    bucket: b.bucket,
                    leads: Number(b.leads || 0),
                    rpcCount: Number(b.rpcCount || 0),
                    saleCount: Number(b.saleCount || 0),
                    billableCount: Number(b.billableCount || 0),
                    revenue: Number(b.revenue || 0),
                  }))}
                  margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(v) => Number(v).toLocaleString()} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '12px' }}
                    formatter={(val: number) => [Number(val).toLocaleString(), '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="leads" name="Transaction Rows" fill="#64748b" />
                  <Bar dataKey="rpcCount" name="RPC Flags" fill="#8b5cf6" />
                  <Bar dataKey="saleCount" name="Sale Flags" fill="#3b82f6" />
                  <Bar dataKey="billableCount" name="Sale Flags w/ Revenue" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>
    </div>
  </PageShell>;
}
