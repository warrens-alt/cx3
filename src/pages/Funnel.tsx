import DataVisual, { VisualTable } from '../components/visuals/DataVisual';
import React, { useMemo, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import PageHeader from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { ChartSkeleton } from '../components/Skeleton';
import { FunnelWaterfall } from '../components/charts/FunnelWaterfall';
import { DistributionBar } from '../components/charts/DistributionBar';
import { ComboChart } from '../components/charts/ComboChart';
import { DataState } from '../components/DataState';
import { Download, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function Funnel() {
  const { data: funnelData, loading: funnelLoading, error: funnelError, refetch: retryFunnel } = useAnalyticsData('funnel');
  const { data: callData, loading: callLoading, error: callError, refetch: retryCalls } = useAnalyticsData('calls');
  const [stageDetailsView, setStageDetailsView] = useState<'table' | 'graph'>('table');

  const steps = useMemo(() => {
    if (!funnelData || !Array.isArray(funnelData)) return [];
    return funnelData.map((d: any) => ({
      label: d.stage,
      value: d.count,
      rate: d.rate,
      costMetric: d.costMetric,
      itemNo: d.itemNo,
      isTerminal: d.stage === 'Leads with Activations' || d.stage === 'Activated' || d.stage === 'Activated Sales'
    }));
  }, [funnelData]);

  const cumulativeData = useMemo(() => {
    const callChart = callData?.chart || [];
    return callChart.map((b: any) => ({
      bucket: b.bucket,
      leads: b.current,
      rpcRate: b.rpc,
      saleRate: b.sale,
      actRate: b.activation
    }));
  }, [callData?.chart]);

  const exportFunnelCsv = () => {
    const headers = ['Stage Order', 'Funnel Stage', 'Volume / Count', 'Conversion Rate (%)', 'Cost Metric'];
    const rows = steps.map((s: any, idx: number) => [
      `"${s.itemNo ?? idx + 1}"`,
      `"${String(s.label || '').replace(/"/g, '""')}"`,
      `"${s.value ?? ''}"`,
      `"${s.rate ?? ''}"`,
      `"${s.costMetric ?? ''}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = href;
    a.download = 'cx-funnel-stages.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  if (funnelError || callError) return <PageShell><PageHeader title="Lead Funnel"/><DataState error={funnelError || callError} retry={()=>{retryFunnel?.();retryCalls?.();}}/></PageShell>;

  if (funnelLoading || callLoading) {
    return (
      <PageShell>
        <PageHeader title="Lead Performance & Funnel" description="Loading workspace..." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </PageShell>
    );
  }

  if (!funnelData || !callData) {
    return (
      <PageShell>
        <PageHeader title="Lead Performance & Funnel" />
        <EmptyState message="Configure BigQuery in settings or adjust your date filters." />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader 
        title="Lead Performance & Funnel" 
        description="Conversion progression, call distribution, and lifecycle analysis."
      />

      <DataVisual id="api.response" data={{stages:funnelData,calls:callData}} context={{endpoint:"funnel"}}/>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="min-h-[450px] flex flex-col">
          <FunnelWaterfall 
            title="Recorded Lead-Stage Counts" 
            subtitle="Recorded stage counts; a decline between non-nested populations is not proof of leakage."
            steps={steps}
          />
        </div>
        <div className="min-h-[450px] flex flex-col">
          <DistributionBar 
            title="Calls per Lead" 
            subtitle="Distribution of unique leads by total call attempts."
            data={cumulativeData}
            bucketKey="bucket"
            valueKey="leads"
            height={360}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="min-h-[400px] flex flex-col">
          <ComboChart 
            title="RPC Share by Call-Attempt Band" 
            subtitle="Lead RPC flags / lead records in each call-attempt band. CP.RPC is a cost metric and is not plotted here."
            data={cumulativeData}
            xKey="bucket"
            barKey="leads"
            lineKey="rpcRate"
            barName="Dialled Leads"
            lineName="RPC / Leads in Band (%)"
            height={310}
          />
        </div>
        <div className="min-h-[400px] flex flex-col">
          <ComboChart 
            title="Sale Share by Call-Attempt Band" 
            subtitle="Leads with sales / leads in each call-attempt band."
            data={cumulativeData}
            xKey="bucket"
            barKey="leads"
            lineKey="saleRate"
            barName="Dialled Leads"
            lineName="Sales / Leads in Band (%)"
            height={310}
          />
        </div>
      </div>

      <section className="enterprise-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Recorded Funnel Stage Details</h2>
            <p className="text-xs text-text-sec">Exact recorded stage counts, step conversion rates, and cost metrics.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setStageDetailsView('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                  stageDetailsView === 'table'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setStageDetailsView('graph')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                  stageDetailsView === 'graph'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Graph</span>
              </button>
            </div>
            {steps.length > 0 && (
              <button type="button" onClick={exportFunnelCsv} className="cx-button-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5">
                <Download size={13} /> Export CSV
              </button>
            )}
          </div>
        </div>
        
        {stageDetailsView === 'table' ? (
          <div className="overflow-x-auto">
            <VisualTable visual={{id:'funnel.stages',data:steps}} className="enterprise-table w-full">
              <thead>
                <tr>
                  {['Stage Order', 'Funnel Stage', 'Volume / Count', 'Conversion Rate', 'Cost Metric'].map(h => <th key={h} scope="col">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {steps.map((s: any, idx: number) => (
                  <tr key={s.label || idx}>
                    <td>#{s.itemNo ?? idx + 1}</td>
                    <td><strong>{s.label}</strong></td>
                    <td>{Number(s.value || 0).toLocaleString('en-GB')}</td>
                    <td>{s.rate ? `${s.rate}%` : '—'}</td>
                    <td>{s.costMetric ?? '—'}</td>
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
                  data={steps.map((s: any, idx: number) => ({
                    stage: s.label || `Stage ${idx + 1}`,
                    leads: Number(s.value || 0),
                    conversionRate: s.rate ? Number(s.rate) : 0,
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(v) => Number(v).toLocaleString()} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '12px' }}
                    formatter={(val: number) => [Number(val).toLocaleString(), 'Volume / Count']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="leads" name="Volume / Count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>
      
    </PageShell>
  );
}
