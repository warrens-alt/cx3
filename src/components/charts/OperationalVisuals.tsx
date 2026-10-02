import ChartTooltip from '../../shared/visuals/ChartTooltip';
import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatChartAxis, formatPercent, formatTableNumber } from '../../lib/formatters';
import { ChartToolbar } from './ChartToolbar';
import { CategoryAxisTick, CategoryChartFrame, categoryPlotWidth, chartTooltipWrapperStyle } from './CategoryChartFrame';

export const ANALYTICS_COLORS = {
  volume: 'var(--cx-data-fetched)',
  secondary: 'var(--cx-text-muted)',
  rpc: 'var(--cx-data-rpc)',
  sale: 'var(--cx-data-sales)',
  activation: 'var(--cx-data-activation)',
  warning: 'var(--cx-warning)',
  critical: 'var(--cx-critical)',
  neutral: 'var(--cx-text-muted)',
} as const;

export function EmptyChartState({ message = 'No observations recorded for the active filters.' }: { message?: string }) {
  return (
    <div className="h-44 w-full flex flex-col items-center justify-center text-xs text-text-sec bg-surface-subtle rounded-lg border border-dashed border-border p-4">
      <span className="font-medium text-text-sec mb-1">{message}</span>
      <span className="text-xs text-text-sec">Try adjusting dates, vendor scope, or filters to display data.</span>
    </div>
  );
}

const CHART_LEGEND_STYLE = { fontSize: 12, paddingTop: 10 };
const CHART_TOOLTIP_STYLE = {
  borderRadius: 'var(--cx-radius-md)',
  border: '1px solid var(--cx-border)',
  background: 'var(--cx-surface)',
  color: 'var(--cx-text)',
  maxWidth: 280,
  whiteSpace: 'normal' as const,
  overflowWrap: 'anywhere' as const,
  boxShadow: 'var(--cx-shadow-md)',
  fontSize: 12,
};

type RateSeries = {
  key: string;
  label: string;
  color?: string;
};

interface VolumeRateComboChartProps {
  title: string;
  subtitle?: string;
  data: Array<Record<string, any>>;
  xKey: string;
  volumeKey: string;
  volumeLabel?: string;
  rateSeries: RateSeries[];
  height?: number;
  onSelect?: (category: string, row: Record<string, any>) => void;
}

