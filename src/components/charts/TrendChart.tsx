import ChartFrame from '../../shared/visuals/ChartFrame';
import ReportingScopeSummary from '../../shared/reporting/ReportingScopeSummary';
import ChartTooltip from '../../shared/visuals/ChartTooltip';
import React, { useId, useMemo } from 'react';
import { formatChartAxis, formatTableNumber } from '../../lib/formatters';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartToolbar } from './ChartToolbar';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TrendChartProps {
  title: string;
  subtitle?: string;
  data: any[];
  currentKey: string;
  comparisonKey?: string;
  xAxisKey: string;
  valuePrefix?: string;
  valueSuffix?: string;
  height?: number;
  options?: { label: string; value: string }[];
  auditTitle?: string;
  auditContext?: any;
  auditGrain?: string;
  onOptionChange?: (val: string) => void;
  selectedOption?: string;
}

export function TrendChart({
  title,
  subtitle,
  data,
  currentKey,
  comparisonKey,
  xAxisKey,
  valuePrefix = '',
  valueSuffix = '',
  height = 300,
  options,
  onOptionChange,
  selectedOption,
  auditTitle,
  auditContext,
  auditGrain
}: TrendChartProps) {

  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const safeData = useMemo(() => data || [], [data]);

  const formatValue = (val: number) => {
    return `${valuePrefix}${formatTableNumber(val)}${valueSuffix}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const currentVal = payload.find((p: any) => p.dataKey === currentKey)?.value;
    const prevVal = comparisonKey ? payload.find((p: any) => p.dataKey === comparisonKey)?.value : null;

    let deltaPct: number | null = null;
    let deltaAbs: number | null = null;
    if (prevVal !== null && prevVal !== undefined && prevVal !== 0 && currentVal !== undefined) {
      deltaAbs = currentVal - prevVal;
      deltaPct = Number(((deltaAbs / prevVal) * 100).toFixed(1));
    }

    return <ChartTooltip title={label} rows={[{ label: 'Current', value: currentVal !== undefined ? formatValue(Number(currentVal)) : '—', color: 'var(--cx-action)' }, ...(comparisonKey && prevVal !== null && prevVal !== undefined ? [{ label: 'Previous', value: formatValue(Number(prevVal)), color: 'var(--cx-text-muted)' }] : []), ...(deltaPct !== null && deltaAbs !== null ? [{ label: 'Change', value: `${deltaPct >= 0 ? '+' : ''}${deltaPct}% (${deltaAbs >= 0 ? '+' : ''}${formatValue(deltaAbs)})` }] : [])]} />;
  };

  return (
    <ChartFrame title={title} className="cx-analytics-card" scope={<ReportingScopeSummary/>} header={<ChartToolbar visualData={safeData} title={title} subtitle={subtitle} auditTitle={auditTitle} auditContext={auditContext} auditGrain={auditGrain}>
        {options && (
          <select
            aria-label={`${title} measure`}
            value={selectedOption}
            onChange={(e) => onOptionChange?.(e.target.value)}
            className="border border-border-subtle rounded-lg px-3 py-1.5 bg-surface text-xs sm:text-sm font-medium text-text-main outline-none focus:border-[var(--cx-action)] focus:ring-1 focus:ring-[var(--cx-action)]/30 transition-all cursor-pointer shadow-2xs"
          >
            {options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      </ChartToolbar>}>


      <div style={{ height, minHeight: height, width: '100%' }}>
        {!safeData.length ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-xs text-text-mute bg-surface-subtle  rounded-lg border border-dashed border-border-subtle  p-4">
            <span className="font-medium text-text-sec  mb-1">No trend observations recorded.</span>
            <span className="text-[11px] text-text-mute">Select a wider date range or check data filters.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <AreaChart data={safeData} margin={{ top: 12, right: 14, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--cx-action)" stopOpacity={0.24}/>
                <stop offset="95%" stopColor="var(--cx-action)" stopOpacity={0.01}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border-subtle)" />
            <XAxis
              dataKey={xAxisKey}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--cx-text-secondary)' }}
              tickFormatter={(val) => formatChartAxis(val)}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--cx-text-secondary)' }}
              tickFormatter={(val) => `${valuePrefix}${formatChartAxis(val)}${valueSuffix}`}
              dx={-6}
            />
            <RechartsTooltip content={<CustomTooltip />} />

            {comparisonKey && (
              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey={comparisonKey}
                stroke="var(--cx-text-muted)"
                strokeWidth={1.8}
                strokeDasharray="4 4"
                fill="none"
                name="Previous Period"
                connectNulls={true}
              />
            )}

            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey={currentKey}
              stroke="var(--cx-action)"
              strokeWidth={2.5}
              activeDot={{ r: 5, fill: 'var(--cx-action)', stroke: 'var(--cx-surface)', strokeWidth: 2 }}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              name="Current Period"
              connectNulls={true}
            />
            {comparisonKey && (
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                iconType="plainline"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>
    </ChartFrame>
  );
}
