import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import ChartFrame from '../../shared/visuals/ChartFrame';
import ChartTooltip from '../../shared/visuals/ChartTooltip';
import ReportingScopeSummary from '../../shared/reporting/ReportingScopeSummary';
import { categoryColour, CHART_PALETTE } from '../../lib/visuals/palette';

export interface VettingChartProps {
  title: string;
  description?: string;
  rows: any[];
  series: Array<{ key: string; label: string }>;
  disjoint?: boolean;
  initial?: 'bar' | 'column' | 'line' | 'pie' | 'donut';
  onSelect?: (val: string) => void;
  ordered?: boolean;
  unit?: string;
  scopeNote?: React.ReactNode;
}

export default function VettingChart({
  title,
  description,
  rows,
  series,
  disjoint,
  initial = 'bar',
  onSelect,
  ordered,
  unit,
  scopeNote,
}: VettingChartProps) {
  const [chartType, setChartType] = useState(initial);
  const activeChartType = chartType === 'column' ? 'bar' : chartType;

  const formattedRows = (rows || []).map((r) => {
    const obj: any = { label: r.label || r.key || 'Unknown', key: r.key || r.label };
    for (const s of series) {
      const val = r[s.key];
      obj[s.key] = val !== null && val !== undefined ? (typeof val === 'number' ? val : parseFloat(val)) : null;
    }
    return obj;
  });

  const pieSeriesKey = series[0]?.key || 'leads';
  const validPieRows = formattedRows.filter((r) => (r[pieSeriesKey] ?? 0) > 0);

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return <ChartTooltip title={label || payload[0]?.name || 'Segment'} rows={payload.map((entry: any) => ({
      label: entry.name, color: entry.color || entry.fill,
      value: <>{typeof entry.value === 'number' ? entry.value.toLocaleString() : (entry.value ?? '—')}{unit ? ` ${unit}` : ''}</>,
    }))} />;
  };

  return (
    <ChartFrame title={title} scope={<><ReportingScopeSummary />{scopeNote}</>} header={<div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-[var(--cx-text)] text-sm">{title}</h3>
          {description && <p className="text-xs text-[var(--cx-text-muted)] mt-0.5">{description}</p>}
        </div>

        <div className="flex items-center gap-1 bg-[var(--cx-surface-subtle)] p-0.5 rounded text-[11px]">
          {(['bar', 'line', 'pie', 'donut'] as const).map((t) => (
            <button
              key={t}
              type="button" aria-pressed={activeChartType === t}
              onClick={() => setChartType(t)}
              className={`px-2 py-0.5 rounded capitalize ${
                activeChartType === t ? 'bg-[var(--cx-surface)] font-semibold text-[var(--cx-action)]' : 'text-[var(--cx-text-muted)] hover:text-[var(--cx-text)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>}>
      <div className="h-64 min-h-[256px] w-full">
        {!formattedRows.length ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-xs text-[var(--cx-text-muted)] bg-[var(--cx-surface-subtle)] rounded-lg border border-dashed border-[var(--cx-border)] p-4">
            <span className="font-medium text-[var(--cx-text-secondary)] mb-1">No vetting records available.</span>
            <span className="text-[11px] text-[var(--cx-text-muted)]">Current filter scope returned zero matching groups.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
            {chartType === 'donut' || chartType === 'pie' ? (
              <PieChart>
                <Tooltip content={<CustomChartTooltip />} />
                <Pie
                  isAnimationActive={false}
                  data={validPieRows}
                  dataKey={pieSeriesKey}
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={chartType === 'donut' ? '40%' : 0}
                  outerRadius="75%"
                  onClick={(e: any) => onSelect && onSelect(e.payload?.key || e.name)}
                >
                  {validPieRows.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={categoryColour(entry.label)} />
                  ))}
                </Pie>
              </PieChart>
            ) : chartType === 'line' ? (
              <LineChart data={formattedRows} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--cx-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--cx-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={(v) => typeof v === 'number' ? v.toLocaleString() : v} />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                {series.map((s, idx) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={CHART_PALETTE[idx % CHART_PALETTE.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={true}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart data={formattedRows} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--cx-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--cx-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={(v) => typeof v === 'number' ? v.toLocaleString() : v} />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                {series.map((s, idx) => (
                  <Bar
                    isAnimationActive={false}
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                    onClick={(e: any) => onSelect && onSelect(e.key || e.label)}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </ChartFrame>
  );
}
