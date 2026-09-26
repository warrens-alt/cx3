/** Append a normalized, approved batch. The original input file must be retained by the source owner. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { BigQuery } from '@google-cloud/bigquery';
import { normalizeBatch } from '../server/reporting/ingestion';
const a=process.argv.slice(2), opt=(k:string)=>{const i=a.indexOf(k);return i<0?undefined:a[i+1];};
async function main(){
  const input=opt('--input'),contractFile=opt('--contract'),batch=opt('--batch'),dataset=opt('--dataset');
  if(!input||!contractFile||!batch||!dataset||!/^[A-Za-z0-9_-]+\.cx_[A-Za-z0-9_]+$/.test(dataset))throw new Error('Use --input source.ndjson --contract approved.json --batch stable_id --dataset project.cx_raw [--execute]');
  const contract=JSON.parse(fs.readFileSync(contractFile,'utf8')), bytes=fs.readFileSync(input),checksum=createHash('sha256').update(bytes).digest('hex');
  const records=bytes.toString().split(/\r?\n/).filter(line=>line.trim()).map(line=>JSON.parse(line));
  const rows=normalizeBatch(contract,batch,records,new Date().toISOString());
  console.info(JSON.stringify({batch,checksum,records:rows.length,execute:a.includes('--execute')}));
  if(!a.includes('--execute'))return;
  if(!rows.length)throw new Error('Empty batches need an explicit source-completeness attestation; not inferred here');
  const [project,schema]=dataset.split('.'),bq=new BigQuery({projectId:project});
  const query=async(query:string,params:any={})=>bq.query({query,params,maximumBytesBilled:'1000000000'});
  const [[existing]]=await query(`SELECT checksum,status FROM \`${dataset}.ingestion_batches\` WHERE tenant_id=@tenant AND batch_id=@batch`,{tenant:contract.tenant_id,batch});
  if(existing){if(existing.checksum===checksum&&existing.status==='COMPLETE'){console.info('Previously committed identical batch; no data appended.');return;}throw new Error('Batch ID already exists with a different payload or incomplete state');}
  const [[approved]]=await query(`SELECT COUNT(*) AS n FROM \`${dataset}.source_contracts\` WHERE tenant_id=@tenant AND source_id=@source AND entity_kind=@kind AND contract_version=@version AND status='APPROVED'`,{tenant:contract.tenant_id,source:contract.source_id,kind:contract.entity_kind,version:contract.contract_version});
  if(Number(approved.n)!==1)throw new Error('The source contract must be independently approved in the warehouse registry before ingestion');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cx-ingest-')),file=path.join(dir,'batch.ndjson');
  const staging=`_ingest_${createHash('sha256').update(contract.tenant_id+batch).digest('hex').slice(0,32)}`;
  try{
    fs.writeFileSync(file,rows.map(r=>JSON.stringify(r)).join('\n'));
    const [schemaMetadata]=await bq.dataset(schema).table('raw_records').getMetadata();
    await bq.dataset(schema).table(staging).load(file,{sourceFormat:'NEWLINE_DELIMITED_JSON',schema:schemaMetadata.schema,writeDisposition:'WRITE_EMPTY'});
    await query(`BEGIN TRANSACTION;
      ASSERT (SELECT COUNT(*)=0 FROM \`${dataset}.ingestion_batches\` WHERE tenant_id=@tenant AND batch_id=@batch) AS 'Batch already exists';
      INSERT INTO \`${dataset}.raw_records\` SELECT * FROM \`${dataset}.${staging}\`;
      INSERT INTO \`${dataset}.ingestion_batches\` (tenant_id,batch_id,status,expected_count,accepted_count,completed_at,checksum)
        VALUES(@tenant,@batch,'COMPLETE',@n,@n,CURRENT_TIMESTAMP(),@checksum);
      COMMIT TRANSACTION;`,{tenant:contract.tenant_id,batch,n:rows.length,checksum});
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
  // Retain staging on failure for investigation; never delete a potentially concurrent ingestion's data automatically.
  console.info('Batch committed. Replayed source versions are deduplicated only by the versioned warehouse model; completeness checks remain mandatory.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
