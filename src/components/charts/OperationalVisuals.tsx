import React from 'react';
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

export const ANALYTICS_COLORS = {
  volume: '#3562B3',
  secondary: '#64748B',
  rpc: '#0F766E',
  sale: '#7C3AED',
  activation: '#15803D',
  warning: '#B7791F',
  critical: '#B42318',
  neutral: '#94A3B8',
} as const;

const CHART_LEGEND_STYLE = { fontSize: 11, paddingTop: 10 };
const CHART_TOOLTIP_STYLE = {
  borderRadius: 9,
  border: '1px solid #DCE4ED',
  background: 'rgba(255,255,255,.98)',
  boxShadow: '0 12px 28px rgba(15,23,42,.12)',
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
  if (!data.length) return null;

  const tooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="cx-analytics-tooltip">
        <strong>{label}</strong>
        {payload.map((item: any) => (
          <div key={item.dataKey}>
            <span><i style={{ background: item.color }} />{item.name}</span>
            <b>{item.dataKey === volumeKey ? formatTableNumber(item.value) : formatPercent(item.value, 2)}</b>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="enterprise-card cx-analytics-card">
      <ChartToolbar visualData={data} title={title} subtitle={subtitle} />
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={data} margin={{ top: 16, right: 16, left: -10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F6" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} interval={0} angle={data.length > 8 ? -24 : 0} textAnchor={data.length > 8 ? 'end' : 'middle'} height={data.length > 8 ? 56 : 34} />
            <YAxis yAxisId="volume" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={formatChartAxis} />
            <YAxis yAxisId="rate" orientation="right" domain={[0, 'auto']} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={value => `${formatChartAxis(value)}%`} />
            <Tooltip content={tooltip} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
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
                dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
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
  const rows = [...data]
    .filter(row => row[valueKey] !== null && row[valueKey] !== undefined && Number.isFinite(Number(row[valueKey])))
    .sort((a, b) => Number(b[valueKey]) - Number(a[valueKey]))
    .slice(0, maxItems);

  if (!rows.length) return null;

  const formatValue = (value: unknown) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '—';
    return `${valuePrefix}${numeric.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}${valueSuffix}`;
  };

  return (
    <div className="enterprise-card cx-analytics-card">
      <ChartToolbar visualData={rows} title={title} subtitle={subtitle} />
      <div style={{ height: Math.max(height, rows.length * 34 + 60), width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF2F6" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={value => `${valuePrefix}${formatChartAxis(value)}${valueSuffix}`} />
            <YAxis type="category" dataKey={categoryKey} width={138} tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value: any) => [formatValue(value), valueLabel]} cursor={{ fill: '#F8FAFC' }} contentStyle={CHART_TOOLTIP_STYLE} />
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
      </div>
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
}

export function GroupedOutcomeChart({ title, subtitle, data, xKey, series, height = 320 }: GroupedOutcomeChartProps) {
  if (!data.length) return null;
  return (
    <div className="enterprise-card cx-analytics-card">
      <ChartToolbar visualData={data} title={title} subtitle={subtitle} />
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} margin={{ top: 14, right: 18, left: -6, bottom: data.length > 8 ? 48 : 12 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F6" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} interval={0} angle={data.length > 8 ? -24 : 0} textAnchor={data.length > 8 ? 'end' : 'middle'} />
            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={formatChartAxis} />
            <Tooltip formatter={(value: any) => formatTableNumber(value)} cursor={{ fill: '#F8FAFC' }} contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
            {series.map((item, index) => (
              <Bar key={item.key} dataKey={item.key} name={item.label} fill={item.color || [ANALYTICS_COLORS.volume, ANALYTICS_COLORS.rpc, ANALYTICS_COLORS.sale, ANALYTICS_COLORS.activation][index % 4]} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


const SERIES_PALETTE = ['#3562B3','#0F766E','#7C3AED','#15803D','#B7791F','#64748B','#0E7490','#BE185D'];

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
  if (!data.length || !series.length) return null;

  return (
    <div className="enterprise-card cx-analytics-card">
      <ChartToolbar visualData={data} title={title} subtitle={subtitle} />
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={data} margin={{ top: 16, right: 16, left: -4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F6" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={value => `${formatChartAxis(value)}${valueSuffix}`} />
            <Tooltip formatter={(value: any, name: any) => [value == null ? '—' : `${Number(value).toFixed(1)}${valueSuffix}`, name]} contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
            {series.slice(0, 8).map((item, index) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={item.color || SERIES_PALETTE[index % SERIES_PALETTE.length]}
                strokeWidth={2.2}
                dot={{ r: 2.5, fill: '#fff', strokeWidth: 2 }}
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
  if (!data.length || !series.length) return null;

  return (
    <div className="enterprise-card cx-analytics-card">
      <ChartToolbar visualData={data} title={title} subtitle={subtitle} />
      <div style={{ height: Math.max(height, data.length * 34 + 80), width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 22, left: 8, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF2F6" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={value => `${value}%`} />
            <YAxis type="category" dataKey={categoryKey} width={138} tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value: any, name: any) => [`${Number(value).toFixed(1)}%`, name]} contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
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
      </div>
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
  if (!data.length || !series.length) return null;

  return (
    <div className="w-full">
      <div style={{ height: Math.max(height, data.length * 38 + 70), width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 28, left: 10, bottom: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF2F6" />
            <XAxis
              type="number"
              domain={isPercent ? [0, 100] : [0, 'auto']}
              tickFormatter={(v) => (isPercent ? `${v}%` : formatTableNumber(v))}
              tick={{ fontSize: 11, fill: '#64748B' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey={categoryKey}
              width={110}
              tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload;
                const base = row?.base || 0;
                return (
                  <div className="bg-white p-3 rounded-lg shadow-xl border border-slate-200 text-xs min-w-[220px]">
                    <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 mb-2">
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
                                <span className="text-slate-700">{p.name}</span>
                              </div>
                              <span className="font-mono text-slate-900 font-medium">
                                {formatTableNumber(rawCount)} ({pct}%)
                              </span>
                            </div>
                          );
                        })}
                    </div>
                    {onSelect && (
                      <div className="mt-2.5 pt-1.5 border-t border-slate-100 text-[11px] text-sky-700 font-medium">
                        Click to drill down into raw codes
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              formatter={(value) => <span className="text-slate-700 text-xs">{value}</span>}
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
      </div>
    </div>
  );
}

