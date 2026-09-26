import React, { useEffect, useState } from 'react';
import { formatTableNumber } from '../lib/formatters';
import { TableSkeleton } from '../components/Skeleton';
import KpiCard from '../components/KpiCard';
import PageHeader from '../components/PageHeader';
import { useFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchAnalyticsJson } from '../lib/useAnalyticsData';
import { Loader2, Database, TableProperties, CheckCircle2, AlertCircle, Fingerprint, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function DataCoverage() {
  const { startDate, endDate, filters } = useFilters();
  const { selectedClient } = useClient();
  const [tableData, setTableData] = useState<any[]>([]);
  const [paramData, setParamData] = useState<any>(null);
  const [hlcCoverage, setHlcCoverage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorCoverageView, setVendorCoverageView] = useState<'table' | 'graph'>('table');

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);

    const clientId = selectedClient || 'default_tenant';
    const filterParam = Object.keys(filters).length ? `&filters=${encodeURIComponent(JSON.stringify(filters))}` : '';
    const dateParams = (startDate ? `&startDate=${encodeURIComponent(startDate)}` : '') + (endDate ? `&endDate=${encodeURIComponent(endDate)}` : '');
    const vendorCoverageUrl = `/api/analytics/vendor-coverage?clientId=${encodeURIComponent(clientId)}${dateParams}${filterParam}`;
    const discoveryUrl = `/api/analytics/discovery?clientId=${encodeURIComponent(clientId)}`;
    const paramCoverageUrl = `/api/analytics/parameter-coverage?clientId=${encodeURIComponent(clientId)}`;

    Promise.all([
      fetchAnalyticsJson(discoveryUrl).catch(() => ({ success: false, data: null })),
      fetchAnalyticsJson(paramCoverageUrl).catch(() => ({ success: false, data: null })),
      fetchAnalyticsJson(vendorCoverageUrl).catch(() => ({ success: false, data: null }))
    ]).then(([tData, pData, hData]: any[]) => {
      if (!isCurrent) return;
      if (tData?.success) setTableData(tData.data);
      if (pData?.success) {
        setParamData(pData.data);
      } else {
        // Fallback default structure so page can render gracefully even if paramCoverage is unauthorized or unavailable
        setParamData({
          summary: { mapped: 0, totalRequired: 0, coveragePercent: '0.0', sourceConflicts: 0 },
          parameters: []
        });
      }
      if (hData && hData?.success) setHlcCoverage(hData.data);
      setLoading(false);
    }).catch(err => {
      console.warn("Data coverage fetch failed:", err);
      if (isCurrent) {
        setParamData({
          summary: { mapped: 0, totalRequired: 0, coveragePercent: '0.0', sourceConflicts: 0 },
          parameters: []
        });
        setLoading(false);
      }
    });

    return () => { isCurrent = false; };
  }, [selectedClient, startDate, endDate]);

  if (loading || !paramData) {
    return (
      <div className="w-full px-6 lg:px-8 py-6 lg:py-8 pb-24 max-w-[1920px] mx-auto fade-in space-y-6"><TableSkeleton /></div>
    );
  }
  
  const mappedCount = tableData.filter(d => d.mapped).length;
  const totalCount = tableData.length;
  const coverage = totalCount > 0 ? ((mappedCount / totalCount) * 100).toFixed(1) : '0.0';

  return (
    <div className="w-full px-6 lg:px-8 py-6 lg:py-8 pb-24 max-w-[1920px] mx-auto fade-in space-y-6">
      <PageHeader 
        title="Data & Parameter Coverage" 
        category="Semantic Schema Integrity"
        description="Audit BigQuery field mappings, canonical parameter schemas, and multi-vendor telemetry coverage." 
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-6 sm:mb-8">
        <KpiCard title="Parameters Mapped" value={paramData.summary.mapped + " / " + paramData.summary.totalRequired} />
        <KpiCard title="Parameter Coverage" value={paramData.summary.coveragePercent} suffix="%" />
        <KpiCard title="Tables Scanned" value={totalCount} />
        <KpiCard title="Source Conflicts" value={paramData.summary.sourceConflicts} isPositiveGood={false} />
      </div>
      <div className="enterprise-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-surface-sec">
          <h2 className="font-semibold text-text-main">Canonical Parameter Registry</h2>
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Source Table</th>
                <th>Source Column</th>
                <th>Type</th>
                <th>Fallback Source</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paramData.parameters.map((p: any, i: number) => (
                <tr key={i} className="hover:bg-surface-sec">
                  <td>{p.canonicalParameter}</td>
                  <td>{p.sourceTable}</td>
                  <td>{p.sourceColumn}</td>
                  <td>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-mono">{p.dataType}</span>
                  </td>
                  <td>{p.fallbackSource || '-'}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === 'MAPPED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-surface-sec">
          <h2 className="font-semibold text-text-main">Table Schema Matrix</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Table</th>
                <th>Domain</th>
                <th>Rows</th>
                <th>Used By</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tableData.map((d: any, i: number) => (
                <tr key={i} className="hover:bg-surface-sec">
                  <td>{d.dataset}</td>
                  <td>
                    <TableProperties className="w-4 h-4 text-indigo-400" />
                    {d.table}
                  </td>
                  <td>{d.domain}</td>
                  <td>{formatTableNumber(d.rows)}</td>
                  <td>{d.usedBy || '-'}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${d.mapped ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {d.mapped ? 'MAPPED' : 'UNMAPPED'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="enterprise-card overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-slate-200 bg-surface-sec flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-text-main">HLC Vendor Field Coverage</h2>
            <p className="text-xs text-text-sec mt-1">Completeness of analytical fields partitioned by HLC Vendor.</p>
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setVendorCoverageView('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                vendorCoverageView === 'table'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setVendorCoverageView('graph')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                vendorCoverageView === 'graph'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Graph</span>
            </button>
          </div>
        </div>

        {vendorCoverageView === 'table' ? (
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th className="text-right">Transactions</th>
                  <th className="text-right">Status</th>
                  <th className="text-right">Delivery</th>
                  <th className="text-right">1st Call</th>
                  <th className="text-right">Last Call</th>
                  <th className="text-right">Disposition</th>
                  <th className="text-right">RPC</th>
                  <th className="text-right">Sale</th>
                  <th className="text-right">Activation</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {hlcCoverage.map((d: any, i: number) => {
                  const pct = (val: number) => (val * 100).toFixed(1) + '%';
                  const getColor = (val: number) => val > 0.9 ? 'text-emerald-600 font-medium' : val > 0.5 ? 'text-amber-600' : 'text-slate-400';
                  return (
                    <tr key={i} className="hover:bg-surface-sec">
                      <td className="font-medium text-text-main">{d.vendor || 'Unknown'}</td>
                      <td className="text-right">{formatTableNumber(d.total_transactions)}</td>
                      <td className={"text-right " + getColor(d.coverage_status)}>{pct(d.coverage_status)}</td>
                      <td className={"text-right " + getColor(d.coverage_delivery)}>{pct(d.coverage_delivery)}</td>
                      <td className={"text-right " + getColor(d.coverage_first_call)}>{pct(d.coverage_first_call)}</td>
                      <td className={"text-right " + getColor(d.coverage_last_call)}>{pct(d.coverage_last_call)}</td>
                      <td className={"text-right " + getColor(d.coverage_disposition)}>{pct(d.coverage_disposition)}</td>
                      <td className={"text-right " + getColor(d.coverage_rpc)}>{pct(d.coverage_rpc)}</td>
                      <td className={"text-right " + getColor(d.coverage_sale)}>{pct(d.coverage_sale)}</td>
                      <td className={"text-right " + getColor(d.coverage_activation)}>{pct(d.coverage_activation)}</td>
                      <td className={"text-right " + getColor(d.coverage_revenue)}>{pct(d.coverage_revenue)}</td>
                    </tr>
                  );
                })}
                {hlcCoverage.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center py-6 text-text-mute italic">No HLC vendor data available for the current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={hlcCoverage.map((d: any) => ({
                    vendor: d.vendor || 'Unknown',
                    status: Number(((d.coverage_status || 0) * 100).toFixed(1)),
                    delivery: Number(((d.coverage_delivery || 0) * 100).toFixed(1)),
                    firstCall: Number(((d.coverage_first_call || 0) * 100).toFixed(1)),
                    rpc: Number(((d.coverage_rpc || 0) * 100).toFixed(1)),
                    sale: Number(((d.coverage_sale || 0) * 100).toFixed(1)),
                    activation: Number(((d.coverage_activation || 0) * 100).toFixed(1)),
                    revenue: Number(((d.coverage_revenue || 0) * 100).toFixed(1)),
                  }))}
                  margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="vendor" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                  <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '12px' }}
                    formatter={(val: number) => [`${val}%`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                  <Bar dataKey="delivery" name="Delivery %" fill="#3b82f6" />
                  <Bar dataKey="firstCall" name="1st Call %" fill="#6366f1" />
                  <Bar dataKey="rpc" name="RPC %" fill="#8b5cf6" />
                  <Bar dataKey="sale" name="Sale %" fill="#10b981" />
                  <Bar dataKey="activation" name="Activation %" fill="#059669" />
                  <Bar dataKey="revenue" name="Revenue %" fill="#d97706" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
