import { COUNT_KEYS, COLOURS, MISSING_CLASS, MISSING_COLOUR, MULTIPLE_COLOURS, UNMAPPED_COLOUR, type VettingInterval } from '../../contracts/vetting';
import { getClientConfig, tableIdentifier } from '../bigquery/config';
import { conditionSql, RequestError, scalarString, validateScope, type QueryScope, type Scalar } from '../bigquery/filters';
import { flatSchema, type TableMetadata } from '../bigquery/sourceAccess';
import { validTimestampSql } from '../bigquery/integrity';

export interface VettingInput extends QueryScope { interval?: unknown; classValue?: unknown; colourValue?: unknown; }
const literal = (s: string) => `'${s.replace(/'/g,"''")}'`;
const column = (field: string, alias: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) throw new RequestError('Invalid vetting field mapping', 503);
  return `${alias}.\`${field}\``;
};
export function vettingScope(input: VettingInput) {
  const scope = validateScope(input), interval = scalarString(input.interval, 'interval') || 'day';
  if (!scope.startDate || !scope.endDate) throw new RequestError('Vetting requires an explicit start and end date; all-time scope is not supported for this report.', 422);
  if (!['day', 'week', 'month'].includes(interval)) throw new RequestError('Choose day, week or month');
  const days = (Date.parse(scope.endDate) - Date.parse(scope.startDate)) / 86400000 + 1;
  if (days > 366) throw new RequestError('Vetting reports support at most 366 inclusive days');
  return {...scope, startDate: scope.startDate, endDate: scope.endDate, days, interval: interval as VettingInterval,
    previousStart: new Date(Date.parse(scope.startDate) - days * 86400000).toISOString().slice(0, 10),
    previousEnd: new Date(Date.parse(scope.startDate) - 86400000).toISOString().slice(0, 10),
    classValue: scalarString(input.classValue, 'classValue') || null, colourValue: scalarString(input.colourValue, 'colourValue') || null};
}
export function compileVetting(input: VettingInput, metadata: TableMetadata) {
  const scope = vettingScope(input), client = getClientConfig(scope.clientId);
  if (client.dataSourceMode !== 'separate') throw new RequestError('Vetting requires verified tenant-isolated source tables', 503);
  const schema = flatSchema(metadata.schema?.fields || []), fieldMap = client.semanticMappings.fields;
  const scalar = (field: string) => {const f = schema.get(field); return !!f && !f.repeated && !['RECORD','STRUCT','JSON','BYTES','GEOGRAPHY'].includes(f.type);};
  const hlc = (field: string) => metadata.schema?.fields?.find(f=>f.name==='hlc_details')?.fields?.find(f=>f.name===field)?.mode!=='REPEATED' && !!schema.get('hlc_details')?.repeated && ['RECORD','STRUCT'].includes(schema.get('hlc_details')!.type) && !!schema.get(`hlc_details.${field}`) && !['RECORD','STRUCT','JSON','BYTES'].includes(schema.get(`hlc_details.${field}`)!.type);
  const fields: Record<string, {sourceField: string; available: boolean}> = {};
  const field = (name: string, fallback: string) => {const sourceField = fieldMap[name] || fallback; column(sourceField, 's'); fields[name] = {sourceField, available: scalar(sourceField)}; return sourceField;};
  const grade = field('leadClass', 'offershop_grade'), colour = field('leadColour', 'offershop_color_vetting');
  const gradeDate = field('leadClassDate', 'offershop_grade_date'), colourDate = field('leadColourDate', 'offershop_color_vetting_date');
  for (const f of ['lead_id','fetched','offershop_source','offernet_medium','valid_lead','valid_idno','phone_valid']) fields[f] = {sourceField:f, available:scalar(f)};
  if (!scalar('lead_id') || !['STRING','DATE','DATETIME','TIMESTAMP'].includes(schema.get('fetched')?.type || '')) throw new RequestError('Vetting needs lead_id and fetched mappings', 422);
  const text = (f: string) => scalar(f) ? `NULLIF(TRIM(CAST(${column(f, 's')} AS STRING)), '')` : 'CAST(NULL AS STRING)';
  const bool = (f: string) => `CASE LOWER(${text(f)}) WHEN 'true' THEN TRUE WHEN '1' THEN TRUE WHEN 'false' THEN FALSE WHEN '0' THEN FALSE ELSE NULL END`;
  const hFields = ['vendor','delivered','first_call_date','rpc','sale','activated'];
  for (const f of hFields) fields[`hlc.${f}`] = {sourceField:`hlc_details.${f}`, available:hlc(f)};
  const hText = (f: string) => hlc(f) ? `NULLIF(TRIM(CAST(${column(f,'h')} AS STRING)), '')` : 'CAST(NULL AS STRING)';
  const hProjection = hFields.map(f => `${hText(f)} AS ${f}`).join(', ');
  fields.hlcRecords={sourceField:'hlc_details',available:!!schema.get('hlc_details')?.repeated&&['RECORD','STRUCT'].includes(schema.get('hlc_details')!.type)};
  const hArray = schema.get('hlc_details')?.repeated && ['RECORD','STRUCT'].includes(schema.get('hlc_details')!.type)
    ? `ARRAY(SELECT AS STRUCT ${hProjection} FROM UNNEST(s.hlc_details) h)`
    : `ARRAY<STRUCT<${hFields.map(f => `${f} STRING`).join(', ')}>>[]`;
  const params: Record<string,Scalar> = {startDate:scope.startDate,endDate:scope.endDate,previousStart:scope.previousStart};
  const filters: string[] = [], vendor = scope.filters?.vendor;
  const filterFields: Record<string, [string, string]> = {
    source:['source','offershop_source'],medium:['medium','offernet_medium'],grade:['class_raw','leadClass'],vetting:['vetting_legacy','leadColour'],
    lead_id:['lead_id','lead_id'],valid_lead:['valid','valid_lead'],valid_idno:['valid_id','valid_idno'],phone_valid:['valid_phone','phone_valid'],
    delivered:['delivered','hlc.delivered'],has_delivery:['delivered','hlc.delivered'],called:['called','hlc.first_call_date'],has_call:['called','hlc.first_call_date'],
    rpc:['rpc','hlc.rpc'],has_rpc:['rpc','hlc.rpc'],sale:['sales','hlc.sale'],sales:['sales','hlc.sale'],has_sale:['sales','hlc.sale'],
    activated:['activations','hlc.activated'],activation:['activations','hlc.activated'],has_activation:['activations','hlc.activated'],
  };
  let vendorPredicate = 'TRUE';
  for (const [key, condition] of Object.entries(scope.filters || {})) {
    if (key === 'vendor') {
      if (!hlc('vendor')) throw new RequestError('Vendor filtering requires an HLC vendor field',422);
      if (!['in','equals'].includes(condition.operator)) throw new RequestError('Use a vendor inclusion filter',422);
      vendorPredicate = conditionSql('h.vendor',condition,'vetting_vendor',params); continue;
    }
    const target = filterFields[key];
    if (!target || !fields[target[1]]?.available) throw new RequestError(`Vetting has no verified ${key} mapping; remove that filter`,422);
    filters.push(conditionSql(target[0],condition,`vetting_${key}`,params));
  }
  if (scope.classValue) { if (!fields.leadClass.available) throw new RequestError('Class mapping unavailable',422); params.classValue=scope.classValue; filters.push('class_name = @classValue'); }
  if (scope.colourValue) { if (!fields.leadColour.available) throw new RequestError('Colour mapping unavailable',422); params.colourValue=scope.colourValue; filters.push('colour_name = @colourValue'); }
  const named = COLOURS.map(c=>literal(c.toLowerCase())).join(',');
  const className = `CASE WHEN class_raw IS NULL THEN ${literal(MISSING_CLASS)} WHEN REGEXP_CONTAINS(class_raw, r'(?i)^(?:class[\\s_-]*)?[A-FU]$') THEN UPPER(REGEXP_EXTRACT(class_raw,r'(?i)([A-FU])$')) ELSE class_raw END`;
  const colourName = `CASE WHEN colour_raw IS NULL THEN ${literal(MISSING_COLOUR)}
    WHEN (SELECT COUNT(DISTINCT LOWER(TRIM(token))) FROM UNNEST(SPLIT(colour_raw, ',')) token WHERE LOWER(TRIM(token)) IN (${named})) > 1 THEN ${literal(MULTIPLE_COLOURS)}
    ${COLOURS.map(c=>`WHEN LOWER(TRIM(SPLIT(colour_raw, ',')[SAFE_OFFSET(0)])) = ${literal(c.toLowerCase())} THEN ${literal(c)}`).join('\n    ')} ELSE ${literal(UNMAPPED_COLOUR)} END`;
  const vendorEvent = (name: string) => `EXISTS(SELECT 1 FROM UNNEST(f.selected_hlc) h WHERE h.vendor=v AND ${validTimestampSql(`h.${name}`)} BETWEEN f.capture_ts AND CURRENT_TIMESTAMP())`;
  const event = (name: string) => `EXISTS(SELECT 1 FROM UNNEST(selected_hlc) h WHERE ${validTimestampSql(`h.${name}`)} BETWEEN capture_ts AND CURRENT_TIMESTAMP())`;
  const expressions: Record<string,string> = {
    leads:'COUNT(*)',classRecorded:'COUNTIF(class_raw IS NOT NULL)',recognisedClass:"COUNTIF(class_name IN ('A','B','C','D','E','F','U'))",
    colourRecorded:'COUNTIF(colour_raw IS NOT NULL)',namedColour:`COUNTIF(colour_name IN (${COLOURS.map(literal).join(',')}))`,
    bothRecorded:`COUNTIF(class_raw IS NOT NULL AND colour_name IN (${COLOURS.map(literal).join(',')}))`,withHlc:'COUNTIF(ARRAY_LENGTH(selected_hlc)>0)',
    valid:'COUNTIF(valid IS TRUE)',invalid:'COUNTIF(valid IS FALSE)',unknownValidity:'COUNTIF(valid IS NULL)',
    delivered:'COUNTIF(delivered)',called:'COUNTIF(called)',rpc:'COUNTIF(rpc)',sales:'COUNTIF(sales)',activations:'COUNTIF(activations)',
    classTimed:'COUNTIF(class_seconds IS NOT NULL)',colourTimed:'COUNTIF(colour_seconds IS NOT NULL)',
    classBeforeCapture:'COUNTIF(class_ts < capture_ts)',colourBeforeCapture:'COUNTIF(colour_ts < capture_ts)',
    classInvalidTime:'COUNTIF(class_date_raw IS NOT NULL AND class_ts IS NULL)',colourInvalidTime:'COUNTIF(colour_date_raw IS NOT NULL AND colour_ts IS NULL)',
    classFutureTime:'COUNTIF(class_ts > CURRENT_TIMESTAMP())',colourFutureTime:'COUNTIF(colour_ts > CURRENT_TIMESTAMP())',
  };
  const dependencies: Record<string,string> = {withHlc:'hlcRecords',classRecorded:'leadClass',recognisedClass:'leadClass',colourRecorded:'leadColour',namedColour:'leadColour',
    valid:'valid_lead',invalid:'valid_lead',unknownValidity:'valid_lead',delivered:'hlc.delivered',called:'hlc.first_call_date',rpc:'hlc.rpc',sales:'hlc.sale',activations:'hlc.activated'};
  for (const key of Object.keys(expressions)) if (key.startsWith('class') && !['classRecorded'].includes(key)) dependencies[key] ||= 'leadClassDate';
  dependencies.recognisedClass = 'leadClass';
  for (const key of Object.keys(expressions)) if (key.startsWith('colour') && key!=='colourRecorded') dependencies[key] ||= 'leadColourDate';
  const aggregates = COUNT_KEYS.map(key => `CAST(${dependencies[key] && !fields[dependencies[key]].available || key==='bothRecorded'&&(!fields.leadClass.available||!fields.leadColour.available) ? 'NULL' : expressions[key]} AS STRING) AS ${key}`).join(',\n');
  const counts = `${aggregates}, CAST(AVG(CAST(class_seconds AS NUMERIC)) AS STRING) AS classMeanSeconds, CAST(AVG(CAST(colour_seconds AS NUMERIC)) AS STRING) AS colourMeanSeconds`;
  const date = scope.interval==='day'?'capture_date':scope.interval==='week'?'DATE_TRUNC(capture_date, WEEK(MONDAY))':'DATE_TRUNC(capture_date, MONTH)';
  const group = (section: string,key: string,series="''") => `STRUCT('${section}' AS section, ${key} AS key, ${series} AS series)`;
  const groups = [group('class','class_name'),group('colour','colour_name'),group('matrix','class_name','colour_name'),
    group('sourceClass',"COALESCE(source,'[No source]')",'class_name'),group('sourceColour',"COALESCE(source,'[No source]')",'colour_name'),
    group('rawClass',`COALESCE(class_raw,${literal(MISSING_CLASS)})`,'class_name'),group('rawColour',`COALESCE(colour_raw,${literal(MISSING_COLOUR)})`,'colour_name'),
    group('trend',`CAST(${date} AS STRING)`),group('trendClass',`CAST(${date} AS STRING)`,'class_name'),group('trendColour',`CAST(${date} AS STRING)`,'colour_name')].join(',\n');
  const diagnostic = (period: string) => `SELECT '${period}' AS period, CAST(COUNT(*) AS STRING) AS sourceRows, CAST(COUNTIF(lead_id IS NULL) AS STRING) AS missingIdRows,
    CAST(COUNT(DISTINCT IF(variants > 1,lead_id,NULL)) AS STRING) AS conflictingLeads,
    CAST(COUNTIF(variants > 1 AND lead_id IS NOT NULL) AS STRING) AS conflictingRows,
    CAST(COUNTIF(variants=1 AND lead_id IS NOT NULL)-COUNT(DISTINCT IF(variants=1,lead_id,NULL)) AS STRING) AS duplicateRowsCollapsed,
    CAST(COUNT(DISTINCT IF(variants=1,lead_id,NULL)) AS STRING) AS eligibleUniqueLeads FROM assessed WHERE period='${period}'`;
  return {scope, fields, table:client.semanticMappings.tables.leads, params, query:`
WITH raw AS (
 SELECT ${text('lead_id')} AS lead_id, ${validTimestampSql(column('fetched','s'))} AS capture_ts,
 ${text('offershop_source')} AS source, ${text('offernet_medium')} AS medium,
 ${text(grade)} AS class_raw, ${text(colour)} AS colour_raw, ${text(gradeDate)} AS class_date_raw, ${text(colourDate)} AS colour_date_raw,
 ${bool('valid_lead')} AS valid, ${bool('valid_idno')} AS valid_id, ${bool('phone_valid')} AS valid_phone, ${hArray} AS all_hlc
 FROM ${tableIdentifier(client.semanticMappings.tables.leads)} s
 WHERE DATE(${validTimestampSql(column('fetched','s'))}) BETWEEN @previousStart AND @endDate
), signed AS (
 SELECT *, TO_HEX(SHA256(TO_JSON_STRING(raw))) AS signature, DATE(capture_ts) AS capture_date,
 IF(DATE(capture_ts)>=@startDate,'current','previous') AS period FROM raw
), assessed AS (
 SELECT *, COUNT(DISTINCT signature) OVER(PARTITION BY lead_id) AS variants,
 ROW_NUMBER() OVER(PARTITION BY lead_id ORDER BY signature) AS duplicate_rank FROM signed
), unique_leads AS (
 SELECT * FROM assessed WHERE lead_id IS NOT NULL AND variants=1 AND duplicate_rank=1
), classified AS (
 SELECT *, ${className} AS class_name, ${colourName} AS colour_name,
 ${validTimestampSql('class_date_raw')} AS class_ts, ${validTimestampSql('colour_date_raw')} AS colour_ts,
 ARRAY(SELECT AS STRUCT h.* FROM UNNEST(all_hlc) h WHERE ${vendorPredicate}) AS selected_hlc,
 CASE WHEN REGEXP_CONTAINS(colour_raw,r'^(Orange|Charcoal|Blue|Green),') THEN SPLIT(colour_raw,',')[SAFE_OFFSET(0)] ELSE colour_raw END AS vetting_legacy
 FROM unique_leads
), facts AS (
 SELECT *, ${event('delivered')} AS delivered, ${event('first_call_date')} AS called,
 EXISTS(SELECT 1 FROM UNNEST(selected_hlc) h WHERE LOWER(h.rpc)='true' OR SAFE_CAST(h.rpc AS NUMERIC)>0) AS rpc,
 ${event('sale')} AS sales, ${event('activated')} AS activations,
 IF(class_ts BETWEEN capture_ts AND CURRENT_TIMESTAMP(), TIMESTAMP_DIFF(class_ts,capture_ts,SECOND),NULL) AS class_seconds,
 IF(colour_ts BETWEEN capture_ts AND CURRENT_TIMESTAMP(), TIMESTAMP_DIFF(colour_ts,capture_ts,SECOND),NULL) AS colour_seconds
 FROM classified ${vendor?'WHERE ARRAY_LENGTH(selected_hlc)>0':''}
), filtered AS (SELECT * FROM facts ${filters.length?`WHERE ${filters.join(' AND ')}`:''}),
current_summary AS (SELECT ${counts} FROM filtered WHERE period='current'),
previous_summary AS (SELECT ${counts} FROM filtered WHERE period='previous'),
vendor_facts AS (
 SELECT f.* REPLACE(
   ARRAY(SELECT AS STRUCT h.* FROM UNNEST(f.selected_hlc) h WHERE h.vendor=v) AS selected_hlc,
   ${vendorEvent('delivered')} AS delivered, ${vendorEvent('first_call_date')} AS called,
   EXISTS(SELECT 1 FROM UNNEST(f.selected_hlc) h WHERE h.vendor=v AND (LOWER(h.rpc)='true' OR SAFE_CAST(h.rpc AS NUMERIC)>0)) AS rpc,
   ${vendorEvent('sale')} AS sales, ${vendorEvent('activated')} AS activations
 ),v AS vendor_key FROM filtered f
 CROSS JOIN UNNEST(ARRAY(SELECT DISTINCT h.vendor FROM UNNEST(f.selected_hlc) h WHERE h.vendor IS NOT NULL)) v
), expanded AS (
 SELECT f.*,g.section,g.key,g.series FROM filtered f CROSS JOIN UNNEST([${groups}]) g
 UNION ALL SELECT f.* EXCEPT(vendor_key),g.section,g.key,g.series FROM vendor_facts f
 CROSS JOIN UNNEST([STRUCT('vendorClass' AS section,vendor_key AS key,class_name AS series),STRUCT('vendorColour' AS section,vendor_key AS key,colour_name AS series)]) g
),
breakdowns AS (SELECT section,period,key,series,${counts} FROM expanded GROUP BY section,period,key,series),
timing_values AS (
 SELECT 'Class' AS kind, class_seconds AS seconds FROM filtered WHERE period='current' AND class_seconds IS NOT NULL
 UNION ALL SELECT 'Colour' AS kind, colour_seconds AS seconds FROM filtered WHERE period='current' AND colour_seconds IS NOT NULL
), percentiles AS (
 SELECT *, PERCENTILE_CONT(CAST(seconds AS NUMERIC), NUMERIC '0.5') OVER(PARTITION BY kind) AS median,
 PERCENTILE_CONT(CAST(seconds AS NUMERIC), NUMERIC '0.9') OVER(PARTITION BY kind) AS p90 FROM timing_values
), timing AS (SELECT kind,CAST(COUNT(*) AS STRING) AS sample,CAST(AVG(CAST(seconds AS NUMERIC)) AS STRING) AS meanSeconds,
 CAST(ANY_VALUE(median) AS STRING) AS medianSeconds,CAST(ANY_VALUE(p90) AS STRING) AS p90Seconds FROM percentiles GROUP BY kind)
SELECT (SELECT AS STRUCT * FROM current_summary) AS \`current\`, (SELECT AS STRUCT * FROM previous_summary) AS \`previous\`,
 ARRAY(SELECT AS STRUCT * FROM breakdowns ORDER BY section,period,key,series LIMIT 10001) AS \`groups\`,
 ARRAY(SELECT AS STRUCT * FROM (${diagnostic('current')} UNION ALL ${diagnostic('previous')})) AS diagnostics,
 ARRAY(SELECT AS STRUCT * FROM timing ORDER BY kind) AS timing,
 CAST(CURRENT_TIMESTAMP() AS STRING) AS generatedAt
`};
}
