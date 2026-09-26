/** Explicit schema bootstrap in new datasets. Does not modify the existing Lead Ledger tables. */
import { BigQuery } from '@google-cloud/bigquery';
const a=process.argv.slice(2), read=(k:string)=>a[a.indexOf(k)+1];
async function main(){
  const project=read('--project'), raw=read('--raw'), reporting=read('--reporting'), location=read('--location');
  if(!a.includes('--project')||!a.includes('--raw')||!a.includes('--reporting')||!a.includes('--location')||!/^[a-zA-Z0-9_-]+$/.test(project)||![raw,reporting].every(x=>/^cx_[a-zA-Z0-9_]+$/.test(x))||raw===reporting)throw new Error('Supply --project, --raw cx_raw, --reporting cx_reporting and the confirmed --location');
  const ddl=[
    `CREATE TABLE IF NOT EXISTS \`${project}.${raw}.raw_records\` (tenant_id STRING,source_id STRING,entity_kind STRING,entity_key STRING,source_record_id STRING,revision INT64,recorded_at TIMESTAMP,source_updated_at TIMESTAMP,batch_id STRING,contract_version STRING,payload JSON,payload_hash STRING) PARTITION BY DATE(recorded_at) CLUSTER BY tenant_id,entity_kind`,
    `CREATE TABLE IF NOT EXISTS \`${project}.${raw}.ingestion_batches\` (tenant_id STRING,batch_id STRING,status STRING,expected_count INT64,accepted_count INT64,completed_at TIMESTAMP,checksum STRING)`,
    `CREATE TABLE IF NOT EXISTS \`${project}.${raw}.source_contracts\` (tenant_id STRING,source_id STRING,entity_kind STRING,contract_version STRING,status STRING,owner STRING,approval_reference STRING,semantics STRING)`,
    `CREATE TABLE IF NOT EXISTS \`${project}.${reporting}.reporting_releases\` (tenant_id STRING,release_id STRING,status STRING,published_at TIMESTAMP,manifest JSON)`,
  ];
  if(!a.includes('--execute')){console.log(ddl.join(';\n')+';');return;}
  const bq=new BigQuery({projectId:project});
  for(const dataset of [raw,reporting]){const [exists]=await bq.dataset(dataset).exists();if(!exists)await bq.createDataset(dataset,{location});else{const[m]=await bq.dataset(dataset).getMetadata();if(m.location.toUpperCase()!==location.toUpperCase())throw new Error('Dataset location mismatch');}}
  for(const query of ddl)await bq.query({query,location});
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
