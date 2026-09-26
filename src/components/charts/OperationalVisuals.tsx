import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
            <Bar yAxisId="volume" dataKey={volumeKey} name={volumeLabel} fill={ANALYTICS_COLORS.volume} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
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
            <Tooltip formatter={(value: any) => [formatValue(value), valueLabel]} cursor={{ fill: '#F8FAFC' }} />
            <Bar dataKey={valueKey} name={valueLabel} fill={ANALYTICS_COLORS.volume} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
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
            <Tooltip formatter={(value: any) => formatTableNumber(value)} cursor={{ fill: '#F8FAFC' }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
            {series.map((item, index) => (
              <Bar key={item.key} dataKey={item.key} name={item.label} fill={item.color || [ANALYTICS_COLORS.volume, ANALYTICS_COLORS.rpc, ANALYTICS_COLORS.sale, ANALYTICS_COLORS.activation][index % 4]} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
