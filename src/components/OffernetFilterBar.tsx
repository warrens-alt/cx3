import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Database, Download, Filter, RefreshCw, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useClient } from '../lib/ClientContext';
import { useFilters } from '../lib/FilterContext';
import { fetchAnalyticsJson } from '../lib/useAnalyticsData';
import { invalidateOffernetCache } from '../lib/offernetClient';

interface OffernetFilterBarProps {
  onRefresh?: () => void | Promise<void>;
  onExportCsv?: () => void;
  showVendorFilter?: boolean;
  showSourceFilter?: boolean;
  showGradeFilter?: boolean;
}

const localDateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfQuarter = (date: Date) => new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export function buildPeriodPresets(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = startOfMonth(today);
  const previousMonthEnd = addDays(monthStart, -1);
  const previousMonthStart = startOfMonth(previousMonthEnd);
  const weekday = today.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const weekStart = addDays(today, mondayOffset);
  const quarterStart = startOfQuarter(today);

  return [
    { id: 'all', label: 'All time', start: '', end: '' },
    { id: 'today', label: 'Today', start: localDateOnly(today), end: localDateOnly(today) },
    { id: 'wtd', label: 'Week to date', start: localDateOnly(weekStart), end: localDateOnly(today) },
    { id: 'last7', label: 'Last 7 days', start: localDateOnly(addDays(today, -6)), end: localDateOnly(today) },
    { id: 'mtd', label: 'Month to date', start: localDateOnly(monthStart), end: localDateOnly(today) },
    { id: 'last30', label: 'Last 30 days', start: localDateOnly(addDays(today, -29)), end: localDateOnly(today) },
    { id: 'previous_month', label: 'Previous month', start: localDateOnly(previousMonthStart), end: localDateOnly(previousMonthEnd) },
    { id: 'qtd', label: 'Quarter to date', start: localDateOnly(quarterStart), end: localDateOnly(today) },
  ];
}

export const PERIOD_PRESETS = buildPeriodPresets();

function firstFilterValue(condition: any): string {
  if (!condition) return '';
  if (condition.operator === 'in' && Array.isArray(condition.values)) return String(condition.values[0] || '');
  if (condition.operator === 'equals') return String(condition.value || '');
  return '';
}

function optionValues(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(item => typeof item === 'string' ? item : (item as any)?.value || (item as any)?.label)
    .filter(Boolean)
    .map(String);
}