export function VolumeRateComboChart({
  title,
  subtitle,
  data,
  xKey,
  volumeKey,
  volumeLabel = 'Volume',
  rateSeries,
  height = 320,
  onSelect,
}: VolumeRateComboChartProps) {
  const safeData = useMemo(() => data || [], [data]);

  if (!safeData.length) {
    return (
      <div className="enterprise-card cx-analytics-card">
        <ChartToolbar visualData={safeData} title={title} subtitle={subtitle} />
        <EmptyChartState />
      </div>
    );
  }

  const tooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return <ChartTooltip title={label} rows={payload.map((item: any) => ({
      label: item.name, color: item.color,
      value: item.dataKey === volumeKey ? formatTableNumber(item.value) : item.value == null || !Number.isFinite(Number(item.value)) ? 'Unavailable' : formatPercent(item.value, 2),
    }))} />;
  };

  return (
    <div className="enterprise-card cx-analytics-card">
      <ChartToolbar visualData={safeData} title={title} subtitle={subtitle} />
      <CategoryChartFrame title={title} height={height} minWidth={categoryPlotWidth(safeData.length, 144)} legend={[{ label: volumeLabel, color: ANALYTICS_COLORS.volume }, ...rateSeries.map((item, index) => ({ label: item.label, color: item.color || [ANALYTICS_COLORS.rpc, ANALYTICS_COLORS.sale, ANALYTICS_COLORS.activation][index % 3] }))]}>{portal => (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
          <ComposedChart data={safeData} margin={{ top: 16, right: 16, left: -10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border-subtle)" />
            <XAxis dataKey={xKey} tick={<CategoryAxisTick />} axisLine={false} tickLine={false} interval={0} height={38} />
            <YAxis yAxisId="volume" tick={{ fontSize: 12, fill: 'var(--cx-text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={formatChartAxis} />
            <YAxis yAxisId="rate" orientation="right" domain={[0, 'auto']} tick={{ fontSize: 12, fill: 'var(--cx-text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={value => `${formatChartAxis(value)}%`} />
            <Tooltip cursor={{ stroke: 'var(--cx-border)' }} content={tooltip} portal={portal ?? undefined} wrapperStyle={chartTooltipWrapperStyle} isAnimationActive={false} />
            <Bar
              yAxisId="volume"
              dataKey={volumeKey}
              name={volumeLabel}
              fill={ANALYTICS_COLORS.volume}
              radius={[4, 4, 0, 0]}
              maxBarSize={44}
              isAnimationActive={false}
              className={onSelect ? 'cx-chart-clickable' : undefined}
              onClick={onSelect ? (entry: any) => {
                const row = entry?.payload || entry;
                const category = row?.[xKey];
                if (category !== null && category !== undefined) onSelect(String(category), row);
              } : undefined}
            />
            {rateSeries.map((series, index) => (
              <Line
                key={series.key}
                yAxisId="rate"
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color || [ANALYTICS_COLORS.rpc, ANALYTICS_COLORS.sale, ANALYTICS_COLORS.activation][index % 3]}
                strokeWidth={2.25}
                dot={{ r: 3, fill: 'var(--cx-surface)', strokeWidth: 2 }}
                activeDot={{ stroke: 'var(--cx-surface)' }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      )}</CategoryChartFrame>
    </div>
  );
}

interface RankedMetricChartProps {
  title: string;
  subtitle?: string;
  data: Array<Record<string, any>>;
  categoryKey: string;
  valueKey: string;
  valueLabel?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  decimals?: number;
  maxItems?: number;
  height?: number;
  onSelect?: (category: string, row: Record<string, any>) => void;
}

export function RankedMetricChart({
  title,
  subtitle,
  data,
  categoryKey,
  valueKey,
  valueLabel = 'Value',
  valuePrefix = '',
  valueSuffix = '',
  decimals = 0,
  maxItems = 12,
  height = 320,
  onSelect,
}: RankedMetricChartProps) {
  const rows = useMemo(() => {
    return [...(data || [])]
      .filter(row => row[valueKey] !== null && row[valueKey] !== undefined && Number.isFinite(Number(row[valueKey])))
      .sort((a, b) => Number(b[valueKey]) - Number(a[valueKey]))
      .slice(0, maxItems);
  }, [data, valueKey, maxItems]);

  if (!rows.length) {
    return (
      <div className="enterprise-card cx-analytics-card">
        <ChartToolbar visualData={rows} title={title} subtitle={subtitle} />
        <EmptyChartState />
      </div>
    );
  }

  const formatValue = (value: unknown) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '—';
    return `${valuePrefix}${numeric.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}${valueSuffix}`;
  };

  return (
    <div className="enterprise-card cx-analytics-card">
      <ChartToolbar visualData={rows} title={title} subtitle={subtitle} />
      <CategoryChartFrame title={title} height={Math.max(height, rows.length * 34 + 60)} minWidth={420}>{portal => (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--cx-border-subtle)" />
            <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--cx-text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={value => `${valuePrefix}${formatChartAxis(value)}${valueSuffix}`} />
            <YAxis type="category" dataKey={categoryKey} width={138} tick={<CategoryAxisTick horizontal />} interval={0} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value: any) => [formatValue(value), valueLabel]} cursor={{ fill: 'var(--cx-surface-subtle)' }} contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color: 'var(--cx-text)' }} portal={portal ?? undefined} wrapperStyle={chartTooltipWrapperStyle} isAnimationActive={false} />
            <Bar
              dataKey={valueKey}
              name={valueLabel}
              fill={ANALYTICS_COLORS.volume}
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
              isAnimationActive={false}
              className={onSelect ? 'cx-chart-clickable' : undefined}
              onClick={onSelect ? (entry: any) => {
                const row = entry?.payload || entry;
                const category = row?.[categoryKey];
                if (category !== null && category !== undefined) onSelect(String(category), row);
              } : undefined}
            />
          </BarChart>
        </ResponsiveContainer>
      )}</CategoryChartFrame>
    </div>
  );
}

interface GroupedOutcomeChartProps {
  title: string;
  subtitle?: string;
  data: Array<Record<string, any>>;
  xKey: string;
  series: Array<{ key: string; label: string; color?: string }>;
  height?: number;
  minPlotWidth?: number;
}

export function GroupedOutcomeChart({ title, subtitle, data, xKey, series, height = 320, minPlotWidth }: GroupedOutcomeChartProps) {
  const safeData = useMemo(() => data || [], [data]);

  if (!safeData.length) {
    return (
      <div className="enterprise-card cx-analytics-card">
        <ChartToolbar visualData={safeData} title={title} subtitle={subtitle} />
        <EmptyChartState />
      </div>
    );
  }
  return (
    <div className="enterprise-card cx-analytics-card">
      <ChartToolbar visualData={safeData} title={title} subtitle={subtitle} />
      <CategoryChartFrame title={title} height={height} minWidth={Math.max(minPlotWidth || 0, categoryPlotWidth(safeData.length, 96))} legend={series.map((item, index) => ({ label: item.label, color: item.color || [ANALYTICS_COLORS.volume, ANALYTICS_COLORS.rpc, ANALYTICS_COLORS.sale, ANALYTICS_COLORS.activation][index % 4] }))}>{portal => (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
          <BarChart data={safeData} margin={{ top: 14, right: 18, left: -6, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border-subtle)" />
            <XAxis dataKey={xKey} tick={<CategoryAxisTick />} axisLine={false} tickLine={false} interval={0} height={38} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--cx-text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={formatChartAxis} />
            <Tooltip formatter={(value: any) => formatTableNumber(value)} cursor={{ fill: 'var(--cx-surface-subtle)' }} contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color: 'var(--cx-text)' }} portal={portal ?? undefined} wrapperStyle={chartTooltipWrapperStyle} isAnimationActive={false} />
            {series.map((item, index) => (
              <Bar key={item.key} dataKey={item.key} name={item.label} fill={item.color || [ANALYTICS_COLORS.volume, ANALYTICS_COLORS.rpc, ANALYTICS_COLORS.sale, ANALYTICS_COLORS.activation][index % 4]} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}</CategoryChartFrame>
    </div>
  );
}


const SERIES_PALETTE = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#6366F1', '#14B8A6'];

interface MultiSeriesTrendChartProps {
  title: string;
  subtitle?: string;
  data: Array<Record<string, any>>;
  xKey: string;
  series: Array<{ key: string; label: string; color?: string }>;
  valueSuffix?: string;
  height?: number;
}

export function MultiSeriesTrendChart({
  title,
  subtitle,
  data,
  xKey,
  series,
  valueSuffix = '%',
  height = 320,
}: MultiSeriesTrendChartProps) {
  const safeData = useMemo(() => data || [], [data]);

  if (!safeData.length || !series || !series.length) {
    return (
      <div className="enterprise-card cx-analytics-card">
        <ChartToolbar visualData={safeData} title={title} subtitle={subtitle} />
        <EmptyChartState />
      </div>
    );
  }

  return (
    <div className="enterprise-card cx-analytics-card">
      <ChartToolbar visualData={safeData} title={title} subtitle={subtitle} />
      <div style={{ height, minHeight: height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
          <LineChart data={safeData} margin={{ top: 16, right: 16, left: -4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border-subtle)" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: 'var(--cx-text-secondary)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--cx-text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={value => `${formatChartAxis(value)}${valueSuffix}`} />
            <Tooltip cursor={{ stroke: 'var(--cx-border)' }} labelStyle={{ color: 'var(--cx-text)' }} formatter={(value: any, name: any) => [value == null || !Number.isFinite(Number(value)) ? '—' : `${Number(value).toFixed(1)}${valueSuffix}`, name]} contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} formatter={label => <span style={{ color: 'var(--cx-text-secondary)' }}>{label}</span>} />
            {series.slice(0, 8).map((item, index) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={item.color || SERIES_PALETTE[index % SERIES_PALETTE.length]}
                strokeWidth={2.2}
                dot={{ r: 2.5, fill: 'var(--cx-surface)', strokeWidth: 2 }}
                activeDot={{ stroke: 'var(--cx-surface)' }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface StackedCompositionChartProps {
  title: string;
  subtitle?: string;
  data: Array<Record<string, any>>;
  categoryKey: string;
  series: Array<{ key: string; label: string; color?: string }>;
  height?: number;
}

export function StackedCompositionChart({
  title,
  subtitle,
  data,
  categoryKey,
  series,
  height = 330,
}: StackedCompositionChartProps) {
  const safeData = useMemo(() => data || [], [data]);

  if (!safeData.length || !series || !series.length) {
    return (
      <div className="enterprise-card cx-analytics-card">
        <ChartToolbar visualData={safeData} title={title} subtitle={subtitle} />
        <EmptyChartState />
      </div>
    );
  }

  return (
    <div className="enterprise-card cx-analytics-card">
      <ChartToolbar visualData={safeData} title={title} subtitle={subtitle} />
      <CategoryChartFrame title={title} height={Math.max(height, safeData.length * 34 + 60)} minWidth={420} legend={series.slice(0, 8).map((item, index) => ({ label: item.label, color: item.color || SERIES_PALETTE[index % SERIES_PALETTE.length] }))}>{portal => (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
          <BarChart data={safeData} layout="vertical" margin={{ top: 8, right: 22, left: 8, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--cx-border-subtle)" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--cx-text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={value => `${value}%`} />
            <YAxis type="category" dataKey={categoryKey} width={138} tick={<CategoryAxisTick horizontal />} interval={0} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'var(--cx-surface-subtle)' }} formatter={(value: any, name: any) => [`${Number(value).toFixed(1)}%`, name]} contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color: 'var(--cx-text)' }} portal={portal ?? undefined} wrapperStyle={chartTooltipWrapperStyle} isAnimationActive={false} />
            {series.slice(0, 8).map((item, index) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stackId="composition"
                fill={item.color || SERIES_PALETTE[index % SERIES_PALETTE.length]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}</CategoryChartFrame>
    </div>
  );
}

export interface HorizontalStackedOutcomeChartProps {
  title?: string;
  subtitle?: string;
  data: Array<Record<string, any>>;
  categoryKey: string;
  series: Array<{ key: string; label: string; color?: string }>;
  isPercent?: boolean;
  height?: number;
  onSelect?: (category: string, key?: string) => void;
  tooltipBaseLabel?: string;
}

export function HorizontalStackedOutcomeChart({
  title,
  subtitle,
  data,
  categoryKey,
  series,
  isPercent = true,
  height = 340,
  onSelect,
  tooltipBaseLabel = 'base',
}: HorizontalStackedOutcomeChartProps) {
  const safeData = useMemo(() => data || [], [data]);

  if (!safeData.length || !series || !series.length) {
    return (
      <div className="w-full">
        {title && <h3 className="text-sm font-semibold text-text-main mb-1">{title}</h3>}
        {subtitle && <p className="text-xs text-text-sec mb-3">{subtitle}</p>}
        <EmptyChartState />
      </div>
    );
  }

  return (
    <div className="w-full">
      <CategoryChartFrame title={title || 'Vendor outcomes'} height={Math.max(height, safeData.length * 38 + 70)} minWidth={440} legend={series.map(item => ({ label: item.label, color: item.color || '#94a3b8' }))}>{portal => (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
          <BarChart data={safeData} layout="vertical" margin={{ top: 10, right: 28, left: 10, bottom: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--cx-border-subtle)" />
            <XAxis
              type="number"
              domain={isPercent ? [0, 100] : [0, 'auto']}
              tickFormatter={(v) => (isPercent ? `${v}%` : formatTableNumber(v))}
              tick={{ fontSize: 12, fill: 'var(--cx-text-secondary)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey={categoryKey}
              width={138}
              tick={<CategoryAxisTick horizontal />} interval={0}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: 'var(--cx-surface-subtle)' }} portal={portal ?? undefined} wrapperStyle={chartTooltipWrapperStyle} isAnimationActive={false}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload;
                const base = row?.base || 0;
                return (
                  <div className="cx-analytics-tooltip">
                    <div className="font-bold text-text-main border-b border-border-subtle pb-1.5 mb-2">
                      {label} · Base: {formatTableNumber(base)} {tooltipBaseLabel}
                    </div>
                    <div className="space-y-1.5">
                      {payload
                        .filter((p: any) => p.value > 0)
                        .map((p: any) => {
                          const rawCount = isPercent ? row?.[`${p.dataKey}_count`] ?? 0 : p.value;
                          const pct = base > 0 ? ((rawCount / base) * 100).toFixed(1) : '0';
                          return (
                            <div key={p.dataKey} className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: p.color }} />
                                <span className="text-text-sec">{p.name}</span>
                              </div>
                              <span className="font-mono text-text-main font-medium">
                                {formatTableNumber(rawCount)} ({pct}%)
                              </span>
                            </div>
                          );
                        })}
                    </div>
                    {onSelect && (
                      <div className="mt-2.5 pt-1.5 border-t border-border-subtle text-[11px] text-action font-medium">
                        Click to drill down into raw codes
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {series.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stackId="outcomes"
                fill={item.color || '#94a3b8'}
                className={onSelect ? 'cursor-pointer' : undefined}
                isAnimationActive={false}
                onClick={
                  onSelect
                    ? (entry: any) => {
                        const cat = entry?.[categoryKey] || entry?.payload?.[categoryKey];
                        if (cat) onSelect(cat, item.key);
                      }
                    : undefined
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}</CategoryChartFrame>
    </div>
  );
}
