import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, CheckCircle2, Download, Filter, RefreshCw, RotateCcw, SlidersHorizontal } from 'lucide-react';
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

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const startOfMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const startOfQuarter = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3, 1));
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

export function buildPeriodPresets(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = startOfMonth(today);
  const previousMonthEnd = addDays(monthStart, -1);
  const previousMonthStart = startOfMonth(previousMonthEnd);
  const weekday = today.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const weekStart = addDays(today, mondayOffset);
  const quarterStart = startOfQuarter(today);

  return [
    { id: 'all', label: 'All time', start: '', end: '' },
    { id: 'today', label: 'Today', start: dateOnly(today), end: dateOnly(today) },
    { id: 'wtd', label: 'Week to date', start: dateOnly(weekStart), end: dateOnly(today) },
    { id: 'last7', label: 'Last 7 days', start: dateOnly(addDays(today, -6)), end: dateOnly(today) },
    { id: 'mtd', label: 'Month to date', start: dateOnly(monthStart), end: dateOnly(today) },
    { id: 'last30', label: 'Last 30 days', start: dateOnly(addDays(today, -29)), end: dateOnly(today) },
    { id: 'previous_month', label: 'Previous full month', start: dateOnly(previousMonthStart), end: dateOnly(previousMonthEnd) },
    { id: 'qtd', label: 'Quarter to date', start: dateOnly(quarterStart), end: dateOnly(today) },
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
  } = useFilters();
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const optionsQuery = useQuery({
    queryKey: ['filter-options', selectedClient, startDate, endDate],
    queryFn: ({ signal }) => {
      const q = new URLSearchParams({ clientId: selectedClient });
      if (startDate) q.set('startDate', startDate);
      if (endDate) q.set('endDate', endDate);
      return fetchAnalyticsJson(`/api/analytics/filter-options?${q.toString()}`, signal);
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

  const setSingle = (key: 'vendor' | 'source' | 'grade', value: string) => {
    setFilter(key, value ? { operator: 'in', values: [value] } : null);
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

        <button
          type="button"
          className={`cx-scope-more ${expanded ? 'is-open' : ''}`}
          onClick={() => setExpanded(value => !value)}
          aria-expanded={expanded}
        >
          <SlidersHorizontal size={14} />
          <span>More filters</span>
          {activeFilterCount > 0 && <strong>{activeFilterCount}</strong>}
        </button>

        <div className="cx-scopebar-status" title="Operational analytics have not been independently reconciled">
          <CheckCircle2 size={14} />
          <span>Live warehouse</span>
          <em>Unverified</em>
        </div>

        <div className="cx-scopebar-actions">
          {(activeFilterCount > 0 || startDate || endDate) && (
            <button type="button" onClick={clearFilters} title="Reset scope">
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

          <p>
            Filters apply to the current client workspace and persist while you move between operational views.
          </p>
        </div>
      )}
    </section>
  );
};

export default OffernetFilterBar;
