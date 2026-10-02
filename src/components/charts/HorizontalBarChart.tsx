import ChartFrame from '../../shared/visuals/ChartFrame';
import ReportingScopeSummary from '../../shared/reporting/ReportingScopeSummary';
import ChartTooltip from '../../shared/visuals/ChartTooltip';
import React, { useMemo } from 'react';
import { formatChartAxis, formatTableNumber } from '../../lib/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartToolbar } from './ChartToolbar';

interface HorizontalBarChartProps {
  title: string;
  subtitle?: string;
  auditTitle?: string;
  auditContext?: any;
  auditGrain?: string;
  data: any[];
  categoryKey: string;
  valueKey: string;
  valuePrefix?: string;
  valueSuffix?: string;
  height?: number;
  color?: string;
}

export function HorizontalBarChart({
  title,
  subtitle,
  data,
  categoryKey,
  valueKey,
  valuePrefix = '',
  valueSuffix = '',
  height = 300,
  color = 'var(--cx-action)',
  auditTitle,
  auditContext,
  auditGrain
}: HorizontalBarChartProps) {

  const safeData = useMemo(() => data || [], [data]);
  const { totalVal, maxVal } = useMemo(() => {
    const sum = safeData.reduce((acc, curr) => acc + (Number(curr[valueKey]) || 0), 0);
    const max = safeData.length ? Math.max(...safeData.map(d => Number(d[valueKey]) || 0), 1) : 1;
    return { totalVal: sum, maxVal: max };
  }, [safeData, valueKey]);

  const formatValue = (val: number) => {
    return `${valuePrefix}${formatTableNumber(val)}${valueSuffix}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    const val = Number(item[valueKey]) || 0;
    const sharePct = totalVal > 0 ? ((val / totalVal) * 100).toFixed(1) : '0.0';
    const pctOfMax = ((val / maxVal) * 100).toFixed(1);

    return <ChartTooltip title={item[categoryKey]} rows={[{ label: 'Metric Value', value: formatValue(val), color }, { label: 'Share of Total', value: `${sharePct}%` }, { label: 'Relative to Peak', value: `${pctOfMax}%` }]} />;
  };

  return (
    <ChartFrame title={title} className="cx-analytics-card" scope={<ReportingScopeSummary/>} header={<ChartToolbar visualData={safeData} title={title} subtitle={subtitle} auditTitle={auditTitle} auditContext={auditContext} auditGrain={auditGrain} />}>


      <div style={{ height, minHeight: height, width: '100%' }}>
        {!safeData.length ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-xs text-text-mute bg-surface-subtle  rounded-lg border border-dashed border-border-subtle  p-4">
            <span className="font-medium text-text-sec  mb-1">No category observations recorded.</span>
            <span className="text-[11px] text-text-mute">Select a wider date range or check data filters.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <BarChart data={safeData} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--cx-border-subtle)" />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--cx-text-secondary)' }}
              tickFormatter={(val) => `${valuePrefix}${formatChartAxis(val)}${valueSuffix}`}
            />
            <YAxis
              type="category"
              dataKey={categoryKey}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--cx-text-secondary)', fontWeight: 500 }}
              width={140}
            />
            <RechartsTooltip content={<CustomTooltip />} />
            <Bar dataKey={valueKey} fill={color} radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
              {safeData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>
    </ChartFrame>
  );
}
