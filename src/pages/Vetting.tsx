import React, { useDeferredValue, useMemo, useState } from 'react';
import { ShieldCheck, Layers3, Palette, ArrowUpRight, ArrowDownRight, Minus, Download, Filter, Clock3, X, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { PageShell } from '../components/PageShell';
import { DataState } from '../components/DataState';
import VettingChart from '../components/visuals/VettingChart';
import { VisualTable } from '../components/visuals/DataVisual';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { useFilters, defaultDateRange } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { exactLabel } from '../lib/visuals/model';
import { compareExactDecimal } from '../lib/breakdown';
import { VETTING_MEASURES, selectedGroups, decorateGroup, groupDataset, classMovement, summaryLine, downloadVetting, csvText } from '../lib/vetting';
import { COLOURS, MISSING_CLASS, MISSING_COLOUR, MULTIPLE_COLOURS, UNMAPPED_COLOUR, countRatio, periodChange, VETTING_METRICS, type VettingReport, type VettingGroup, type VettingMetric } from '../../contracts/vetting';
import '../styles/vetting.css';
const tabs=[['overview','Overview'],['classes','Class Leads'],['colours','Colour Leads'],['matrix','Class × Colour'],['sources','Sources & Vendors'],['coverage','Timing & Coverage']] as const;
const pct=(value:string|null)=>value===null?'Unavailable':`${exactLabel(value)}%`;

function Scorecard({title,rows,report}:{title:string;rows:VettingGroup[];report:VettingReport}){
  const [search,setSearch]=useState(''), deferredSearch=useDeferredValue(search),[page,setPage]=useState(0);
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');
  const matches=useMemo(()=>rows.filter(r=>`${r.key} ${r.series}`.toLowerCase().includes(deferredSearch.toLowerCase())).sort((a,b)=>compareExactDecimal(b.leads!,a.leads!)),[rows,deferredSearch]);
  const pageIndex=Math.min(page,Math.max(0,Math.ceil(matches.length/25)-1));
  const headers=['Category','Segment','Included Leads','Share of Included Leads (%)','HLC Delivery Evidence','HLC Dial Evidence','HLC RPC Flag','HLC Sale Evidence','HLC Activation Evidence','Sale / Included Leads (%)'];
  const cells=(r:VettingGroup)=>[r.key,r.series,r.leads,countRatio(r.leads,report.current.leads),r.delivered,r.called,r.rpc,r.sales,r.activations,countRatio(r.sales,r.leads)];
  return <details className="vetting-scorecard enterprise-card">
    <summary>{title} — full scorecard ({rows.length} groups)</summary>
    <div className="vetting-table-actions flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label>
          <span>Find group</span>
          <div className="relative">
            <input 
              aria-label={`${title} search`} 
              type="search" 
              value={search} 
              onChange={e=>{setSearch(e.target.value);setPage(0);}}
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
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
              viewMode === 'table'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('graph')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
              viewMode === 'graph'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Graph</span>
          </button>
        </div>
      </div>
      <button type="button" onClick={()=>downloadVetting(csvText([...headers,'Capture Start','Capture End','Query Job ID'],rows.map(r=>[...cells(r),report.scope?.startDate || '',report.scope?.endDate || '',report.evidence?.jobId || ''])),`vetting-${title.replace(/[^a-z0-9]/gi,'-')}.csv`)}>
        Export complete scorecard
      </button>
    </div>
    {viewMode === 'table' ? (
      <>
        <VisualTable aria-label={title} className="enterprise-table w-full" visual={{id:'vetting.scorecard',data:rows,datasets:[groupDataset(rows,report,title)]}}>
          <thead><tr>{headers.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{matches.slice(pageIndex*25,pageIndex*25+25).map(r=><tr key={JSON.stringify([r.key,r.series])}>{cells(r).map((c,i)=>i===0?<th scope="row" key={i}>{c}</th>:<td key={i}>{i<2?c:exactLabel(c)}</td>)}</tr>)}{!matches.length&&<tr><td colSpan={headers.length}>No matching groups.</td></tr>}</tbody>
        </VisualTable>
        <div className="vetting-pagination"><button type="button" onClick={()=>setPage(n=>Math.max(0,n-1))} disabled={!pageIndex}>Previous groups</button><span>{matches.length?`${pageIndex*25+1}–${Math.min(pageIndex*25+25,matches.length)}`:'0'} of {matches.length} · exports include all {rows.length} groups</span><button type="button" onClick={()=>setPage(n=>n+1)} disabled={(pageIndex+1)*25>=matches.length}>Next groups</button></div>
      </>
    ) : (
      <div className="p-4 bg-white rounded-lg border border-slate-200 mt-3">
        <div className="h-[320px] min-h-[320px] w-full">
          {!matches.length ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 p-4">
              <span className="font-medium text-slate-600 mb-1">No matching vetting groups to graph.</span>
              <span className="text-[11px] text-slate-400">Try adjusting your scorecard search.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
              <BarChart
                data={matches.slice(0, 12).map((r: VettingGroup) => ({
                  name: r.series ? `${r.key} (${r.series})` : r.key,
                  leads: Number(r.leads || 0),
                  delivered: Number(r.delivered || 0),
                  called: Number(r.called || 0),
                  sales: Number(r.sales || 0),
                }))}
                margin={{ top: 20, right: 30, left: 10, bottom: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" angle={-20} textAnchor="end" height={50} interval={0} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(v) => Number(v).toLocaleString()} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-3 text-xs min-w-[190px] ring-1 ring-black/5 dark:ring-white/5 font-mono">
                        <div className="font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1 mb-2">
                          {label}
                        </div>
                        <div className="space-y-1.5">
                          {payload.map((entry: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-sans">
                                <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: entry.fill }} />
                                <span>{entry.name}</span>
                              </span>
                              <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                                {Number(entry.value || 0).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="leads" name="Included Leads" fill="var(--cx-data-fetched, #4F5FB7)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="delivered" name="Delivered" fill="var(--cx-data-delivered, #0E7490)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="called" name="Dialled" fill="var(--cx-data-dialled, #7153A3)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="sales" name="Sales" fill="var(--cx-data-sales, #426D80)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    )}
  </details>;
}
function Movement({report,section}:{report:VettingReport;section:'class'|'colour'}){
  const changes=classMovement(report,section);
  return <VettingChart title={`${section==='class'?'Class':'Colour'} mix: current vs previous`} description={`Same ${report.scope?.days ?? 0}-day capture windows and filters. Different follow-up time can affect outcomes. Missing categories in a complete returned window have a measured count of zero.`}
    rows={changes.map(c=>({...c,label:c.key}))} series={[{key:'current',label:'Current Included Leads'},{key:'previous',label:'Previous Included Leads'}]} initial="column"/>;
}
function Matrix({report,measure,onSelect}:{report:VettingReport;measure:string;onSelect:(c:string,k:string)=>void}){
  const rows=selectedGroups(report,'matrix'),classes=[...new Set(rows.map(r=>r.key))].sort(),colours=[...new Set(rows.map(r=>r.series))].sort();
  const lookup=new Map(rows.map(r=>[JSON.stringify([r.key,r.series]),decorateGroup(r,report)]));
  const values=rows.map(r=>Number((decorateGroup(r,report) as any)[measure]||0)),max=Math.max(1,...values),label=VETTING_MEASURES.find(m=>m.key===measure)!.label;
  return <section className="vetting-matrix enterprise-card"><h2>Class × colour relationship</h2><p>{label}. Each lead belongs to one recorded class/colour cell. This does not imply an equivalent score. Select a populated cell to apply both classifications.</p>
    <div className="vetting-matrix-scroll"><div role="grid" aria-label="Class by colour heatmap" style={{minWidth:Math.max(540,colours.length*115+155)}}>
      <div role="row" className="vetting-matrix-row" style={{gridTemplateColumns:`155px repeat(${colours.length},minmax(100px,1fr))`}}><strong role="columnheader">Class / Colour</strong>{colours.map(c=><strong key={c} role="columnheader">{c}</strong>)}</div>
      {classes.slice(0,50).map(c=><div key={c} role="row" className="vetting-matrix-row" style={{gridTemplateColumns:`155px repeat(${colours.length},minmax(100px,1fr))`}}><strong role="rowheader">{c}</strong>{colours.map(k=>{
        const row=lookup.get(JSON.stringify([c,k])),value=row?(row as any)[measure]:null,intensity=value==null?0:Math.max(0,Math.min(1,Number(value)/max));
        return <button key={k} role="gridcell" type="button" disabled={!row} aria-label={`Class ${c}, colour ${k}: ${value==null?'no measured value':exactLabel(value)}`} style={{background:`rgba(8,127,140,${.05+.8*intensity})`,color:intensity>.65?'white':'#17283d'}} onClick={()=>onSelect(c,k)}>{value===null?'—':exactLabel(value)}<small>{row?`${exactLabel(row.leads)} leads`:'No returned cell'}</small></button>;
      })}</div>)}
    </div></div>{classes.length>50&&<p>First 50 of {classes.length} class values are shown. Use the complete cross-tab scorecard for every value.</p>}{!rows.length&&<p className="vetting-empty">No class/colour cells were returned.</p>}
  </section>;
}
export default function Vetting(){
  const [tab,setTab]=useState<typeof tabs[number][0]>('overview'),[interval,setInterval]=useState('day'),[classValue,setClassValue]=useState(''),[colourValue,setColourValue]=useState('');
  const [measure,setMeasure]=useState('leads'),[sourceAxis,setSourceAxis]=useState<'source'|'vendor'>('source');
  const {startDate,endDate,filters}=useFilters(),{selectedClient}=useClient();
  const defaultDates = useMemo(() => defaultDateRange(), []);
  const activeStart = startDate || defaultDates.start;
  const activeEnd = endDate || defaultDates.end;

  const allowedFilterKeys = useMemo(() => new Set([
    'source', 'medium', 'vendor', 'grade', 'vetting',
    'lead_id', 'valid_lead', 'valid_idno', 'phone_valid',
    'delivered', 'has_delivery', 'called', 'has_call',
    'rpc', 'has_rpc', 'sale', 'sales', 'has_sale',
    'activated', 'activation', 'has_activation'
  ]), []);

  const vettingFilters = useMemo(() => {
    const vf: Record<string, any> = {};
    for (const [k, v] of Object.entries(filters || {})) {
      if (allowedFilterKeys.has(k)) {
        vf[k] = v;
      }
    }
    return vf;
  }, [filters, allowedFilterKeys]);

  const result=useAnalyticsData<VettingReport>('vetting',{
    startDate: activeStart,
    endDate: activeEnd,
    filters: vettingFilters,
    interval,
    classValue:classValue||undefined,
    colourValue:colourValue||undefined
  });
  const data=result.data,classes=data?selectedGroups(data,'class'):[],colours=data?selectedGroups(data,'colour'):[];
  const currentClassOptions=[...new Set(['A','B','C','D','E','F','U',MISSING_CLASS,...classes.map(r=>r.key),classValue])].filter(Boolean);
  const currentColourOptions=[...new Set([...COLOURS,MISSING_COLOUR,UNMAPPED_COLOUR,MULTIPLE_COLOURS,...colours.map(r=>r.key),colourValue])].filter(Boolean);
  const selectedMeasure=VETTING_MEASURES.find(m=>m.key===measure)!;
  const chartRows=(rows:VettingGroup[])=>rows.map(r=>({...decorateGroup(r,data!),label:r.series?`${r.key} · ${r.series}`:r.key}));
  const reset=()=>{setClassValue('');setColourValue('');};
  const choose=(c:string,k:string)=>{setClassValue(c);setColourValue(k);};
  const exportAll=()=>data&&downloadVetting(JSON.stringify(data,null,2),`vetting-${data.scope?.startDate || 'export'}-${data.scope?.endDate || ''}.json`,'application/json');
  const sourceClassRows=data?selectedGroups(data,sourceAxis==='source'?'sourceClass':'vendorClass'):[],sourceColourRows=data?selectedGroups(data,sourceAxis==='source'?'sourceColour':'vendorColour'):[];
  const trend=data?selectedGroups(data,'trend').map(r=>({...decorateGroup(r,data),label:r.key})):[];
  const show=Boolean(data && data.scope && data.current && !result.error && !result.loading && !result.fetching);
  return <PageShell><div className="vetting-page">
    <header className="vetting-hero"><div><h1>Vetting</h1><p>Compare class and colour results as separate classifications, with their recorded outcomes.</p></div><div><button type="button" className="cx-button-secondary" disabled={!show} onClick={exportAll}><Download size={15}/>Export complete analysis</button>{!show&&<p className="cx-filter-note">Available when this selection has loaded.</p>}</div></header>
    <section className="vetting-selection enterprise-card" aria-label="Vetting selections"><label>Class result<select aria-label="Class result" value={classValue} onChange={e=>setClassValue(e.target.value)}><option value="">All class results</option>{currentClassOptions.map(v=><option value={v} key={v}>{v}</option>)}</select></label>
      <label>Colour result<select aria-label="Colour result" value={colourValue} onChange={e=>setColourValue(e.target.value)}><option value="">All colour results</option>{currentColourOptions.map(v=><option value={v} key={v}>{v}</option>)}</select></label>
      <label>Capture trend<select aria-label="Vetting trend interval" value={interval} onChange={e=>setInterval(e.target.value)}><option value="day">Daily</option><option value="week">Weekly (Monday)</option><option value="month">Monthly</option></select></label>
      <label>Compare outcomes<select aria-label="Vetting comparison measure" value={measure} onChange={e=>setMeasure(e.target.value)}>{VETTING_MEASURES.map(m=><option value={m.key} key={m.key}>{m.label}</option>)}</select></label>
      <button type="button" className="cx-button-secondary" onClick={reset} disabled={!classValue&&!colourValue}><Filter size={14}/>Clear class and colour</button>
    </section>
    <nav className="vetting-tabs" role="tablist" aria-label="Vetting analysis sections">{tabs.map(([id,label],index)=><button key={id} id={`vetting-tab-${id}`} type="button" role="tab" aria-selected={tab===id} aria-controls={`vetting-panel-${id}`} tabIndex={tab===id?0:-1} onClick={()=>setTab(id)} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const n=(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;setTab(tabs[n][0]);document.getElementById(`vetting-tab-${tabs[n][0]}`)?.focus();}}}>{label}</button>)}</nav>
    {!show?<DataState loading={result.loading||result.fetching} error={result.error} empty={!data} retry={result.refetch}/>:<div role="tabpanel" id={`vetting-panel-${tab}`} aria-labelledby={`vetting-tab-${tab}`} className="vetting-panel" key={`${selectedClient}:${data?.scope?.startDate || ''}:${data?.scope?.endDate || ''}:${classValue}:${colourValue}`}>
      <div className="vetting-insight"><Palette size={22}/><p>{summaryLine(data)}</p><span>Observed, not independently reconciled</span></div>
      <p className="vetting-response-scope"><strong>Included leads: {exactLabel(data?.current?.leads)}</strong><span>Selected class: {classValue||'All'} · Selected colour: {colourValue||'All'} · Current vs {data?.scope?.previousStart || '—'}–{data?.scope?.previousEnd || '—'}</span></p>
      {(!data?.fields?.leadClass?.available||!data?.fields?.leadColour?.available)&&<div className="vetting-warning" role="status">{!data?.fields?.leadClass?.available?'Class field unavailable. ':''}{!data?.fields?.leadColour?.available?'Colour field unavailable. ':''}Result coverage remains unavailable; missing mappings are not measured failed leads.</div>}
      {tab==='overview'&&<>
        <div className="vetting-kpis">{([['leads','Included Leads'],['classRecorded','Class Result Recorded'],['namedColour','Recognised Colour'],['bothRecorded','Class + Named Colour']] as [VettingMetric,string][]).map(([key,label])=>{
          const change=periodChange(data?.current?.[key],data?.previous?.[key]);return <article key={key} className="enterprise-card"><span>{label}</span><strong>{exactLabel(data?.current?.[key])}</strong><small>{key==='leads'?`${data?.scope?.days ?? 0} capture days`: `${pct(countRatio(data?.current?.[key],data?.current?.leads))} of included leads`}</small><p>{change.delta?.startsWith('-')?<ArrowDownRight size={13}/>:change.delta==='0'?<Minus size={13}/>:<ArrowUpRight size={13}/>}{change.percent===null?'No comparable prior denominator':`${change.percent}% vs previous window`}</p></article>;
        })}</div>
        <div className="vetting-two"><VettingChart title="Class lead distribution" description="Distinct included leads by recorded class. U is retained as a class code, not re-labelled missing or qualified." rows={chartRows(classes)} series={[{key:'leads',label:'Included Leads'}]} disjoint initial="pie" onSelect={setClassValue}/>
          <VettingChart title="Colour lead distribution" description="Named colours, absent results and unmapped outcomes are separate, mutually exclusive groups." rows={chartRows(colours)} series={[{key:'leads',label:'Included Leads'}]} disjoint initial="donut" onSelect={setColourValue}/></div>
        <VettingChart title="Capture and vetting coverage trend" description="Capture-dated included leads and their currently recorded classifications. This is not the count of vetting events performed on those dates." rows={trend} series={[{key:'leads',label:'Included Leads'},{key:'classRecorded',label:'Class Result Recorded'},{key:'namedColour',label:'Recognised Colour'}]} ordered initial="line"/>
        <div className="vetting-two"><VettingChart title="Class outcome comparison" description={selectedMeasure.label+'. Source evidence is not proof that class caused conversion.'} rows={chartRows(classes)} series={[{key:measure,label:selectedMeasure.label}]} unit={selectedMeasure.unit} onSelect={setClassValue}/>
          <VettingChart title="Colour outcome comparison" description={selectedMeasure.label+'. Failed or missing results are not assigned a colour.'} rows={chartRows(colours)} series={[{key:measure,label:selectedMeasure.label}]} unit={selectedMeasure.unit} onSelect={setColourValue}/></div>
      </>}
      {(tab==='classes'||tab==='colours')&&<>
        <div className="vetting-two"><VettingChart title={tab==='classes'?'Class mix':'Colour mix'} description="Complete included-lead distribution. Select a slice or exact category to filter the complete report." rows={chartRows(tab==='classes'?classes:colours)} series={[{key:'leads',label:'Included Leads'}]} disjoint initial="donut" onSelect={tab==='classes'?setClassValue:setColourValue}/>
          <VettingChart title="Downstream evidence by classification" description={`${selectedMeasure.label}. All selected HLC outcomes are counted once per included lead.`} rows={chartRows(tab==='classes'?classes:colours)} series={[{key:measure,label:selectedMeasure.label}]} unit={selectedMeasure.unit} initial="bar"/></div>
        <Movement report={data} section={tab==='classes'?'class':'colour'}/>
        <VettingChart title="Selected classification over time" description="Use the class/colour selectors above to isolate a category. Empty source periods are not manufactured. Outcome shares use the included leads in each capture period." rows={trend} series={[{key:measure,label:selectedMeasure.label}]} unit={selectedMeasure.unit} ordered initial="line"/>
        <Scorecard title={tab==='classes'?'Class leads':'Colour leads'} rows={tab==='classes'?classes:colours} report={data}/>
      </>}
      {tab==='matrix'&&<><Matrix report={data} measure={measure} onSelect={choose}/><Scorecard title="Class by colour cross-tab" rows={selectedGroups(data,'matrix')} report={data}/></>}
      {tab==='sources'&&<>
        <label className="vetting-breakdown-select">Break down by<select aria-label="Vetting segment dimension" value={sourceAxis} onChange={e=>setSourceAxis(e.target.value as any)}><option value="source">Lead source</option><option value="vendor">HLC vendor</option></select></label>
        <p className="vetting-warning">{sourceAxis==='vendor'?'A lead can appear under several vendors. Vendor totals must not be summed into unique leads. Each vendor’s outcome counts use only its own HLC records.':'Source/class and source/colour pairs partition the selected included leads; each returned pair remains a separate point.'}</p>
        <div className="vetting-two"><VettingChart title="Segment × class performance" description={selectedMeasure.label} rows={chartRows(sourceClassRows)} series={[{key:measure,label:selectedMeasure.label}]} unit={selectedMeasure.unit}/><VettingChart title="Segment × colour performance" description={selectedMeasure.label} rows={chartRows(sourceColourRows)} series={[{key:measure,label:selectedMeasure.label}]} unit={selectedMeasure.unit}/></div>
        <Scorecard title={`${sourceAxis} class breakdown`} rows={sourceClassRows} report={data}/><Scorecard title={`${sourceAxis} colour breakdown`} rows={sourceColourRows} report={data}/>
      </>}
      {tab==='coverage'&&<>
        <VettingChart title="Capture-to-vetting delay" description="Elapsed seconds, using non-negative source timestamps no later than query time. Median and 90th percentile use exact warehouse percentile calculations, not business-hours adjustment." rows={['Class','Colour'].map(kind=>({label:kind,...(data?.timing || []).find(r=>r.kind===kind)}))} series={[{key:'meanSeconds',label:'Mean Seconds'},{key:'medianSeconds',label:'Median Seconds'},{key:'p90Seconds',label:'90th Percentile Seconds'}]} unit="seconds" initial="column"/>
        <div className="vetting-two"><VettingChart title="Class timestamp quality" description="These counts are source timestamp conditions, not a pass/fail score. Absent fields remain unavailable." rows={(['classTimed','classBeforeCapture','classInvalidTime','classFutureTime'] as VettingMetric[]).map(k=>({label:VETTING_METRICS[k],count:data?.current?.[k]}))} series={[{key:'count',label:'Included Leads'}]}/>
          <VettingChart title="Colour timestamp quality" description="A colour-vetting result can be present without a usable completion timestamp." rows={(['colourTimed','colourBeforeCapture','colourInvalidTime','colourFutureTime'] as VettingMetric[]).map(k=>({label:VETTING_METRICS[k],count:data?.current?.[k]}))} series={[{key:'count',label:'Included Leads'}]}/></div>
        <section className="vetting-diagnostics enterprise-card"><h2>Source quality before report filters</h2><p>Capture-window inspection precedes class, colour, source and vendor selections. Conflicting lead projections are excluded instead of choosing an arbitrary record.</p>{(data?.diagnostics || []).map(d=><article key={d.period}><h3>{d.period==='current'?'Current capture window':'Previous capture window'}</h3><dl>{[['Source rows',d.sourceRows],['Missing-ID rows excluded',d.missingIdRows],['Conflicting lead IDs',d.conflictingLeads],['Conflicting rows excluded',d.conflictingRows],['Repeated rows collapsed',d.duplicateRowsCollapsed],['Eligible unique leads before filters',d.eligibleUniqueLeads]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{exactLabel(value)}</dd></div>)}</dl></article>)}</section>
        <Scorecard title="Raw class results" rows={selectedGroups(data,'rawClass')} report={data}/><Scorecard title="Raw colour-vetting results" rows={selectedGroups(data,'rawColour')} report={data}/>
      </>}
      <details className="vetting-evidence enterprise-card"><summary>Definitions, source fields and query evidence</summary><p><strong>Previous window:</strong> {data?.scope?.previousStart || '—'} to {data?.scope?.previousEnd || '—'}. <strong>Source:</strong> {data?.evidence?.table || 'Unavailable'}. <strong>Query job:</strong> {data?.evidence?.jobId||'Unavailable'}. <strong>Read at:</strong> {data?.evidence?.generatedAt || 'Unavailable'}.</p><p>No snapshot is pinned. The same filters and period definitions apply throughout this response.</p><ul>{(data?.notes || []).map(n=><li key={n}>{n}</li>)}</ul><dl>{Object.entries(data?.fields || {}).map(([key,f])=><div key={key}><dt>{f.sourceField}</dt><dd>{f.available?'Column available':'Mapping unavailable'}</dd></div>)}</dl></details>
    </div>}
  </div></PageShell>;
}
