import { LEDGER_COLUMNS, PROCESS_TIMESTAMPS, type LedgerCoverage } from '../../contracts/leadLedgerReplica';

export class LedgerError extends Error {
  constructor(message: string, readonly status = 422) { super(message); }
}
export interface LedgerScope {
  clientId: string; startDate?: string; endDate?: string;
  filters?: Record<string, { operator: string; value?: string | number | boolean; values?: (string | number | boolean)[]; min?: string | number | boolean; max?: string | number | boolean }>;
}
export interface SchemaField { name?: string; type?: string; fields?: SchemaField[] }
export interface LedgerSource {
  table: string; flat: boolean; lead: Map<string, string>; hlc: Map<string, string>; coverage: LedgerCoverage;
}
export interface LedgerOptions { sourceMode?: string; search?: string; limit?: number; offset?: number }
export const MASTER_LEDGER = 'dashboards-422710.lead_ledger.clustered_lead_ledger';
export const RICH_LEDGER = 'dashboards-422710.lead_ledger.view_lead_ledger_using_open_leadger';

export function selectLedgerTable(client: { id: string; dataSourceMode: string; semanticMappings: { tables: { leads: string } } }, mode = 'configured', approved = false) {
  if (client.dataSourceMode !== 'separate') throw new LedgerError('Shared sources require a reviewed row-security contract.', 503);
  if (!['configured', 'rich'].includes(mode)) throw new LedgerError('Unsupported LeadLedger source mode.');
  const richViewEnabled = approved && client.id === 'default_tenant' && client.semanticMappings.tables.leads === MASTER_LEDGER;
  if (mode === 'rich' && !richViewEnabled) throw new LedgerError('The richer master view is not approved for this tenant. A deployment administrator must enable CX_LEAD_LEDGER_RICH_VIEW_APPROVED after verifying read access and scope.', 403);
  return { table: mode === 'rich' ? RICH_LEDGER : client.semanticMappings.tables.leads, richViewEnabled };
}
function identifier(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new LedgerError('Invalid source column identifier.', 503);
  return '`' + name + '`';
}
function tableIdentifier(name: string): string {
  if (!/^[a-zA-Z0-9-]+\.[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new LedgerError('Invalid configured LeadLedger table.', 503);
  return '`' + name + '`';
}
export function inspectLedgerSchema(table: string, fields: SchemaField[], richViewEnabled: boolean): LedgerSource {
  tableIdentifier(table);
  const lead = new Map(fields.filter(f => f.name).map(f => [f.name!.toLowerCase(), f.name!]));
  const nested = fields.find(f => f.name?.toLowerCase() === 'hlc_details');
  const flat = !nested && lead.has('vendor') && lead.has('transaction_id');
  if (!lead.has('lead_id') || !lead.has('fetched') || (!nested && !flat)) throw new LedgerError('The configured source does not supply the required lead and HLC schema.', 503);
  const hlc = flat ? new Map(lead) : new Map((nested?.fields || []).filter(f => f.name).map(f => [f.name!.toLowerCase(), f.name!]));
  const supplied = (column: typeof LEDGER_COLUMNS[number]) => column.scope === 'lead' ? lead.has(column.field)
    : column.scope === 'hlc' ? hlc.has(column.field)
    : column.field === 'vendors' ? hlc.has('vendor') : hlc.has('revenue_generated') && hlc.has('currency');
  const available = LEDGER_COLUMNS.filter(supplied).map(c => c.label);
  const missing = LEDGER_COLUMNS.filter(c => !supplied(c)).map(c => c.label);
  return { table, flat, lead, hlc, coverage: { source: table, available, missing, compatible: missing.length === 0, richViewEnabled } };
}

export function validateLedgerWindow(scope: LedgerScope): { startDate: string; endDate: string } {
  const valid = (date?: string) => Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date);
  if (!valid(scope.startDate) || !valid(scope.endDate)) throw new LedgerError('Select a valid fetched start date and end date for the LeadLedger report.');
  const days = (Date.parse(scope.endDate!) - Date.parse(scope.startDate!)) / 86400000;
  if (days < 0 || days > 365) throw new LedgerError('Use an ordered fetched-date window of at most 366 days.');
  return { startDate: scope.startDate!, endDate: scope.endDate! };
}

/** Explicit approved columns only. No SELECT *, raw identity/contact columns, or enrichment joins. */
export function buildLedgerQuery(source: LedgerSource, scope: LedgerScope, options: LedgerOptions = {}, exportRows = false) {
  const dates = validateLedgerWindow(scope);
  const limit = options.limit ?? 25, offset = options.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000000) throw new LedgerError('Invalid LeadLedger pagination.');
  const search = (options.search || '').trim();
  if (search.length > 200) throw new LedgerError('Search must be 200 characters or fewer.');
  const params: Record<string, string | number | boolean> = { ledgerStart: dates.startDate, ledgerEnd: dates.endDate };
  const raw = (field: string, scope: 'lead' | 'hlc') => {
    const name = (scope === 'lead' ? source.lead : source.hlc).get(field);
    return name ? `CAST(${scope === 'lead' || source.flat ? 'l' : 'h'}.${identifier(name)} AS STRING)` : 'CAST(NULL AS STRING)';
  };
  const processPattern = String.raw`r'^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})?$'`;
  const projections = LEDGER_COLUMNS.flatMap((c, i) => {
    if (c.scope === 'derived') return [];
    const expression = raw(c.field, c.scope);
    return [`${PROCESS_TIMESTAMPS.has(c.field) ? `IF(REGEXP_CONTAINS(${expression}, ${processPattern}), ${expression}, NULL)` : expression} AS c${i}`];
  });
  const redactions = [...PROCESS_TIMESTAMPS].map(field => `IF(${raw(field, 'lead')} IS NOT NULL AND ${raw(field, 'lead')} != '' AND NOT REGEXP_CONTAINS(${raw(field, 'lead')}, ${processPattern}), 1, 0)`).join(' + ');
  const leadPredicates = ['DATE(SAFE_CAST(c5 AS TIMESTAMP)) BETWEEN @ledgerStart AND @ledgerEnd'];
  const vendorPredicates: string[] = [];
  const fields: Record<string, { index: number; field: string; type?: 'BOOL' | 'NUMERIC' }> = {
    source: { index: 4, field: 'offershop_source' }, medium: { index: 25, field: 'offernet_medium' },
    grade: { index: 18, field: 'offershop_grade' }, vetting: { index: 16, field: 'offershop_color_vetting' },
    lead_id: { index: 1, field: 'lead_id' }, consumer_id: { index: 3, field: 'consumer_id', type: 'NUMERIC' },
    valid_idno: { index: 10, field: 'valid_idno', type: 'BOOL' }, phone_valid: { index: 12, field: 'phone_valid', type: 'BOOL' },
    valid_lead: { index: 29, field: 'valid_lead', type: 'BOOL' },
  };
  let parameter = 0;
  const bind = (value: unknown) => {
    if (!['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) throw new LedgerError('Invalid LeadLedger filter value.');
    const key = `ledgerFilter${parameter++}`; params[key] = value as string | number | boolean; return '@' + key;
  };
  for (const [key, filter] of Object.entries(scope.filters || {})) {
    const field = fields[key];
    if (key !== 'vendor' && !field) throw new LedgerError(`Filter '${key}' is not supported by the raw LeadLedger report. Remove it rather than applying an enriched metric to raw data.`);
    if (key === 'vendor' ? !source.hlc.has('vendor') : !source.lead.has(field.field)) throw new LedgerError(`Filter '${key}' is unavailable in this tenant source.`);
    const expression = key === 'vendor' ? 'c45' : field.type ? `SAFE_CAST(c${field.index} AS ${field.type})` : `c${field.index}`;
    let predicate: string;
    if (filter.operator === 'in') {
      if (!filter.values?.length || filter.values.length > 100) throw new LedgerError('Use 1–100 filter values.');
      predicate = `${expression} IN (${filter.values.map(bind).join(', ')})`;
    } else if (filter.operator === 'between') {
      predicate = `${expression} BETWEEN ${bind(filter.min)} AND ${bind(filter.max)}`;
    } else {
      const operators: Record<string, string> = { equals: '=', not_equals: '!=', greater_than: '>', less_than: '<' };
      if (!operators[filter.operator]) throw new LedgerError('Unsupported LeadLedger filter operator.');
      predicate = `${expression} ${operators[filter.operator]} ${bind(filter.value)}`;
    }
    (key === 'vendor' ? vendorPredicates : leadPredicates).push(predicate);
  }
  if (search) {
    params.ledgerSearch = search.toLowerCase();
    leadPredicates.push(`(${[1, 3, 4].map(i => `STRPOS(LOWER(IFNULL(c${i}, '')), @ledgerSearch) > 0`).join(' OR ')})`);
  }
  const hasVendor = source.hlc.has('vendor'), hasRevenue = source.hlc.has('revenue_generated') && source.hlc.has('currency');
  const currency = `COALESCE(NULLIF(TRIM(c62), ''), 'Unknown')`;
  const noHlc = `NULLIF(TRIM(c45), '') IS NULL AND NULLIF(TRIM(c46), '') IS NULL`;
  const columns = LEDGER_COLUMNS.map((_, i) => `c${i}`);
  const body = `WITH raw_rows AS (
    SELECT ${projections.join(',\n      ')}, ${redactions} AS _redactions,
      ${source.flat ? '0' : '_array_offset'} AS _array_offset
    FROM ${tableIdentifier(source.table)} l
    ${source.flat ? '' : `LEFT JOIN UNNEST(l.${identifier(source.lead.get('hlc_details')!)}) AS h WITH OFFSET AS _array_offset ON TRUE`}
  ), cohort AS (
    SELECT r.*, COALESCE(NULLIF(c1, ''), CONCAT('unresolved:', TO_HEX(SHA256(TO_JSON_STRING(r))))) AS _lead_key,
      TO_HEX(SHA256(TO_JSON_STRING(r))) AS _record_fingerprint
    FROM raw_rows r WHERE ${leadPredicates.join(' AND ')}
  ), totals AS (
    SELECT cohort.*,
      ${hasVendor ? `CAST(COUNT(DISTINCT NULLIF(TRIM(c45), '')) OVER (PARTITION BY _lead_key) AS STRING)` : 'CAST(NULL AS STRING)'} AS c0,
      ${hasRevenue ? `CAST(IF(COUNTIF(NOT (${noHlc}) AND (SAFE_CAST(c48 AS NUMERIC) IS NULL OR NULLIF(TRIM(c62), '') IS NULL)) OVER (PARTITION BY _lead_key, ${currency}) > 0, NULL,
        COALESCE(SUM(SAFE_CAST(c48 AS NUMERIC)) OVER (PARTITION BY _lead_key, ${currency}), 0)) AS STRING)` : 'CAST(NULL AS STRING)'} AS c2
    FROM cohort
  ), selected AS (
    SELECT totals.*, IF(NULLIF(TRIM(c45), '') IS NOT NULL AND NULLIF(TRIM(c46), '') IS NOT NULL,
      COUNT(*) OVER (PARTITION BY _lead_key, c45, c46), 1) AS _key_rows
    FROM totals ${vendorPredicates.length ? `WHERE ${vendorPredicates.join(' AND ')}` : ''}
  )`;
  if (exportRows) return {
    query: `${body} SELECT ${columns.map((column, i) => `${column} AS \`${LEDGER_COLUMNS[i].label}\``).join(', ')}
      FROM selected ORDER BY c5 DESC, _lead_key, c45, c46, _array_offset, _record_fingerprint`,
    params, dates, limit, offset, search,
  };
  params.ledgerLimit = limit; params.ledgerOffset = offset;
  return {
    query: `${body}, lead_groups AS (
      SELECT _lead_key, MAX(c5) AS fetched, ARRAY_AGG(STRUCT(${columns.join(', ')}) ORDER BY c45, c46, _array_offset, _record_fingerprint) AS records
      FROM selected GROUP BY _lead_key
    ) SELECT
      ARRAY(SELECT AS STRUCT _lead_key, records FROM lead_groups ORDER BY fetched DESC, _lead_key LIMIT @ledgerLimit OFFSET @ledgerOffset) AS leads,
      (SELECT COUNT(*) FROM lead_groups) AS total_leads,
      (SELECT COUNT(*) FROM selected) AS total_rows,
      (SELECT COUNTIF(${noHlc}) FROM selected) AS lead_only_rows,
      (SELECT COUNTIF(_key_rows > 1) FROM selected) AS duplicate_key_rows,
      (SELECT COALESCE(SUM(_redactions), 0) FROM selected) AS redacted_values,
      ARRAY(SELECT AS STRUCT ${currency} AS currency, CAST(IF(COUNTIF(NOT (${noHlc}) AND NULLIF(TRIM(c62), '') IS NULL) > 0, NULL, SUM(SAFE_CAST(c48 AS NUMERIC))) AS STRING) AS amount,
        COUNTIF(NOT (${noHlc}) AND (SAFE_CAST(c48 AS NUMERIC) IS NULL OR NULLIF(TRIM(c62), '') IS NULL)) AS missing_amounts
        FROM selected GROUP BY currency ORDER BY currency) AS revenue,
      ARRAY(SELECT AS STRUCT COALESCE(NULLIF(c45, ''), 'No vendor record') AS vendor, COUNT(DISTINCT _lead_key) AS leads, COUNT(*) AS \`rows\`
        FROM selected GROUP BY vendor ORDER BY \`rows\` DESC, vendor) AS vendors`,
    params, dates, limit, offset, search,
  };
}
