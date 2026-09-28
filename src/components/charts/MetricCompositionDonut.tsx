import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatChartAxis, formatTableNumber } from '../../lib/formatters';
import { ChartToolbar } from './ChartToolbar';

interface DonutSlice {
  name: string;
  value: number;
  color?: string;
  [key: string]: any;
}

interface MetricCompositionDonutProps {
  title: string;
  subtitle?: string;
  data: DonutSlice[];
  valuePrefix?: string;
  valueSuffix?: string;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  centerLabel?: string;
  centerValue?: string | number;
  auditTitle?: string;
  auditContext?: any;
  auditGrain?: string;
}

const DEFAULT_PALETTE = [
  '#315BCB', // Primary Cobalt Accent
  '#0F766E', // Teal
  '#7C3AED', // Violet
  '#0284C7', // Sky Blue
  '#D97706', // Warm Amber
  '#059669', // Emerald
  '#DB2777', // Berry Pink
  '#475569', // Slate
  '#0891B2'  // Cyan
];

export function MetricCompositionDonut({
  title,
  subtitle,
  data,
  valuePrefix = '',
  valueSuffix = '',
  height = 320,
  innerRadius = 65,
  outerRadius = 95,
  centerLabel,
  centerValue,
  auditTitle,
  auditContext,
  auditGrain
}: MetricCompositionDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const safeData = useMemo(() => data || [], [data]);

  const total = useMemo(
    () => safeData.reduce((sum, item) => sum + (Number(item.value) || 0), 0),
    [safeData]
  );
  const activeItem = activeIndex !== null && safeData[activeIndex] ? safeData[activeIndex] : null;
  const activePct = activeItem && total > 0 ? ((Number(activeItem.value) / total) * 100).toFixed(1) : null;

  const displayCenterValue = activeItem 
    ? `${valuePrefix}${formatTableNumber(Number(activeItem.value))}${valueSuffix}`
    : centerValue !== undefined 
      ? centerValue 
      : `${valuePrefix}${formatChartAxis(total)}${valueSuffix}`;

  const displayCenterLabel = activeItem ? activeItem.name : (centerLabel || 'Total');

  return (
    <div className="enterprise-card p-5 flex flex-col h-full w-full">
      <ChartToolbar 
        visualData={safeData}
        title={title} 
        subtitle={subtitle} 
        auditTitle={auditTitle} 
        auditContext={auditContext} 
        auditGrain={auditGrain} 
      />

      <div className="relative flex-1 flex items-center justify-center" style={{ minHeight: height }}>
        {!safeData.length || total === 0 ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-4">
            <span className="font-medium text-slate-600 dark:text-slate-300 mb-1">No composition slices recorded.</span>
            <span className="text-[11px] text-slate-400">Total volume is zero or unobserved in this scope.</span>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={height} minWidth={0}>
              <PieChart>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as DonutSlice;
                      const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                      return (
                        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl p-3 text-xs ring-1 ring-black/5 dark:ring-white/5 transition-all">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
                            <span 
                              className="w-2.5 h-2.5 rounded-full inline-block" 
                              style={{ backgroundColor: payload[0].color }} 
                            />
                            {item.name}
                          </div>
                          <div className="text-slate-700 dark:text-slate-200 font-mono text-sm font-bold tabular-nums">
                            {valuePrefix}{formatTableNumber(item.value)}{valueSuffix}
                          </div>
                          <div className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold font-mono mt-0.5 tabular-nums">
                            {pct}% of {centerLabel || 'total'}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Pie
                  data={safeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="48%"
                  innerRadius={innerRadius}
                  outerRadius={outerRadius}
                  paddingAngle={2.5}
                  isAnimationActive={false}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {safeData.map((entry, index) => {
                    const color = entry.color || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
                    const isHovered = activeIndex === index;
                    return (
                      <Cell
                        key={`slice-${index}`}
                        fill={color}
                        opacity={activeIndex === null || isHovered ? 1 : 0.65}
                        stroke="#ffffff"
                        strokeWidth={isHovered ? 2.5 : 1}
                      />
                    );
                  })}
                </Pie>
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ fontSize: '11px', paddingTop: '14px' }}
                  formatter={(value) => {
                    const item = safeData.find(d => d.name === value);
                    const pct = item && total > 0 ? ` (${((item.value / total) * 100).toFixed(0)}%)` : '';
                    return <span className="text-slate-600 font-medium">{value}{pct}</span>;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Readout */}
            <div 
              className="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none transition-all duration-150"
              style={{ maxWidth: innerRadius * 1.75 }}
            >
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate px-1">
                {displayCenterLabel}
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-slate-100 tracking-tight whitespace-nowrap">
                {displayCenterValue}
              </div>
              {activePct && (
                <div className="text-[10.5px] font-mono text-blue-700 dark:text-blue-400 font-semibold tabular-nums">
                  {activePct}% share
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
