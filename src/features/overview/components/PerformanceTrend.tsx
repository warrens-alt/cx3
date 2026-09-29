import React, { useState, useMemo, useId } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Clock3 } from 'lucide-react';
import { formatTableNumber } from '../../../lib/formatters';

export interface DailyTrendRow {
  date: string;
  leads?: number;
  delivered?: number;
  sales?: number;
  dialled?: number;
  contacted?: number;
  activations?: number;
  revenue?: number | null;
  fetchedLeads?: number;
  deliveredLeads?: number;
  saleLeads?: number;
  [key: string]: any;
}

export type SelectableTrendMetric = 'leads' | 'delivered' | 'sales';

export interface PerformanceTrendPoint {
  date: string;
  leads: number | undefined;
  delivered: number | undefined;
  sales: number | undefined;
  dialled: number | undefined;
  contacted: number | undefined;
  activations: number | undefined;
  revenue: number | null | undefined;
}

/**
 * Presentation adapter: maps Overview API dailyTrends rows to normalized trend points
 * without globally mutating the server response or substituting artificial zeros for absent measures.
 */
export function adaptDailyTrends(rows: DailyTrendRow[] = []): PerformanceTrendPoint[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(r => ({
    date: r.date,
    leads: r.leads !== undefined ? r.leads : r.fetchedLeads,
    delivered: r.delivered !== undefined ? r.delivered : r.deliveredLeads,
    sales: r.sales !== undefined ? r.sales : r.saleLeads,
    dialled: r.dialled !== undefined ? r.dialled : r.dialledLeads,
    contacted: r.contacted !== undefined ? r.contacted : r.contactedLeads,
    activations: r.activations !== undefined ? r.activations : r.activatedLeads,
    revenue: r.revenue !== undefined ? r.revenue : undefined,
  }));
}

export interface PerformanceTrendProps {
  data?: DailyTrendRow[];
  comparisonWindow?: {
    startDate: string;
    endDate: string;
  } | null;
}

const METRIC_CONFIGS: Record<SelectableTrendMetric, { label: string; color: string }> = {
  leads: { label: 'Fetched leads', color: 'var(--cx-data-fetched)' },
  delivered: { label: 'Delivered leads', color: 'var(--cx-data-delivered)' },
  sales: { label: 'Recorded sales', color: 'var(--cx-data-sales)' },
};

interface TrendTooltipProps {
  active?: boolean;
  payload?: readonly { value?: number | string | null }[];
  label?: React.ReactNode;
  metricLabel: string;
}

// Stable component identity avoids remounting a nested tooltip on every selection.
function TrendTooltip({ active, payload, label, metricLabel }: TrendTooltipProps) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  return (
    <div className="cx-chart-tooltip">
      <div className="cx-chart-tooltip-title">{label}</div>
      <div className="cx-chart-tooltip-row">
        <span className="cx-chart-tooltip-label">{metricLabel}:</span>
        <span className="cx-chart-tooltip-value">{value != null ? formatTableNumber(value) : '—'}</span>
      </div>
    </div>
  );
}

export default function PerformanceTrend({ data = [], comparisonWindow }: PerformanceTrendProps) {
  const [activeMetric, setActiveMetric] = useState<SelectableTrendMetric>('leads');

  const chartId = useId();
  const chartData = useMemo(() => adaptDailyTrends(data), [data]);
  const currentConfig = METRIC_CONFIGS[activeMetric];

  const handleMetricKey = (event: React.KeyboardEvent<HTMLButtonElement>, key: SelectableTrendMetric) => {
    const keys = Object.keys(METRIC_CONFIGS) as SelectableTrendMetric[];
    const index = keys.indexOf(key);
    const next = event.key === 'ArrowRight' ? (index + 1) % keys.length
      : event.key === 'ArrowLeft' ? (index - 1 + keys.length) % keys.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    setActiveMetric(keys[next]);
    const button = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next];
    button?.focus();
  };

  return (
    <section className="cx-trend-panel enterprise-card bg-surface border border-border p-5 rounded-lg flex flex-col justify-between shadow-xs" aria-label="Performance trend">
      <div className="cx-trend-heading flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-text-main">Performance trend</h2>
          <p className="text-xs text-text-sec mt-0.5">
            Daily progression across the selected reporting period.
          </p>
        </div>

        {/* Metric Selector Tabs */}
        <div
          role="tablist"
          aria-label="Select metric to plot"
          className="cx-trend-tabs flex items-center gap-1 bg-surface-subtle p-1 rounded-lg border border-border-subtle text-xs"
        >
          {(Object.keys(METRIC_CONFIGS) as SelectableTrendMetric[]).map(key => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`${chartId}-${key}`}
              aria-controls={`${chartId}-plot`}
              aria-selected={activeMetric === key}
              tabIndex={activeMetric === key ? 0 : -1}
              onKeyDown={event => handleMetricKey(event, key)}
              onClick={() => setActiveMetric(key)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeMetric === key
                  ? 'bg-surface text-text-main shadow-2xs font-semibold'
                  : 'text-text-mute hover:text-text-main'
              }`}
            >
              {METRIC_CONFIGS[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="cx-trend-canvas h-64 min-h-[256px] w-full" id={`${chartId}-plot`} role="tabpanel" aria-labelledby={`${chartId}-${activeMetric}`}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -2, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border-subtle)" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--cx-text-muted)', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--cx-border-subtle)' }}
              />
              <YAxis
                tick={{ fill: 'var(--cx-text-muted)', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={42}
                tickFormatter={val => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val))}
              />
              <Tooltip content={<TrendTooltip metricLabel={currentConfig.label} />} />
              <Line
                type="monotone"
                dataKey={activeMetric}
                stroke={currentConfig.color}
                strokeWidth={2.5}
                dot={{ r: chartData.length === 1 ? 5 : 3, fill: currentConfig.color, strokeWidth: 2, stroke: 'var(--cx-surface)' }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                connectNulls={true}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-xs text-text-mute bg-surface-subtle/50 rounded-lg border border-dashed border-border-subtle p-4">
            <span className="font-medium text-text-sec">No daily trend data available in this scope.</span>
            <span className="text-xs text-text-mute mt-0.5">Select a broader date range or adjust tenant filters.</span>
          </div>
        )}
      </div>

      {/* Comparison Context Footer */}
      <div className="pt-3 mt-2 border-t border-border-subtle flex items-center gap-1.5 text-xs text-text-mute">
        <Clock3 size={13} aria-hidden="true" />
        <span>
          {comparisonWindow
            ? `Plotting ${currentConfig.label}. Preceding matched comparison window (${comparisonWindow.startDate} – ${comparisonWindow.endDate}) provides page-level delta context.`
            : `Plotting ${currentConfig.label}. Select explicit dates in the scope bar to enable matched-period comparison.`}
        </span>
      </div>
    </section>
  );
}
