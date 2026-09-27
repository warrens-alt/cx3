import React, { useState, useMemo } from 'react';
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

export default function PerformanceTrend({ data = [], comparisonWindow }: PerformanceTrendProps) {
  const [activeMetric, setActiveMetric] = useState<SelectableTrendMetric>('leads');

  const metricConfigs: Record<SelectableTrendMetric, { label: string; color: string }> = {
    leads: { label: 'Fetched leads', color: 'var(--cx-data-fetched, var(--cx-action, #315BCB))' },
    delivered: { label: 'Delivered leads', color: 'var(--cx-data-delivered, #0E7490)' },
    sales: { label: 'Recorded sales', color: 'var(--cx-data-sales, #426D80)' },
  };

  const chartData = useMemo(() => adaptDailyTrends(data), [data]);
  const currentConfig = metricConfigs[activeMetric];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const value = payload[0]?.value;
    return (
      <div className="cx-chart-tooltip">
        <div className="cx-chart-tooltip-title">{label}</div>
        <div className="cx-chart-tooltip-row">
          <span className="cx-chart-tooltip-label">{currentConfig.label}:</span>
          <span className="cx-chart-tooltip-value">
            {value !== undefined && value !== null ? formatTableNumber(value) : '—'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <section className="enterprise-card bg-surface border border-border p-5 rounded-lg flex flex-col justify-between shadow-xs" aria-label="Performance trend">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
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
          className="flex items-center gap-1 bg-surface-subtle p-1 rounded-lg border border-border-subtle text-xs"
        >
          {(Object.keys(metricConfigs) as SelectableTrendMetric[]).map(key => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeMetric === key}
              onClick={() => setActiveMetric(key)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeMetric === key
                  ? 'bg-surface text-text-main shadow-2xs font-semibold'
                  : 'text-text-mute hover:text-text-main'
              }`}
            >
              {metricConfigs[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full">
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
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey={activeMetric}
                stroke={currentConfig.color}
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: currentConfig.color }}
                activeDot={{ r: 5, strokeWidth: 0 }}
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
