import React, { useState } from 'react';
import { PageShell } from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import KpiCard from '../components/KpiCard';
import { TrendChart } from '../components/charts/TrendChart';
import { DataState, EvidenceNotice, displayNumber } from '../components/DataState';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { useClient } from '../lib/ClientContext';
import { Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function Acquisition() {
  const [channelView, setChannelView] = useState<'table' | 'graph'>('table');
  const { data, loading, error, refetch } = useAnalyticsData('acquisition'), { clientConfig } = useClient();
  const prefix = clientConfig?.currency === 'ZAR' ? 'R ' : `${clientConfig?.currency || ''} `;
  if (loading || error || !data?.summary) return <PageShell><PageHeader title="Acquisition & Media" /><DataState loading={loading} error={error} empty={!data?.summary} retry={refetch} /></PageShell>;
  const s = data.summary;
  const chart = new Map<string, any>();
  for (const row of data.timeseries || []) { const point = chart.get(row.date) || { date: row.date, spend: 0 }; point.spend += Number(row.spend) || 0; chart.set(row.date, point); }
  return <PageShell><PageHeader title="Acquisition & Media" category="Marketing Attribution" description="Costs are displayed only when their source field and filter scope are supported." />
    <div className="space-y-6"><EvidenceNotice>{data.unavailableReason || 'Recorded revenue is not verified cash collected. Campaign-level attribution is not mapped.'}</EvidenceNotice>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Measured Spend" value={s.spend ?? 'Unavailable'} prefix={s.spend == null ? '' : prefix} />
        <KpiCard title="Fetched Leads" value={s.fetchedLeads ?? 'Unavailable'} />
        <KpiCard title="Cost per Fetched Lead" value={s.cplFetched ?? 'Unavailable'} prefix={s.cplFetched == null ? '' : prefix} subtitle="CPL.Fetched (Item 022.0)" />
        <KpiCard title="Impressions" value={s.impressions ?? 'Unavailable'} subtitle="CPM (Item 02.0)" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[
        ['Delivered Leads', 'delivered', 'cplDelivered', 'CPL.Delivered (033.0)'],
        ['Dialed Leads', 'called', 'cplDialed', 'CPL.Dialed (037.0)'],
        ['Sales', 'sales', 'cpSale', 'CP.Sale (040.0)'],
        ['Activated Sales', 'activations', 'cpsActivated', 'CPS.Activated (046.0)']
      ].map(([title, count, cost, code]) =>
        <KpiCard key={count} title={title} value={s[count] ?? 'Unavailable'} subtitle={`${code}: ${s[cost] == null ? 'Unavailable' : prefix + displayNumber(s[cost], 2)}`} />)}</div>
      {s.spend !== null && chart.size > 0 && <TrendChart title="Measured Spend by Media Date" subtitle="Media spend uses media event date, not lead capture date." data={[...chart.values()]} xAxisKey="date" currentKey="spend" valuePrefix={prefix} />}
      <section className="enterprise-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold">Channel-Level Media Performance</h2>
            <p className="text-sm text-text-sec">Campaign-level detail is unavailable in the mapped query. No campaign totals are inferred.</p>
          </div>
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setChannelView('table')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                channelView === 'table'
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon size={12} /> Table
            </button>
            <button
              type="button"
              onClick={() => setChannelView('graph')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                channelView === 'graph'
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 size={12} /> Graph
            </button>
          </div>
        </div>
        {channelView === 'table' ? (
          <div className="overflow-x-auto">
            <table className="enterprise-table w-full">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="text-right">Spend</th>
                  <th className="text-right">Impressions (CPM)</th>
                  <th className="text-right">Clicks (CPC)</th>
                  <th className="text-right">Fetched Leads (CPL.Fetched)</th>
                </tr>
              </thead>
              <tbody className="tabular-nums font-mono text-xs">
                {(data.channels || []).map((row: any) => {
                  const spendNum = Number(row.spend) || 0;
                  const impNum = Number(row.impressions) || 0;
                  const clicksNum = Number(row.clicks) || 0;
                  const leadsNum = Number(row.leads) || 0;
                  const cpm = impNum > 0 ? (spendNum / impNum) * 1000 : null;
                  const cpc = clicksNum > 0 ? spendNum / clicksNum : null;
                  const cpl = leadsNum > 0 ? spendNum / leadsNum : null;

                  return (
                    <tr key={row.channel} className="hover:bg-slate-50/70">
                      <td className="font-sans font-medium text-slate-900">{row.channel}</td>
                      <td className="text-right font-semibold">{prefix}{displayNumber(spendNum, 2)}</td>
                      <td className="text-right">
                        <span>{displayNumber(impNum)}</span>
                        {cpm !== null && (
                          <span className="block text-[11px] text-text-mute font-sans">
                            CPM: {prefix}{displayNumber(cpm, 2)}
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <span>{displayNumber(clicksNum)}</span>
                        {cpc !== null && (
                          <span className="block text-[11px] text-text-mute font-sans">
                            CPC: {prefix}{displayNumber(cpc, 2)}
                          </span>
                        )}
                      </td>
                      <td className="text-right font-medium text-blue-700">
                        <span>{displayNumber(leadsNum)}</span>
                        {cpl !== null && (
                          <span className="block text-[11px] text-emerald-700 font-sans font-semibold">
                            CPL.Fetched: {prefix}{displayNumber(cpl, 2)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!data.channels?.length && <tr><td colSpan={5} className="text-center py-4 text-text-mute font-sans">No comparable media data is available for this selection.</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data.channels || []).map((row: any) => ({
                channel: row.channel,
                spend: Number(row.spend) || 0,
                leads: Number(row.leads) || 0,
              }))} margin={{ top: 10, right: 30, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="channel" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(val: any, name: any) => [name === 'Spend' ? `${prefix}${Number(val).toLocaleString()}` : Number(val).toLocaleString(), name]}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="spend" name="Spend" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="leads" name="Fetched Leads" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  </PageShell>;
}
