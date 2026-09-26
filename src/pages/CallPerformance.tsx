import { VisualTable } from '../components/visuals/DataVisual';
import React, { useMemo, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PageShell } from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import KpiCard from '../components/KpiCard';
import { TableSkeleton } from '../components/Skeleton';
import { DiminishingReturnsChart } from '../components/charts/DiminishingReturnsChart';
import { DistributionBar } from '../components/charts/DistributionBar';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { useClient } from '../lib/ClientContext';
import { METRICS } from '../lib/metrics';
import { LEGACY_LABELS as L } from '../../contracts/naming';
import { exactNumber } from '../../contracts/format';
import { compareExactDecimal } from '../../contracts/exactDecimal';
import { AlertTriangle, ArrowUpDown, Download, Search, X, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const number = (value: unknown) => typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value) ? exactNumber(value) : 'Unavailable';
const pct = (value: unknown) => value === null || value === undefined ? 'Unavailable' : `${number(value)}%`;
const coordinate = (value: unknown) => typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : null;

function Table({ headings, rows, visual }: { headings: string[]; rows: React.ReactNode[][]; visual: any }) {
  return <div className="overflow-x-auto"><VisualTable visual={visual} className="enterprise-table w-full"><thead><tr>{headings.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell,j) => <td key={j}>{cell}</td>)}</tr>)}{!rows.length && <tr><td colSpan={headings.length}>No records matched this selection.</td></tr>}</tbody></VisualTable></div>;
}

function SectionUnavailable({ section }: { section?: { status: string; reason: string | null } }) {
  if (!section || section.status === 'AVAILABLE') return null;
  return <div className="cx-section-unavailable" role="status"><AlertTriangle size={19} aria-hidden="true"/><div><strong>{section.status === 'SOURCE_UNAVAILABLE' ? 'Required source unavailable' : 'Section unavailable'}</strong><p>{section.reason || 'Unavailable — this section could not be calculated.'}</p></div></div>;
}

