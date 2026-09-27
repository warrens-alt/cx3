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
  Check,
} from 'lucide-react';
import { useClient } from '../../lib/ClientContext';
import { useFilters } from '../../lib/FilterContext';
import { fetchAnalyticsJson } from '../../lib/useAnalyticsData';
import { dateDraftError, scopeFilterSummary, scopeSelectValue, type DateRangeDraft } from '../../lib/scopeControls';
import type { FilterCondition } from '../../../contracts/filters';
import type { ScopePolicy } from '../../app/routeManifest';
import '../../styles/scopeControls.css';

export interface ReportingScopeBarProps {
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

export const PERIOD_PRESETS = buildPeriodPresets();

function optionValues(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(item => (typeof item === 'string' ? item : (item as any)?.value || (item as any)?.label))
    .filter(Boolean)
    .map(String);
}

function ScopeSelect({
  label,
  value,
  condition,
  options,
  loading,
  loaded,
  onChange,
}: {
  label: string;
  value: string | null;
  condition?: FilterCondition;
  options: string[];
  loading: boolean;
  loaded: boolean;
  onChange: (value: string) => void;
}) {
  let complexValue = '__cx_scope_selection__';
  while (options.includes(complexValue)) complexValue += '_';
  const allLabel = label === 'Lead grade' ? 'All grades' : `All ${label.toLowerCase()}s`;
  return (
    <select
      value={value ?? complexValue}
      onChange={event => {
        if (event.target.value !== complexValue) onChange(event.target.value);
      }}
      aria-label={label}
      disabled={loading}
      aria-busy={loading}
    >
      <option value="">{loading ? `Loading ${label.toLowerCase()}s…` : allLabel}</option>
      {value === null && condition && (
        <option value={complexValue} disabled>
          {condition.operator === 'in' ? `${condition.values?.length} selected` : scopeFilterSummary(condition)}
        </option>
      )}
      {loaded && !loading && !options.length && (
        <option value={`${complexValue}_empty`} disabled>
          No {label.toLowerCase()}s in this period
        </option>
      )}
      {options.map(option => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function ReleaseScopeBar({ onRefresh, className = '' }: { onRefresh?: () => void | Promise<void>; className?: string }) {
  return (
    <div className={`cx-reporting-scope-bar flex items-center justify-between text-xs px-4 py-2 bg-surface-sec border-b border-border-subtle ${className}`} role="region" aria-label="Release scope">
      <div className="flex items-center gap-2 text-text-sec">
        <Database size={14} className="text-brand-primary" aria-hidden="true" />
        <span>Immutable published release registry. Scope is defined by the released snapshot manifest. Operational filters do not constrain fixed releases.</span>
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-border-subtle bg-surface hover:bg-surface-sec transition-colors"
        >
          <RefreshCw size={12} aria-hidden="true" />
          <span>Refresh releases</span>
        </button>
      )}
    </div>
  );
}

function OperationalScopeBar({
  onRefresh,
  onExportCsv,
  showVendorFilter = true,
  showSourceFilter = true,
  showGradeFilter = true,
  className = '',
}: ReportingScopeBarProps) {
  const { clients, selectedClient } = useClient();
  const {
    startDate,
    endDate,
    setDateRange,
    filters,
    setFilter,
    clearDimensionFilters,
    resetScope,
    appliedFilters,
  } = useFilters();

  const [expanded, setExpanded] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const scopeKey = JSON.stringify([selectedClient, startDate, endDate]);
  const [storedDraft, setStoredDraft] = useState<(DateRangeDraft & { scopeKey: string }) | null>(null);
  const draft = storedDraft?.scopeKey === scopeKey ? storedDraft : null;
  const dates = draft || { start: startDate, end: endDate };
  const datesDirty = !!draft && (draft.start !== startDate || draft.end !== endDate || draft.startIncomplete || draft.endIncomplete);
  const dateError = draft ? dateDraftError(draft) : null;

  const panelId = useId();
  const controlsId = useId();
  const dateHelpId = useId();
  const dateErrorId = useId();
  const optionsErrorId = useId();
  const moreButton = useRef<HTMLButtonElement>(null);
  const startInput = useRef<HTMLInputElement>(null);
  const refreshInProgress = useRef(false);

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
    refetchOnWindowFocus: false,
  });

  const data = optionsQuery.error ? undefined : optionsQuery.data?.data;
  const optionsLoading = optionsQuery.isFetching && !data;

  const moreFilterCount = Object.keys(filters).filter(
    key => !((showVendorFilter && key === 'vendor') || (showSourceFilter && key === 'source'))
  ).length;

  const visibleChips = Object.entries(filters).map(([key, condition]) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
    value: scopeFilterSummary(condition),
  }));

  const vendor = scopeSelectValue(filters.vendor);
  const source = scopeSelectValue(filters.source);
  const grade = scopeSelectValue(filters.grade);

  const vendors = useMemo(
    () => Array.from(new Set([vendor, ...optionValues(data?.vendors)].filter(Boolean))) as string[],
    [vendor, data?.vendors]
  );
  const sources = useMemo(
    () => Array.from(new Set([source, ...optionValues(data?.sources)].filter(Boolean))) as string[],
    [source, data?.sources]
  );
  const grades = useMemo(
    () => Array.from(new Set([grade, ...optionValues(data?.grades)].filter(Boolean))) as string[],
    [grade, data?.grades]
  );

  const presets = buildPeriodPresets();
  const currentPreset = presets.find(item => item.start === startDate && item.end === endDate);
  const periodValue = draft ? 'custom' : currentPreset?.id || 'custom';
  const customPeriod = !currentPreset ? appliedFilters.find(item => item.key === 'dateRange') : undefined;
  const appliedPeriodLabel = currentPreset?.label || customPeriod?.value || 'Custom dates';
  const selectedClientName = clients.find(client => client.id === selectedClient)?.name || selectedClient;

  const hasDimensionFilters = Object.keys(filters).length > 0;
  const canClearDimensions = hasDimensionFilters;
  const canResetScope = Boolean(startDate || endDate || hasDimensionFilters || draft);

  const setSingle = (key: 'vendor' | 'source' | 'grade', value: string) => {
    setFilter(key, value ? { operator: 'in', values: [value] } : null);
    setAnnouncement(`${key.charAt(0).toUpperCase() + key.slice(1)} filter updated.`);
  };

  const handleClearDimensions = () => {
    setStoredDraft(null);
    clearDimensionFilters();
    setAnnouncement('Dimension filters cleared. Reporting period retained.');
  };

  const handleResetScope = () => {
    setStoredDraft(null);
    resetScope();
    setAnnouncement('Reporting scope and period reset.');
  };

  const cancelDates = () => {
    setStoredDraft(null);
    setAnnouncement('Date changes cancelled. Applied period unchanged.');
  };

  const changePeriod = (id: string) => {
    setRefreshError(null);
    if (id === 'custom') {
      setStoredDraft({ scopeKey, start: startDate, end: endDate });
      setExpanded(true);
      requestAnimationFrame(() => startInput.current?.focus());
      return;
    }
    const preset = buildPeriodPresets().find(item => item.id === id);
    if (preset) {
      setStoredDraft(null);
      setDateRange(preset.start, preset.end);
      setAnnouncement(`${preset.label} applied.`);
    }
  };

  const applyDates = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || dateDraftError(draft)) return;
    setDateRange(draft.start, draft.end);
    setStoredDraft(null);
    setAnnouncement('Reporting dates applied.');
  };

  const refresh = async () => {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    setRefreshing(true);
    setRefreshError(null);
    setAnnouncement('Refreshing current view.');
    try {
      const [view, options] = await Promise.allSettled([
        Promise.resolve().then(() => onRefresh?.()),
        optionsQuery.refetch({ throwOnError: true }),
      ]);
      if (view.status === 'rejected') {
        const msg = view.reason instanceof Error ? view.reason.message : 'The current view could not be refreshed. Try again.';
        setRefreshError(msg);
        setAnnouncement('Refresh failed.');
      } else if (options.status === 'rejected') {
        const msg = options.reason instanceof Error ? options.reason.message : 'Filter choices could not be loaded.';
        setRefreshError(msg);
        setAnnouncement('Filter choices could not be loaded.');
      } else {
        setAnnouncement('Refresh request finished.');
      }
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : 'The current view could not be refreshed. Try again.');
      setAnnouncement('Refresh failed.');
    } finally {
      refreshInProgress.current = false;
      setRefreshing(false);
    }
  };

  return (
    <section className={`cx-scopebar cx-scope-controls ${mobileExpanded ? 'is-mobile-expanded' : ''} ${className}`} aria-label="Reporting scope">
      <div className="cx-scopebar-main">
        <div className="cx-scope-mobile-summary">
          <strong>{selectedClientName}</strong>
          <span>
            <Calendar size={13} aria-hidden="true" />
            {appliedPeriodLabel}
          </span>
          {datesDirty && <small>Date changes not applied</small>}
        </div>

        <button
          type="button"
          className="cx-scope-mobile-toggle"
          onClick={() => setMobileExpanded(value => !value)}
          aria-expanded={mobileExpanded}
          aria-controls={controlsId}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          {mobileExpanded ? 'Hide filters' : 'Edit filters'}
        </button>

        <div className="cx-scope-editable" id={controlsId}>
          <label className="cx-scope-control cx-scope-period">
            <span>Period</span>
            <div className="cx-scope-control-icon">
              <Calendar size={14} aria-hidden="true" />
              <select
                value={periodValue}
                onChange={event => changePeriod(event.target.value)}
                aria-label="Reporting period"
              >
                {presets.map(period => (
                  <option key={period.id} value={period.id}>
                    {period.label}
                  </option>
                ))}
                <option value="custom">Custom dates</option>
              </select>
            </div>
          </label>

          {showVendorFilter && (
            <label className={`cx-scope-control ${!showSourceFilter ? 'cx-scope-control-wide' : ''}`}>
              <span>Vendor</span>
              <ScopeSelect
                label="Vendor"
                value={vendor}
                condition={filters.vendor}
                options={vendors}
                loading={optionsLoading}
                loaded={Boolean(data)}
                onChange={value => setSingle('vendor', value)}
              />
            </label>
          )}

          {showSourceFilter && (
            <label className={`cx-scope-control ${!showVendorFilter ? 'cx-scope-control-wide' : ''}`}>
              <span>Source</span>
              <ScopeSelect
                label="Source"
                value={source}
                condition={filters.source}
                options={sources}
                loading={optionsLoading}
                loaded={Boolean(data)}
                onChange={value => setSingle('source', value)}
              />
            </label>
          )}

          <button
            ref={moreButton}
            type="button"
            className={`cx-scope-more ${expanded ? 'is-open' : ''}`}
            onClick={() => {
              if (expanded) setStoredDraft(null);
              setExpanded(value => !value);
            }}
            aria-expanded={expanded}
            aria-controls={panelId}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            <span>More filters</span>
            {moreFilterCount > 0 && <strong aria-label={`${moreFilterCount} additional filters`}>{moreFilterCount}</strong>}
          </button>
        </div>

        <div className="cx-scopebar-actions">
          {canClearDimensions && (
            <button
              type="button"
              onClick={handleClearDimensions}
              aria-label="Clear dimension filters"
              title="Clear all filters while preserving reporting period"
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span className="cx-scope-action-label">Clear filters</span>
            </button>
          )}

          {canResetScope && (
            <button
              type="button"
              onClick={handleResetScope}
              aria-label="Reset reporting scope"
              title="Reset reporting dates and filters"
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span className="cx-scope-action-label">Reset</span>
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              className="cx-scope-refresh"
              onClick={() => {
                void refresh();
              }}
              disabled={refreshing}
              aria-label={refreshing ? 'Refreshing current view' : 'Refresh current view'}
              aria-busy={refreshing}
              title="Refresh current view"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
              <span className="cx-scope-action-label">{refreshing ? 'Refreshing' : 'Refresh'}</span>
            </button>
          )}

          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              aria-label="Export current view"
              title="Export current view"
            >
              <Download size={14} aria-hidden="true" />
              <span className="cx-scope-action-label">Export</span>
            </button>
          )}
        </div>
      </div>

      <div className="cx-scopebar-meta">
        {(customPeriod || visibleChips.length > 0) && (
          <div className="cx-scope-chips" aria-label="Active reporting filters">
            {customPeriod && (
              <button
                type="button"
                onClick={() => {
                  setStoredDraft(null);
                  setDateRange('', '');
                }}
                aria-label={`Remove period filter: ${customPeriod.value}`}
                title={`Remove period: ${customPeriod.value}`}
              >
                <Calendar size={12} aria-hidden="true" />
                <span>{customPeriod.label}</span>
                <strong>{customPeriod.value}</strong>
                <X size={11} aria-hidden="true" />
              </button>
            )}
            {visibleChips.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key, null)}
                aria-label={`Remove ${item.label} filter: ${item.value}`}
                title={`Remove ${item.label}: ${item.value}`}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <X size={11} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        <div className="cx-scopebar-status" title="Operational analytics are live but not independently reconciled">
          <Database size={13} aria-hidden="true" />
          <span>Operational data</span>
          <em>Not reconciled</em>
        </div>
      </div>

      {optionsQuery.isFetching && (
        <p className="cx-scope-feedback" role="status">
          <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
          Loading filter choices…
        </p>
      )}

      {optionsQuery.error && (
        <div className="cx-scope-feedback cx-scope-feedback-error" role="alert" id={optionsErrorId}>
          <AlertCircle size={14} aria-hidden="true" />
          <span>Filter choices are unavailable. {optionsQuery.error instanceof Error ? optionsQuery.error.message : 'Please try again.'}</span>
          <button
            type="button"
            onClick={() => {
              void optionsQuery.refetch();
            }}
            disabled={optionsQuery.isFetching}
          >
            Retry filter choices
          </button>
        </div>
      )}

      {refreshError && (
        <div className="cx-scope-feedback cx-scope-feedback-error" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          <span>{refreshError}</span>
        </div>
      )}

      <span className="cx-scope-announcement" role="status" aria-live="polite">
        {announcement}
      </span>

      {expanded && (
        <div
          className="cx-scopebar-more"
          id={panelId}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelDates();
              setExpanded(false);
              moreButton.current?.focus();
            }
          }}
        >
          <form className="cx-scope-date-editor" onSubmit={applyDates} noValidate aria-label="Custom reporting dates">
            <div className="cx-scope-panel-heading">
              <strong>Custom dates</strong>
              <span>Choose the period to include in your reports.</span>
            </div>
            <div className="cx-scope-custom-dates">
              <label>
                <span>From</span>
                <input
                  ref={startInput}
                  type="date"
                  value={dates.start}
                  aria-label="Start date"
                  aria-describedby={dateError ? `${dateHelpId} ${dateErrorId}` : dateHelpId}
                  aria-invalid={Boolean(dateError)}
                  onChange={event =>
                    setStoredDraft({
                      ...dates,
                      scopeKey,
                      start: event.target.value,
                      startIncomplete: event.target.validity.badInput,
                    })
                  }
                />
              </label>
              <label>
                <span>To</span>
                <input
                  type="date"
                  value={dates.end}
                  aria-label="End date"
                  aria-describedby={dateError ? `${dateHelpId} ${dateErrorId}` : dateHelpId}
                  aria-invalid={Boolean(dateError)}
                  onChange={event =>
                    setStoredDraft({
                      ...dates,
                      scopeKey,
                      end: event.target.value,
                      endIncomplete: event.target.validity.badInput,
                    })
                  }
                />
              </label>
              <div className="cx-scope-date-actions">
                <button type="submit" disabled={!datesDirty || Boolean(dateError)}>
                  <Check size={14} aria-hidden="true" />
                  Apply dates
                </button>
                <button type="button" onClick={cancelDates} disabled={!draft}>
                  Cancel
                </button>
              </div>
            </div>
            <p id={dateHelpId}>Dates change only when applied. Leave either date blank for an open-ended period.</p>
            {dateError && (
              <p className="cx-scope-date-error" id={dateErrorId} role="alert">
                {dateError}
              </p>
            )}
            {datesDirty && !dateError && (
              <p className="cx-scope-date-pending" role="status">
                Date changes have not been applied.
              </p>
            )}
          </form>
          <div className="cx-scope-additional">
            {showGradeFilter && (
              <label className="cx-scope-control">
                <span>Lead grade</span>
                <ScopeSelect
                  label="Lead grade"
                  value={grade}
                  condition={filters.grade}
                  options={grades}
                  loading={optionsLoading}
                  loaded={Boolean(data)}
                  onChange={value => setSingle('grade', value)}
                />
              </label>
            )}
            <p>Applied scope follows you between views.</p>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ReportingScopeBar({
  policy = 'operational',
  ...props
}: ReportingScopeBarProps) {
  if (policy === 'none' || policy === 'settings') {
    return null;
  }

  if (policy === 'release') {
    return <ReleaseScopeBar onRefresh={props.onRefresh} className={props.className} />;
  }

  return <OperationalScopeBar policy={policy} {...props} />;
}
