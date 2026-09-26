import { METRIC_BY_ID } from '../../../contracts/reporting';
import { EXPLORER_METRICS } from '../../../contracts/legacyMetrics';
import { SOURCE_DEFINITIONS } from '../../../contracts/sourceCoverage';
import { decimal, type VisualDataset, type Dimension, type Measure } from './model';

export const VISUAL_VERSION = 'cx.visuals.1';
const LEGACY = 'Returned API rows only; legacy calculations remain unverified. No values are summed, deduplicated or averaged by this visual view.';
const SENSITIVE = /(^|[_. ])(id|ids|key|token|email|phone|mobile|idno|name|address|contact_number)([_. ]|$)|(^|[a-z])(Id|ID|Key|Token)$/;
const human = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_.]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const LABELS: Record<string, string> = {
  leads:'Fetched Leads', totalLeads:'Fetched Leads', size:'Fetched Leads in Cohort', delivered:'Delivered Leads', called:'Dialled Leads',
  rpcs:'Leads with RPC', sales:'Leads with Sales', billableSales:'Leads with Sales and Recorded Revenue', activations:'Leads with Activations',
  revenue:'Recorded Revenue', total_revenue:'Recorded Revenue', revPerLead:'Recorded Revenue per Fetched Lead', rev_per_lead:'Recorded Revenue per Fetched Lead',
  source:'Lead Source', medium:'Traffic Medium', vendor:'Vendor', calls:'Recorded Call Attempts', total_calls:'Recorded Call Attempts',
  callRate:'Dialled / Fetched Leads (%)', deliveryRate:'Delivered / Fetched Leads (%)', rpcRate:'RPC / Dialled Leads (%)',
  saleRate:'Sales / Dialled Leads (%)', leadToSaleRate:'Sales / Fetched Leads (%)', callCoverage:'Dialled / Delivered Leads (%)',
  billableSaleRate:'Revenue-Matched Sales / Sales (%)', activationRate:'Activations / Sales (Lead Counts) (%)',
  lead_share_pct:'Share of Returned Lead Population (%)', handoff_rate_pct:'Handoff / Routed Leads (%)',
  delivery_rate_pct:'Delivered / Fetched Leads (%)', call_rate_pct:'Dialled / Fetched Leads (%)', rpc_rate_pct:'RPC / Fetched Leads (%)',
  sale_rate_pct:'Sales / Fetched Leads (%)', billable_sale_rate_pct:'Revenue-Matched Sales / Fetched Leads (%)',
  transactions:'Transaction Rows', total_transactions:'Transaction Rows', avg_cascade_delay_sec:'Mean Cascade Delay (Seconds)',
  affected:'Affected Records', percentage:'Share of API Population (%)', rowCount:'Metadata Row Count (Not Period-Filtered)',
  metrics:'Cohort Follow-up', current:'Current Period Value', previous:'Previous Period Value', change:'Absolute Change', pctChange:'Relative Change (%)',
  validRows:'Valid Input Rows', missingRows:'Missing Input Rows', invalidRows:'Invalid Input Rows', value:'Source Value',
};
interface Spec { title: string; dimension?: string; ordered?: string[]; labels?: Record<string,string>; measures?: string[]; note?: string; }
export const TABLE_VISUALS: Record<string,Spec> = {
  'routing.depth': {title:'Routing Depth',dimension:'depth_bucket'}, 'routing.paths':{title:'Partner Routing Sequences',dimension:'route_path'},
  'routing.handoff':{title:'Partner Handoff',dimension:'partner'}, 'routing.missing':{title:'Unmatched Routing Sample',dimension:'partner',note:'Returned missing-match sample only, not all routed leads.'},
  'cohorts.maturity':{title:'Cohort Maturation',dimension:'cohort',ordered:['cohort'],measures:['metrics.d0','metrics.d1','metrics.d3','metrics.d7','metrics.d14','metrics.d30'],note:'API-returned cohort values. Immature periods stay missing; no interpolation or averaging.'},
  'cohorts.funnel':{title:'Cohort Outcomes',dimension:'cohort',ordered:['cohort']},
  'quality.grades':{title:'Lead Grade Outcomes',dimension:'grade'}, 'quality.reasons':{title:'Validation Reasons',dimension:'reason',labels:{count:'Returned Classification Count'}},
  'validation.checks':{title:'Reconciliation Check Status',dimension:'status',note:'Counts of returned checks by status—not a certification score or measured business outcomes.'},
  'consumers.tiers':{title:'Consumer Lead Tiers',dimension:'lead_tier',labels:{sale_rate_pct:'Consumers with Sales / Consumers (%)',billable_sale_rate_pct:'Consumers with Revenue-Matched Sales / Consumers (%)'}},
  'consumers.sequence':{title:'Consumer Entry Sequences',dimension:'sequence_bucket'},
  'consumers.sample':{title:'Repeat Consumer Sample',dimension:'has_billable_sale',note:'Returned consumer sample only. Recorded values are not customer lifetime value.'},
  'revetting.comparison':{title:'Original and Re-vetted Leads',dimension:'is_revetted'}, 'revetting.vetting':{title:'Re-vetting by Classification',dimension:'vetting'},
  'trust.capabilities':{title:'Vendor Capability Evidence',dimension:'vendor',note:'API-returned capability classifications, not inferred data completeness. Choose record distribution to compare status categories.'},
  'trust.multivendor':{title:'Multi-vendor Lead Groups',dimension:'vendor_count'},
  'speed.bands':{title:'Delivery-to-First-Dial Bands',dimension:'bucket',labels:{leads:'Transaction Rows',rpcCount:'RPC Flag Rows',saleCount:'Sale Flag Rows',billableCount:'Sale Flags with Recorded Revenue',actCount:'Activation Flag Rows',rpc:'RPC Flag Rows / Rows in Band (%)',sale:'Sale Flag Rows / Rows in Band (%)',activation:'Activation Flag Rows / Sale Flag Rows (%)',billableRate:'Revenue-Matched Sale Rows / Sale Flag Rows (%)',revPerLead:'Recorded Revenue / Transaction Row'},note:'Whole-minute elapsed intervals on the returned dialled transaction subset; not all deliveries and not operating-hours-adjusted.'},
  'sources.performance':{title:'Lead Source Performance',dimension:'source',labels:{activationRate:'Activations / Revenue-Matched Sales (Lead Counts) (%)'}},
  'outcomes.status':{title:'Vendor and Status Outcomes',dimension:'vendor',labels:{sales:'Sale Flag Rows',billable_sales:'Sale Flag Rows with Recorded Revenue',unbilled_sales:'Sale Flag Rows without Matched Revenue',billable_conversion_pct:'Revenue-Matched Sale Rows / Sale Flag Rows (%)',rev_per_transaction:'Recorded Revenue / Transaction Row'}},
  'records.leads':{title:'Returned Lead Records',dimension:'source',note:'Loaded API page only. Changing page changes this chart; not a full warehouse population.'},
  'sources.coverage':{title:'Configured Source Tables',dimension:'label',note:'Schema inventory and metadata only. Metadata row counts are not date-filtered or additive across sources.'},
  'sources.unmapped':{title:'Unmapped Source Tables',dimension:'reason',note:'Returned metadata only. Unapproved tables are not queried or joined by charts.'},
  'sources.dependencies':{title:'Metric-to-Fact Dependencies',dimension:'metric',note:'Declared dependency relationships, not measured lead or financial data.'},
  'quality.issues':{title:'Data Quality Exceptions',dimension:'issue',note:'Reported exception counts may overlap. They are not summed into a unique affected population.'},
  'calls.bands':{title:'Call-Attempt Band Outcomes',dimension:'bucket',labels:{current:'Lead Records in Band',rpc:'RPC / Leads in Band (%)',sale:'Sales / Leads in Band (%)',activation:'Activations / Leads in Band (%)',revPerLead:'Recorded Revenue per Lead',totalRevenue:'Recorded Revenue'}},
  'calls.hourly':{title:'First-Dial Hour',dimension:'label',ordered:['label'],labels:{volume:'Dialled Leads'},note:'Returned first-dial-hour counts; only hours supplied by the API. Not the number of call attempts or a complete 24-hour series.'},
  'calls.weekdays':{title:'First-Dial Weekday',dimension:'day',labels:{volume:'Dialled Leads'}},
  'calls.vendors':{title:'Vendor Call Records',dimension:'vendor',labels:{calledLeads:'Dialled Transaction Rows',avgCallsPerLead:'Recorded Attempts / Dialled Transaction Row',oneCallRate:'One-Call Rows / Dialled Rows (%)',rpcRate:'RPC Flag Rows / Dialled Rows (%)',saleRate:'Sale Flag Rows / Dialled Rows (%)',revPerLead:'Recorded Revenue / Dialled Row'}},
  'calls.dispositions':{title:'Recorded Call Dispositions',dimension:'disposition',labels:{volume:'Distinct Transaction IDs',share:'Share of Returned Groups (%)',rpcRate:'RPC Flag Rows / Transaction IDs (%)',saleRate:'Sale Flag Rows / Transaction IDs (%)'}},
  'legacy.audit':{title:'Exported Source Records',dimension:'source',note:'Loaded export records only; any API row cap or upstream incompleteness still applies. No event uniqueness is inferred.'},
  'overview.visuals':{title:'Overview Data',dimension:'date'}, 'funnel.visuals':{title:'Lead Funnel Data',dimension:'stage'},
  'vendor.performance':{title:'Vendor Performance Evidence',dimension:'group',note:'Snapshot-bound values from the approved release. Exact figures are preserved; unavailable metrics are not zero.'},
  'operations.exceptions':{title:'Operational Exception Rules',dimension:'label',labels:{count:'Affected Records',severity:'Severity Level',status:'Validation Status'},note:'Rule counts derived from release validation. Missing thresholds or source facts remain visibly unavailable.'},
  'commercial.reconciliation':{title:'Commercial Reconciliation by Vendor',dimension:'group',note:'Contractual stage amounts from approved vendor ledger changes. Invoice-to-collection gaps reflect uncollected billable amounts.'},
};
function flatten(row: unknown, prefix='', out: Record<string,unknown> = {}, depth=0): Record<string,unknown> {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return { label: String(row ?? 'Unspecified') };
  for (const [k,v] of Object.entries(row)) {
    if (['__proto__','constructor','prototype'].includes(k)) continue;
    const key=prefix+k;
    if (v && typeof v==='object' && !Array.isArray(v) && !Object.hasOwn(v,'value') && depth<3) flatten(v,key+'.',out,depth+1);
    else if (!Array.isArray(v)) out[key]=v && typeof v==='object' && Object.hasOwn(v,'value') ? (v as any).value : v;
  }
  return out;
}
function unit(key:string,label:string) {
  if (/%/.test(label) || /(_pct|Rate|Coverage|percentage|pctChange)$/.test(key)) return 'percent';
  if (/Seconds|seconds|_sec$/.test(label+' '+key)) return 'seconds';
  // Unknown source measures get separate axes by default, rather than guessing comparability.
  return `field:${key}`;
}
export function tableDataset(id:string, input:unknown, override:Partial<Spec>={}):VisualDataset {
  const spec:Spec={...(TABLE_VISUALS[id]||{title:human(id)}),...override};
  const rows=(Array.isArray(input)?input:input&&typeof input==='object'?[input]:[]).map(row=>flatten(row));
  const keys=[...new Set(rows.flatMap(Object.keys))];
  const preferred=['group','date','capture_date','cohort','month','week','source','vendor','medium','bucket','label','name','stage','tier','segment','partner','reason','status','displayMonth'];
  const dims:Dimension[]=keys.filter(key=>!SENSITIVE.test(key)||key==='name'||['phone_valid','valid_idno'].includes(key)&&rows.some(r=>typeof r[key]==='boolean')).filter(key=> (!rows.some(r=>decimal(r[key])!==null) && !['leads','sales','delivered','called','revenue','total_revenue','value','current','previous','change'].includes(key) && rows.some(r=>typeof r[key]==='string' && decimal(r[key])===null && String(r[key]).length<250 || typeof r[key]==='boolean')) || key===spec.dimension)
    .map(key=>({key,label:spec.labels?.[key]||LABELS[key]||human(key),ordered:spec.ordered?.includes(key)||/^(date|capture_date|cohort|month|week)$/.test(key)&&rows.some(r=>/^\d{4}-\d{2}/.test(String(r[key])))}));
  if(spec.dimension && keys.includes(spec.dimension) && !dims.some(d=>d.key===spec.dimension))dims.unshift({key:spec.dimension,label:LABELS[spec.dimension]||human(spec.dimension),ordered:spec.ordered?.includes(spec.dimension)});
  dims.sort((a,b)=>a.key===spec.dimension?-1:b.key===spec.dimension?1:(preferred.indexOf(a.key)<0?999:preferred.indexOf(a.key))-(preferred.indexOf(b.key)<0?999:preferred.indexOf(b.key)));
  const measurements=(spec.measures||keys).filter(key=>!SENSITIVE.test(key) && key!==spec.dimension && !dims.some(d=>d.key===key) && (spec.measures?.includes(key)||['leads','sales','delivered','called','revenue','total_revenue','value','current','previous','change'].includes(key)||rows.some(r=>decimal(r[key])!==null)))
    .map(key=>{const label=spec.labels?.[key]||LABELS[key]||(/^metrics\.d\d+$/.test(key)?key.split('.')[1].toUpperCase()+' Cohort Value (%)':human(key));return {key,label,unit:unit(key,label)};});
  return {id,title:spec.title,rows,dimensions:dims,measures:measurements,note:spec.note||LEGACY,defaultDimension:dims[0]?.key,defaultMeasure:measurements[0]?.key};
}
export function metricDatasets(id:string, rows:any[], grouping='group', note='Snapshot-bound API results. Values, numerators and denominators retain their metric definitions.'):VisualDataset[] {
  const ids=[...new Set((rows||[]).map(r=>r.metricId||r.id))];
  return ids.filter(Boolean).map(metricId=>{
    const values=rows.filter(r=>(r.metricId||r.id)===metricId), definition=METRIC_BY_ID[metricId];
    const label=definition?.label||values[0]?.label||human(metricId), keys=['value','numerator','denominator','validRows','missingRows','invalidRows'];
    const dataset=tableDataset(id+':'+metricId,values.map(r=>({...r,group:Object.hasOwn(r,'group')?(r.group??'Unspecified'):'Report total'})),{title:label,dimension:'group',ordered:grouping==='date'?['group']:[],measures:keys.filter(k=>values.some(r=>Object.hasOwn(r,k))),note,
      labels:{value:label,numerator:definition?.numeratorLabel||'Numerator',denominator:definition?.denominatorLabel||'Denominator'}});
    dataset.measures=dataset.measures.map(m=>({...m,unit:m.key==='value'?(definition?.unit==='percent'?'percent':`metric:${metricId}`):m.key==='numerator'||m.key==='denominator'?`population:${metricId}`:'input rows'}));
    dataset.rows=dataset.rows.map((row,i)=>({...row,value:values[i].calculationStatus==='UNAVAILABLE'?null:row.value}));
    return dataset;
  });
}
export function comparisonDataset(id:string,rows:any[],metricId:string):VisualDataset {
  const meta=EXPLORER_METRICS.find(m=>m.id===metricId), label=meta?.label||human(metricId);
  const dataset=tableDataset(id,rows,{title:`Period Comparison · ${label}`,dimension:'segment',measures:['current','previous','change','pctChange'],labels:{current:`Current · ${label}`,previous:`Previous · ${label}`,change:`Change · ${label}`,pctChange:'Relative Change (%)'},note:'Returned period comparisons; not causal attribution. Percent values are already percentages.'});
  dataset.measures=dataset.measures.map(m=>({...m,unit:m.key==='pctChange'?'relative percent':`comparison:${metricId}`}));return dataset;
}
/** Explicit adapters for long-form API results avoid comparing unrelated metrics as a single value column. */
export function datasetsFor(id:string,input:any,context?:any):VisualDataset[] {
  if(id==='report.groups'||id==='report.totals')return metricDatasets(id,input||[],context?.grouping,context?.note);
  if(id==='media.groups')return metricDatasets(id,(input||[]).flatMap((g:any)=>(g.metrics||[]).map((m:any)=>({...m,group:g.group}))), 'channel','Media-date API values. Platform actions are not ledger leads; no financial values are inferred.');
  if(id==='sources.metrics')return metricDatasets(id,input||[],'source','Source diagnostic values for the selected date field. Input coverage is separate from population completeness.');
  if(id==='sources.dependencies')return [tableDataset(id,(input||[]).flatMap((m:any)=>(m.requiredFacts||[]).map((fact:string)=>({metric:m.label,fact,required:'Recorded dependency'}))))];
  if(id==='comparison')return [comparisonDataset(id,input||[],context?.metric||'activations')];
  if(id==='explore.results') {
    const meta=EXPLORER_METRICS.find(m=>m.id===context?.metric);
    const d=tableDataset(id,input,{title:`Explorer · ${meta?.label||context?.metric||'Selected metric'}`,dimension:'dim1',ordered:['date','week','month','hour','weekday'].includes(context?.dimension)?['dim1']:[],measures:['value','sampleSize'],labels:{value:meta?.label||'Selected metric',sampleSize:'API Sample Size'},note:'Returned explorer groups only. No percentage scaling, group aggregation or inferred overall rate.'});
    d.measures=d.measures.map(m=>({...m,unit:m.key==='value'&&meta?.unit==='percent'?'percent':m.unit}));return [d];
  }
  if(id==='api.response')return responseDatasets(input,context?.endpoint||'response');
  return [tableDataset(id,input,context||{})];
}
/** Make every returned table selectable without treating nested arrays as numeric values. */
export function responseDatasets(input:any,path:string,depth=0):VisualDataset[] {
  if(depth>5||input===null||input===undefined)return [];
  if(Array.isArray(input)) {
    if(input.some(r=>r&&typeof r==='object'&&r.metricId))return metricDatasets(path,input);
    if(input.some(r=>r&&Array.isArray(r.metrics)))return datasetsFor('media.groups',input);
    if(input.some(r=>r&&r.id&&r.label&&Object.hasOwn(r,'value')))return datasetsFor('sources.metrics',input);
    return [tableDataset(path,input,{title:human(path),note:'This chart uses the selected API response array only. Record count means returned rows; raw rows and cumulative counters are not unique events.'})];
  }
  if(typeof input==='object') {
    const datasets:VisualDataset[]=[];
    for(const [key,value] of Object.entries(input))if(value&&typeof value==='object'&&!['metadata','source','query','request','filters'].includes(key))datasets.push(...responseDatasets(value,path+'.'+key,depth+1));
    const scalars=Object.fromEntries(Object.entries(input).filter(([k,v])=>!SENSITIVE.test(k) && (typeof v!=='object'||v===null)));
    if(Object.values(scalars).some(v=>decimal(v)!==null))datasets.unshift(tableDataset(path+'.summary',[{...scalars,label:'Returned summary'}],{title:human(path)+' Summary',dimension:'label'}));
    return datasets;
  }
  return [];
}
export const API_VISUAL_REPORTS=[
  ['overview','Executive Overview'],['funnel','Lead Funnel'],['calls','Call Performance'],['speed-to-lead','Delivery and First-Dial Timing'],
  ['cohorts','Lead Cohorts'],['timeseries','Capture-Date Trends'],['sources','Lead Sources'],['quality','Validation and Vetting'],['outcomes','Sales and Activations'],['outcomes-quality','Outcome Status Economics'],
  ['routing','Lead Routing'],['consumers','Consumer Re-entry'],['revetting','Re-vetting'],['data-trust','Data Checks'],['multi-vendor','Multi-vendor Leads'],
  ['data-quality','Data Quality'],['vendor-coverage','Vendor Field Coverage'],['parameter-coverage','Source Parameters (Administrator)'],['leads','Loaded Lead Records'],['validation','Reconciliation Status'],['acquisition','Media Channels'],['source-coverage','Source Inventory (Administrator)'],
  ...Object.entries(SOURCE_DEFINITIONS).map(([role,d])=>['source-metrics/'+role,d.label+' (Source Date)']),
] as const;

/** Retain endpoint IDs while giving the workspace a scan-friendly source hierarchy. */
export const API_VISUAL_REPORT_GROUPS = [
  {label:'Performance and operations', endpoints:['overview','funnel','calls','speed-to-lead','cohorts','timeseries','sources','quality','outcomes','outcomes-quality','routing','consumers','revetting','multi-vendor','leads','acquisition']},
  {label:'Data quality and administration', endpoints:['data-trust','data-quality','vendor-coverage','parameter-coverage','validation','source-coverage']},
  {label:'Source-specific recorded data', endpoints:Object.keys(SOURCE_DEFINITIONS).map(role=>'source-metrics/'+role)},
].map(group=>({...group,reports:API_VISUAL_REPORTS.filter(([endpoint])=>group.endpoints.includes(endpoint))}));
