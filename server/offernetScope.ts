import { RequestError, validateFilters, type Filters } from './bigquery/filters';

/** Current operational SQL accepts one equality value per supported dimension. */
export function operationalFilterValues(input: Filters | undefined, path: string): Record<string, string> {
  const filters = validateFilters(input);
  const allowed = new Set(['vendor', 'source', 'medium', 'grade']);
  if (['/offernet/campaigns', '/offernet/marketing-root-cause'].includes(path)) allowed.add('campaign');
  if (path === '/offernet/agent-performance' || path.startsWith('/offernet/lead-timeline/')) {
    allowed.clear(); allowed.add('vendor');
  }
  if (['/offernet/marketing-discovery', '/offernet/source-observability'].includes(path)) allowed.clear();
  const values: Record<string, string> = {};
  for (const [key, condition] of Object.entries(filters)) {
    const dimension = ['partner', 'ror_partner'].includes(key) ? 'vendor' : key;
    if (!allowed.has(dimension)) throw new RequestError(`This operational report cannot apply the ${key} filter. Remove it or choose a report that supports it.`, 422);
    const selected = condition.operator === 'equals' ? [condition.value] : condition.operator === 'in' ? condition.values : [];
    if (selected?.length !== 1 || typeof selected[0] !== 'string') {
      throw new RequestError(`This operational report requires one equality value for ${key}. Multiple values and comparison operators are not supported.`, 422);
    }
    const value = selected[0].trim();
    if (!value || ['all', 'all vendors', 'all sources', 'all grades', 'undefined', 'null'].includes(value.toLowerCase())) {
      throw new RequestError(`Remove the ${key} condition to select all values.`, 422);
    }
    if (values[dimension] !== undefined && values[dimension] !== value) throw new RequestError(`Conflicting ${dimension} selections`, 422);
    values[dimension] = value;
  }
  return values;
}
