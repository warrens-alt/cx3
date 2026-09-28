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

    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl p-3 text-xs min-w-[200px] ring-1 ring-black/5 dark:ring-white/5 transition-all">
        <div className="font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-2 font-mono flex items-center justify-between">
          <span>{label}</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans font-normal">Observation</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-[#315BCB] dark:bg-[#3B82F6] shrink-0" />
              <span>Current</span>
            </div>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {currentVal !== undefined ? formatValue(Number(currentVal)) : '—'}
            </span>
          </div>

          {comparisonKey && prevVal !== null && prevVal !== undefined && (
            <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-slate-400 dark:bg-slate-500 shrink-0" />
                <span>Previous</span>
              </div>
              <span className="font-mono tabular-nums">
                {formatValue(Number(prevVal))}
              </span>
            </div>
          )}

          {deltaPct !== null && deltaAbs !== null && (
            <div className={`mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold ${
              deltaPct >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
            }`}>
              <span className="flex items-center gap-0.5">
                {deltaPct >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {deltaPct >= 0 ? `+${deltaPct}%` : `${deltaPct}%`}
              </span>
              <span className="font-mono text-[10px] font-normal text-slate-400 dark:text-slate-500">
                ({deltaAbs >= 0 ? `+${formatValue(deltaAbs)}` : formatValue(deltaAbs)})
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="enterprise-card p-5 flex flex-col h-full w-full">
      <ChartToolbar visualData={safeData} title={title} subtitle={subtitle} auditTitle={auditTitle} auditContext={auditContext} auditGrain={auditGrain}>
        {options && (
          <select 
            aria-label={`${title} measure`}
            value={selectedOption}
            onChange={(e) => onOptionChange?.(e.target.value)}
            className="border border-border-subtle rounded-lg px-3 py-1.5 bg-surface text-xs sm:text-sm font-medium text-text-main outline-none focus:border-[#315BCB] focus:ring-1 focus:ring-[#315BCB]/30 transition-all cursor-pointer shadow-2xs"
          >
            {options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      </ChartToolbar>
      
      <div style={{ height, minHeight: height, width: '100%' }}>
        {!safeData.length ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-4">
            <span className="font-medium text-slate-600 dark:text-slate-300 mb-1">No trend observations recorded.</span>
            <span className="text-[11px] text-slate-400">Select a wider date range or check data filters.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <AreaChart data={safeData} margin={{ top: 12, right: 14, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#315BCB" stopOpacity={0.24}/>
                <stop offset="95%" stopColor="#315BCB" stopOpacity={0.01}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EDF3" />
            <XAxis 
              dataKey={xAxisKey} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(val) => formatChartAxis(val)}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(val) => `${valuePrefix}${formatChartAxis(val)}${valueSuffix}`}
              dx={-6} 
            />
            <RechartsTooltip content={<CustomTooltip />} />
            
            {comparisonKey && (
              <Area 
                isAnimationActive={false}
                type="monotone" 
                dataKey={comparisonKey} 
                stroke="#94a3b8" 
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
              stroke="#315BCB" 
              strokeWidth={2.5} 
              activeDot={{ r: 5, fill: '#315BCB', stroke: '#ffffff', strokeWidth: 2 }}
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
    </div>
  );
}
