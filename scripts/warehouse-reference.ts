/** Opt-in real BigQuery execution against SYNTHETIC fixtures in a new, isolated test dataset. */
import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { FACTS, METRICS, MODEL_VERSION, METRIC_VERSION, type ReleaseManifest } from '../contracts/reporting';
import { ENGINE_HASH } from '../server/reporting/buildStamp';
import { compileReport, compileEvidence } from '../server/reporting/query';
import { reportRequest } from '../server/reporting/scope';
const args = process.argv.slice(2), option = (key:string) => args[args.indexOf(key)+1];
async function main() {
  if (!args.includes('--project') || !args.includes('--location')) throw new Error('Supply a test --project and --location; --execute is required for cloud writes');
  const project=option('--project'), location=option('--location');
  if(!/^[A-Za-z0-9_-]+$/.test(project))throw new Error('Invalid project');
  if(!args.includes('--execute')){console.log('Plan: create a new cx_validation_* dataset, load synthetic facts, execute production report SQL, compare 48 metric values plus evidence, and remove only this test dataset. No real source tables are accessed.');return;}
  const fixture=JSON.parse(fs.readFileSync('tests/fixtures/reporting-reference.json','utf8'));
  const bq=new BigQuery({projectId:project}), id=`cx_validation_${randomBytes(8).toString('hex')}`;
  const [dataset]=await bq.createDataset(id,{location,defaultTableExpirationMs:'3600000'});
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cx-reference-'));
  const cutoff='2026-09-20T00:00:00.000Z', tenant='default_tenant';
  let checks=0;
  try {
    const snapshots:any={};
    for(const fact of FACTS){
      const name=`fact_${fact}`;const file=path.join(directory,`${fact}.ndjson`);
      fs.writeFileSync(file,fixture[fact].map((r:any)=>JSON.stringify({...r,tenant_id:tenant,source_record_id:r.entity_key,batch_id:'synthetic'})).join('\n')+'\n');
      const fields=[{name:'tenant_id',type:'STRING'},{name:'entity_key',type:'STRING'},{name:'source_record_id',type:'STRING'},{name:'batch_id',type:'STRING'},...Object.keys(fixture[fact][0]).filter(name=>name!=='entity_key').map(name=>({name,type:name.endsWith('_at')?'TIMESTAMP':name==='amount_delta'?'NUMERIC':'STRING'}))];
      await dataset.table(name).load(file,{sourceFormat:'NEWLINE_DELIMITED_JSON',writeDisposition:'WRITE_EMPTY',schema:{fields},location});
      snapshots[fact]={table:`${project}.${id}.${name}`,createdAt:cutoff,snapshotTime:cutoff};
    }
    // Normal tables are used only for this ephemeral SQL test; production ReportService rejects non-SNAPSHOT objects.
    const release={releaseId:'rfixture',tenantId:tenant,modelVersion:MODEL_VERSION,metricVersion:METRIC_VERSION,engineHash:ENGINE_HASH,status:'PUBLISHED',cutoff,builtAt:cutoff,snapshots,
      sources:FACTS.map(fact=>({fact,status:'COMPLETE',completeThrough:cutoff,earliestAvailable:'2026-01-01T00:00:00Z',contractVersion:'synthetic',owner:'test',approvalReference:'synthetic'}))} as ReleaseManifest;
    const variants=[['all',{}],['vendorA',{vendor:['Vendor A']}],['vendorB',{vendor:['Vendor B']}],['organic',{source:['Organic']}]] as const;
    for(const [name,filters] of variants){
      const req=reportRequest({tenantId:tenant,startDate:'2026-08-01',endDate:'2026-08-31',observationCutoff:cutoff,dateBasis:'capture_cohort',grouping:'none',currency:'ZAR',metrics:METRICS.map(m=>m.id),filters});
      const compiled=compileReport(req,release)!;
      const [job]=await bq.createQueryJob({...compiled,location,maximumBytesBilled:'1000000000'});const [rows]=await job.getQueryResults();
      for(const [metric,expected]of Object.entries(fixture.expected[name])){assert.equal(rows.find((r:any)=>r.metric_id===metric&&r.is_total)?.value,expected,`${name}/${metric}`);checks++;}
      console.log(`PASS ${name}: production SQL job ${job.id}`);
      if(name==='all'){const q=compileEvidence(req,release,'call_attempts',null);const[rows]=await bq.query({...q,location,maximumBytesBilled:'1000000000'});assert.deepEqual(rows.map((r:any)=>r.entity_key).sort(),fixture.calls.map((r:any)=>r.entity_key).sort());checks++;}
    }
    console.log(`${checks} real BigQuery SQL fixture checks passed. Synthetic inputs are not proof of live source completeness.`);
  } finally {fs.rmSync(directory,{recursive:true,force:true});await dataset.delete({force:true});}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
