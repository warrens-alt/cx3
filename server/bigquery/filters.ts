/** One validated filter contract for the API, analytical SQL and exports. */
export {
  type FilterOperator,
  type Scalar,
  type FilterCondition,
  type Filters,
  type QueryScope,
  RequestError,
  FIELD_TYPES,
  OPERATORS,
  scalarString,
  validateDate,
  validateFilters,
  validateScope,
  boundedInteger,
} from '../../contracts/filters';
import {
  type FilterCondition,
  type QueryScope,
  type Scalar,
  RequestError,
  validateScope,
} from '../../contracts/filters';

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