export default function CallPerformance() {
  const { data, loading, error, refetch } = useAnalyticsData('calls');
  const { clientConfig } = useClient();
  const location = useLocation();
  const [tab,setTab] = useState('attempts'), [vendorSearch,setVendorSearch] = useState('');
  const [vendorView, setVendorView] = useState<'table' | 'graph'>('table');
  const [dispView, setDispView] = useState<'table' | 'graph'>('table');
  const [hourlyView, setHourlyView] = useState<'table' | 'graph'>('table');
  const [weekdayView, setWeekdayView] = useState<'table' | 'graph'>('table');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['attempts', 'timing', 'vendors'].includes(tabParam)) {
      setTab(tabParam);
    }
  }, [location.search]);

  const [vendorSort, setVendorSort] = useState<string>('totalLeads');
  const [vendorDir, setVendorDir] = useState<'asc' | 'desc'>('desc');
  const currency = clientConfig?.currency || 'ZAR';
  const money = (value: unknown) => value === null || value === undefined ? 'Unavailable' : `${currency} ${number(value)}`;

  const bands = data?.chart || [];
  const rawVendors = data?.vendors || [];

  const chartBands = useMemo(() => {
    return bands.map((band: any) => ({
      ...band,
      current: coordinate(band.current),
      rpc: coordinate(band.rpc),
      sale: coordinate(band.sale),
      activation: coordinate(band.activation),
    }));
  }, [bands]);

  const vendors = useMemo(() => {
    const term = vendorSearch.trim().toLowerCase();
    const filtered = (rawVendors as any[]).filter((v: any) => !term || String(v.vendor || '').toLowerCase().includes(term));
    return filtered.sort((a: any, b: any) => {
      if (vendorSort === 'vendor') {
        const cmp = String(a.vendor || '').localeCompare(String(b.vendor || ''));
        return vendorDir === 'asc' ? cmp : -cmp;
      }
      const valA = a[vendorSort];
      const valB = b[vendorSort];
      if (typeof valA === 'string' && typeof valB === 'string' && /^-?\d+(?:\.\d+)?$/.test(valA) && /^-?\d+(?:\.\d+)?$/.test(valB)) {
        const cmp = compareExactDecimal(valA, valB);
        return vendorDir === 'asc' ? cmp : -cmp;
      }
      const numA = Number(valA ?? -Infinity);
      const numB = Number(valB ?? -Infinity);
      return vendorDir === 'asc' ? numA - numB : numB - numA;
    });
  }, [rawVendors, vendorSearch, vendorSort, vendorDir]);

  const handleVendorSort = (key: string) => {
    if (vendorSort === key) {
      setVendorDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setVendorSort(key);
      setVendorDir(key === 'vendor' ? 'asc' : 'desc');
    }
  };

  const exportVendorCsv = () => {
    const headers = ['Vendor', 'Fetched Leads', 'Dialled Rows', 'Attempts / Dialled Row', 'One-Call Share (%)', 'Observed RPC (%)', 'Sales (%)', 'Recorded Value / Dialled Row'];
    const rows = vendors.map((v: any) => [
      `"${String(v.vendor || '').replace(/"/g, '""')}"`,
      `"${v.totalLeads ?? ''}"`,
      `"${v.calledLeads ?? ''}"`,
      `"${v.avgCallsPerLead ?? ''}"`,
      `"${v.oneCallRate ?? ''}"`,
      `"${v.rpcRate ?? ''}"`,
      `"${v.saleRate ?? ''}"`,
      `"${v.revPerLead ?? ''}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = href;
    a.download = `cx-calls-vendors.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  if (loading) return <PageShell><PageHeader title="Call Performance" /><TableSkeleton /></PageShell>;
  if (error || !data) return <PageShell><PageHeader title="Call Performance" /><div role="alert">{error || 'No report was returned.'}<button className="block underline mt-2" onClick={()=>refetch?.()}>Retry</button></div></PageShell>;

  return <PageShell><PageHeader title="Call Performance" description="Observed dialling activity. A call attempt is not proof of contact, resolution or a sale." />
    <div className="space-y-6">
      <SectionUnavailable section={data.sections?.summary}/>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard title={L.called} value={data.calledLeads} subtitle="Lead records with supported first-call evidence" lineage={METRICS.called_leads} />
        <KpiCard title={L.total_calls} value={data.totalCalls} subtitle="Distinct event-level dialler rows; HLC snapshot counters excluded" lineage={METRICS.total_calls} />
        <KpiCard title={L.calls_per_called_lead} value={data.avgCalls} subtitle="Observed call events / dialled leads" lineage={METRICS.calls_per_called_lead} />
        <KpiCard title={L.one_call_rate} value={data.oneCallRate} suffix="%" subtitle={`${number(data.oneCallLeads)} leads with exactly one observed attempt / dialled leads`} />
        <KpiCard title={L.repeat_call_rate} value={data.repeatCallRate} suffix="%" subtitle={`${number(data.repeatCallLeads)} leads with two or more observed attempts / dialled leads`} />
        <KpiCard title="Recorded Call Duration" value={data.totalDurationHours} suffix="hours" subtitle="Sum of event-level duration values; not verified talk time" />
      </div>
      <nav className="cx-tabs" aria-label="Call report views">
        {[
          ['attempts','Call-Attempt Bands'],
          ['timing','First-Dial Timing'],
          ['vendors','Vendor & Disposition Records']
        ].map(([id,label]) => (
          <button
            key={id}
            type="button"
            onClick={()=>setTab(id)}
            aria-pressed={tab===id}
            className={`cx-tab-item ${tab===id ? 'active' : ''}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab==='attempts' && <>
        <p className="text-sm">Each band counts lead records by distinct event-level dialler attempts. HLC snapshot counters and sale flags do not add calls. Observed RPC means supported dialler RPC evidence only.</p>
        <SectionUnavailable section={data.sections?.callAttemptBands}/>
        {data.sections?.callAttemptBands?.status === 'AVAILABLE' && <div className="grid lg:grid-cols-2 gap-6">
          <DiminishingReturnsChart title="Recorded Outcomes by Call-Attempt Band" subtitle="Outcome lead flags / lead records in each band. Association does not establish an effect of making more calls."
            data={chartBands} volumeKey="current" volumeName="Leads in Band" primaryLineKey="rpc" primaryLineName="Observed RPC / Leads in Band (%)" secondaryLineKey="sale" secondaryLineName="Sales / Leads in Band (%)" />
          <DistributionBar title="Lead Counts by Observed Attempts" subtitle="Counts of lead records by distinct call-event population." data={chartBands} bucketKey="bucket" valueKey="current" />
        </div>}
        {data.sections?.callAttemptBands?.status === 'AVAILABLE' && <section className="enterprise-card p-5"><h2 className="font-semibold mb-3">Lead-Level Outcomes</h2><Table visual={{id:'calls.bands',data:bands}} headings={['Call-Attempt Band','Lead Records','Observed RPC / Leads (%)','Sales / Leads (%)','Activations / Leads (%)','Recorded Value / Lead','Recorded Value']}
          rows={bands.map((b:any)=>[b.bucket,number(b.current),pct(b.rpc),pct(b.sale),pct(b.activation),money(b.revPerLead),money(b.totalRevenue)])}/></section>}
      </>}
      {tab==='timing' && <>
        <p className="text-sm">Counts are dialled lead records grouped by their first supported dial timestamp, not total attempts or answered calls. Hours use the configured source timestamp interpretation; no operating roster or optimal calling window is inferred.</p>
        <div className="grid lg:grid-cols-2 gap-6">{[['hourly','First-Dial Hour','label','firstDialHour'],['dayOfWeek','First-Dial Weekday','day','firstDialWeekday']].map(([key,title,label,section]) => <section key={key} className="enterprise-card p-5"><h2 className="font-semibold mb-3">{title}</h2><SectionUnavailable section={data.sections?.[section]}/>{data.sections?.[section]?.status === 'AVAILABLE' && <Table visual={{id:key==='hourly'?'calls.hourly':'calls.weekdays',data:data[key]||[]}} headings={[title,'Dialled Leads','Observed RPC / Dialled Leads (%)','Sales / Dialled Leads (%)','Recorded Value']}
          rows={(data[key]||[]).map((r:any)=>[r[label],number(r.volume),pct(r.rpcRate),pct(r.saleRate),money(r.revenue)])}/>}</section>)}</div>
      </>}
      {tab==='vendors' && <>
        <section className="enterprise-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Vendor Transaction Summary</h2>
              <p className="text-sm text-text-sec">Fetched leads are distinct lead IDs. Observed attempts aggregate event-level dialler rows once at lead/vendor grain; repeated HLC transaction rows cannot multiply them.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setVendorView('table')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                    vendorView === 'table'
                      ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TableIcon size={12} /> Table
                </button>
                <button
                  type="button"
                  onClick={() => setVendorView('graph')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                    vendorView === 'graph'
                      ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart2 size={12} /> Graph
                </button>
              </div>
              {vendors.length > 0 && (
                <button type="button" onClick={exportVendorCsv} className="cx-button-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5">
                  <Download size={13} /> Export CSV
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative inline-flex items-center flex-1 max-w-sm">
              <Search size={14} className="absolute left-2.5 text-text-mute"/>
              <input
                className="w-full border rounded pl-8 pr-7 py-1.5 text-sm"
                placeholder="Find Vendor..."
                value={vendorSearch}
                onChange={e=>setVendorSearch(e.target.value)}
              />
              {vendorSearch && (
                <button type="button" onClick={()=>setVendorSearch('')} className="absolute right-2 text-text-mute hover:text-text-main">
                  <X size={13}/>
                </button>
              )}
            </div>
            <span className="text-xs text-text-mute">
              Showing {vendors.length} of {rawVendors.length} vendors
            </span>
          </div>
          <SectionUnavailable section={data.sections?.vendors}/>
          {data.sections?.vendors?.status === 'AVAILABLE' && (
            vendorView === 'table' ? (
              <div className="overflow-x-auto">
                <VisualTable visual={{id:'calls.vendors',data:vendors}} className="enterprise-table w-full">
                  <thead>
                    <tr>
                      {[
                        { key: 'vendor', label: 'Vendor' },
                        { key: 'totalLeads', label: 'Fetched Leads (022.0)' },
                        { key: 'calledLeads', label: 'Dialed Leads (037.0)' },
                        { key: 'avgCallsPerLead', label: 'Attempts / Dialed Lead' },
                        { key: 'oneCallRate', label: 'One-Call / Dialed (%)' },
                        { key: 'rpcRate', label: 'Right Party Contact / Dialed (%)' },
                        { key: 'saleRate', label: 'Sales / Dialed (%)' },
                        { key: 'revPerLead', label: 'Recorded Value / Dialed Lead' },
                      ].map(col => (
                        <th key={col.key} scope="col">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-semibold text-inherit hover:underline"
                            onClick={() => handleVendorSort(col.key)}
                          >
                            {col.label}
                            {vendorSort === col.key ? (vendorDir === 'desc' ? ' ▼' : ' ▲') : <ArrowUpDown size={11} className="opacity-40" />}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((v: any, i: number) => (
                      <tr key={v.vendor || i}>
                        <td><strong>{v.vendor}</strong></td>
                        <td>{number(v.totalLeads)}</td>
                        <td>{number(v.calledLeads)}</td>
                        <td>{number(v.avgCallsPerLead)}</td>
                        <td>{pct(v.oneCallRate)}</td>
                        <td>{pct(v.rpcRate)}</td>
                        <td>{pct(v.saleRate)}</td>
                        <td>{money(v.revPerLead)}</td>
                      </tr>
                    ))}
                    {!vendors.length && (
                      <tr>
                        <td colSpan={8} className="text-center py-4 text-text-mute">
                          No vendors match the search filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </VisualTable>
              </div>
            ) : (
              <div className="p-4 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendors.slice(0, 15).map(v => ({
                    vendor: v.vendor,
                    totalLeads: Number(v.totalLeads) || 0,
                    calledLeads: Number(v.calledLeads) || 0,
                    rpcRate: Number(v.rpcRate) || 0,
                    saleRate: Number(v.saleRate) || 0,
                  }))} margin={{ top: 10, right: 30, left: 10, bottom: 35 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="vendor" tick={{ fontSize: 9 }} stroke="#94a3b8" interval={0} angle={-25} textAnchor="end" height={45} />
                    <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <Tooltip
                      formatter={(val: any, name: any) => [Number(val).toLocaleString(), name]}
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="totalLeads" name="Fetched Leads" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="calledLeads" name="Dialled Rows" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          )}
        </section>
        <section className="enterprise-card p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Recorded Dispositions</h2>
              <p className="text-sm text-text-sec">Transaction IDs are counted within each disposition. Observed RPC is kept separate from sale evidence. Share refers to the returned top-ten groups only.</p>
            </div>
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setDispView('table')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                  dispView === 'table'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon size={12} /> Table
              </button>
              <button
                type="button"
                onClick={() => setDispView('graph')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                  dispView === 'graph'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart2 size={12} /> Graph
              </button>
            </div>
          </div>
          <SectionUnavailable section={data.sections?.dispositions}/>
          {data.sections?.dispositions?.status === 'AVAILABLE' && (
            dispView === 'table' ? (
              <Table visual={{id:'calls.dispositions',data:data.dispositions||[]}} headings={['Disposition','Distinct Transaction IDs','Share of Returned Groups (%)','Observed RPC / Transactions (%)','Sales / Transactions (%)','Recorded Value']}
                rows={(data.dispositions||[]).map((d:any)=>[d.disposition,number(d.volume),pct(d.share),pct(d.rpcRate),pct(d.saleRate),money(d.revenue)])}/>
            ) : (
              <div className="p-4 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(data.dispositions||[]).map((d: any) => ({
                    disposition: d.disposition,
                    volume: Number(d.volume) || 0,
                    rpcRate: Number(d.rpcRate) || 0,
                    saleRate: Number(d.saleRate) || 0,
                  }))} margin={{ top: 10, right: 30, left: 10, bottom: 35 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="disposition" tick={{ fontSize: 9 }} stroke="#94a3b8" interval={0} angle={-25} textAnchor="end" height={45} />
                    <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <Tooltip
                      formatter={(val: any, name: any) => [Number(val).toLocaleString(), name]}
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="volume" name="Distinct Transactions" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          )}
        </section>
      </>}
      <details className="enterprise-card p-4"><summary>Call evidence definition</summary><p className="text-sm mt-3">{data.rpcDefinition}</p><p className="text-sm">Numeric API values use {data.precision}; charts alone use approximate coordinates.</p></details>
    </div>
  </PageShell>;
}
