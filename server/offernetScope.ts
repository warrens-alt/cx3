import { RequestError, validateFilters, type Filters } from './bigquery/filters';
import type { OffernetQueryParams } from './analytics/common/types';

/** Construct canonical Filters representation from validated operational scalar values. */
export function canonicalOperationalFilters(values: Record<string, string>): Filters {
  const filters: Filters = {};
  for (const [key, value] of Object.entries(values)) {
    if (value && typeof value === 'string' && value.trim()) {
      filters[key] = { operator: 'equals', value: value.trim() };
    }
  }
  return filters;
}

/** Current operational SQL accepts one equality value per supported dimension. */
export function operationalFilterValues(input: Filters | undefined, path: string): Record<string, string> {
  const filters = validateFilters(input);
  const allowed = new Set(['vendor', 'source', 'medium', 'grade']);
  if (['/offernet/campaigns', '/offernet/commercial', '/offernet/marketing-attribution', '/offernet/marketing-root-cause'].includes(path)) {
    for (const dimension of ['campaign', 'channel', 'adset']) allowed.add(dimension);
  }
  if (path === '/offernet/agent-performance') {
    allowed.clear(); allowed.add('vendor');
    if (path === '/offernet/agent-performance') allowed.add('agent');
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

/**
 * Normalizes operational query parameters and enforces consistency between scalar properties
 * (vendor, source, medium, grade) and structured filters. Rejects conflicting representations.
 */
export function normalizeOperationalParams(
  params: OffernetQueryParams,
  path = '/offernet/raw-leads'
): { params: OffernetQueryParams; effectiveFilters: Filters; filterValues: Record<string, string> } {
  const filterValues = params.filters ? operationalFilterValues(params.filters, path) : {};

  // Check scalar properties on params and reconcile with filterValues
  const dimensions = ['vendor', 'source', 'medium', 'grade'] as const;
  for (const dim of dimensions) {
    const rawVal = params[dim];
    if (rawVal !== undefined && rawVal !== null && typeof rawVal === 'string') {
      const trimmed = rawVal.trim();
      if (trimmed && !['all', `all ${dim}s`, 'all vendors', 'all sources', 'all grades', 'undefined', 'null'].includes(trimmed.toLowerCase())) {
        if (filterValues[dim] !== undefined && filterValues[dim] !== trimmed) {
          throw new RequestError(`Conflicting ${dim} selections`, 422);
        }
        filterValues[dim] = trimmed;
      }
    }
  }

  // Handle partner / ror_partner aliases if present on params
  for (const alias of ['partner', 'ror_partner']) {
    const rawVal = (params as Record<string, any>)[alias];
    if (rawVal !== undefined && rawVal !== null && typeof rawVal === 'string') {
      const trimmed = rawVal.trim();
      if (trimmed && !['all', 'all vendors', 'undefined', 'null'].includes(trimmed.toLowerCase())) {
        if (filterValues.vendor !== undefined && filterValues.vendor !== trimmed) {
          throw new RequestError('Conflicting vendor selections', 422);
        }
        filterValues.vendor = trimmed;
      }
    }
  }

  const effectiveFilters = canonicalOperationalFilters(filterValues);
  const normalizedParams: OffernetQueryParams = {
    ...params,
    vendor: filterValues.vendor || undefined,
    source: filterValues.source || undefined,
    medium: filterValues.medium || undefined,
    grade: filterValues.grade || undefined,
    filters: effectiveFilters,
  };

  return { params: normalizedParams, effectiveFilters, filterValues };
}
