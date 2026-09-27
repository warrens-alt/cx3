import type { FilterCondition, Filters } from '../../contracts/filters';
import { validateFilters } from '../../contracts/filters';
import { privateScopeKeys } from './scopePresentation';

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

export function defaultLegacyDates(now = new Date()): { startDate: string; endDate: string } {
  const endDate = now.toISOString().slice(0, 10);
  const startDate = new Date(Date.parse(endDate) - 29 * 86400000).toISOString().slice(0, 10);
  return { startDate, endDate };
}

export function defaultDateRange(now = new Date()): { start: string; end: string; startDate: string; endDate: string } {
  const { startDate, endDate } = defaultLegacyDates(now);
  return { start: startDate, end: endDate, startDate, endDate };
}

export function readLegacyFilters(params: URLSearchParams): Filters {
  const rawFilters: Record<string, any> = {};

  if (params.has('filters')) {
    const raw = params.get('filters');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.assign(rawFilters, parsed);
        }
      } catch {
        throw new Error('Filters must be valid JSON');
      }
    }
  }

  for (const [key, value] of params.entries()) {
    if (['startDate', 'endDate', 'workspace', 'client', 'clientId', 'filters', 'tab', 'view'].includes(key)) {
      continue;
    }
    if (privateScopeKeys.has(key)) {
      throw new Error('Private record selection is not permitted in URL parameters.');
    }
    if (!Object.hasOwn(FIELD_TYPES, key)) {
      continue;
    }
    if (params.getAll(key).length > 1) {
      throw new Error(`Duplicate parameter: ${key}`);
    }
    if (!value) continue;

    const type = FIELD_TYPES[key];
    if (type === 'boolean' || value === 'true' || value === 'false') {
      rawFilters[key] = { operator: 'equals', value: value === 'true' };
    } else if (key === 'calls' && value.includes('-')) {
      const [minStr, maxStr] = value.split('-');
      const min = Number(minStr);
      const max = Number(maxStr);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
        throw new Error(`Invalid calls range: ${value}`);
      }
      rawFilters[key] = { operator: 'between', min, max };
    } else if (type === 'number' && /^-?\d+(\.\d+)?$/.test(value)) {
      rawFilters[key] = { operator: 'equals', value: Number(value) };
    } else {
      const parts = value.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        rawFilters[key] = { operator: 'in', values: parts };
      }
    }
  }

  for (const key of privateScopeKeys) {
    if (key in rawFilters) {
      throw new Error('Private record selection is not permitted in URL parameters.');
    }
  }

  return validateFilters(rawFilters);
}

export function readLegacyScope(params: URLSearchParams): { startDate: string; endDate: string; filters: Filters } {
  if (params.getAll('startDate').length > 1) {
    throw new Error('Duplicate startDate parameter.');
  }
  if (params.getAll('endDate').length > 1) {
    throw new Error('Duplicate endDate parameter.');
  }

  for (const key of privateScopeKeys) {
    if (params.has(key)) {
      throw new Error('Private record selection is not permitted in URL parameters.');
    }
  }

  const defaults = defaultLegacyDates();
  let startDate = defaults.startDate;
  let endDate = defaults.endDate;

  if (params.has('startDate')) {
    const rawStart = params.get('startDate');
    if (!rawStart || !/^\d{4}-\d{2}-\d{2}$/.test(rawStart) || !Number.isFinite(Date.parse(rawStart)) || new Date(rawStart).toISOString().slice(0, 10) !== rawStart) {
      throw new Error('Invalid startDate; use YYYY-MM-DD');
    }
    startDate = rawStart;
  }

  if (params.has('endDate')) {
    const rawEnd = params.get('endDate');
    if (!rawEnd || !/^\d{4}-\d{2}-\d{2}$/.test(rawEnd) || !Number.isFinite(Date.parse(rawEnd)) || new Date(rawEnd).toISOString().slice(0, 10) !== rawEnd) {
      throw new Error('Invalid endDate; use YYYY-MM-DD');
    }
    endDate = rawEnd;
  }

  if (startDate > endDate) {
    throw new Error('startDate must not be after endDate');
  }

  const filters = readLegacyFilters(params);
  return { startDate, endDate, filters };
}

export function writeLegacyFilter(params: URLSearchParams, key: string, condition: FilterCondition | null): URLSearchParams {
  const next = new URLSearchParams(params);
  if (!condition) {
    next.delete(key);
    return next;
  }
  if (condition.operator === 'in') {
    if (condition.values && condition.values.length > 0) {
      next.set(key, condition.values.join(','));
    } else {
      next.delete(key);
    }
  } else if (condition.operator === 'between') {
    if (condition.min !== undefined && condition.max !== undefined) {
      next.set(key, `${condition.min}-${condition.max}`);
    }
  } else if (condition.operator === 'equals') {
    next.set(key, String(condition.value));
  } else if (condition.operator === 'not_equals') {
    next.set(key, `!${condition.value}`);
  } else if (condition.value !== undefined) {
    next.set(key, String(condition.value));
  }
  return next;
}

export function clearLegacyFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (['startDate', 'endDate', 'workspace', 'client', 'clientId', 'tab', 'view'].includes(key)) {
      next.append(key, value);
    }
  }
  return next;
}

export function resetLegacyScope(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams();
  for (const workspace of params.getAll('workspace')) {
    next.append('workspace', workspace);
  }
  if (params.has('client')) {
    next.set('client', params.get('client')!);
  }
  const { startDate, endDate } = defaultLegacyDates();
  next.set('startDate', startDate);
  next.set('endDate', endDate);
  return next;
}
