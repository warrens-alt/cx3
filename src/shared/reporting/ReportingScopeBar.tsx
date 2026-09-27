import React, { useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Download,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  X,
  AlertCircle,
  Database,
  Filter,
  Check,
} from 'lucide-react';
import { useClient } from '../../lib/ClientContext';
import { useFilters } from '../../lib/FilterContext';
import { fetchAnalyticsJson } from '../../lib/useAnalyticsData';
import { dateDraftError, scopeFilterSummary, scopeSelectValue, type DateRangeDraft } from '../../lib/scopeControls';
import type { FilterCondition } from '../../../contracts/filters';
import type { ScopePolicy } from '../../app/routeManifest';
import '../../styles/scopeControls.css';

interface ReportingScopeBarProps {
  policy?: ScopePolicy;
  onRefresh?: () => void | Promise<void>;
  onExportCsv?: () => void;
  showVendorFilter?: boolean;
  showSourceFilter?: boolean;
  showGradeFilter?: boolean;
  className?: string;
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

function optionValues(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(item => (typeof item === 'string' ? item : (item as any)?.value || (item as any)?.label))
    .filter(Boolean)
    .map(String);
}

export default function ReportingScopeBar({
  policy = 'operational',
  onRefresh,
  onExportCsv,
  showVendorFilter = true,
  showSourceFilter = true,
  showGradeFilter = true,
  className = '',
}: ReportingScopeBarProps) {
  const { clients, selectedClient, setSelectedClient, loading: clientLoading } = useClient();
  const { startDate, endDate, setDateRange, filters, setFilter, clearFilters, appliedFilters } = useFilters();
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const scopeKey = JSON.stringify([selectedClient, startDate, endDate]);
  const [storedDraft, setStoredDraft] = useState<(DateRangeDraft & { scopeKey: string }) | null>(null);
  const draft = storedDraft?.scopeKey === scopeKey ? storedDraft : null;
  const dates = draft || { start: startDate, end: endDate };
  const datesDirty = !!draft && (draft.start !== startDate || draft.end !== endDate || draft.startIncomplete || draft.endIncomplete);
  const dateError = draft ? dateDraftError(draft) : null;
  const refreshInProgress = useRef(false);

  // If policy is 'none' or 'settings', do not render date/filter controls
  if (policy === 'none' || policy === 'settings') {
    return null;
  }

  // If policy is 'release', render a specialized immutable release scope pill
  if (policy === 'release') {
    return (
      <div className={`cx-reporting-scope-bar flex items-center justify-between text-xs px-4 py-2 bg-surface-sec border-b border-border-subtle ${className}`}>
        <div className="flex items-center gap-2 text-text-sec">
          <Database size={14} className="text-brand-primary" aria-hidden="true" />
          <span>Immutable published release registry. Scope is defined by the released snapshot manifest.</span>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-border-subtle bg-surface hover:bg-surface-sec transition-colors"
          >
            <RefreshCw size={12} />
            <span>Refresh releases</span>
          </button>
        )}
      </div>
    );
  }

  const optionsQuery = useQuery({
    queryKey: ['filter-options', selectedClient, startDate, endDate],
    queryFn: ({ signal }) => {
      const query = new URLSearchParams({ clientId: selectedClient });
      if (startDate) query.set('startDate', startDate);
      if (endDate) query.set('endDate', endDate);
      return fetchAnalyticsJson(`/api/analytics/filter-options?${query.toString()}`, signal);
    },
    enabled: Boolean(selectedClient) && policy === 'operational',
    staleTime: 120000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const data = optionsQuery.error ? undefined : optionsQuery.data?.data;
  const optionsLoading = optionsQuery.isFetching && !data;

  const vendor = scopeSelectValue(filters.vendor);
  const source = scopeSelectValue(filters.source);
  const grade = scopeSelectValue(filters.grade);

  const vendors = useMemo(() => Array.from(new Set([vendor, ...optionValues(data?.vendors)].filter(Boolean))) as string[], [vendor, data?.vendors]);
  const sources = useMemo(() => Array.from(new Set([source, ...optionValues(data?.sources)].filter(Boolean))) as string[], [source, data?.sources]);
  const grades = useMemo(() => Array.from(new Set([grade, ...optionValues(data?.grades)].filter(Boolean))) as string[], [grade, data?.grades]);

  const presets = buildPeriodPresets();
  const currentPreset = presets.find(item => item.start === startDate && item.end === endDate);
  const periodValue = draft ? 'custom' : currentPreset?.id || 'custom';

  const setSingle = (key: 'vendor' | 'source' | 'grade', value: string) => {
    setFilter(key, value ? { operator: 'in', values: [value] } : null);
  };

  const changePeriod = (id: string) => {
    setRefreshError(null);
    if (id === 'custom') {
      setStoredDraft({ scopeKey, start: startDate, end: endDate });
      setExpanded(true);
      return;
    }
    const preset = buildPeriodPresets().find(item => item.id === id);
    if (preset) {
      setStoredDraft(null);
      setDateRange(preset.start, preset.end);
    }
  };

  const applyDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || dateDraftError(draft)) return;
    setDateRange(draft.start, draft.end);
    setStoredDraft(null);
  };

  const cancelDates = () => {
    setStoredDraft(null);
  };

  const refresh = async () => {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    setRefreshing(true);
    setRefreshError(null);
    try {
      await Promise.allSettled([
        Promise.resolve().then(() => onRefresh?.()),
        optionsQuery.refetch({ throwOnError: true }),
      ]);
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
      refreshInProgress.current = false;
    }
  };

  const canReset = Boolean(startDate || endDate || Object.keys(filters).length || draft);

  return (
    <div className={`cx-reporting-scope-bar ${className}`} role="region" aria-label="Reporting scope and filters">
      <div className="flex flex-wrap items-center gap-2">
        {/* Period Preset Dropdown */}
        <div className="flex items-center gap-1.5 bg-surface border border-border-subtle rounded-md px-2.5 py-1 text-xs text-text-main shadow-xs">
          <Calendar size={14} className="text-text-mute shrink-0" aria-hidden="true" />
          <select
            value={periodValue}
            onChange={e => changePeriod(e.target.value)}
            className="bg-transparent border-none text-xs font-medium text-text-main focus:outline-hidden cursor-pointer"
            aria-label="Reporting period"
          >
            {presets.map(p => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom dates…</option>
          </select>
        </div>

        {/* Vendor Dropdown */}
        {showVendorFilter && (
          <select
            value={vendor || ''}
            onChange={e => setSingle('vendor', e.target.value)}
            disabled={optionsLoading}
            className="bg-surface border border-border-subtle rounded-md px-2.5 py-1 text-xs text-text-main focus:outline-hidden shadow-xs cursor-pointer"
            aria-label="Filter by vendor"
          >
            <option value="">All vendors</option>
            {vendors.map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}

        {/* Source Dropdown */}
        {showSourceFilter && (
          <select
            value={source || ''}
            onChange={e => setSingle('source', e.target.value)}
            disabled={optionsLoading}
            className="bg-surface border border-border-subtle rounded-md px-2.5 py-1 text-xs text-text-main focus:outline-hidden shadow-xs cursor-pointer"
            aria-label="Filter by source"
          >
            <option value="">All sources</option>
            {sources.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}

        {/* Grade Dropdown */}
        {showGradeFilter && grades.length > 0 && (
          <select
            value={grade || ''}
            onChange={e => setSingle('grade', e.target.value)}
            disabled={optionsLoading}
            className="bg-surface border border-border-subtle rounded-md px-2.5 py-1 text-xs text-text-main focus:outline-hidden shadow-xs cursor-pointer"
            aria-label="Filter by lead grade"
          >
            <option value="">All grades</option>
            {grades.map(g => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}

        {/* Custom Date Form (collapsible) */}
        {expanded && (
          <form onSubmit={applyDates} className="flex items-center gap-1.5 text-xs bg-surface border border-border-subtle rounded-md p-1 shadow-xs">
            <input
              type="date"
              value={dates.start}
              onChange={e => setStoredDraft({ scopeKey, start: e.target.value, end: dates.end })}
              className="px-1.5 py-0.5 border border-border-subtle rounded text-xs"
              aria-label="Start date"
            />
            <span className="text-text-mute">to</span>
            <input
              type="date"
              value={dates.end}
              onChange={e => setStoredDraft({ scopeKey, start: dates.start, end: e.target.value })}
              className="px-1.5 py-0.5 border border-border-subtle rounded text-xs"
              aria-label="End date"
            />
            <button
              type="submit"
              disabled={!datesDirty || !!dateError}
              className="px-2 py-0.5 bg-brand-primary text-white rounded text-xs font-medium hover:bg-brand-hover disabled:opacity-50"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                cancelDates();
                setExpanded(false);
              }}
              className="px-2 py-0.5 bg-surface-sec text-text-sec rounded text-xs hover:bg-surface"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Reset Filter Action */}
        {canReset && (
          <button
            type="button"
            onClick={() => {
              setStoredDraft(null);
              clearFilters();
            }}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-text-mute hover:text-text-main transition-colors"
            title="Clear all filters while preserving period"
          >
            <RotateCcw size={12} />
            <span>Clear filters</span>
          </button>
        )}
      </div>

      {/* Action group: Refresh and Export */}
      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-text-sec bg-surface border border-border-subtle rounded-md hover:bg-surface-sec hover:text-text-main transition-colors disabled:opacity-60 shadow-xs cursor-pointer"
            title="Refresh current analytical view"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin text-brand-primary' : ''} />
            <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        )}

        {onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-text-sec bg-surface border border-border-subtle rounded-md hover:bg-surface-sec hover:text-text-main transition-colors shadow-xs cursor-pointer"
            title="Export filtered aggregate analysis as CSV"
          >
            <Download size={12} />
            <span>Export CSV</span>
          </button>
        )}
      </div>

      {refreshError && (
        <div className="w-full text-xs text-semantic-neg flex items-center gap-1 mt-1" role="alert">
          <AlertCircle size={12} />
          <span>{refreshError}</span>
        </div>
      )}
    </div>
  );
}
