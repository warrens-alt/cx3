import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { SOURCE_DEFINITIONS,SOURCE_ROLES } from '../contracts/sourceCoverage';
import { sourceCatalogue,sourceTable,metricTableLineage } from '../server/bigquery/sourceCatalog';
import { flatSchema,type SourceAccess,type SchemaField,type TableMetadata } from '../server/bigquery/sourceAccess';
import { compileSourceMetrics,getSourceMetrics } from '../server/bigquery/sourceMetrics';
import { createSourceRouter } from '../server/bigquery/sourceRouter';
import { RequestError } from '../server/bigquery/filters';
import { parameterCoverage } from '../server/bigquery/parameterCoverage';
const scope={clientId:'default_tenant',startDate:'2026-08-01',endDate:'2026-08-31',filters:{}};
function metadata(role:string):TableMetadata{
  const common:SchemaField[]=[{name:'fetched',type:'STRING'},{name:'lead_id',type:'STRING'},{name:'offershop_source',type:'STRING'},{name:'offernet_medium',type:'STRING'},
    ...['valid_lead','valid_idno','phone_valid'].map(name=>({name,type:'BOOL'})),
    {name:'hlc_details',type:'RECORD',mode:'REPEATED',fields:[{name:'vendor',type:'STRING'},{name:'transaction_id',type:'STRING'}]}];
  const fields=role==='leads'?common:role==='calls'?[{name:'dialer_lead_id',type:'INT64'},{name:'vendor',type:'STRING'},{name:'call_start_date',type:'TIMESTAMP'},{name:'is_rpc',type:'BOOL'},{name:'is_sale',type:'BOOL'},{name:'length_in_sec',type:'INT64'}]:role==='timeToDial'?[{name:'vendor',type:'STRING'},{name:'dialer_uniqueid',type:'STRING'},{name:'dialer_lead_id',type:'INT64'},{name:'first_dial_date',type:'TIMESTAMP'},{name:'expected_first_dial',type:'TIMESTAMP'}]:role==='activations'?[{name:'transaction_id',type:'STRING'},{name:'date_created',type:'TIMESTAMP'},{name:'expected_ontact_revenue',type:'NUMERIC'}]:[{name:'date',type:'DATE'},{name:'channel',type:'STRING'},{name:'impressions',type:'INT64'},{name:'clicks',type:'INT64'},{name:'actions_lead',type:'INT64'}];
  return {type:'TABLE',numRows:'0',schema:{fields}};
}
function fixture(){
  const queries:any[]=[];const calls:string[]=[];
  const roleFor=(table:string)=>SOURCE_ROLES.find(r=>sourceTable(scope.clientId,r)===table)!;
  const access:SourceAccess={metadata:async table=>{calls.push(table);return metadata(roleFor(table));},listTables:async(p,d)=>[...SOURCE_ROLES.map(r=>sourceTable(scope.clientId,r)!),`${p}.${d}.unmapped_fixture`],
    execute:async options=>{queries.push(options);const table=SOURCE_ROLES.map(r=>sourceTable(scope.clientId,r)!).find(t=>String(options.query).includes('`'+t+'`'))!;const role=roleFor(table);
      const row:any={is_total:true,group_key:null};SOURCE_DEFINITIONS[role].metrics.forEach((_m,i)=>{row[`m${i}_value`]='0';row[`m${i}_valid`]='0';row[`m${i}_missing`]='0';row[`m${i}_invalid`]='0';});
      return {rows:[row],jobId:'synthetic-source-job',referencedTables:[table],bytesProcessed:'0'};}};
  return {access,queries,calls};
}
test('catalogue checks all five configured tables and retains unmapped identities',async()=>{
  const f=fixture(),c=await sourceCatalogue(scope.clientId,f.access);
  assert.equal(c.sources.length,5);assert.equal(f.calls.length,5);assert.equal(c.inventoryComplete,true);assert.ok(c.unmappedTables.length>=1);
  assert.ok(c.sources.every(s=>s.status==='SCHEMA_PRESENT'));assert.ok(c.sources.every(s=>s.populated===null));
  assert.ok(c.sources.every(s=>s.rowCount==='0'));assert.equal(c.validationStatus,'NOT_VERIFIED');
});
test('failed dataset inventory is not reported as an empty complete listing',async()=>{
  const f=fixture();f.access.listTables=async()=>{throw Object.assign(new Error(),{code:403});};
  const c=await sourceCatalogue(scope.clientId,f.access);assert.equal(c.inventoryComplete,false);assert.equal(c.inventory[0].status,'ACCESS_DENIED');
});
test('missing source and permission error do not fabricate zero rows',async()=>{
  const f=fixture();f.access.metadata=async t=>{throw Object.assign(new Error(),{code:t.includes('platform')?403:404});};
  const c=await sourceCatalogue(scope.clientId,f.access);assert.ok(c.sources.every(s=>s.rowCount===null));assert.equal(c.sources.find(s=>s.role==='marketing')!.status,'ACCESS_DENIED');
});
test('nested HLC fields are inspected at the real repeated field path',()=>{
  const f=flatSchema(metadata('leads').schema!.fields!);assert.equal(f.get('hlc_details.vendor')?.repeated,true);assert.equal(f.get('lead_id')?.repeated,false);
});
for(const role of SOURCE_ROLES)test(`${role} API query references its configured physical table and real date field`,async()=>{
  const f=fixture();const result=await getSourceMetrics(role,scope,f.access);const q=f.queries[0];
  assert.ok(q.query.includes('`'+sourceTable(scope.clientId,role)+'`'));assert.ok(q.query.includes(SOURCE_DEFINITIONS[role].dateField));
  assert.equal(q.params.startDate,scope.startDate);assert.equal(q.params.endDate,scope.endDate);assert.equal(result.metrics[0].value,'0');assert.equal(result.queryJobId,'synthetic-source-job');
});
test('time-to-dial distinguishes recorded first dial from scheduled expected dial',async()=>{
  const result=await getSourceMetrics('timeToDial',scope,fixture().access);
  assert.match(result.dateBasis,/Recorded first-dial/);
  assert.equal(result.parameterContract.dateField,'first_dial_date');
  assert.ok(result.metrics.some(metric=>metric.id==='first_dial_rows'));
  assert.ok(result.metrics.some(metric=>metric.id==='expected_first_dial_rows'));
  assert.match(result.warning,/not joined to Lead Ledger outcomes/);
});
test('source metrics do not use budget as spend or infer premium collection',()=>{
  const q=compileSourceMetrics('marketing',scope,metadata('marketing'),'channel');assert.doesNotMatch(q.query,/budget|SUM\(spend\)|premium/i);assert.match(q.query,/actions_lead/);
});
test('missing metric column is returned as unavailable, not queried',async()=>{
  const f=fixture();f.access.metadata=async()=>({schema:{fields:metadata('marketing').schema!.fields!.filter(f=>f.name!=='clicks')}});
  const result=await getSourceMetrics('marketing',scope,f.access);assert.equal(result.metrics.find(m=>m.id==='clicks')!.value,null);assert.equal(result.metrics.find(m=>m.id==='clicks')!.status,'UNAVAILABLE');
  assert.doesNotMatch(f.queries[0].query,/s\.`clicks`/);
});
test('source catalogue and query compiler agree that repeated or structured metrics are unsupported',async()=>{
  for(const field of [{name:'clicks',type:'INT64',mode:'REPEATED'},{name:'clicks',type:'RECORD',fields:[{name:'count',type:'INT64'}]}]){
    const f=fixture(),original=f.access.metadata;
    f.access.metadata=async table=>{
      const meta=await original(table);
      if(table===sourceTable(scope.clientId,'marketing'))meta.schema!.fields=meta.schema!.fields!.map(existing=>existing.name==='clicks'?field:existing);
      return meta;
    };
    const catalogue=await sourceCatalogue(scope.clientId,f.access);
    assert.equal(catalogue.sources.find(s=>s.role==='marketing')!.metrics.find(m=>m.id==='clicks')!.status,'FIELD_UNSUPPORTED');
    const compiled=compileSourceMetrics('marketing',scope,await f.access.metadata(sourceTable(scope.clientId,'marketing')!));
    assert.equal(compiled.available[2],false);assert.doesNotMatch(compiled.query,/s\.`clicks`/);
  }
});
test('structured grouping and filter fields fail before sending invalid casts to BigQuery',()=>{
  const marketing=metadata('marketing');marketing.schema!.fields=marketing.schema!.fields!.map(field=>field.name==='channel'?{name:'channel',type:'RECORD',fields:[{name:'id',type:'STRING'}]}:field);
  assert.throws(()=>compileSourceMetrics('marketing',scope,marketing,'channel'),e=>e instanceof RequestError&&e.status===422);
  const calls=metadata('calls');calls.schema!.fields=calls.schema!.fields!.map(field=>field.name==='vendor'?{name:'vendor',type:'JSON'}:field);
  assert.throws(()=>compileSourceMetrics('calls',{...scope,filters:{vendor:{operator:'equals',value:'MTN'}}},calls),e=>e instanceof RequestError&&e.status===422);
});
test('incompatible source dates are reported as schema gaps in the catalogue',async()=>{
  const f=fixture(),original=f.access.metadata;
  f.access.metadata=async table=>{const meta=await original(table);if(table===sourceTable(scope.clientId,'marketing'))meta.schema!.fields=meta.schema!.fields!.map(field=>field.name==='date'?{name:'date',type:'INT64'}:field);return meta;};
  const result=await sourceCatalogue(scope.clientId,f.access),marketing=result.sources.find(s=>s.role==='marketing')!;
  assert.equal(marketing.status,'SCHEMA_GAP');assert.match(marketing.reason!,/Incompatible date fields: date/);
});
test('nested HLC vendor arrays are not cast to scalar vendor identifiers',()=>{
  const leads=metadata('leads'),hlc=leads.schema!.fields!.find(field=>field.name==='hlc_details')!;
  hlc.fields!.find(field=>field.name==='vendor')!.mode='REPEATED';
  assert.throws(()=>compileSourceMetrics('leads',{...scope,filters:{vendor:{operator:'equals',value:'MTN'}}},leads),e=>e instanceof RequestError&&e.status===422);
});
test('absent date mapping rejects the query instead of ignoring the date selection',()=>{
  assert.throws(()=>compileSourceMetrics('timeToDial',scope,{schema:{fields:[]}}),e=>e instanceof RequestError&&e.status===422);
});
test('invalid and missing dates are rejected before a source query is compiled',()=>{
  assert.throws(()=>compileSourceMetrics('leads',{...scope,startDate:'2026-02-30'},metadata('leads')));
  assert.throws(()=>compileSourceMetrics('leads',{...scope,startDate:undefined},metadata('leads')));
});
test('source, vendor and medium restrictions are not silently ignored by unrelated tables',()=>{
  assert.throws(()=>compileSourceMetrics('marketing',{...scope,filters:{vendor:{operator:'in',values:['MTN']}}},metadata('marketing')),e=>e instanceof RequestError&&e.status===422);
  assert.throws(()=>compileSourceMetrics('calls',{...scope,filters:{source:{operator:'equals',value:'A'}}},metadata('calls')));
});
test('vendor filters on calls bind values, never interpolate user SQL',()=>{
  const value="x' OR TRUE --";const q=compileSourceMetrics('calls',{...scope,filters:{vendor:{operator:'in',values:[value]}}},metadata('calls'));
  assert.ok(!q.query.includes(value));assert.ok(Object.values(q.params).includes(value));
});
test('lead vendor filtering uses EXISTS without multiplying source rows',()=>{
  const q=compileSourceMetrics('leads',{...scope,filters:{vendor:{operator:'in',values:['MTN']}}},metadata('leads'));
  assert.match(q.query,/EXISTS \(SELECT 1 FROM UNNEST/);assert.doesNotMatch(q.query,/CROSS JOIN/);
});
test('unsupported grouping cannot become a SQL identifier',()=>{
  assert.throws(()=>compileSourceMetrics('marketing',scope,metadata('marketing'),'channel; DROP TABLE'));
});
test('source counts and large expected amounts preserve exact strings',async()=>{
  const f=fixture(),original=f.access.execute;f.access.execute=async o=>{const r=await original(o);r.rows[0].m2_value='9007199254740993.01';return r;};
  const r=await getSourceMetrics('activations',scope,f.access);assert.equal(r.metrics[2].value,'9007199254740993.01');
});
test('partial numeric values are not presented as a complete sum',async()=>{
  const f=fixture(),original=f.access.execute;f.access.execute=async o=>{const r=await original(o);r.rows[0].m2_value='150';r.rows[0].m2_missing='1';return r;};
  const r=await getSourceMetrics('activations',scope,f.access);assert.equal(r.metrics[2].value,null);assert.equal(r.metrics[2].recordedSubtotal,'150');assert.equal(r.metrics[2].status,'PARTIAL');
});
test('numeric precision contract rejects warehouse numbers instead of rounding silently',async()=>{
  const f=fixture(),original=f.access.execute;f.access.execute=async o=>{const r=await original(o);r.rows[0].m0_value=9007199254740992;return r;};
  await assert.rejects(getSourceMetrics('calls',scope,f.access),/precision/);
});
test('canonical metric dependencies do not substitute raw HLC rows for released facts',()=>{
  const result=metricTableLineage(scope.clientId);assert.equal(result.versioned.length,12);assert.ok(result.versioned.every(m=>m.tables.every(t=>t.table===null)));
  assert.equal(result.versioned.find(m=>m.metricId==='call_attempts')!.requiredFacts.join(','),'leads,deliveries,calls');
});
test('parameter coverage reports actual missing fields and keeps population unknown',async()=>{
  const c=await parameterCoverage(scope.clientId,fixture().access);assert.equal(c.summary.populated,null);assert.equal(c.summary.populationStatus,'NOT_MEASURED');assert.ok(c.summary.unavailable>0);assert.ok(c.parameters.every(p=>p.status!=='MAPPED'));
});
test('empty warehouse result set returns zero metrics without 502 error',async()=>{
  const f=fixture();
  f.access.execute=async()=>({rows:[],jobId:'empty-job',referencedTables:[sourceTable(scope.clientId,'marketing')!],bytesProcessed:'0'});
  const result=await getSourceMetrics('marketing',scope,f.access,'channel');
  assert.equal(result.metrics[0].value,'0');
  assert.equal(result.groups.length,0);
  assert.equal(result.queryJobId,'empty-job');
});

test('all source metrics, acquisition and tenant/role checks operate over HTTP',async()=>{
  const f=fixture(),app=express();app.use((q,r,n)=>{if(!q.get('x-test-anonymous'))r.locals.principal={subject:'fixture',role:q.get('x-test-role')||'admin',tenants:q.get('x-test-deny')?[]:['default_tenant']};n();});
  app.use('/api/analytics',createSourceRouter(()=>f.access));app.use((e:any,_q:any,r:any,_n:any)=>r.status(e instanceof RequestError?e.status:500).json({success:false,error:e.message}));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as any).port}/api/analytics`;
  const query='?clientId=default_tenant&startDate=2026-08-01&endDate=2026-08-31';
  try{
    for(const role of SOURCE_ROLES){const r=await fetch(`${base}/source-metrics/${role}${query}`);assert.equal(r.status,200);const b=await r.json();assert.equal(b.data.role,role);assert.equal(b.data.metrics[0].value,'0');}
    const a=await fetch(`${base}/acquisition${query}`);assert.equal(a.status,200);const b=await a.json();assert.equal(b.data.spend,null);assert.equal(b.data.financialStatus,'SPEND_AND_ATTRIBUTION_MAPPING_REQUIRED');
    assert.equal((await fetch(base+'/source-coverage'+query)).status,200);
    assert.equal((await fetch(base+'/source-coverage'+query,{headers:{'x-test-role':'viewer'}})).status,403);
    assert.equal((await fetch(base+'/source-metrics/leads'+query,{headers:{'x-test-anonymous':'1'}})).status,401);
    assert.equal((await fetch(base+'/source-metrics/leads'+query,{headers:{'x-test-deny':'1'}})).status,403);
    assert.equal((await fetch(base+'/source-metrics/arbitrary'+query)).status,404);
    assert.equal(f.queries.length,6);
  }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});

test('optional source relations never fall back to another tenant table',async()=>{
  const {configuredRelation}=await import('../server/bigquery/sourceSql');const {getClientConfig}=await import('../server/bigquery/config');
  const c=structuredClone(getClientConfig('default_tenant'));delete c.semanticMappings.tables.calls;delete c.semanticMappings.tables.activations;
  assert.match(configuredRelation(c,'calls'),/WHERE FALSE/);assert.match(configuredRelation(c,'activations'),/WHERE FALSE/);
  assert.doesNotMatch(configuredRelation(c,'calls'),/dashboards-422710/);
  c.semanticMappings.tables.calls='other_project.unknown.calls';assert.throws(()=>configuredRelation(c,'calls'));
});
test('missing vendor identity does not join one lead to every dialler vendor',async()=>{
  const {getBaseSemanticLayer}=await import('../server/bigquery/views');const {getClientConfig}=await import('../server/bigquery/config');
  const sql=getBaseSemanticLayer(getClientConfig('default_tenant'));assert.doesNotMatch(sql,/t.hlc_vendor = v.vendor OR t.hlc_vendor IS NULL/);
});
