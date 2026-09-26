import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Columns3, Download, Filter, Info, Search, X, FileSpreadsheet, Check, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Link, useLocation } from 'react-router-dom';
import { PAGE_TITLES } from '../../contracts/naming';
import { compareExactDecimal } from '../../contracts/exactDecimal';
import { METRIC_BY_ID, type MetricResult, type ReportResult } from '../../contracts/reporting';
import { formatReportValue } from '../lib/reportPreflight';
import { exactMovement, metricValue, pivotReportGroups } from '../lib/evidenceWorkspace';
import { createEvidenceReport } from '../lib/reportingClient';
import { useEvidenceWorkspace } from '../lib/useEvidenceWorkspace';
import { useFilters } from '../lib/FilterContext';
import EvidenceScopeBar from '../components/operations/EvidenceScopeBar';
import WorkspaceState from '../components/operations/WorkspaceState';
import MetricRail from '../components/operations/MetricRail';
import ExactBarChart from '../components/operations/ExactBarChart';
import EvidenceInspector, { type EvidenceSelection } from '../components/operations/EvidenceInspector';
import { VisualTable } from '../components/visuals/DataVisual';

const METRICS = ['delivered_episodes','called_episodes','call_attempts','call_coverage','sale_events','activation_events','sale_activation_rate','expected_value','approved_value','invoiced_value','collected_value'];
const LEAD_METRICS = ['fetched_leads'];
const CHART_METRICS = ['delivered_episodes','called_episodes','call_attempts','call_coverage','sale_events','activation_events','sale_activation_rate','collected_value'];
const TABLE_COLUMNS = ['delivered_episodes','called_episodes','call_attempts','call_coverage','sale_events','activation_events','sale_activation_rate','expected_value','approved_value','invoiced_value','collected_value'];

