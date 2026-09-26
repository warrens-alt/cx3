import { LEGACY_LABELS } from '../../../contracts/naming';
import React, { Suspense, useDeferredValue, useId, useMemo, useState } from 'react';
import { Download, Search, SlidersHorizontal, Info, X, FileText } from 'lucide-react';
import { VisualTable } from '../visuals/DataVisual';
import { METRICS, DIMENSIONS, TEMPORAL, type ExploreView, type ExploreResult, type ExploreRow, type Sort, selectRows, sumExact, formatValue, safeChart, canDonut, seriesNames, seriesLabel, saveFile, exportCsv } from '../../lib/explore/model';
import { exactLabel } from '../../lib/visuals/model';
const ExploreChart=React.lazy(()=>import('./ExploreChart'));
const Modal=React.lazy(()=>import('../Modal'));
const FIELD_NAMES:Record<string,string>={leads:LEGACY_LABELS.leads,delivered:LEGACY_LABELS.delivered,called:LEGACY_LABELS.called,rpcs:LEGACY_LABELS.rpcs,sales:LEGACY_LABELS.sales,billableSales:LEGACY_LABELS.billable_sales,activations:LEGACY_LABELS.activations,revenue:LEGACY_LABELS.revenue,deliveryRate:LEGACY_LABELS.delivery_rate,callRate:LEGACY_LABELS.dial_rate,rpcRate:LEGACY_LABELS.rpc_rate,saleRate:LEGACY_LABELS.sale_rate,leadToSaleRate:LEGACY_LABELS.lead_to_sale_rate,billableSaleRate:LEGACY_LABELS.billable_sale_rate,activationRate:LEGACY_LABELS.activation_rate,revPerLead:LEGACY_LABELS.revenue_per_lead};
interface Props { result:ExploreResult; view:ExploreView; onView:(change:Partial<ExploreView>)=>void; scope:Record<string,unknown>; }
export default function ExploreResults({result,view,onView,scope}:Props){
  const sampleHelpId=useId();
  const [search,setSearch]=useState(''),deferredSearch=useDeferredValue(search),[sort,setSort]=useState<Sort>(TEMPORAL.has(view.dimension)?'label':'value_desc');
  const [minSample,setMinSample]=useState('0'),[page,setPage]=useState(0),[pageSize,setPageSize]=useState(25),[limit,setLimit]=useState(25);
  const [selection,setSelection]=useState<string[]|null>(null),[inspected,setInspected]=useState<ExploreRow|null>(null);
  const metric=METRICS.find(m=>m.id===view.metric)!,currency=typeof result.metadata.currency==='string'?result.metadata.currency:'ZAR';
  const effective={...view,chart:safeChart(view,result.rows)};
  const matching=useMemo(()=>selectRows(result.rows,deferredSearch,sort,minSample),[result.rows,deferredSearch,sort,minSample]);
  const total=useMemo(()=>metric.additive?sumExact(result.rows.map(r=>r.value)):null,[result.rows,metric]);
  const samples=useMemo(()=>sumExact(result.rows.map(r=>r.sampleSize)),[result.rows]);
  const names=useMemo(()=>seriesNames(matching),[matching]);
  const activeNames=selection===null?names.slice(0,6):selection.filter(n=>names.includes(n));
  const pageIndex=Math.min(page,Math.max(0,Math.ceil(matching.length/pageSize)-1)),displayed=matching.slice(pageIndex*pageSize,(pageIndex+1)*pageSize);
  const measured=result.rows.filter(r=>r.value!==null).length;
  const context={...scope,metric:view.metric,dimension:view.dimension,secondaryDimension:view.secondary||null,metricDefinition:metric,
    metadata:result.metadata,receivedAt:result.receivedAt,scopeNote:'Loaded API groups only; not a pinned or independently reconciled report.'};
  const dataset=useMemo(()=>({id:'explore.result',title:metric.label,rows:result.rows.map(r=>({...r,displayLabel:r.label})),dimensions:[{key:'displayLabel',label:'Returned Group'}],measures:[{key:'value',label:metric.label,unit:metric.unit},{key:'sampleSize',label:'Reported Sample Size',unit:'lead records'}],defaultDimension:'displayLabel',defaultMeasure:'value',note:'Same loaded API groups. Visual selection is local and does not change the complete response export.'}),[result.rows,metric]);
  const exportRows=(all:boolean)=>saveFile(exportCsv(all?result.rows:matching,view,{...context,exportSelection:all?'All loaded groups':'Matching loaded groups',search:all?null:deferredSearch,minSample:all?null:minSample,rowCount:all?result.rows.length:matching.length}),`explore-${view.metric}-${all?'loaded':'matching'}.csv`,'text/csv;charset=utf-8');
  return <div className="cx-explore-results">
    <div className="cx-explore-metrics">
      <article><span>Returned group total</span><strong>{!metric.additive?'Not additive':formatValue(total,view.metric,currency)}</strong><small>{!metric.additive?'Ratios are not summed or averaged into an overall rate.':result.metadata.truncated?'Partial response — not a warehouse grand total.':total===null?'No complete sum is available for these values.':'Sum of received values, before local table filters.'}</small></article>
      <article><span>Measured groups</span><strong>{measured.toLocaleString('en-GB')} <em>/ {result.rows.length.toLocaleString('en-GB')}</em></strong><small>{result.rows.length-measured} groups have unavailable values.</small></article>
      <article><span>Reported samples</span><strong>{exactLabel(samples)}</strong><small>Sum of group sample counts; not a count of distinct people.</small></article>
    </div>
    {result.metadata.truncated===true&&<div className="cx-explore-warning" role="status">This API response is truncated to {result.rows.length} groups. Charts, totals and exports cover these returned groups only. Narrow the reporting filters for a smaller population.</div>}
    {result.rows.some(r=>r.value!==null&&(String(r.value).replace(/[-+.]/g,'').length>14||!Number.isFinite(Number(r.value))))&&<div className="cx-explore-warning" role="status">Chart geometry is approximate for large or highly precise values. Similar-looking marks need not be equal; use the exact table values and exports.</div>}
    {result.rows.some(r=>r.precisionWarning)&&<div className="cx-explore-warning" role="status">Some values arrived as approximate numbers or invalid numeric values. Formatting cannot restore upstream precision; inspect the evidence before financial use.</div>}
    <section className="enterprise-card cx-explore-workspace" aria-label="Explore results workspace">
      <div className="cx-explore-results-title">
        <div>
          <span className="cx-explore-kicker">RESULT WORKSPACE</span>
          <h2>{DIMENSIONS.find(d=>d.id===view.dimension)?.label}{view.secondary?' × '+DIMENSIONS.find(d=>d.id===view.secondary)?.label:''}</h2>
        </div>
        <div className="cx-explore-exports">
          <button type="button" className="cx-button-secondary" onClick={()=>exportRows(false)}>
            <FileText size={14}/>Export matching ({matching.length})
          </button>
          <button type="button" className="cx-button-secondary" onClick={()=>exportRows(true)}>
            <Download size={14}/>Export all loaded ({result.rows.length})
          </button>
          <button type="button" className="cx-button-secondary" onClick={()=>saveFile(JSON.stringify({...context,data:result.rows},null,2),'explore-response.json','application/json')}>
            Response JSON
          </button>
        </div>
      </div>
      <div className="cx-explore-local">
        <label className="cx-explore-search col-span-full">
          Find groups
          <div className="relative">
            <Search size={15}/>
            <input 
              aria-label="Find Explore groups" 
              type="search" 
              value={search} 
              onChange={e=>{setSearch(e.target.value);setPage(0);}} 
              placeholder="Search returned labels…"
              className={search ? 'pr-7' : ''}
            />
            {search && (
              <button 
                type="button" 
                onClick={()=>{setSearch('');setPage(0);}} 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-mute hover:text-text-main"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </label>
      </div>
      <details className="cx-explore-adjust cx-explore-records" aria-label="Adjust Explore visual">
        <summary>Adjust visual{Number(minSample)>0&&<span> · minimum reported sample {minSample} applied</span>}</summary>
        <p className="my-3 text-sm text-text-sec">These controls change the displayed groups only. They do not change the reporting scope or rerun the query.</p>
        <div className="cx-explore-local">
        <label>Sort groups<select aria-label="Sort Explore groups" value={sort} onChange={e=>{setSort(e.target.value as Sort);setPage(0);}}><option value="value_desc">Highest value first</option><option value="value_asc">Lowest value first</option><option value="label">Label / period order</option><option value="sample_desc">Largest sample first</option></select></label>
        <label>Minimum reported sample<input aria-label="Minimum reported sample" aria-describedby={sampleHelpId} type="number" min="0" max="999999999999" step="1" value={minSample} onChange={e=>{if(e.target.value===''||/^\d{1,12}$/.test(e.target.value)){setMinSample(e.target.value);setPage(0);}}}/></label>
        <label>Chart points<select aria-label="Explore chart point limit" value={limit} onChange={e=>setLimit(Number(e.target.value))}>{[10,25,50,100,250].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      </div>
      <p id={sampleHelpId} className="mb-3 text-sm text-text-sec">Minimum reported sample is a display filter, not a statistical confidence test. Groups below this threshold are hidden from the chart and matching table; the loaded response and loaded export remain unchanged.</p>
      <div className="cx-explore-viewbar"><div role="group" aria-label="Explore visual type">{(['bar','column','line','area','donut','table'] as const).map(type=><button type="button" key={type} disabled={(['line','area'].includes(type)&&!TEMPORAL.has(view.dimension))||(type==='donut'&&!canDonut(view,result.rows))} aria-pressed={effective.chart===type} onClick={()=>onView({chart:type})}>{({bar:'Bars',column:'Columns',line:'Line',area:'Area',donut:'Doughnut',table:'Table'})[type]}</button>)}</div></div>
      {view.secondary&&['line','area'].includes(effective.chart)&&<fieldset className="cx-explore-series"><legend>Comparison series ({activeNames.length} of {names.length}; maximum six shown)</legend>{names.map(name=><label key={name}><input type="checkbox" checked={activeNames.includes(name)} disabled={!activeNames.includes(name)&&activeNames.length>=6} onChange={()=>setSelection(activeNames.includes(name)?activeNames.filter(n=>n!==name):[...activeNames,name])}/>{seriesLabel(name)}</label>)}<button type="button" onClick={()=>setSelection(null)}>Reset series</button></fieldset>}
      </details>
      <p className="px-4 py-2 text-xs text-text-sec" role="status" aria-live="polite">{matching.length} of {result.rows.length} returned groups match · local controls do not rerun queries{Number(minSample)>0?` · minimum reported sample ${minSample} is a display filter`:''}</p>
      <div aria-busy={search!==deferredSearch} className={search!==deferredSearch?'cx-explore-updating':''}>
        {matching.length===0?<div className="cx-explore-empty" role="status"><SlidersHorizontal size={24}/><h3>No matching groups</h3><p>The loaded report is unchanged. Adjust the search or sample threshold.</p><button type="button" className="cx-button-secondary" onClick={()=>{setSearch('');setMinSample('0');setPage(0);}}>Clear local filters</button></div>:effective.chart!=='table'?<Suspense fallback={<div className="cx-explore-empty" role="status">Loading chart…</div>}><ExploreChart rows={matching} view={effective} currency={currency} limit={limit} selectedSeries={activeNames} onInspect={setInspected} context={`${String(scope.startDate)} to ${String(scope.endDate)} · ${metric.unit} · received ${result.receivedAt} · legacy results, not independently reconciled`}/></Suspense>:null}
      </div>
      <details className="cx-explore-records" open={effective.chart==='table'||undefined}><summary>Inspect exact results ({matching.length} matching groups)</summary>
        <VisualTable initialView="table" aria-label="Explorer results" className="enterprise-table w-full" visual={{id:'explore.table',data:result.rows,datasets:[dataset]}}>
          <thead><tr><th scope="col">{DIMENSIONS.find(d=>d.id===view.dimension)?.label}</th>{view.secondary&&<th scope="col">{DIMENSIONS.find(d=>d.id===view.secondary)?.label}</th>}<th scope="col" className="text-right" aria-label={METRICS.find(m=>m.id===view.metric)?.label}>{metric.label}</th><th scope="col" className="text-right">Reported Sample Size</th><th scope="col">Details</th></tr></thead>
          <tbody>{displayed.map(r=><tr key={r.key}><th scope="row">{r.dim1??'Unspecified'}</th>{view.secondary&&<td>{r.dim2??'Unspecified'}</td>}<td className="text-right">{formatValue(r.value,view.metric,currency)}</td><td className="text-right">{exactLabel(r.sampleSize)}</td><td><button type="button" className="cx-explore-inspect" onClick={()=>setInspected(r)} aria-label={`Inspect ${r.label}`}><Info size={14}/>Inspect</button></td></tr>)}{!displayed.length&&<tr><td colSpan={view.secondary?5:4}>No matching result rows.</td></tr>}</tbody>
        </VisualTable>
        <div className="cx-explore-pagination"><label>Rows per page<select aria-label="Explore rows per page" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(0);}}>{[10,25,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select></label><span>{matching.length?pageIndex*pageSize+1:0}–{Math.min((pageIndex+1)*pageSize,matching.length)} of {matching.length}</span><button type="button" disabled={!pageIndex} onClick={()=>setPage(p=>p-1)}>Previous page</button><button type="button" disabled={(pageIndex+1)*pageSize>=matching.length} onClick={()=>setPage(p=>p+1)}>Next page</button><button type="button" onClick={()=>exportRows(false)}>Export matching CSV</button></div>
      </details>
    </section>
    <details className="enterprise-card cx-explore-evidence"><summary>Metric definition & response evidence</summary><p>{metric.definition}</p><p><strong>Calculation:</strong> {metric.formula}</p><p><strong>Request:</strong> {String(scope.startDate)} to {String(scope.endDate)} · {view.metric} by {view.dimension}{view.secondary?' / '+view.secondary:''}</p><p><strong>Query duration:</strong> {result.metadata.durationMs??'Unavailable'} ms · <strong>Received:</strong> {result.receivedAt}</p><p>Generated or received time is not a warehouse refresh watermark. Explore is a live-source legacy view, not an approved pinned Evidence Report.</p><pre>{JSON.stringify({filters:scope.filters,source:result.metadata.source,sourceDependencies:result.metadata.sourceDependencies,validationStatus:result.metadata.validationStatus??'NOT_VERIFIED',truncated:result.metadata.truncated??'Not supplied'},null,2)}</pre></details>
    {inspected&&<Suspense fallback={null}><Modal open onClose={()=>setInspected(null)} label="Explore group details"><div className="cx-explore-inspector"><button type="button" className="cx-button-secondary" onClick={()=>setInspected(null)}>Close group details</button><h2>{inspected.label}</h2><p>{metric.label}: <strong>{formatValue(inspected.value,view.metric,currency)}</strong></p><p>Reported Sample Size: {exactLabel(inspected.sampleSize)}</p><p>{metric.definition}</p><p>Additional fields below are the API’s legacy group measures, not newly calculated outcomes.</p><dl>{Object.entries<string|null>(inspected.fullFunnel).map(([k,v])=><div key={k}><dt>{FIELD_NAMES[k]||`Unmapped API field: ${k}`}</dt><dd>{exactLabel(v)}{v!==null&&k.endsWith('Rate')?'%':''}</dd></div>)}</dl><button type="button" className="cx-button-secondary" onClick={()=>saveFile(JSON.stringify({...context,data:inspected},null,2),'explore-group.json','application/json')}>Export this group JSON</button></div></Modal></Suspense>}
  </div>;
}
