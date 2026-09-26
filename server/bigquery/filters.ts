/** One validated filter contract for the API, analytical SQL and exports. */
export type FilterOperator = 'in' | 'equals' | 'not_equals' | 'between' | 'greater_than' | 'less_than';
export type Scalar = string | number | boolean;
export interface FilterCondition { operator: FilterOperator; values?: Scalar[]; value?: Scalar; min?: number; max?: number; }
export type Filters = Record<string, FilterCondition>;
export interface QueryScope { clientId: string; startDate?: string; endDate?: string; filters?: Filters; }
export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = 'RequestError'; }
}
const FIELD_TYPES: Record<string, 'string' | 'number' | 'boolean'> = {
  source: 'string', vendor: 'string', medium: 'string', grade: 'string', vetting: 'string',
  lead_id: 'string', consumer_id: 'number', partner: 'string', ror_partner: 'string',
  cli: 'string', campaign: 'string',
  calls: 'number', total_calls: 'number', routing_depth: 'number', vendor_count: 'number',
  revenue: 'number', total_revenue: 'number', valid_lead: 'boolean', valid_idno: 'boolean',
  phone_valid: 'boolean', is_revetted: 'boolean', delivered: 'boolean', called: 'boolean',
  rpc: 'boolean', sales: 'boolean', sale: 'boolean', activated: 'boolean', activation: 'boolean',
  has_delivery: 'boolean', has_call: 'boolean', has_rpc: 'boolean', has_sale: 'boolean', has_activation: 'boolean',
};
const OPERATORS = new Set(['in', 'equals', 'not_equals', 'between', 'greater_than', 'less_than']);
export function scalarString(value: unknown, name: string, maxLength = 256): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > maxLength || /[\x00-\x1f]/.test(value)) throw new RequestError(`Invalid ${name}`);
  return value;
}
export function validateDate(value: unknown, name: string): string | undefined {
  const text = scalarString(value, name, 10);
  if (!text) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text) throw new RequestError(`Invalid ${name}; use YYYY-MM-DD`);
  return text;
}
export function validateFilters(input: unknown): Filters {
  if (input === undefined || input === null || input === '') return {};
  let raw = input;
  if (typeof raw === 'string') {
    if (raw.length > 12000) throw new RequestError('Filters are too large');
    try { raw = JSON.parse(raw); } catch { throw new RequestError('Filters must be valid JSON'); }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length > 20) throw new RequestError('Invalid filters');
  const result: Filters = Object.create(null);
  for (const [key, candidate] of Object.entries(raw)) {
    if (!Object.hasOwn(FIELD_TYPES, key)) throw new RequestError(`Unsupported filter: ${key}`);
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new RequestError(`Invalid filter: ${key}`);
    const f = candidate as FilterCondition;
    if (!OPERATORS.has(f.operator)) throw new RequestError(`Unsupported operator for ${key}`);
    const type = FIELD_TYPES[key];
    const check = (value: unknown): Scalar => {
      if (typeof value !== type || (typeof value === 'string' && (value.length > 256 || /[\x00-\x1f]/.test(value))) || (typeof value === 'number' && !Number.isFinite(value))) throw new RequestError(`Invalid value for ${key}`);
      return value as Scalar;
    };
    if (f.operator === 'in') {
      if (!Array.isArray(f.values) || f.values.length === 0 || f.values.length > 50) throw new RequestError(`Invalid values for ${key}`);
      result[key] = { operator: 'in', values: [...new Set(f.values.map(check))] };
    } else if (f.operator === 'between') {
      if (type !== 'number' || typeof f.min !== 'number' || typeof f.max !== 'number') throw new RequestError(`Invalid range for ${key}`);
      check(f.min); check(f.max);
      if (f.min > f.max) throw new RequestError(`Reversed range for ${key}`);
      result[key] = { operator: 'between', min: f.min, max: f.max };
    } else {
      if (['greater_than', 'less_than'].includes(f.operator) && type !== 'number') throw new RequestError(`Invalid comparison for ${key}`);
      result[key] = { operator: f.operator, value: check(f.value) };
    }
  }
  return result;
}
export function validateScope(input: { clientId?: unknown; startDate?: unknown; endDate?: unknown; filters?: unknown }): QueryScope {
  const clientId = scalarString(input.clientId, 'clientId', 80) || 'default_tenant';
  if (!/^[a-zA-Z0-9_-]+$/.test(clientId)) throw new RequestError('Invalid clientId');
  const startDate = validateDate(input.startDate, 'startDate');
  const endDate = validateDate(input.endDate, 'endDate');
  if (startDate && endDate && startDate > endDate) throw new RequestError('startDate must not be after endDate');
  return { clientId: clientId === 'default' ? 'default_tenant' : clientId, startDate, endDate, filters: validateFilters(input.filters) };
}
export function boundedInteger(value: unknown, fallback: number, max: number, min = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  if (!['number', 'string'].includes(typeof value) || !/^\d+$/.test(String(value))) throw new RequestError('Invalid integer');
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new RequestError(`Integer must be between ${min} and ${max}`);
  return n;
}
const LEAD_FIELDS: Record<string, string> = {
  source: 'source', vendor: 'vendor', medium: 'medium', grade: 'grade', vetting: 'vetting',
  lead_id: 'CAST(lead_id AS STRING)', consumer_id: 'consumer_id', calls: 'total_calls', total_calls: 'total_calls',
  routing_depth: 'routing_depth', vendor_count: 'vendor_count', revenue: 'total_revenue', total_revenue: 'total_revenue',
  valid_lead: 'valid_lead', valid_idno: 'valid_idno', phone_valid: 'phone_valid', is_revetted: 'is_revetted',
  delivered: 'has_delivery', called: 'has_call', rpc: 'has_rpc', sales: 'has_sale', sale: 'has_sale',
  activated: 'has_activation', activation: 'has_activation', has_delivery: 'has_delivery', has_call: 'has_call',
  has_rpc: 'has_rpc', has_sale: 'has_sale', has_activation: 'has_activation',
};
export function conditionSql(field: string, f: FilterCondition, prefix: string, params: Record<string, Scalar>): string {
  if (f.operator === 'in') return `${field} IN (${f.values!.map((value, i) => { const name = `${prefix}_${i}`; params[name] = value; return `@${name}`; }).join(', ')})`;
  if (f.operator === 'between') { params[`${prefix}_min`] = f.min!; params[`${prefix}_max`] = f.max!; return `${field} BETWEEN @${prefix}_min AND @${prefix}_max`; }
  params[prefix] = f.value!;
  const operators = { equals: '=', not_equals: '!=', greater_than: '>', less_than: '<' } as const;
  return `${field} ${operators[f.operator as keyof typeof operators]} @${prefix}`;
}
/** Filters a one-row-per-lead view. Vendor predicates scope transactions before this roll-up. */
export function buildLeadWhere(scopeInput: QueryScope): { sql: string; queryParams: Record<string, Scalar> } {
  const scope = validateScope(scopeInput);
  const clauses: string[] = [];
  const queryParams: Record<string, Scalar> = {};
  if (scope.startDate) { clauses.push('capture_date >= @startDate'); queryParams.startDate = scope.startDate; }
  if (scope.endDate) { clauses.push('capture_date <= @endDate'); queryParams.endDate = scope.endDate; }
  Object.entries(scope.filters || {}).forEach(([key, f], i) => {
    if (key === 'vendor') {
      clauses.push(`EXISTS (SELECT 1 FROM vw_lead_vendor_transactions v WHERE v.lead_id = vw_leads.lead_id AND ${conditionSql('v.vendor', f, `filter_${i}`, queryParams)})`);
    } else if (key === 'partner' || key === 'ror_partner') {
      clauses.push(`EXISTS (SELECT 1 FROM vw_ror_events r WHERE r.lead_id = vw_leads.lead_id AND ${conditionSql('r.partner', f, `filter_${i}`, queryParams)})`);
    } else if (LEAD_FIELDS[key]) {
      clauses.push(conditionSql(LEAD_FIELDS[key], f, `filter_${i}`, queryParams));
    } else {
      throw new RequestError(`Filter '${key}' is not supported at lead grain`, 422);
    }
  });
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', queryParams };
}
