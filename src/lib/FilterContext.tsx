import React, { createContext, useContext, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { validateFilters, type FilterCondition, type Filters } from '../../contracts/filters';
export type { FilterCondition };
export type UniversalFilters = Filters;

export function defaultDateRange(now = new Date()) {
  const localDate = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 29);
  return { start: localDate(start), end: localDate(end) };
}

const SUPPORTED_STANDALONE_KEYS = ['source', 'vendor', 'medium', 'grade', 'cli', 'campaign', 'channel', 'adset', 'agent'] as const;

function cleanString(val: unknown): string | undefined {
  if (!val) return undefined;
  const s = String(val).trim();
  if (['all', 'all vendors', 'all sources', 'all grades', 'undefined', 'null'].includes(s.toLowerCase())) {
    return undefined;
  }
  return s;
}

export function readFilters(params: URLSearchParams): Filters {
  let result: Filters = {};
  const encoded = params.get('filters');
  if (encoded) {
    result = validateFilters(encoded);
  }
  for (const key of SUPPORTED_STANDALONE_KEYS) { 
    const value = params.get(key); 
    if (value) {
      const cleaned = cleanString(value);
      if (cleaned) {
        result[key] = { operator: 'in', values: cleaned.split(',').map(s => s.trim()).filter(Boolean) };
      }
    } 
  }
  return validateFilters(result);
}

export interface AppliedFilterItem {
  key: string;
  label: string;
  value: string;
}

export function extractOffernetFilters(filters: Filters): { filters: string } {
  // Keep the complete contract so the API can apply or explicitly reject it.
  return { filters: JSON.stringify(validateFilters(filters)) };
}

export function singleFilterValue(condition: FilterCondition | undefined): string | undefined {
  if (condition?.operator === 'equals' && typeof condition.value === 'string') return cleanString(condition.value);
  if (condition?.operator === 'in' && condition.values?.length === 1 && typeof condition.values[0] === 'string') return cleanString(condition.values[0]);
  return undefined;
}

interface FilterContextType {
  startDate: string; 
  endDate: string; 
  startMonth: string; 
  endMonth: string;
  setStartDate: (value: string) => void; 
  setEndDate: (value: string) => void; 
  setDateRange: (start: string, end: string) => void;
  filters: Filters; 
  filterError: string | null; 
  setFilter: (key: string, condition: FilterCondition | null) => void; 
  clearFilters: () => void;
  clearDimensionFilters: () => void;
  resetScope: () => void;
  source: string; 
  vendor: string; 
  medium: string; 
  grade: string;
  setSource: (value: string) => void; 
  setVendor: (value: string) => void; 
  setMedium: (value: string) => void;
  setGrade: (value: string) => void;
  activeFilterCount: number;
  appliedFilters: AppliedFilterItem[];
}

const Context = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [params, setParams] = useSearchParams();
  // By default, no date filters are imposed unless manually specified by the user
  const startDate = params.get('startDate') || '';
  const endDate = params.get('endDate') || '';
  const parsed = useMemo(() => { 
    try { 
      return { filters: readFilters(params), filterError: null }; 
    } catch (e) { 
      return { filters: {} as Filters, filterError: e instanceof Error ? e.message : 'Invalid filters' }; 
    } 
  }, [params]);

  const update = (key: string, value: string) => setParams(previous => { 
    const next = new URLSearchParams(previous); 
    value ? next.set(key, value) : next.delete(key); 
    return next; 
  }, { replace: true });

  const setDateRange = (start: string, end: string) => setParams(previous => { 
    const next = new URLSearchParams(previous); 
    if (start) next.set('startDate', start); else next.delete('startDate'); 
    if (end) next.set('endDate', end); else next.delete('endDate'); 
    return next; 
  }, { replace: true });

  const setFilter = (key: string, condition: FilterCondition | null) => setParams(previous => {
    const next = new URLSearchParams(previous), filters = { ...readFilters(previous) };
    if (key === 'dateRange' && condition === null) {
      next.delete('startDate');
      next.delete('endDate');
      return next;
    }
    if (condition === null) delete filters[key]; else filters[key] = condition;
    const validated = validateFilters(filters);
    for (const legacy of SUPPORTED_STANDALONE_KEYS) next.delete(legacy);
    Object.keys(validated).length ? next.set('filters', JSON.stringify(validated)) : next.delete('filters');
    return next;
  }, { replace: true });

  const clearDimensionFilters = () => setParams(previous => {
    const next = new URLSearchParams(previous);
    for (const key of ['filters', ...SUPPORTED_STANDALONE_KEYS]) next.delete(key);
    return next;
  }, { replace: true });

  const clearFilters = () => setParams(previous => { 
    const next = new URLSearchParams(previous); 
    next.delete('startDate');
    next.delete('endDate');
    for (const key of ['filters', ...SUPPORTED_STANDALONE_KEYS]) next.delete(key); 
    return next; 
  }, { replace: true });

  const resetScope = () => clearFilters();

  const get = (key: string) => {
    const cond = parsed.filters[key];
    if (!cond) return '';
    if (cond.operator === 'in') return cond.values?.join(',') || '';
    if (cond.operator === 'equals' && cond.value !== undefined) return String(cond.value);
    return '';
  };
  const set = (key: string, value: string) => setFilter(key, value ? { operator: 'in', values: value.split(',') } : null);

  const appliedFilters = useMemo<AppliedFilterItem[]>(() => {
    const items: AppliedFilterItem[] = [];
    if (startDate && endDate) {
      items.push({
        key: 'dateRange',
        label: 'Period',
        value: `${startDate} → ${endDate}`
      });
    } else if (startDate) {
      items.push({ key: 'dateRange', label: 'From Date', value: startDate });
    } else if (endDate) {
      items.push({ key: 'dateRange', label: 'To Date', value: endDate });
    }
    for (const [key, cond] of Object.entries(parsed.filters)) {
      if (!cond) continue;
      let valStr = '';
      if (cond.operator === 'in' && cond.values && cond.values.length > 0) {
        valStr = cond.values.join(', ');
      } else if (cond.operator === 'equals' && cond.value !== undefined) {
        valStr = String(cond.value);
      } else if (cond.operator === 'between') {
        valStr = `${cond.min} - ${cond.max}`;
      }
      if (valStr) {
        const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
        items.push({ key, label, value: valStr });
      }
    }
    return items;
  }, [parsed.filters, startDate, endDate]);

  const activeFilterCount = appliedFilters.length;

  return (
    <Context.Provider value={{ 
      startDate, 
      endDate, 
      startMonth: startDate ? startDate.slice(0, 7) : '', 
      endMonth: endDate ? endDate.slice(0, 7) : '',
      setStartDate: value => update('startDate', value), 
      setEndDate: value => update('endDate', value), 
      setDateRange,
      ...parsed, 
      setFilter, 
      clearFilters, 
      clearDimensionFilters,
      resetScope, 
      source: get('source'), 
      vendor: get('vendor'), 
      medium: get('medium'), 
      grade: get('grade'),
      setSource: value => set('source', value), 
      setVendor: value => set('vendor', value), 
      setMedium: value => set('medium', value),
      setGrade: value => set('grade', value),
      activeFilterCount,
      appliedFilters
    }}>
      {children}
    </Context.Provider>
  );
}

export function useFilters() { 
  const context = useContext(Context); 
  if (!context) throw new Error('FilterProvider is required'); 
  return context; 
}
