/**
 * Pure browser-safe filter contracts and validation.
 * Shared across frontend clients, analytical API endpoints, and export builders.
 */

export type FilterOperator = 'in' | 'equals' | 'not_equals' | 'between' | 'greater_than' | 'less_than';
export type Scalar = string | number | boolean;

export interface FilterCondition {
  operator: FilterOperator;
  values?: Scalar[];
  value?: Scalar;
  min?: number;
  max?: number;
}

export type Filters = Record<string, FilterCondition>;

export interface QueryScope {
  clientId: string;
  startDate?: string;
  endDate?: string;
  filters?: Filters;
}

export class RequestError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = 'RequestError';
  }
}

export const FIELD_TYPES: Record<string, 'string' | 'number' | 'boolean'> = {
  source: 'string',
  vendor: 'string',
  medium: 'string',
  grade: 'string',
  vetting: 'string',
  lead_id: 'string',
  consumer_id: 'number',
  partner: 'string',
  ror_partner: 'string',
  cli: 'string',
  campaign: 'string',
  channel: 'string',
  adset: 'string',
  agent: 'string',
  calls: 'number',
  total_calls: 'number',
  routing_depth: 'number',
  vendor_count: 'number',
  revenue: 'number',
  total_revenue: 'number',
  valid_lead: 'boolean',
  valid_idno: 'boolean',
  phone_valid: 'boolean',
  is_revetted: 'boolean',
  delivered: 'boolean',
  called: 'boolean',
  rpc: 'boolean',
  sales: 'boolean',
  sale: 'boolean',
  activated: 'boolean',
  activation: 'boolean',
  has_delivery: 'boolean',
  has_call: 'boolean',
  has_rpc: 'boolean',
  has_sale: 'boolean',
  has_activation: 'boolean',
};

export const OPERATORS = new Set<string>(['in', 'equals', 'not_equals', 'between', 'greater_than', 'less_than']);

export function scalarString(value: unknown, name: string, maxLength = 256): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > maxLength || /[\x00-\x1f]/.test(value)) {
    throw new RequestError(`Invalid ${name}`);
  }
  return value;
}

export function validateDate(value: unknown, name: string): string | undefined {
  const text = scalarString(value, name, 10);
  if (!text) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text) {
    throw new RequestError(`Invalid ${name}; use YYYY-MM-DD`);
  }
  return text;
}

export function validateFilters(input: unknown): Filters {
  if (input === undefined || input === null || input === '') return {};
  let raw = input;
  if (typeof raw === 'string') {
    if (raw.length > 12000) throw new RequestError('Filters are too large');
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new RequestError('Filters must be valid JSON');
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length > 20) {
    throw new RequestError('Invalid filters');
  }
  const result: Filters = Object.create(null);
  for (const [key, candidate] of Object.entries(raw)) {
    if (!Object.hasOwn(FIELD_TYPES, key)) throw new RequestError(`Unsupported filter: ${key}`);
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new RequestError(`Invalid filter: ${key}`);
    }
    const f = candidate as FilterCondition;
    if (!OPERATORS.has(f.operator)) throw new RequestError(`Unsupported operator for ${key}`);
    const type = FIELD_TYPES[key];
    const check = (value: unknown): Scalar => {
      if (
        typeof value !== type ||
        (typeof value === 'string' && (value.length > 256 || /[\x00-\x1f]/.test(value))) ||
        (typeof value === 'number' && !Number.isFinite(value))
      ) {
        throw new RequestError(`Invalid value for ${key}`);
      }
      return value as Scalar;
    };
    if (f.operator === 'in') {
      if (!Array.isArray(f.values) || f.values.length === 0 || f.values.length > 50) {
        throw new RequestError(`Invalid values for ${key}`);
      }
      result[key] = { operator: 'in', values: [...new Set(f.values.map(check))] };
    } else if (f.operator === 'between') {
      if (type !== 'number' || typeof f.min !== 'number' || typeof f.max !== 'number') {
        throw new RequestError(`Invalid range for ${key}`);
      }
      check(f.min);
      check(f.max);
      if (f.min > f.max) throw new RequestError(`Reversed range for ${key}`);
      result[key] = { operator: 'between', min: f.min, max: f.max };
    } else {
      if (['greater_than', 'less_than'].includes(f.operator) && type !== 'number') {
        throw new RequestError(`Invalid comparison for ${key}`);
      }
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
  return {
    clientId: clientId === 'default' ? 'default_tenant' : clientId,
    startDate,
    endDate,
    filters: validateFilters(input.filters),
  };
}

export function boundedInteger(value: unknown, fallback: number, max: number, min = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  if (!['number', 'string'].includes(typeof value) || !/^\d+$/.test(String(value))) {
    throw new RequestError('Invalid integer');
  }
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) {
    throw new RequestError(`Integer must be between ${min} and ${max}`);
  }
  return n;
}