function availableValue(metric: MetricResult | null | undefined): string | null { return metric?.calculationStatus === 'CHECKED' ? metric.value : null; }
function exportRows(rows: unknown[], filename: string) { const href=URL.createObjectURL(new Blob([JSON.stringify(rows,null,2)],{type:'application/json'}));const anchor=document.createElement('a');anchor.href=href;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(href),1000); }
function exportCsv(headers: string[], rows: (string | null | undefined)[][], filename: string) {
  const quote = (val: string | null | undefined) => {
    if (val === null || val === undefined) return '""';
    const s = String(val);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const content = '\uFEFF' + [headers.map(quote).join(','), ...rows.map(r => r.map(quote).join(','))].join('\r\n');
  const href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export default function VendorPerformance() {
  const workspace = useEvidenceWorkspace({ metrics: METRICS, grouping: 'vendor', comparisons: true });
  const leadTotals = useEvidenceWorkspace({ metrics: LEAD_METRICS, grouping: 'none', comparisons: true });
  const filterScope = useFilters();
  const report = workspace.current.data;
  const previous = workspace.previous.data;
  const matched = workspace.matched.data;
  const currency = workspace.request.currency;
  const location = useLocation();
  const [chartMetric,setChartMetric]=useState('delivered_episodes'), [search,setSearch]=useState(''), [sortMetric,setSortMetric]=useState('delivered_episodes');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const vendorParam = params.get('vendor') || filterScope.vendor;
    if (vendorParam && !['all', 'all vendors'].includes(vendorParam.toLowerCase())) {
      setSearch(vendorParam);
    } else if (!vendorParam) {
      setSearch('');
    }
  }, [location.search, filterScope.vendor]);
  const [direction,setDirection]=useState<'asc'|'desc'>('desc'), [page,setPage]=useState(0), [pageSize,setPageSize]=useState(10), [selectedVendor,setSelectedVendor]=useState<string|null>(null);
  const [vendorTableView, setVendorTableView] = useState<'table' | 'graph'>('table');
  const [visible,setVisible]=useState(()=>new Set(TABLE_COLUMNS));
  const [inspection,setInspection]=useState<EvidenceSelection|null>(null);
  const deferredSearch=useDeferredValue(search.trim().toLowerCase());
  const rows=useMemo(()=>pivotReportGroups(report),[report]);
  const previousRows=useMemo(()=>pivotReportGroups(previous),[previous]);
  const matching=useMemo(()=>rows.filter(row=>!deferredSearch||row.group.toLowerCase().includes(deferredSearch)).sort((a,b)=>{
    if (sortMetric === 'vendor') {
      const cmp = a.group.localeCompare(b.group);
      return direction === 'asc' ? cmp : -cmp;
    }
    const av=availableValue(a.metrics[sortMetric]), bv=availableValue(b.metrics[sortMetric]);
    const compared=av===null&&bv===null?0:av===null?1:bv===null?-1:compareExactDecimal(av,bv);
    return direction==='asc'?compared:-compared;
  }),[rows,deferredSearch,sortMetric,direction]);
  useEffect(()=>{setPage(0);},[deferredSearch,sortMetric,direction,pageSize]);
  useEffect(()=>{if(!selectedVendor&&rows[0])setSelectedVendor(rows[0].key);if(selectedVendor&&!rows.some(row=>row.key===selectedVendor))setSelectedVendor(rows[0]?.key??null);},[rows,selectedVendor]);
  const selectedCurrent=rows.find(row=>row.key===selectedVendor), selectedPrevious=previousRows.find(row=>row.key===selectedVendor);
  const sourceVendor=selectedCurrent?.rawGroup;
  const sourceRequest=useMemo(()=>sourceVendor!==undefined&&sourceVendor!==null?{...workspace.request,grouping:'source' as const,filters:{...workspace.request.filters,vendor:[sourceVendor]}}:null,[workspace.request,sourceVendor]);
  const sourceReport=useQuery<ReportResult>({queryKey:['vendor-source-breakdown',workspace.release?.releaseId,sourceRequest],queryFn:({signal})=>createEvidenceReport(sourceRequest!,workspace.release!.releaseId,signal),enabled:!!sourceRequest&&!!workspace.release&&!workspace.scopeError,retry:false,staleTime:Infinity});
  const format=(metric:MetricResult|null|undefined)=>metric?formatReportValue(metric,currency):'Unavailable';
  const total=(id:string)=>metricValue(report,id), previousTotal=(id:string)=>metricValue(previous,id);
  const kpi=(id:string,note:string)=>{const currentMetric=id==='fetched_leads'?metricValue(leadTotals.current.data,id):total(id),previousMetric=id==='fetched_leads'?metricValue(leadTotals.previous.data,id):previousTotal(id);return {id,label:METRIC_BY_ID[id].label,value:format(currentMetric),change:exactMovement(availableValue(currentMetric),availableValue(previousMetric)),comparison:`vs ${workspace.previousPeriod.startDate} — ${workspace.previousPeriod.endDate}`,note,status:currentMetric?.calculationStatus};};
  const chartRows=matching.slice(0,12).map(row=>({id:row.key,label:row.group,value:availableValue(row.metrics[chartMetric]),formatted:format(row.metrics[chartMetric]),secondary:availableValue(previousRows.find(item=>item.key===row.key)?.metrics[chartMetric]),secondaryFormatted:`Previous: ${format(previousRows.find(item=>item.key===row.key)?.metrics[chartMetric])}`}));
  const driverIds=[['delivered_episodes','Volume'],['call_coverage','Calling coverage'],['sale_events','Sales events'],['activation_events','Activation events'],['collected_value','Collected amount']] as const;
  const pageRows=matching.slice(page*pageSize,page*pageSize+pageSize), pageCount=Math.max(1,Math.ceil(matching.length/pageSize));
  const toggle=(id:string)=>setVisible(old=>{const next=new Set(old);next.has(id)?next.delete(id):next.add(id);return next;});
  const selectAll=()=>setVisible(new Set(TABLE_COLUMNS));
  const resetDefault=()=>setVisible(new Set(TABLE_COLUMNS));
  const handleSort=(metricKey:string)=>{
    if (sortMetric===metricKey) {
      setDirection(d=>d==='desc'?'asc':'desc');
    } else {
      setSortMetric(metricKey);
      setDirection(metricKey==='vendor'?'asc':'desc');
    }
  };
  const loading=workspace.catalogue.isLoading||workspace.current.isLoading||leadTotals.current.isLoading;
  const error=workspace.catalogue.error||workspace.current.error||leadTotals.current.error;
  const missingReleaseReason=workspace.catalogue.data&&!workspace.catalogue.data.available?workspace.catalogue.data.reason:null;

  return <div className="cx-page cx-ops-page">
    <header className="cx-page-header"><div><p className="cx-ops-eyebrow">Management workspace</p><h1 className="text-page-title">{PAGE_TITLES['/vendors']}</h1><p>Compare vendor supply, delivery, observed calling, recorded outcomes and commercial stages from one approved evidence release.</p></div><a className="cx-button-secondary" href="#vendor-table">Review vendor evidence <ArrowRight size={15}/></a></header>
    <EvidenceScopeBar releaseId={workspace.release?.releaseId} cutoff={workspace.release?.cutoff} busy={workspace.current.isFetching}/>
    <WorkspaceState loading={loading} error={error} missingRelease={missingReleaseReason} scopeError={workspace.scopeError} retry={()=>{void workspace.catalogue.refetch();void workspace.current.refetch();}}/>

    {missingReleaseReason && (
      <section className="enterprise-card p-6 border-slate-200 bg-slate-50/70 space-y-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[#3562B3] shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h2 className="font-semibold text-text-main text-base">Live Vendor Telemetry & BigQuery Data Checks</h2>
            <p className="text-sm text-text-sec">
              While the immutable versioned release contract (<code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">CX_REPORTING_DATASET</code>) is unconfigured or awaiting release publication, you can explore live vendor transaction metrics directly in the operational tabs.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-2">
              <Link to="/data-trust?tab=multivendor" className="cx-button-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5">
                View Live Multi-Vendor Telemetry <ArrowRight size={13} />
              </Link>
              <Link to="/overview" className="cx-button-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5">
                Executive Overview <ArrowRight size={13} />
              </Link>
              <Link to="/call-performance" className="cx-button-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5">
                Call Performance & Vendors <ArrowRight size={13} />
              </Link>
              <Link to="/vetting" className="cx-button-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5">
                Vendor Vetting Scorecards <ArrowRight size={13} />
              </Link>
              <Link to="/routing" className="cx-button-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5">
                Routing Intelligence <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    )}

    {report&&<>
      <MetricRail items={[kpi('fetched_leads','Distinct captured leads in the selected scope; vendor rows are not summed because populations can overlap.'),kpi('delivered_episodes','Observed successful vendor delivery episodes.'),kpi('call_coverage','Delivered episodes with a subsequent observed call.'),kpi('sale_activation_rate','Distinct sales with at least one observed activation.'),kpi('collected_value','Signed collected-stage ledger changes; not expected or invoiced value.')]}/>
      <section className="cx-ops-analysis-grid"><div className="cx-ops-primary">
        <div className="cx-ops-viewbar" aria-label="Vendor chart controls"><div><strong>Vendor comparison</strong><span>Local controls — no new warehouse query</span></div><label>Measure<select value={chartMetric} onChange={event=>setChartMetric(event.target.value)}>{CHART_METRICS.map(id=><option key={id} value={id}>{METRIC_BY_ID[id].label}</option>)}</select></label></div>
        <ExactBarChart data={chartRows} title={`${METRIC_BY_ID[chartMetric].label} by vendor`} description="Exact values are retained in labels and the evidence table. Bar lengths use display-only coordinates." onSelect={setSelectedVendor} selectedId={selectedCurrent?.group}/>
      </div><aside className="enterprise-card cx-ops-periods"><header><h2>Period comparison</h2><p>Current, previous comparable period and previous matched calendar days.</p></header>{[['Current',report],['Previous',previous],['Matched days',matched]].map(([label,data])=><div key={label as string}><span>{label as string}</span><strong>{format(metricValue(data as ReportResult|undefined,chartMetric))}</strong><small>{label==='Current'?`${workspace.request.startDate} — ${workspace.request.endDate}`:label==='Previous'?`${workspace.previousPeriod.startDate} — ${workspace.previousPeriod.endDate}`:`${workspace.matchedPeriod.startDate} — ${workspace.matchedPeriod.endDate}`}</small></div>)}</aside></section>
      <section className="enterprise-card cx-ops-driver" aria-label="Descriptive driver decomposition">
        <header>
          <div>
            <p className="cx-ops-eyebrow">Where movement appears</p>
            <h2>{selectedCurrent?.group??'Select a vendor'} · descriptive change signals</h2>
            <p>Signals compare independent measures with the previous period. They are not additive contributions and do not claim causation.</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedCurrent?.rawGroup && (
              filterScope.vendor === selectedCurrent.rawGroup ? (
                <button
                  type="button"
                  className="cx-button-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1"
                  onClick={() => filterScope.setVendor('')}
                  title="Clear vendor filter to show all vendors in workspace"
                >
                  <X size={12} /> Clear vendor scope filter
                </button>
              ) : (
                <button
                  type="button"
                  className="cx-button-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1"
                  onClick={() => filterScope.setVendor(selectedCurrent.rawGroup!)}
                  title={`Filter workspace strictly to ${selectedCurrent.group}`}
                >
                  <Filter size={12} /> Filter scope to {selectedCurrent.group}
                </button>
              )
            )}
            <span className="cx-status">Previous comparable period</span>
          </div>
        </header>
        <div>
          {driverIds.map(([id,label])=>{
            const current=availableValue(selectedCurrent?.metrics[id]),prior=availableValue(selectedPrevious?.metrics[id]);
            const movement=exactMovement(current,prior);
            const isNeg = movement?.startsWith('-');
            const isZero = movement === '0.0' || movement === '0';
            const movementDisplay = movement === null ? 'No comparable value' : isNeg ? `${movement}% vs previous` : isZero ? '0.0% vs previous' : `+${movement}% vs previous`;
            const movementClass = movement === null ? 'text-slate-400' : isNeg ? 'text-rose-600 font-medium' : isZero ? 'text-slate-500' : 'text-emerald-700 font-medium';
            return <article key={id}>
              <span>{label}</span>
              <strong>{format(selectedCurrent?.metrics[id])}</strong>
              <small className={movementClass}>{movementDisplay}</small>
            </article>;
          })}
          <article data-status="unavailable">
            <span>Contact (RPC)</span>
            <strong>Unavailable</strong>
            <small>RPC is not inferred from a sale; no approved RPC fact exists in this release.</small>
          </article>
        </div>
      </section>
      <section className="cx-ops-secondary-grid"><div className="enterprise-card cx-ops-breakdown"><header><div><h2>Source mix · {selectedCurrent?.group}</h2><p>Delivery episodes grouped by source for the selected vendor.</p></div></header>{!sourceRequest?<p role="status">Source mix is unavailable until a vendor with a recorded identity is selected.</p>:sourceReport.isLoading?<p role="status">Calculating source mix…</p>:sourceReport.error?<p role="alert">Source mix unavailable — this section could not be calculated.</p>:<ExactBarChart data={pivotReportGroups(sourceReport.data).slice(0,8).map(row=>({id:row.key,label:row.group,value:availableValue(row.metrics.delivered_episodes),formatted:format(row.metrics.delivered_episodes)}))} title={`Delivery source mix · ${selectedCurrent?.group}`} description="Source groups use the same selected-period release and vendor population." empty={`No delivery sources recorded for ${selectedCurrent?.group ?? 'selected vendor'}.`}/>}</div>
        <div className="enterprise-card cx-ops-coverage">
          <h2>Class and colour coverage</h2>
          <p className="cx-ops-unavailable"><Info size={18}/>Unavailable in the approved release contract. Class and colour fields are not attached to the versioned lead fact, so no vendor split is inferred from legacy rows.</p>
          <dl>
            <div><dt>Source status</dt><dd>Not mapped to versioned fact</dd></div>
            <div><dt>Missing-data policy</dt><dd>Unavailable, not zero</dd></div>
            <div><dt>Next evidence step</dt><dd>Approve lead classification fields and release reconciliation.</dd></div>
          </dl>
          <div className="pt-2">
            <Link to="/vetting" className="cx-link-button text-xs inline-flex items-center gap-1 text-[#315EAD] font-medium hover:underline">
              Explore legacy Class & Colour Vetting <ArrowRight size={12}/>
            </Link>
          </div>
        </div>
      </section>
      <section id="vendor-table" className="enterprise-card cx-ops-table-card"><header><div><p className="cx-ops-eyebrow">Vendor evidence</p><h2>Performance table</h2><p>Exact snapshot-bound values. Select a vendor or inspect the supporting records for any measured value.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setVendorTableView('table')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                vendorTableView === 'table'
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon size={12} /> Table
            </button>
            <button
              type="button"
              onClick={() => setVendorTableView('graph')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded ${
                vendorTableView === 'graph'
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 size={12} /> Graph
            </button>
          </div>
          <button type="button" className="cx-button-secondary" onClick={()=>exportRows(matching.map(row=>({vendor:row.rawGroup,...Object.fromEntries(Object.entries(row.metrics).map(([id,metric])=>[id,metric.value]))})),`cx-vendors-${workspace.request.startDate}-${workspace.request.endDate}.json`)}><Download size={15}/>Export {matching.length} matching rows</button>
          <button type="button" className="cx-button-secondary" onClick={()=>exportCsv(['Vendor', ...TABLE_COLUMNS.filter(id=>visible.has(id)).map(id=>METRIC_BY_ID[id].label)], matching.map(row=>[row.group, ...TABLE_COLUMNS.filter(id=>visible.has(id)).map(id=>row.metrics[id]?.value ?? '')]), `cx-vendors-${workspace.request.startDate}-${workspace.request.endDate}.csv`)}><FileSpreadsheet size={15}/>CSV</button>
        </div>
      </header>
        {vendorTableView === 'table' ? (
          <>
            <div className="cx-ops-table-tools">
              <label className="relative inline-flex items-center">
                <Search size={15}/>
                <span className="sr-only">Search vendors</span>
                <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search vendors" className="pr-6"/>
                {search && <button type="button" onClick={()=>setSearch('')} className="absolute right-2 text-text-mute hover:text-text-main p-0.5"><X size={13}/></button>}
              </label>
              <label>Sort by<select value={sortMetric} onChange={event=>setSortMetric(event.target.value)}><option value="vendor">Vendor name</option>{TABLE_COLUMNS.map(id=><option key={id} value={id}>{METRIC_BY_ID[id].label}</option>)}</select></label>
              <button type="button" className="cx-button-secondary" onClick={()=>setDirection(old=>old==='desc'?'asc':'desc')}>{direction==='desc'?'Highest first':'Lowest first'}</button>
              <label>Page size<select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}><option value={10}>10 per page</option><option value={25}>25 per page</option><option value={50}>50 per page</option><option value={100}>100 per page</option></select></label>
              <details><summary><Columns3 size={15}/>Columns</summary>
                <div>
                  <div className="flex gap-2 pb-2 mb-2 border-b border-border-dim text-xs">
                    <button type="button" className="underline" onClick={selectAll}>Select all</button>
                    <button type="button" className="underline" onClick={resetDefault}>Reset default</button>
                  </div>
                  {TABLE_COLUMNS.map(id=><label key={id}><input type="checkbox" checked={visible.has(id)} onChange={()=>toggle(id)}/>{METRIC_BY_ID[id].label}</label>)}
                </div>
              </details>
            </div>
            <p className="cx-ops-table-count">Showing {matching.length?page*pageSize+1:0}–{Math.min((page+1)*pageSize,matching.length)} of {matching.length} matching vendors · {rows.length} total returned</p>
            <div className="cx-ops-table-scroll"><VisualTable initialView="table" visual={{id:'vendor.performance',data:pageRows,context:{currency}}} className="enterprise-table" aria-label="Vendor performance evidence">
              <thead>
                <tr>
                  <th scope="col" aria-sort={sortMetric==='vendor'?(direction==='asc'?'ascending':'descending'):'none'}>
                    <button type="button" className="inline-flex items-center gap-1 font-semibold text-inherit hover:underline" onClick={()=>handleSort('vendor')}>
                      Vendor {sortMetric==='vendor'?(direction==='desc'?<ArrowDown size={13} className="text-[#315EAD]"/>:<ArrowUp size={13} className="text-[#315EAD]"/>):<ArrowUpDown size={12} className="opacity-40"/>}
                    </button>
                  </th>
                  {TABLE_COLUMNS.filter(id=>visible.has(id)).map(id=>(
                    <th key={id} scope="col" aria-sort={sortMetric===id?(direction==='asc'?'ascending':'descending'):'none'}>
                      <button type="button" className="inline-flex items-center gap-1 font-semibold text-inherit hover:underline" onClick={()=>handleSort(id)}>
                        {METRIC_BY_ID[id].label} {sortMetric===id?(direction==='desc'?<ArrowDown size={13} className="text-[#315EAD]"/>:<ArrowUp size={13} className="text-[#315EAD]"/>):<ArrowUpDown size={12} className="opacity-40"/>}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{pageRows.map(row=><tr key={row.key} data-selected={selectedVendor===row.key}><th scope="row"><button type="button" className="cx-link-button" onClick={()=>setSelectedVendor(row.key)}>{row.group}</button></th>{TABLE_COLUMNS.filter(id=>visible.has(id)).map(id=><td key={id}>{row.metrics[id]?.calculationStatus==='CHECKED'?<button type="button" className="cx-ops-value-button" onClick={()=>setInspection({metricId:id,group:row.rawGroup,groupIsNull:row.rawGroup===null,label:METRIC_BY_ID[id].label})}>{format(row.metrics[id])}</button>:<span title={row.metrics[id]?.reason??'Required evidence unavailable'}>Unavailable</span>}</td>)}</tr>)}</tbody>
            </VisualTable></div>
            {!matching.length&&<p className="cx-ops-empty" role="status">No vendor groups matched the local search. The reporting result was not changed.</p>}
            <footer><span>Page {Math.min(page+1,pageCount)} of {pageCount}</span><div><button type="button" className="cx-button-secondary" disabled={page===0} onClick={()=>setPage(old=>old-1)}>Previous</button><button type="button" className="cx-button-secondary" disabled={page+1>=pageCount} onClick={()=>setPage(old=>old+1)}>Next</button></div></footer>
          </>
        ) : (
          <div className="p-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={matching.slice(0, 12).map(r => ({
                vendor: r.group,
                delivered: Number(availableValue(r.metrics.delivered_episodes)) || 0,
                called: Number(availableValue(r.metrics.called_episodes)) || 0,
                sales: Number(availableValue(r.metrics.sale_events)) || 0,
                activations: Number(availableValue(r.metrics.activation_events)) || 0,
              }))} margin={{ top: 10, right: 30, left: 10, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="vendor" tick={{ fontSize: 9 }} stroke="#94a3b8" interval={0} angle={-25} textAnchor="end" height={45} />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(val: any, name: any) => [Number(val).toLocaleString(), name]}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="delivered" name="Delivered" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="called" name="Called" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                <Bar dataKey="sales" name="Sales" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="activations" name="Activations" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      <EvidenceInspector report={report} selection={inspection} onClose={()=>setInspection(null)}/>
    </>}
  </div>;
}
