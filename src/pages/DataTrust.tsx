import { VisualTable } from '../components/visuals/DataVisual';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageShell } from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import KpiCard from '../components/KpiCard';
import { TableSkeleton } from '../components/Skeleton';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { useClient } from '../lib/ClientContext';
import { DataState } from '../components/DataState';
import { ShieldCheck, AlertTriangle, CheckCircle2, Clock, XCircle, Info, Database, Layers, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function DataTrust() {
  const { clientConfig } = useClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const currencyPrefix = clientConfig?.currency === 'ZAR' ? 'R ' : clientConfig?.currency === 'GBP' ? '£' : '$';
  const { data, loading, error, refetch } = useAnalyticsData('data-trust');
  const { data: multiVendorData, error: multiVendorError, refetch: retryMultiVendor } = useAnalyticsData('multi-vendor');
  const [activeTab, setActiveTab] = useState<'matrix' | 'anomalies' | 'multivendor'>(() => {
    if (tabParam === 'multivendor' || tabParam === 'anomalies') return tabParam;
    return 'matrix';
  });
  const [matrixView, setMatrixView] = useState<'table' | 'graph'>('table');
  const [multiVendorView, setMultiVendorView] = useState<'table' | 'graph'>('table');

  useEffect(() => {
    if (tabParam === 'multivendor' || tabParam === 'anomalies' || tabParam === 'matrix') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  if (error) return <PageShell><PageHeader title="Data Checks"/><DataState error={error} retry={refetch}/></PageShell>;
  if (activeTab==='multivendor' && multiVendorError) return <PageShell><PageHeader title="Data Checks"/><DataState error={multiVendorError} retry={retryMultiVendor}/><button type="button" className="cx-button-secondary mt-4" onClick={()=>setActiveTab('matrix')}>Return to capability matrix</button></PageShell>;

  if (loading) {
    return (
      <PageShell>
        <TableSkeleton />
      </PageShell>
    );
  }

  if (error || !data || !data.vendorCapabilities) {
    return (
      <PageShell>
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-xl mx-auto my-12 shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Unable to Load Data Trust Matrix</h2>
          <p className="text-slate-600 text-sm mb-4">{error || 'Data capabilities could not be audited.'}</p>
        </div>
      </PageShell>
    );
  }

  const { vendorCapabilities, timingAnomalies } = data;

  const renderBadge = (status: string) => {
    switch (status) {
      case 'RELIABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Reliable
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Info className="w-3.5 h-3.5 text-amber-600" />
            Partial
          </span>
        );
      case 'INSUFFICIENT DATA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
            Insufficient
          </span>
        );
      case 'UNAVAILABLE':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
            <XCircle className="w-3.5 h-3.5 text-red-400" />
            Unavailable
          </span>
        );
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Data Trust & Vendor Capability Matrix"
        description="Dynamic vendor telemetry auditing, metric readiness rules, timing inversion detection, and multi-vendor distribution."
      >
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-lg text-xs font-medium">
          <Database className="w-4 h-4 text-blue-600" />
          <span>Audited Records: {Number(timingAnomalies?.total_records || 0).toLocaleString()}</span>
        </div>
      </PageHeader>

      {/* Metric Readiness Banner */}
      <div className="bg-white text-slate-800 rounded-lg p-5 mb-6 shadow-2xs border border-slate-200/90">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-wide uppercase">
              Metric Readiness & Trust Protocol
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Different vendors log telemetry at different operational checkpoints. MTN and BizVoip supply rich dialer and call timestamps, whereas Mondo and RewardsCo report outcomes primarily via sales and billing feeds. The system audits telemetry coverage dynamically so decisions are never based on missing data disguised as zero values.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px] font-medium font-mono uppercase">Delivery & Ingest</span>
                <span className="text-emerald-700 font-semibold text-xs">Reliable across all vendors</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px] font-medium font-mono uppercase">Dialer & Call Effort</span>
                <span className="text-amber-700 font-semibold text-xs">Vendor dependent (MTN, Ontact)</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px] font-medium font-mono uppercase">Contact & RPC</span>
                <span className="text-amber-700 font-semibold text-xs">Ontact BizVoip & BLC only</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px] font-medium font-mono uppercase">Commercial & Revenue</span>
                <span className="text-emerald-700 font-semibold text-xs">Mondo, RewardsCo, Ontact</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards for Timing Anomalies */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-6">
        <KpiCard
          title="Vendor Transaction Rows Checked"
          value={timingAnomalies?.total_records || 0}
          subtitle="Transactions in view"
        />
        <KpiCard
          title="Call Before Delivery"
          value={timingAnomalies?.call_before_delivery_count || 0}
          subtitle="Dialer timestamp < HLC delivery"
        />
        <KpiCard
          title="Delivery Before Capture"
          value={timingAnomalies?.delivery_before_capture_count || 0}
          subtitle="HLC delivery < lead capture"
        />
        <KpiCard
          title="Hospital Flag / Timestamp Mismatches"
          value={timingAnomalies?.hospital_applied_inconsistent_count || 0}
          subtitle="Recorded flag and timestamp disagree"
        />
      </div>

      {/* Sub Navigation */}
      <nav aria-label="Data trust sections" className="cx-tabs">
        <button
          type="button"
          onClick={() => { setActiveTab('matrix'); setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('tab'); return n; }, { replace: true }); }}
          data-active={activeTab === 'matrix'}
          className="cx-tab-item"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Vendor Telemetry Capability Matrix</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('anomalies'); setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('tab', 'anomalies'); return n; }, { replace: true }); }}
          data-active={activeTab === 'anomalies'}
          className="cx-tab-item"
        >
          <Clock className="w-4 h-4 text-amber-500" />
          <span>Timing Inversion Audit</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('multivendor'); setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('tab', 'multivendor'); return n; }, { replace: true }); }}
          data-active={activeTab === 'multivendor'}
          className="cx-tab-item"
        >
          <Layers className="w-4 h-4" />
          <span>Multi-Vendor Co-Distribution</span>
        </button>
      </nav>

      {activeTab === 'matrix' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Dynamic Vendor Telemetry Capabilities</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audited field coverage percentages and automated metric trust tier classification.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMatrixView('table')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                    matrixView === 'table'
                      ? 'bg-white text-blue-700 shadow-2xs font-semibold'
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
                      ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart2 size={12} /> Graph
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Reliable &ge; 75%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Partial 25-75%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span> Insufficient &lt; 25%</span>
              </div>
            </div>
          </div>

          {matrixView === 'table' ? (
            <div className="overflow-x-auto">
              <VisualTable visual={{id:'trust.capabilities',data:(vendorCapabilities)}} className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4 text-right">Transactions</th>
                    <th className="py-3 px-4 text-center">Delivery</th>
                    <th className="py-3 px-4 text-center">Calls / Dialled</th>
                    <th className="py-3 px-4 text-center">RPC</th>
                    <th className="py-3 px-4 text-center">Sale Flag</th>
                    <th className="py-3 px-4 text-center">Sale Flag with Recorded Revenue</th>
                    <th className="py-3 px-4 text-center">Revenue</th>
                    <th className="py-3 px-4 text-right">Recorded Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {vendorCapabilities.map((v: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-3.5 px-4 font-sans font-medium text-slate-900">{v.vendor}</td>
                      <td className="py-3.5 px-4 text-right text-slate-600 font-medium">
                        {Number(v.total_transactions || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">{renderBadge(v.status_delivery)}</td>
                      <td className="py-3.5 px-4 text-center">{renderBadge(v.status_first_call)}</td>
                      <td className="py-3.5 px-4 text-center">{renderBadge(v.status_rpc)}</td>
                      <td className="py-3.5 px-4 text-center">{renderBadge(v.status_sale)}</td>
                      <td className="py-3.5 px-4 text-center">{renderBadge(v.status_billable_sale)}</td>
                      <td className="py-3.5 px-4 text-center">{renderBadge(v.status_revenue)}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {currencyPrefix}{Math.round(v.total_revenue || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </VisualTable>
            </div>
          ) : (
            <div className="p-5 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendorCapabilities.map((v: any) => ({
                  vendor: v.vendor,
                  transactions: Number(v.total_transactions) || 0,
                  revenue: Number(v.total_revenue) || 0,
                }))} margin={{ top: 10, right: 30, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="vendor" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(val: any, name: any) => [name === 'Recorded Revenue' ? `${currencyPrefix}${Number(val).toLocaleString()}` : Number(val).toLocaleString(), name]}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="transactions" name="Transactions" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="revenue" name="Recorded Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {activeTab === 'anomalies' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-200 text-amber-600 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Timing Inversion Anomaly Report</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                In multi-system distribution architecture, asynchronous event ingest and clock drift can cause downstream events to register before upstream handoffs. In accordance with platform design principles, these records are tracked explicitly rather than silently modified.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40">
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider block mb-1">
                Call Before Delivery
              </span>
              <p className="text-2xl font-bold text-amber-900">
                {Number(timingAnomalies?.call_before_delivery_count || 0).toLocaleString()}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Vicidial dialer recorded call timestamp prior to HLC delivery registration timestamp.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40">
              <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider block mb-1">
                Delivery Before Capture
              </span>
              <p className="text-2xl font-bold text-rose-900">
                {Number(timingAnomalies?.delivery_before_capture_count || 0).toLocaleString()}
              </p>
              <p className="text-xs text-rose-700 mt-1">
                HLC delivery timestamp occurred earlier than the original landing page capture timestamp.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40">
              <span className="text-xs font-semibold text-indigo-800 uppercase tracking-wider block mb-1">
                Hospital Policy Flags
              </span>
              <p className="text-2xl font-bold text-indigo-900">
                {Number(timingAnomalies?.hospital_applied_inconsistent_count || 0).toLocaleString()}
              </p>
              <p className="text-xs text-indigo-700 mt-1">
                Records where hospital_plan_applied is non-zero, but is_hospital_plan flag was false.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'multivendor' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Multi-Vendor Lead Co-Distribution Economics</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluation of monetization when leads are distributed to 1, 2, 3, or more vendors concurrently.
              </p>
            </div>
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMultiVendorView('table')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                  multiVendorView === 'table'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon size={12} /> Table
              </button>
              <button
                type="button"
                onClick={() => setMultiVendorView('graph')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                  multiVendorView === 'graph'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart2 size={12} /> Graph
              </button>
            </div>
          </div>

          {multiVendorView === 'table' ? (
            <div className="overflow-x-auto">
              <VisualTable visual={{id:'trust.multivendor',data:(multiVendorData || [])}} className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Vendor Count Bucket</th>
                    <th className="py-3 px-4 text-right">Unique Leads</th>
                    <th className="py-3 px-4 text-right">Lead Share</th>
                    <th className="py-3 px-4 text-right">Dialled / Fetched Leads (%)</th>
                    <th className="py-3 px-4 text-right">RPC / Fetched Leads (%)</th>
                    <th className="py-3 px-4 text-right">Sales / Fetched Leads (%)</th>
                    <th className="py-3 px-4 text-right">Revenue-Matched Sales / Fetched Leads (%)</th>
                    <th className="py-3 px-4 text-right">Recorded Revenue</th>
                    <th className="py-3 px-4 text-right">Recorded Revenue / Lead</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {(multiVendorData || []).map((m: any, idx: number) => {
                    const isCompounding = m.vendor_count >= 3;
                    return (
                      <tr key={idx} className={isCompounding ? 'bg-[#EDF5FC]/50 hover:bg-[#EDF5FC]' : 'hover:bg-slate-50/60'}>
                        <td className="py-3 px-4 font-sans font-medium text-slate-900 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isCompounding ? 'bg-[#3562B3]' : 'bg-slate-400'}`}></span>
                          {m.vendor_count} {m.vendor_count === 1 ? 'Vendor' : 'Vendors'}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-900">{Number(m.leads || 0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-slate-600">{Number(m.lead_share_pct || 0).toFixed(1)}%</td>
                        <td className="py-3 px-4 text-right text-slate-600">{Number(m.call_rate_pct || 0).toFixed(1)}%</td>
                        <td className="py-3 px-4 text-right text-slate-600">{Number(m.rpc_rate_pct || 0).toFixed(1)}%</td>
                        <td className="py-3 px-4 text-right text-slate-600">{Number(m.sale_rate_pct || 0).toFixed(1)}%</td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-700">{Number(m.billable_sale_rate_pct || 0).toFixed(1)}%</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900">{currencyPrefix}{Math.round(m.total_revenue || 0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-bold text-[#315EAD] bg-[#EDF5FC]/50">{currencyPrefix}{Number(m.rev_per_lead || 0).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </VisualTable>
            </div>
          ) : (
            <div className="p-5 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(multiVendorData || []).map((m: any) => ({
                  bucket: `${m.vendor_count} ${m.vendor_count === 1 ? 'Vendor' : 'Vendors'}`,
                  leads: Number(m.leads) || 0,
                  revenue: Number(m.total_revenue) || 0,
                  revPerLead: Number(m.rev_per_lead) || 0,
                }))} margin={{ top: 10, right: 30, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(val: any, name: any) => [name.includes('Revenue') ? `${currencyPrefix}${Number(val).toLocaleString()}` : Number(val).toLocaleString(), name]}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar yAxisId="left" dataKey="leads" name="Unique Leads" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="left" dataKey="revenue" name="Total Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="right" dataKey="revPerLead" name="Rev / Lead" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
