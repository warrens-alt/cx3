import ChartFrame from '../../shared/visuals/ChartFrame';
import ReportingScopeSummary from '../../shared/reporting/ReportingScopeSummary';
import ChartTooltip from '../../shared/visuals/ChartTooltip';
import React, { useMemo } from 'react';
import { formatChartAxis, formatTableNumber } from '../../lib/formatters';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { ChartToolbar } from './ChartToolbar';

interface ComboChartProps {
  title: string;
  subtitle?: string;
  auditTitle?: string;
  auditContext?: any;
  auditGrain?: string;
  data: any[];
  xKey: string;
  barKey: string;
  lineKey: string;
  barName?: string;
  lineName?: string;
  barColor?: string;
  lineColor?: string;
  height?: number;
}

export function ComboChart({
  title,
  subtitle,
  data,
  xKey,
  barKey,
  lineKey,
  barName,
  lineName,
  barColor = 'var(--cx-action)',
  lineColor = 'var(--cx-chart-category-2)',
  height = 350,
  auditTitle,
  auditContext,
  auditGrain
}: ComboChartProps) {
  const safeData = useMemo(() => data || [], [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const barVal = payload.find((p: any) => p.dataKey === barKey)?.value;
    const lineVal = payload.find((p: any) => p.dataKey === lineKey)?.value;

    return <ChartTooltip title={label} rows={[{ label: barName || barKey, value: barVal !== undefined ? formatTableNumber(Number(barVal)) : '—', color: barColor }, { label: lineName || lineKey, value: lineVal !== undefined ? `${Number(lineVal).toFixed(1)}%` : '—', color: lineColor }]} />;
  };

  return (
    <ChartFrame title={title} className="cx-analytics-card" scope={<ReportingScopeSummary/>} header={<ChartToolbar visualData={safeData} title={title} subtitle={subtitle} auditTitle={auditTitle} auditContext={auditContext} auditGrain={auditGrain} />}>


      <div style={{ height, minHeight: height, width: '100%' }}>
        {!safeData.length ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-xs text-text-mute bg-surface-subtle rounded-lg border border-dashed border-border-subtle p-4">
            <span className="font-medium text-text-sec mb-1">No combo observations recorded.</span>
            <span className="text-[11px] text-text-mute">Select a wider date range or check data filters.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
            <ComposedChart data={safeData} margin={{ top: 16, right: 14, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border-subtle)" />
              <XAxis
                dataKey={xKey}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--cx-text-secondary)' }}
                dy={10}
              />
              <YAxis
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--cx-text-secondary)' }}
                tickFormatter={(val) => formatChartAxis(val)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--cx-text-secondary)' }}
                tickFormatter={(val) => `${formatChartAxis(val)}%`}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }} />
              <Bar
                yAxisId="left"
                dataKey={barKey}
                name={barName || barKey}
                fill={barColor}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
                maxBarSize={48}
              >
                {safeData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={barColor} />
                ))}
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey={lineKey}
                name={lineName || lineKey}
                stroke={lineColor}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: 'var(--cx-surface)', stroke: lineColor, strokeWidth: 2 }}
                activeDot={{ r: 5, fill: lineColor, stroke: 'var(--cx-surface)', strokeWidth: 2 }}
                connectNulls={true}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartFrame>
  );
}
