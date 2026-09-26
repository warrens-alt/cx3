/** Explicit administrative command. No warehouse writes occur without --execute. Never called by the web server. */
import 'dotenv/config';
import fs from 'node:fs';
import { BigQuery } from '@google-cloud/bigquery';
import { ENGINE_HASH } from '../server/reporting/buildStamp';
import { FACTS, MODEL_VERSION, METRIC_VERSION, type ReleaseManifest, type SourceEvidence } from '../contracts/reporting';
import { releaseCheckQueries } from '../server/reporting/checks';
import { validateRelease } from '../server/reporting/release';
import { tableIdentifier } from '../server/bigquery/config';
import { isoTimestamp } from '../server/reporting/scope';
const args = process.argv.slice(2), option = (key:string) => { const i=args.indexOf(key); return i<0 ? undefined : args[i+1]; };
async function main() {
  const file=option('--manifest'); if (!file) throw new Error('Use --manifest approved-inputs.json [--execute]');
  const input=JSON.parse(fs.readFileSync(file,'utf8'));
  if (!/^r[a-z0-9_]{5,63}$/.test(input.releaseId) || !/^[A-Za-z0-9_-]{1,80}$/.test(input.tenantId)) throw new Error('Invalid release or tenant');
  const candidate=String(input.candidateDataset), reporting=String(input.reportingDataset);
  if (![candidate,reporting].every(s=>/^[A-Za-z0-9_-]+\.[A-Za-z0-9_]+$/.test(s)) || candidate===reporting || !candidate.split('.')[1].startsWith('cx_candidate_')) throw new Error('Use a unique cx_candidate_<build> dataset and a separate reporting dataset');
  if (!input.approvedBy || !input.approvalReference || !Array.isArray(input.sources)) throw new Error('Approved source evidence is required');
  const cutoff=isoTimestamp(input.cutoff,'cutoff');
  console.info(JSON.stringify({ operation:'publish_checked_snapshots',candidate,reporting,releaseId:input.releaseId,cutoff,execute:args.includes('--execute') }));
  if (!args.includes('--execute')) return;
  const bq=new BigQuery({projectId:reporting.split('.')[0]});
  const query=async (sql:string,params:Record<string,unknown>={})=>{const [job]=await bq.createQueryJob({query:sql,params,maximumBytesBilled:'1000000000'});const [rows]=await job.getQueryResults();return {rows,jobId:job.id!};};
  const existing=await query(`SELECT release_id FROM \`${reporting}.reporting_releases\` WHERE tenant_id=@tenant AND release_id=@id`,{tenant:input.tenantId,id:input.releaseId});
  if (existing.rows.length) throw new Error('Release IDs cannot be reused, including revoked releases');
  const clock=await query('SELECT CAST(CURRENT_TIMESTAMP() AS STRING) AS now');
  const snapshotTime=new Date(clock.rows[0].now).toISOString();
  const snapshots:any={}, provenance:any={};
  const tables=[...FACTS.map(f=>({key:f,source:`fact_${f}`,target:snapshots})),...['records','batches','contracts'].map((k,i)=>({key:k,source:['raw_scope','batch_scope','contract_scope'][i],target:provenance}))];
  // Snapshots are created BEFORE validation; checks subsequently read exactly those frozen objects.
  for(const t of tables){
    const destination=`${reporting}.${input.releaseId}_${t.key}`;
    await query(`CREATE SNAPSHOT TABLE ${tableIdentifier(destination)} CLONE ${tableIdentifier(`${candidate}.${t.source}`)} FOR SYSTEM_TIME AS OF TIMESTAMP(@snapshotTime)`,{snapshotTime});
    const [project,dataset,id]=destination.split('.');const [m]=await bq.dataset(dataset,{projectId:project}).table(id).getMetadata();
    if(m.type!=='SNAPSHOT')throw new Error('Publisher did not create a read-only snapshot');
    t.target[t.key]={table:destination,createdAt:new Date(Number(m.creationTime)).toISOString(),snapshotTime:new Date(m.snapshotDefinition.snapshotTime).toISOString()};
  }
  const batchResult=await query(`SELECT DISTINCT batch_id FROM ${tableIdentifier(provenance.batches.table)} WHERE tenant_id=@tenant ORDER BY batch_id`,{tenant:input.tenantId});
  const manifest:ReleaseManifest={releaseId:input.releaseId,tenantId:input.tenantId,modelVersion:MODEL_VERSION,metricVersion:METRIC_VERSION,engineHash:ENGINE_HASH,status:'PUBLISHED',builtAt:snapshotTime,cutoff,
    sourceBatchIds:batchResult.rows.map(r=>r.batch_id),snapshots,provenance,sources:input.sources as SourceEvidence[],checks:[],approvedBy:input.approvedBy,approvalReference:input.approvalReference};
  for(const [id,sql]of Object.entries(releaseCheckQueries(manifest))){
    const result=await query(sql,{tenant:input.tenantId,cutoff});
    const observed=String(result.rows[0]?.failures ?? 'missing');
    manifest.checks.push({id,status:observed==='0'?'PASS':'FAIL',observed,expected:'0',jobId:result.jobId});
    if(observed!=='0')throw new Error(`Release blocked: ${id} returned ${observed}. Unpublished snapshots are retained for investigation.`);
  }
  validateRelease(manifest);
  // Persist the manifest last. Unique snapshot names make concurrent publication of the same ID fail.
  await query(`INSERT INTO \`${reporting}.reporting_releases\` (tenant_id,release_id,status,published_at,manifest) VALUES(@tenant,@id,'PUBLISHED',CURRENT_TIMESTAMP(),PARSE_JSON(@manifest))`,{tenant:manifest.tenantId,id:manifest.releaseId,manifest:JSON.stringify(manifest)});
  fs.writeFileSync(`${file}.published.json`,JSON.stringify(manifest,null,2));
  console.info(`Published ${manifest.releaseId} with ${manifest.checks.length} independently executed warehouse checks.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
