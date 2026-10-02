import ChartFrame from '../../shared/visuals/ChartFrame';
import ReportingScopeSummary from '../../shared/reporting/ReportingScopeSummary';
import ChartTooltip from '../../shared/visuals/ChartTooltip';
import React, { useMemo } from 'react';
import { formatKpiValue, formatChartAxis, formatTableNumber } from '../../lib/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { ChartToolbar } from './ChartToolbar';

interface DistributionBarProps {
  title: string;
  subtitle?: string;
  auditTitle?: string;
  auditContext?: any;
  auditGrain?: string;
  data: any[];
  bucketKey: string;
  valueKey: string;
  height?: number;
  color?: string;
  formatValue?: (val: number) => string;
}

export function DistributionBar({
  title,
  subtitle,
  data,
  bucketKey,
  valueKey,
  height = 250,
  color = 'var(--cx-action)',
  formatValue,
  auditTitle,
  auditContext,
  auditGrain
}: DistributionBarProps) {
  const safeData = useMemo(() => data || [], [data]);
  const defaultFormat = (val: number) => formatKpiValue(val);
  const formatter = formatValue || defaultFormat;
  const totalVal = useMemo(
    () => safeData.reduce((acc, curr) => acc + (Number(curr[valueKey]) || 0), 0),
    [safeData, valueKey]
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const val = Number(payload[0].value) || 0;
    const sharePct = totalVal > 0 ? ((val / totalVal) * 100).toFixed(1) : '0.0';

    return <ChartTooltip title={label} rows={[{ label: 'Records', value: formatTableNumber(val), color }, { label: 'Cohort Share', value: `${sharePct}%` }]} />;
  };

  return (
    <ChartFrame title={title} className="cx-analytics-card" scope={<ReportingScopeSummary/>} header={<ChartToolbar visualData={safeData} title={title} subtitle={subtitle} auditTitle={auditTitle} auditContext={auditContext} auditGrain={auditGrain} />}>


      <div style={{ height, minHeight: height, width: '100%' }}>
        {!safeData.length ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-xs text-text-mute bg-surface-subtle  rounded-lg border border-dashed border-border-subtle  p-4">
            <span className="font-medium text-text-sec  mb-1">No distribution observations recorded.</span>
            <span className="text-[11px] text-text-mute">Select a wider date range or check data filters.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <BarChart data={safeData} margin={{ top: 20, right: 10, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border-subtle)" />
              <XAxis
                dataKey={bucketKey}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--cx-text-secondary)' }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--cx-text-secondary)' }}
                tickFormatter={(val) => formatChartAxis(val)}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Bar dataKey={valueKey} fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={44}>
                {safeData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
                <LabelList dataKey={valueKey} position="top" formatter={formatter} style={{ fill: 'var(--cx-text-secondary)', fontSize: 10, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartFrame>
  );
}
