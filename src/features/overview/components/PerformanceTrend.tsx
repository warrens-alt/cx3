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
import ChartTooltip from '../../../shared/visuals/ChartTooltip';
import ChartFrame from '../../../shared/visuals/ChartFrame';
import ReportingScopeSummary from '../../../shared/reporting/ReportingScopeSummary';
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
  return <ChartTooltip title={label} rows={[{ label: metricLabel, value: value != null ? formatTableNumber(value) : 'Unavailable' }]} />;
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
    <ChartFrame title="Performance trend" className="cx-trend-panel" scope={<ReportingScopeSummary />} header={
      <div className="cx-trend-heading">
        <div>
          <h2>Performance trend</h2>
          <p>
            Daily progression across the selected reporting period.
          </p>
        </div>

        {/* Metric Selector Tabs */}
        <div
          role="tablist"
          aria-label="Select metric to plot"
          style={{ '--cx-active-series': currentConfig.color } as React.CSSProperties}
          className="cx-trend-tabs"
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
            >
              {METRIC_CONFIGS[key].label}
            </button>
          ))}
        </div>
      </div>}
      footer={<div className="cx-trend-context"><Clock3 size={13} aria-hidden="true" /><span>{comparisonWindow
        ? `Plotting ${currentConfig.label}. Preceding matched comparison window (${comparisonWindow.startDate} – ${comparisonWindow.endDate}) provides page-level delta context.`
        : `Plotting ${currentConfig.label}. Comparison evidence is unavailable for the selected period.`}</span></div>}>

      {/* Chart Canvas */}
      <div className="cx-trend-canvas" id={`${chartId}-plot`} role="tabpanel" aria-labelledby={`${chartId}-${activeMetric}`}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
            <LineChart data={chartData} accessibilityLayer margin={{ top: 8, right: 12, left: -2, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--cx-border-subtle)" />
              <XAxis
                dataKey="date"
                minTickGap={48}
                interval="preserveStartEnd"
                tickFormatter={value => String(value).slice(5)}
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
                type="linear"
                dataKey={activeMetric}
                stroke={currentConfig.color}
                strokeWidth={2}
                dot={{ r: chartData.length === 1 ? 5 : 3, fill: currentConfig.color, strokeWidth: 2, stroke: 'var(--cx-surface)' }}
                activeDot={{ r: 6, fill: currentConfig.color, stroke: 'var(--cx-surface)', strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="cx-trend-empty">
            <span className="font-medium text-text-sec">No daily trend data available in this scope.</span>
            <span className="text-xs text-text-mute mt-0.5">Select a broader date range or adjust tenant filters.</span>
          </div>
        )}
      </div>
      <p className="cx-trend-legend"><i style={{ background: currentConfig.color }} aria-hidden="true" />{currentConfig.label}</p>

      <details className="cx-report-disclosure cx-trend-evidence"><summary>View exact daily evidence</summary>
        <div className="cx-viz-table-scroll" role="region" aria-label="Daily trend evidence" tabIndex={0}>
          <table className="cx-viz-table"><caption className="sr-only">Returned daily observations for Overview outcomes.</caption><thead><tr><th scope="col">Date</th><th scope="col">Fetched</th><th scope="col">Delivered</th><th scope="col">Sales</th><th scope="col">Activations</th></tr></thead>
            <tbody>{chartData.map((point, index) => <tr key={`${point.date}-${index}`}><th scope="row">{point.date}</th>{(['leads','delivered','sales','activations'] as const).map(key => <td key={key}>{point[key] == null ? 'Unavailable' : formatTableNumber(point[key])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>

    </ChartFrame>
  );
}
