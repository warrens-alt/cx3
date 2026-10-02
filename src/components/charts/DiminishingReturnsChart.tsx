import ChartFrame from '../../shared/visuals/ChartFrame';
import ReportingScopeSummary from '../../shared/reporting/ReportingScopeSummary';
import ChartTooltip from '../../shared/visuals/ChartTooltip';
import React, { useMemo } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { formatChartAxis, formatTableNumber } from '../../lib/formatters';
import { ChartToolbar } from './ChartToolbar';

interface DiminishingDataPoint {
  bucket: string;
  volume: number;
  rpcRate?: number;
  saleRate?: number;
  activationRate?: number;
  revPerLead?: number;
  [key: string]: any;
}

interface DiminishingReturnsChartProps {
  title: string;
  subtitle?: string;
  data: DiminishingDataPoint[];
  volumeKey?: string;
  volumeName?: string;
  primaryLineKey?: string;
  primaryLineName?: string;
  secondaryLineKey?: string;
  secondaryLineName?: string;
  benchmarkThreshold?: number;
  benchmarkLabel?: string;
  height?: number;
  auditTitle?: string;
  auditContext?: any;
  auditGrain?: string;
}

const CustomDiminishingTooltip = ({ active, payload, label, volumeName }: any) => {
  if (!active || !payload || !payload.length) return null;
  return <ChartTooltip title={label} rows={payload.map((entry: any) => ({ label: entry.name, color: entry.color, value: entry.name === volumeName ? formatTableNumber(Number(entry.value)) : `${Number(entry.value).toFixed(1)}%` }))} />;
};

export function DiminishingReturnsChart({
  title,
  subtitle,
  data,
  volumeKey = 'current',
  volumeName = 'Records in Band',
  primaryLineKey = 'rpc',
  primaryLineName = 'RPC Flag Share (%)',
  secondaryLineKey = 'sale',
  secondaryLineName = 'Sale Flag Share (%)',
  benchmarkThreshold,
  benchmarkLabel = 'Yield Benchmark',
  height = 360,
  auditTitle,
  auditContext,
  auditGrain
}: DiminishingReturnsChartProps) {
  const safeData = useMemo(() => data || [], [data]);

  return (
    <ChartFrame title={title} className="cx-analytics-card" scope={<ReportingScopeSummary/>} header={<ChartToolbar visualData={safeData}
        title={title}
        subtitle={subtitle}
        auditTitle={auditTitle}
        auditContext={auditContext}
        auditGrain={auditGrain}
      />}>


      <div style={{ height, minHeight: height, width: '100%' }}>
        {!safeData.length ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-xs text-text-mute bg-surface-subtle  rounded-lg border border-dashed border-border-subtle  p-4">
            <span className="font-medium text-text-sec  mb-1">No diminishing returns observations recorded.</span>
            <span className="text-[11px] text-text-mute">Select a wider date range or check data filters.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <ComposedChart data={safeData} margin={{ top: 20, right: 25, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border-subtle)" />

            <XAxis
              dataKey="bucket"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'var(--cx-text-secondary)' }}
              dy={10}
            />

            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'var(--cx-text-secondary)' }}
              tickFormatter={(val) => formatChartAxis(val)}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'var(--cx-text-secondary)' }}
              tickFormatter={(val) => `${val}%`}
              domain={[0, (dataMax: number) => Math.min(100, Math.ceil(dataMax * 1.25))]}
            />

            <Tooltip
              cursor={{ fill: 'var(--cx-surface-subtle)' }}
              content={<CustomDiminishingTooltip volumeName={volumeName} />}
            />

            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />

            {benchmarkThreshold !== undefined && (
              <ReferenceLine
                yAxisId="right"
                y={benchmarkThreshold}
                stroke="var(--cx-warning)"
                strokeDasharray="4 4"
                label={{
                  value: benchmarkLabel,
                  position: 'insideTopRight',
                  fill: 'var(--cx-warning)',
                  fontSize: 12,
                  fontWeight: 500
                }}
              />
            )}

            <Bar
              yAxisId="left"
              dataKey={volumeKey}
              name={volumeName}
              fill="var(--cx-text-muted)"
              radius={[6, 6, 0, 0]}
              isAnimationActive={false}
              maxBarSize={48}
            />

            <Line
              yAxisId="right"
              type="monotone"
              dataKey={primaryLineKey}
              name={primaryLineName}
              stroke="var(--cx-data-rpc)"
              strokeWidth={2.5}
              dot={{ r: 4, fill: 'var(--cx-data-rpc)', strokeWidth: 2, stroke: 'var(--cx-surface)' }}
              activeDot={{ r: 6 }}
              connectNulls={true}
              isAnimationActive={false}
            />

            {secondaryLineKey && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey={secondaryLineKey}
                name={secondaryLineName}
                stroke="var(--cx-data-sales)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: 'var(--cx-data-sales)', strokeWidth: 2, stroke: 'var(--cx-surface)' }}
                activeDot={{ r: 5 }}
                connectNulls={true}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
        )}
      </div>
    </ChartFrame>
  );
}
