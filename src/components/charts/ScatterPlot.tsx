import ChartFrame from '../../shared/visuals/ChartFrame';
import ReportingScopeSummary from '../../shared/reporting/ReportingScopeSummary';
import ChartTooltip from '../../shared/visuals/ChartTooltip';
import React, { useMemo } from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis, ReferenceLine } from 'recharts';
import { formatChartAxis, formatTableNumber } from '../../lib/formatters';
import { ChartToolbar } from './ChartToolbar';

interface ScatterPlotProps {
  title: string;
  subtitle?: string;
  auditTitle?: string;
  auditContext?: any;
  auditGrain?: string;
  data: any[];
  xKey: string;
  yKey: string;
  zKey?: string;
  nameKey: string;
  xLabel?: string;
  yLabel?: string;
  height?: number;
}

export function ScatterPlot({
  title,
  subtitle,
  data,
  xKey,
  yKey,
  zKey,
  nameKey,
  xLabel,
  yLabel,
  height = 360,
  auditTitle,
  auditContext,
  auditGrain
}: ScatterPlotProps) {
  const safeData = useMemo(() => data || [], [data]);

  // Calculate means for quadrant reference lines
  const { avgX, avgY } = useMemo(() => {
    if (!safeData.length) return { avgX: 0, avgY: 0 };
    const sumX = safeData.reduce((acc, curr) => acc + (Number(curr[xKey]) || 0), 0);
    const sumY = safeData.reduce((acc, curr) => acc + (Number(curr[yKey]) || 0), 0);
    return {
      avgX: sumX / safeData.length,
      avgY: sumY / safeData.length,
    };
  }, [safeData, xKey, yKey]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const pt = payload[0].payload;

    return <ChartTooltip title={pt[nameKey] || 'Item'} rows={[{ label: xLabel || xKey, value: typeof pt[xKey] === 'number' ? formatTableNumber(pt[xKey]) : pt[xKey] }, { label: yLabel || yKey, value: typeof pt[yKey] === 'number' ? `${Number(pt[yKey]).toFixed(1)}%` : pt[yKey] }, ...(zKey && pt[zKey] !== undefined ? [{ label: 'Volume', value: formatTableNumber(Number(pt[zKey])) }] : [])]} />;
  };

  return (
    <ChartFrame title={title} className="cx-analytics-card" scope={<ReportingScopeSummary/>} header={<ChartToolbar
        visualData={safeData}
        title={title}
        subtitle={subtitle}
        auditTitle={auditTitle}
        auditContext={auditContext}
        auditGrain={auditGrain}
      />}>


      <div style={{ height, minHeight: height, width: '100%' }}>
        {!safeData.length ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-xs text-text-mute bg-surface-subtle rounded-lg border border-dashed border-border-subtle p-4">
            <span className="font-medium text-text-sec mb-1">No scatter observations recorded.</span>
            <span className="text-[11px] text-text-mute">Select a wider date range or check data filters.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
            <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="var(--cx-border-subtle)" />
              <XAxis
                type="number"
                dataKey={xKey}
                name={xLabel || xKey}
                tick={{ fontSize: 11, fill: 'var(--cx-text-secondary)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatChartAxis(v)}
              />
              <YAxis
                type="number"
                dataKey={yKey}
                name={yLabel || yKey}
                tick={{ fontSize: 11, fill: 'var(--cx-text-secondary)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${formatChartAxis(v)}%`}
              />
              {zKey && <ZAxis type="number" dataKey={zKey} range={[80, 420]} />}
              {avgX > 0 && (
                <ReferenceLine x={avgX} stroke="var(--cx-border-strong)" strokeDasharray="4 4" strokeWidth={1.5} />
              )}
              {avgY > 0 && (
                <ReferenceLine y={avgY} stroke="var(--cx-border-strong)" strokeDasharray="4 4" strokeWidth={1.5} />
              )}
              <Tooltip content={<CustomTooltip />} />
              <Scatter isAnimationActive={false} name="Entities" data={safeData} fill="var(--cx-action)" fillOpacity={0.8} stroke="var(--cx-action-hover)" strokeWidth={1} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartFrame>
  );
}
