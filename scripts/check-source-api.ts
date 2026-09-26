/** Read-only warehouse source inventory + date-bound aggregate checks. Never publishes a reporting release. */
import fs from 'node:fs';
import path from 'node:path';
import { SOURCE_ROLES } from '../contracts/sourceCoverage';
import { sourceCatalogue } from '../server/bigquery/sourceCatalog';
import { getSourceMetrics } from '../server/bigquery/sourceMetrics';
import { getClientConfig } from '../server/bigquery/config';
import { validateScope } from '../server/bigquery/filters';
import { safeSourceError,sourceAccess } from '../server/bigquery/sourceAccess';
const args=process.argv.slice(2),arg=(key:string)=>args[args.indexOf(key)+1];
async function main(){
  if(!args.includes('--start')||!args.includes('--end'))throw new Error('Use --start YYYY-MM-DD --end YYYY-MM-DD [--tenant default_tenant] [--out result.json]');
  const scope=validateScope({clientId:args.includes('--tenant')?arg('--tenant'):'default_tenant',startDate:arg('--start'),endDate:arg('--end')});
  getClientConfig(scope.clientId);const access=sourceAccess(scope.clientId),catalogue=await sourceCatalogue(scope.clientId,access),checks=[];
  // Sequential, bounded aggregate queries: do not issue raw-row dumps or publish business approvals.
  for(const role of SOURCE_ROLES){try{checks.push({role,status:'QUERIED',data:await getSourceMetrics(role,scope,access)});}catch(e){checks.push({role,...safeSourceError(e)});}}
  const result={catalogue,checks,sourceDataReconciled:false};
  if(args.includes('--out')){const out=path.resolve(arg('--out'));fs.writeFileSync(out,JSON.stringify(result,null,2));console.info(`Source evidence written to ${out}`);}else console.info(JSON.stringify(result,null,2));
  if(checks.some(c=>c.status!=='QUERIED')||!catalogue.inventoryComplete)process.exitCode=1;
}
main().catch((e)=>{console.error(e instanceof Error?e.message:'Source check failed');process.exitCode=1;});
