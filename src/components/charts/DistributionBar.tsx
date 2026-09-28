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
  color = '#315BCB',
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

    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl p-3 text-xs min-w-[180px] ring-1 ring-black/5 dark:ring-white/5 transition-all">
        <div className="font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1 mb-2 font-mono flex items-center justify-between">
          <span>{label}</span>
          <span className="text-[10px] text-slate-400 font-sans font-normal">Bucket</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 dark:text-slate-400">Records</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatTableNumber(val)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-blue-700 dark:text-blue-400">
            <span>Cohort Share</span>
            <span className="font-mono font-semibold tabular-nums">
              {sharePct}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="enterprise-card p-5 flex flex-col h-full w-full">
      <ChartToolbar visualData={safeData} title={title} subtitle={subtitle} auditTitle={auditTitle} auditContext={auditContext} auditGrain={auditGrain} />
      
      <div style={{ height, minHeight: height, width: '100%' }}>
        {!safeData.length ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-4">
            <span className="font-medium text-slate-600 dark:text-slate-300 mb-1">No distribution observations recorded.</span>
            <span className="text-[11px] text-slate-400">Select a wider date range or check data filters.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <BarChart data={safeData} margin={{ top: 20, right: 10, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border, #f1f5f9)" />
              <XAxis 
                dataKey={bucketKey}
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#64748b' }} 
                dy={8}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#64748b' }} 
                tickFormatter={(val) => formatChartAxis(val)}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Bar dataKey={valueKey} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={44}>
                {safeData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
                <LabelList dataKey={valueKey} position="top" formatter={formatter} style={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
