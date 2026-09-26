import { SOURCE_DEFINITIONS,type SourceMetric,type SourceRole,SOURCE_ROLES } from '../../contracts/sourceCoverage';
import { conditionSql,RequestError,validateScope,type QueryScope,type Scalar } from './filters';
import { flatSchema,sourceAccess,sourceMetricFieldAvailable,type SourceAccess,type TableMetadata } from './sourceAccess';
import { sourceTable } from './sourceCatalog';
import { tableIdentifier } from './config';
import { validTimestampSql } from './integrity';
export interface CompiledSourceMetrics {query:string;params:Record<string,Scalar>;metrics:SourceMetric[];available:boolean[];table:string;dateField:string;grouping:string|null;}
const atom=(name:string)=>{if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))throw new RequestError('Invalid configured field identifier',503);return `s.\`${name}\``;};
const text=(field:string)=>`NULLIF(TRIM(CAST(${atom(field)} AS STRING)), '')`;
function normalized(m:SourceMetric){
  if(!m.field)return 'NULL';const value=text(m.field);
  if(m.operation==='sum')return `SAFE_CAST(${value} AS NUMERIC)`;
  if(m.operation==='true')return `CASE LOWER(${value}) WHEN 'true' THEN TRUE WHEN '1' THEN TRUE WHEN 'false' THEN FALSE WHEN '0' THEN FALSE ELSE NULL END`;
  if(m.operation==='timestamp')return validTimestampSql(atom(m.field));
  return value;
}
export function compileSourceMetrics(role:SourceRole,input:QueryScope,meta:TableMetadata,grouping:string|null=null):CompiledSourceMetrics {
  const scope=validateScope(input),def=SOURCE_DEFINITIONS[role],table=sourceTable(scope.clientId,role);
  if(!table)throw new RequestError('This source is not configured',422);
  const fields=flatSchema(meta.schema?.fields||[]),dateField=def.dateField;
  const dateType=fields.get(dateField);
  if(!dateType||dateType.repeated||!['STRING','TIMESTAMP','DATETIME','DATE'].includes(dateType.type))throw new RequestError(`A compatible ${dateField} mapping is required to honour reporting dates`,422);
  if(!scope.startDate||!scope.endDate)throw new RequestError('Explicit source-metric startDate and endDate are required');
  if(Date.parse(scope.endDate)-Date.parse(scope.startDate)>365*86400000)throw new RequestError('Select at most 366 inclusive days');
  if(grouping && (role!=='marketing'||!['channel'].includes(grouping)))throw new RequestError('Unsupported source grouping');
  if(grouping&&!sourceMetricFieldAvailable(grouping,fields))throw new RequestError(`The ${grouping} field is not available`,422);
  const params:Record<string,Scalar>={startDate:scope.startDate,endDate:scope.endDate};
  const clauses=[`DATE(${validTimestampSql(atom(dateField))}) BETWEEN @startDate AND @endDate`];
  for(const [key,condition]of Object.entries(scope.filters||{})){
    const field=def.filters[key as keyof typeof def.filters];
    if(!field||!fields.has(field))throw new RequestError(`${def.label} has no verified ${key} mapping. That filter cannot be silently ignored.`,422);
    if(field==='hlc_details.vendor'){
      const hlc=meta.schema?.fields?.find(field=>field.name==='hlc_details'),vendor=hlc?.fields?.find(field=>field.name==='vendor');
      if(hlc?.mode!=='REPEATED'||!['RECORD','STRUCT'].includes(hlc.type.toUpperCase()))throw new RequestError('HLC evidence requires a repeated record field',422);
      if(!vendor||!sourceMetricFieldAvailable('vendor',flatSchema([vendor])))throw new RequestError('HLC evidence requires a compatible scalar vendor field',422);
      clauses.push(`EXISTS (SELECT 1 FROM UNNEST(s.hlc_details) h WHERE ${conditionSql('CAST(h.vendor AS STRING)',condition,`source_filter_${key}`,params)})`);
    }else {if(!sourceMetricFieldAvailable(field,fields))throw new RequestError('A compatible scalar filter mapping is required',422);clauses.push(conditionSql(`CAST(${atom(field)} AS STRING)`,condition,`source_filter_${key}`,params));}
  }
  const metrics=def.metrics,available=metrics.map(m=>sourceMetricFieldAvailable(m.field,fields));
  const parts=metrics.flatMap((m,i)=>{
    if(!available[i])return [`CAST(NULL AS STRING) AS m${i}_value`,`CAST(NULL AS STRING) AS m${i}_valid`,`CAST(NULL AS STRING) AS m${i}_invalid`,`CAST(NULL AS STRING) AS m${i}_missing`];
    const v=m.field?normalized(m):'NULL';
    const value=m.operation==='count'?'COUNT(*)':m.operation==='sum'?`IF(COUNT(*)=0, NUMERIC '0', SUM(${v}))`:m.operation==='distinct'?`COUNT(DISTINCT ${v})`:m.operation==='true'?`COUNTIF(${v} IS TRUE)`:`COUNTIF(${v} IS NOT NULL)`;
    return [`CAST(${value} AS STRING) AS m${i}_value`,`CAST(${m.field?`COUNTIF(${v} IS NOT NULL)`:'COUNT(*)'} AS STRING) AS m${i}_valid`,
      `CAST(${m.field?`COUNTIF(${text(m.field)} IS NOT NULL AND ${v} IS NULL)`:'0'} AS STRING) AS m${i}_invalid`,
      `CAST(${m.field?`COUNTIF(${text(m.field)} IS NULL)`:'0'} AS STRING) AS m${i}_missing`];
  });
  const g=grouping?`CAST(${atom(grouping)} AS STRING)`:'CAST(NULL AS STRING)';
  return {table,dateField,grouping,metrics,available,params,query:`SELECT ${grouping?`GROUPING(${g}) = 1`:'TRUE'} AS is_total, ${grouping?g:'CAST(NULL AS STRING)'} AS group_key,
    ${parts.join(',\n    ')}
    FROM ${tableIdentifier(table)} s WHERE ${clauses.join(' AND ')}
    ${grouping?`GROUP BY GROUPING SETS ((), (${g}))`:''} LIMIT 5002`};
}
export async function getSourceMetrics(roleText:string,input:QueryScope,access:SourceAccess=sourceAccess(input.clientId),grouping:string|null=null){
  if(!SOURCE_ROLES.includes(roleText as SourceRole))throw new RequestError('Unknown source role',404);
  const role=roleText as SourceRole,table=sourceTable(input.clientId,role);
  if(!table)throw new RequestError('No configured source table',422);
  const compiled=compileSourceMetrics(role,input,await access.metadata(table),grouping);
  const result=await access.execute({query:compiled.query,params:compiled.params});
  if(result.rows.length>5001)throw new RequestError('Too many source groups; no partial totals were returned',413);
  let totalRow=result.rows.find(r=>r.is_total===true);
  if(!totalRow){
    if(result.rows.length===0){
      totalRow={is_total:true,group_key:null};
      compiled.metrics.forEach((_m,i)=>{totalRow![`m${i}_value`]='0';totalRow![`m${i}_valid`]='0';totalRow![`m${i}_missing`]='0';totalRow![`m${i}_invalid`]='0';});
    }else{
      throw new RequestError('Missing or duplicated source aggregate',502);
    }
  }else if(result.rows.filter(r=>r.is_total===true).length!==1){
    throw new RequestError('Missing or duplicated source aggregate',502);
  }
  const format=(r:Record<string,any>)=>compiled.metrics.map((m,i)=>{
    const v=r[`m${i}_value`],missing=r[`m${i}_missing`],invalid=r[`m${i}_invalid`];
    for(const x of [v,missing,invalid,r[`m${i}_valid`]])if(x!=null&&(typeof x!=='string'||! /^-?\d+(\.\d+)?$/.test(x)))throw new RequestError('Source precision contract violated',502);
    const mapped=compiled.available[i],partial=mapped&&((missing!=null&&BigInt(missing)>0n)||(invalid!=null&&BigInt(invalid)>0n));
    return {id:m.id,label:m.label,unit:m.unit,sourceField:m.field??null,value:!mapped||(m.operation==='sum'&&partial)?null:v??null,
      recordedSubtotal:mapped&&m.operation==='sum'?v??null:null,status:!mapped?'UNAVAILABLE':partial?'PARTIAL':'MEASURED',
      validRows:r[`m${i}_valid`]??null,missingRows:missing??null,invalidRows:invalid??null,
      reason:!mapped?'Mapped field is absent or has an unsupported schema.':partial?'Some selected records have missing or unparseable values; no complete numeric total is claimed.':null,note:m.note??null};
  });
  return {role,table,dateBasis:SOURCE_DEFINITIONS[role].dateMeaning,dateField:compiled.dateField,timezone:'UTC',timezoneVerified:false,
    scope:validateScope(input),metrics:format(totalRow),groups:result.rows.filter(r=>r.is_total!==true).map(r=>({group:r.group_key,metrics:format(r)})),
    dateCoverage:'NOT_MEASURED',populationNote:'Only records with a usable timestamp inside the selected source-date window are included. Records with missing or invalid date values cannot be assigned to that period; their source-wide coverage is not measured here.',
    rowGrain:'physical_source_row',truncated:false,queryJobId:result.jobId,referencedTables:result.referencedTables,bytesProcessed:result.bytesProcessed,
    generatedAt:new Date().toISOString(),validationStatus:'NOT_INDEPENDENTLY_RECONCILED',warning:SOURCE_DEFINITIONS[role].warning};
}
