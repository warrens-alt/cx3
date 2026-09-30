import { chartCoordinate } from '../lib/chartPresentation';
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Database, Download, FileText, Info, Search, X, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { PAGE_TITLES } from '../../contracts/naming';
import { compareExactDecimal, subtractExactDecimals } from '../../contracts/exactDecimal';
import { METRIC_BY_ID, type MetricResult } from '../../contracts/reporting';
import { exactNumber } from '../../contracts/format';
import { formatReportValue } from '../lib/reportPreflight';
import { exactMovement, metricValue, pivotReportGroups } from '../lib/evidenceWorkspace';
import { useEvidenceWorkspace } from '../lib/useEvidenceWorkspace';
import { useFilters } from '../lib/FilterContext';
import EvidenceScopeBar from '../components/operations/EvidenceScopeBar';
import WorkspaceState from '../components/operations/WorkspaceState';
import MetricRail from '../components/operations/MetricRail';
import ExactBarChart from '../components/operations/ExactBarChart';
import EvidenceInspector, { type EvidenceSelection } from '../components/operations/EvidenceInspector';
import { VisualTable } from '../components/visuals/DataVisual';

const METRICS = ['sale_events','activation_events','expected_value','approved_value','invoiced_value','collected_value'];
const STAGES = ['expected_value','approved_value','invoiced_value','collected_value'];
const available=(metric:MetricResult|null|undefined)=>metric?.calculationStatus==='CHECKED'?metric.value:null;
const exportRows=(rows:unknown[],name:string)=>{const href=URL.createObjectURL(new Blob([JSON.stringify(rows,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=href;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);};

export default function CommercialReconciliation() {
  const workspace=useEvidenceWorkspace({metrics:METRICS,grouping:'vendor',comparisons:true});
  const { vendor } = useFilters();
  const report=workspace.current.data, previous=workspace.previous.data, currency=workspace.request.currency;
  const rows=useMemo(()=>pivotReportGroups(report),[report]);
  const [search,setSearch]=useState(''), deferredSearch=useDeferredValue(search.trim().toLowerCase());

  useEffect(() => {
    if (vendor && !['all', 'all vendors'].includes(vendor.toLowerCase())) {
      setSearch(vendor);
    } else if (!vendor) {
      setSearch('');
    }
  }, [vendor]);
  const [sort,setSort]=useState('collected_value'), [sortAsc,setSortAsc]=useState(false);
  const [selectedVendor,setSelectedVendor]=useState<string|null>(null), [inspection,setInspection]=useState<EvidenceSelection|null>(null);
  const [vendorView, setVendorView] = useState<'table' | 'graph'>('table');

  const filtered=useMemo(() => {
    const list = rows.filter(row => !deferredSearch || row.group.toLowerCase().includes(deferredSearch));
    return [...list].sort((a,b) => {
      let cmp = 0;
      if (sort === 'vendor') {
        cmp = a.group.localeCompare(b.group);
      } else if (sort === 'sales') {
        const av = available(a.metrics['sale_events']), bv = available(b.metrics['sale_events']);
        if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
        cmp = compareExactDecimal(av, bv);
      } else if (sort === 'gap') {
        const ag = (available(a.metrics.invoiced_value) && available(a.metrics.collected_value))
          ? subtractExactDecimals(available(a.metrics.invoiced_value)!, available(a.metrics.collected_value)!) : null;
        const bg = (available(b.metrics.invoiced_value) && available(b.metrics.collected_value))
          ? subtractExactDecimals(available(b.metrics.invoiced_value)!, available(b.metrics.collected_value)!) : null;
        if (ag === null || bg === null) return ag === bg ? 0 : ag === null ? 1 : -1;
        cmp = compareExactDecimal(ag, bg);
      } else {
        const av = available(a.metrics[sort]), bv = available(b.metrics[sort]);
        if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
        cmp = compareExactDecimal(av, bv);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [rows, deferredSearch, sort, sortAsc]);

  const toggleSort = (key: string) => {
    if (sort === key) {
      setSortAsc(!sortAsc);
    } else {
      setSort(key);
      setSortAsc(key === 'vendor');
    }
  };

  const format=(metric:MetricResult|null|undefined)=>metric?formatReportValue(metric,currency):'Unavailable';
  const total=(id:string)=>metricValue(report,id), prior=(id:string)=>metricValue(previous,id);
  const kpis=STAGES.map(id=>({
    id,
    label:METRIC_BY_ID[id].label,
    value:format(total(id)),
    change:exactMovement(available(total(id)),available(prior(id))),
    comparison:'vs previous comparable period',
    note:id==='collected_value'?'Signed collection changes only.':`${METRIC_BY_ID[id].definition}`,
    status:total(id)?.calculationStatus,
    onInspect: () => setInspection({metricId:id,group:null,label:METRIC_BY_ID[id].label}),
    inspectLabel: 'Inspect',
  }));
  const gap=(left:string,right:string)=>{const a=available(total(left)),b=available(total(right));return a===null||b===null?'Unavailable':`${currency} ${exactNumber(subtractExactDecimals(a,b),2)}`;};
  const stageChart=STAGES.map(id=>({label:METRIC_BY_ID[id].label,value:available(total(id)),formatted:format(total(id))}));
  const selected=rows.find(row=>row.key===selectedVendor)??filtered[0];
  const loading=workspace.catalogue.isLoading||workspace.current.isLoading, error=workspace.catalogue.error||workspace.current.error;

  const exportCsv = () => {
    const headers = ['Vendor', 'Recorded Sales', ...STAGES.map(id => METRIC_BY_ID[id].label), 'Invoice-to-collection gap'];
    const csvRows = filtered.map(row => {
      const invoiced = available(row.metrics.invoiced_value);
      const collected = available(row.metrics.collected_value);
      const gapVal = invoiced !== null && collected !== null ? subtractExactDecimals(invoiced, collected) : 'Unavailable';
      return [
        `"${row.group.replace(/"/g, '""')}"`,
        `"${available(row.metrics.sale_events) ?? 'Unavailable'}"`,
        ...STAGES.map(id => `"${available(row.metrics[id]) ?? 'Unavailable'}"`),
        `"${gapVal}"`,
      ];
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows.map(r => r.join(','))].join('\r\n');
    const href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = href;
    a.download = `cx-commercial-reconciliation-${workspace.request.startDate}-${workspace.request.endDate}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  return <div className="cx-page cx-ops-page cx-commercial-page cx-reconciliation-page">
    <header className="cx-page-header">
      <div>
        <p className="cx-ops-eyebrow">Commercial control</p>
        <h1 className="text-page-title">{PAGE_TITLES['/reconciliation']}</h1>
        <p>Follow recorded outcomes through expected, approved, invoiced and collected value without collapsing those stages into a single revenue label.</p>
      </div>
      <a className="cx-button-secondary" href="#commercial-ledger">Review ledger evidence <ArrowRight size={15}/></a>
    </header>

    <EvidenceScopeBar releaseId={workspace.release?.releaseId} cutoff={workspace.release?.cutoff} busy={workspace.current.isFetching}/>
    
    <WorkspaceState loading={loading} error={error} missingRelease={workspace.catalogue.data&&!workspace.catalogue.data.available?workspace.catalogue.data.reason:null} scopeError={workspace.scopeError} retry={()=>{void workspace.catalogue.refetch();void workspace.current.refetch();}}/>

    {!loading && workspace.catalogue.data && !workspace.catalogue.data.available && (
      <div className="enterprise-card p-6 border-blue-200 bg-blue-50/50 space-y-4 my-4">
        <div className="flex items-center gap-2 text-blue-900 font-semibold">
          <Database size={18} className="text-[#315BCB]" />
          <span>Operational Release Telemetry Guidance</span>
        </div>
        <p className="text-sm text-text-sec">
          {workspace.catalogue.data.reason || 'No approved reporting release is available for this workspace.'} Multi-stage commercial reconciliation requires published release evidence.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link to="/overview" className="cx-button-secondary text-xs">Explore Executive Overview</Link>
          <Link to="/call-performance" className="cx-button-secondary text-xs">View Call Performance</Link>
          <Link to="/speed-to-lead" className="cx-button-secondary text-xs">View Speed to Lead</Link>
          <Link to="/lead-performance" className="cx-button-secondary text-xs">View Lead Funnel</Link>
        </div>
      </div>
    )}

    {report&&<>
      <MetricRail items={kpis}/>
      <section className="cx-commercial-flow" aria-label="Commercial stage flow">
        {STAGES.map((id,index)=>(
          <React.Fragment key={id}>
            <button type="button" onClick={()=>setInspection({metricId:id,group:null,label:METRIC_BY_ID[id].label})}>
              <span>{index+1}</span>
              <div><small>{METRIC_BY_ID[id].label}</small><strong>{format(total(id))}</strong></div>
            </button>
            {index<STAGES.length-1&&<ArrowRight aria-hidden="true"/>}
          </React.Fragment>
        ))}
      </section>

      <section className="cx-ops-analysis-grid">
        <ExactBarChart data={stageChart} title="Commercial stage values" description="Signed ledger deltas at each stage. Reversals reduce the relevant stage and remain visible in supporting evidence." onSelect={label=>{const id=STAGES.find(stage=>METRIC_BY_ID[stage].label===label);if(id)setInspection({metricId:id,group:null,label});}}/>
        <aside className="enterprise-card cx-commercial-gaps">
          <header><h2>Stage reconciliation gaps</h2><p>Arithmetic differences are descriptive balances, not loss or profit.</p></header>
          <dl>
            <div><dt>Expected less approved</dt><dd>{gap('expected_value','approved_value')}</dd></div>
            <div><dt>Approved less invoiced</dt><dd>{gap('approved_value','invoiced_value')}</dd></div>
            <div><dt>Invoiced less collected</dt><dd>{gap('invoiced_value','collected_value')}</dd></div>
          </dl>
          <p><Info size={16}/>Negative differences can arise from later-stage value or reversals; inspect ledger events before drawing a conclusion.</p>
        </aside>
      </section>

      <section className="cx-commercial-controls">
        <article className="enterprise-card"><span>Agreement / rate card</span><strong>Evidence field available</strong><p>Commercial evidence exposes the recorded agreement version. No rate-card registry has been approved, so rates are not recalculated.</p></article>
        <article className="enterprise-card"><span>Effective-date eligibility</span><strong>Contract foundation ready</strong><p>Deterministic vendor, currency, product, grade, event and effective-date resolution rejects overlapping versions.</p></article>
        <article className="enterprise-card" data-status="unavailable"><span>Invoice matching</span><strong>Unavailable</strong><p>No approved invoice identity is present in the commercial fact contract. Invoiced stage events are not called matched invoices.</p></article>
        <article className="enterprise-card" data-status="unavailable"><span>Collection matching</span><strong>Unavailable</strong><p>No approved collection identity is present. Collected ledger deltas remain distinct from bank settlement evidence.</p></article>
      </section>

      <section id="commercial-ledger" className="enterprise-card cx-ops-table-card">
        <header>
          <div>
            <p className="cx-ops-eyebrow">Vendor reconciliation</p>
            <h2>Commercial stage table</h2>
            <p>Exact values grouped by vendor. Selecting a value opens records from the same release and execution.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <button type="button" className="cx-button-secondary" onClick={exportCsv} disabled={!filtered.length}>
              <FileText size={15}/>Export CSV
            </button>
            <button type="button" className="cx-button-secondary" onClick={()=>exportRows(filtered.map(row=>({vendor:row.rawGroup,...Object.fromEntries(STAGES.map(id=>[id,row.metrics[id]?.value??null]))})),`cx-commercial-${workspace.request.startDate}-${workspace.request.endDate}.json`)} disabled={!filtered.length}>
              <Download size={15}/>Export JSON
            </button>
          </div>
        </header>

        {vendorView === 'table' ? (
          <>
            <div className="cx-ops-table-tools">
              <label className="relative">
                <Search size={15}/>
                <span className="sr-only">Search vendors</span>
                <input 
                  value={search} 
                  onChange={event=>setSearch(event.target.value)} 
                  placeholder="Search vendors"
                  className={search ? 'pr-7' : ''}
                />
                {search && (
                  <button 
                    type="button" 
                    onClick={()=>setSearch('')} 
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-mute hover:text-text-main"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <label>
                Sort by
                <select value={sort} onChange={event=>{setSort(event.target.value);setSortAsc(false);}}>
                  <option value="vendor">Vendor Name</option>
                  <option value="sales">Sales (040.0)</option>
                  {STAGES.map(id=><option key={id} value={id}>{METRIC_BY_ID[id].label}</option>)}
                  <option value="gap">Invoice-to-collection gap</option>
                </select>
              </label>
            </div>

            <p className="cx-ops-table-count">{filtered.length} matching vendors · {rows.length} total returned</p>

            <div className="cx-ops-table-scroll">
              <VisualTable initialView="table" visual={{id:'commercial.reconciliation',data:filtered,context:{currency}}} className="enterprise-table" aria-label="Commercial reconciliation by vendor">
                <thead>
                  <tr>
                    <th scope="col" onClick={()=>toggleSort('vendor')} className="cursor-pointer select-none">
                      <div className="inline-flex items-center gap-1">
                        <span>Vendor</span>
                        {sort === 'vendor' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
                      </div>
                    </th>
                    <th scope="col" onClick={()=>toggleSort('sales')} className="cursor-pointer select-none">
                      <div className="inline-flex items-center gap-1">
                        <span>Sales (040.0)</span>
                        {sort === 'sales' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
                      </div>
                    </th>
                    {STAGES.map(id=>(
                      <th key={id} scope="col" onClick={()=>toggleSort(id)} className="cursor-pointer select-none">
                        <div className="inline-flex items-center gap-1">
                          <span>{METRIC_BY_ID[id].label}</span>
                          {sort === id ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
                        </div>
                      </th>
                    ))}
                    <th scope="col" onClick={()=>toggleSort('gap')} className="cursor-pointer select-none">
                      <div className="inline-flex items-center gap-1">
                        <span>Invoice-to-collection gap</span>
                        {sort === 'gap' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row=>{
                    const invoiced=available(row.metrics.invoiced_value),collected=available(row.metrics.collected_value);
                    return <tr key={row.key} data-selected={selected?.key===row.key}>
                      <th scope="row">
                        <button className="cx-link-button" type="button" onClick={()=>setSelectedVendor(row.key)}>
                          {row.group}
                        </button>
                      </th>
                      <td>{format(row.metrics.sale_events)}</td>
                      {STAGES.map(id=>(
                        <td key={id}>
                          {row.metrics[id]?.calculationStatus==='CHECKED' ? (
                            <button type="button" className="cx-ops-value-button" onClick={()=>setInspection({metricId:id,group:row.rawGroup,groupIsNull:row.rawGroup===null,label:METRIC_BY_ID[id].label})}>
                              {format(row.metrics[id])}
                            </button>
                          ) : 'Unavailable'}
                        </td>
                      ))}
                      <td>{invoiced===null||collected===null?'Unavailable':`${currency} ${exactNumber(subtractExactDecimals(invoiced,collected),2)}`}</td>
                    </tr>;
                  })}
                </tbody>
              </VisualTable>
            </div>
            {!filtered.length&&<p role="status" className="cx-ops-empty">No vendors matched the local search. No warehouse request was rerun.</p>}
          </>
        ) : (
          <div className="p-4 h-72 min-h-[288px] w-full">
            {!filtered.length ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 p-4">
                <span className="font-medium text-slate-600 mb-1">No vendors matched the search query.</span>
                <span className="text-[11px] text-slate-400">Try adjusting your filter or vendor name search.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
                <BarChart data={filtered.slice(0, 15).map(row => ({
                  vendor: row.group,
                  sales: chartCoordinate(available(row.metrics.sale_events)),
                  invoiced: chartCoordinate(available(row.metrics.invoiced_value)),
                  collected: chartCoordinate(available(row.metrics.collected_value)),
                }))} margin={{ top: 10, right: 30, left: 10, bottom: 35 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="vendor" tick={{ fontSize: 9, fill: '#64748b' }} stroke="#cbd5e1" interval={0} angle={-25} textAnchor="end" height={45} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" axisLine={false} tickLine={false} tickFormatter={v => `${currency} ${Number(v).toLocaleString()}`} />
                  <Tooltip
                    filterNull={false}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-3 text-xs min-w-[200px] ring-1 ring-black/5 dark:ring-white/5 font-mono">
                          <div className="font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1 mb-2 font-mono">
                            Vendor: {label}
                          </div>
                          <div className="space-y-1.5">
                            {payload.map((entry: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-sans">
                                  <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: entry.fill }} />
                                  <span>{entry.name}</span>
                                </span>
                                <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                                  {currency} {entry.value == null ? 'Unavailable' : Number(entry.value).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="invoiced" name="Invoiced Value" fill="var(--cx-action, #315BCB)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="collected" name="Collected Value" fill="var(--cx-favourable, #17744A)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </section>

      <section className="enterprise-card cx-commercial-evidence-note">
        <h2>What this reconciliation does—and does not—prove</h2>
        <div>
          <p><strong>Supported:</strong> signed expected, approved, invoiced and collected ledger events, linked to a recorded sale and grouped by vendor.</p>
          <p><strong>Not supported:</strong> authoritative profit, cost allocation, invoice-document matching or bank settlement matching. Those remain unavailable until approved contracts and identities exist.</p>
        </div>
      </section>
      <EvidenceInspector report={report} selection={inspection} onClose={()=>setInspection(null)}/>
    </>}
  </div>;
}
