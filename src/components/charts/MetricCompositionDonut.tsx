import ChartFrame from '../../shared/visuals/ChartFrame';
import ReportingScopeSummary from '../../shared/reporting/ReportingScopeSummary';
import ChartTooltip from '../../shared/visuals/ChartTooltip';
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

const DEFAULT_PALETTE = Array.from({ length: 8 }, (_, index) => `var(--cx-chart-category-${index + 1})`);

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
    <ChartFrame title={title} className="cx-analytics-card" scope={<ReportingScopeSummary/>} header={<ChartToolbar
        visualData={safeData}
        title={title}
        subtitle={subtitle}
        auditTitle={auditTitle}
        auditContext={auditContext}
        auditGrain={auditGrain}
      />}>


      <div className="relative flex-1 flex items-center justify-center" style={{ minHeight: height }}>
        {!safeData.length || total === 0 ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-xs text-text-mute bg-surface-subtle  rounded-lg border border-dashed border-border-subtle  p-4">
            <span className="font-medium text-text-sec  mb-1">No composition slices recorded.</span>
            <span className="text-[11px] text-text-mute">Total volume is zero or unobserved in this scope.</span>
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
                      return <ChartTooltip title={item.name} rows={[{ label: centerLabel || 'Total', value: `${valuePrefix}${formatTableNumber(item.value)}${valueSuffix}`, color: payload[0].color }, { label: `Share of ${centerLabel || 'total'}`, value: `${pct}%` }]} />;
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
                        stroke="var(--cx-surface)"
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
                    return <span className="text-text-sec font-medium">{value}{pct}</span>;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Readout */}
            <div
              className="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none transition-all duration-150"
              style={{ maxWidth: innerRadius * 1.75 }}
            >
              <div className="text-[11px] font-semibold text-text-mute  uppercase tracking-wider truncate px-1">
                {displayCenterLabel}
              </div>
              <div className="text-lg sm:text-xl font-bold tabular-nums text-text-main  tracking-tight whitespace-nowrap">
                {displayCenterValue}
              </div>
              {activePct && (
                <div className="text-[10.5px] tabular-nums text-action  font-semibold tabular-nums">
                  {activePct}% share
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ChartFrame>
  );
}