export const OffernetFilterBar: React.FC<OffernetFilterBarProps> = ({
  onRefresh,
  onExportCsv,
  showVendorFilter = true,
  showSourceFilter = true,
  showGradeFilter = true,
}) => {
  const { clients, selectedClient, setSelectedClient } = useClient();
  const {
    startDate,
    endDate,
    setDateRange,
    filters,
    setFilter,
    clearFilters,
    activeFilterCount,
    appliedFilters,
  } = useFilters();
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const optionsQuery = useQuery({
    queryKey: ['filter-options', selectedClient, startDate, endDate],
    queryFn: ({ signal }) => {
      const query = new URLSearchParams({ clientId: selectedClient });
      if (startDate) query.set('startDate', startDate);
      if (endDate) query.set('endDate', endDate);
      return fetchAnalyticsJson(`/api/analytics/filter-options?${query.toString()}`, signal);
    },
    enabled: Boolean(selectedClient),
    staleTime: 120000,
    retry: false,
  });

  const data = optionsQuery.data?.data;
  const vendor = firstFilterValue(filters.vendor);
  const source = firstFilterValue(filters.source);
  const grade = firstFilterValue(filters.grade);
  const vendors = useMemo(() => Array.from(new Set([vendor, ...optionValues(data?.vendors)].filter(Boolean))), [vendor, data?.vendors]);
  const sources = useMemo(() => Array.from(new Set([source, ...optionValues(data?.sources)].filter(Boolean))), [source, data?.sources]);
  const grades = useMemo(() => Array.from(new Set([grade, ...optionValues(data?.grades)].filter(Boolean))), [grade, data?.grades]);

  const currentPreset = PERIOD_PRESETS.find(item => item.start === startDate && item.end === endDate);
  const periodValue = currentPreset?.id || 'custom';

  const setSingle = (key: 'vendor' | 'source' | 'grade', value: string) =>
    setFilter(key, value ? { operator: 'in', values: [value] } : null);

  const removeApplied = (key: string) => {
    if (key === 'dateRange') setDateRange('', '');
    else setFilter(key, null);
  };

  const changePeriod = (id: string) => {
    if (id === 'custom') {
      setExpanded(true);
      return;
    }
    const preset = PERIOD_PRESETS.find(item => item.id === id);
    if (preset) setDateRange(preset.start, preset.end);
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    invalidateOffernetCache();
    try {
      await onRefresh?.();
      await optionsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="cx-scopebar" aria-label="Reporting scope">
      <div className="cx-scopebar-main">
        <label className="cx-scope-control cx-scope-client">
          <span>Client</span>
          <select value={selectedClient} onChange={event => setSelectedClient(event.target.value)} aria-label="Client">
            {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>

        <label className="cx-scope-control">
          <span>Period</span>
          <div className="cx-scope-control-icon">
            <Calendar size={14} />
            <select value={periodValue} onChange={event => changePeriod(event.target.value)} aria-label="Reporting period">
              {PERIOD_PRESETS.map(period => <option key={period.id} value={period.id}>{period.label}</option>)}
              <option value="custom">Custom dates</option>
            </select>
          </div>
        </label>

        {showVendorFilter && (
          <label className="cx-scope-control">
            <span>Vendor</span>
            <select value={vendor} onChange={event => setSingle('vendor', event.target.value)} aria-label="Vendor">
              <option value="">All vendors</option>
              {vendors.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        )}

        {showSourceFilter && (
          <label className="cx-scope-control">
            <span>Source</span>
            <select value={source} onChange={event => setSingle('source', event.target.value)} aria-label="Source">
              <option value="">All sources</option>
              {sources.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        )}

        <button type="button" className={`cx-scope-more ${expanded ? 'is-open' : ''}`} onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
          <SlidersHorizontal size={14} />
          <span>More</span>
          {activeFilterCount > 0 && <strong>{activeFilterCount}</strong>}
        </button>

        <div className="cx-scopebar-status" title="Operational analytics are live but not independently reconciled">
          <Database size={14} />
          <span>Operational data</span>
          <em>Not reconciled</em>
        </div>

        <div className="cx-scopebar-actions">
          {activeFilterCount > 0 && (
            <button type="button" onClick={clearFilters} title="Reset reporting scope">
              <RotateCcw size={14} />
              <span className="hidden xl:inline">Reset</span>
            </button>
          )}
          <button type="button" onClick={refresh} disabled={refreshing} title="Refresh current view">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden xl:inline">Refresh</span>
          </button>
          {onExportCsv && (
            <button type="button" onClick={onExportCsv} title="Export current view">
              <Download size={14} />
              <span className="hidden xl:inline">Export</span>
            </button>
          )}
        </div>
      </div>

      {appliedFilters.length > 0 && (
        <div className="cx-scope-chips" aria-label="Active reporting filters">
          {appliedFilters.map(item => (
            <button key={item.key} type="button" onClick={() => removeApplied(item.key)} title={`Remove ${item.label}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <X size={11}/>
            </button>
          ))}
        </div>
      )}

      {expanded && (
        <div className="cx-scopebar-more">
          <div className="cx-scope-custom-dates">
            <Filter size={14} />
            <label>
              <span>From</span>
              <input type="date" value={startDate} onChange={event => setDateRange(event.target.value, endDate)} />
            </label>
            <label>
              <span>To</span>
              <input type="date" value={endDate} onChange={event => setDateRange(startDate, event.target.value)} />
            </label>
          </div>

          {showGradeFilter && (
            <label className="cx-scope-control">
              <span>Grade</span>
              <select value={grade} onChange={event => setSingle('grade', event.target.value)} aria-label="Lead grade">
                <option value="">All grades</option>
                {grades.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          )}

          <p>Scope persists while you move between operational views.</p>
        </div>
      )}
    </section>
  );
};

export default OffernetFilterBar;
