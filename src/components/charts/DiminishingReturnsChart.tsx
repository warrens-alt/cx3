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
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-xl rounded-lg p-3 text-xs font-mono ring-1 ring-black/5 dark:ring-white/5 transition-all">
      <div className="font-sans font-semibold text-slate-800 dark:text-slate-100 pb-1.5 border-b border-slate-100 dark:border-slate-800 mb-2">
        {label}
      </div>
      <div className="space-y-1.5">
        {payload.map((entry: any, index: number) => {
          const isVolume = entry.name === volumeName;
          const displayVal = isVolume
            ? formatTableNumber(Number(entry.value))
            : `${Number(entry.value).toFixed(1)}%`;
          return (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 font-sans text-slate-600 dark:text-slate-300 text-[11px]">
                <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}</span>
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{displayVal}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
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
    <div className="enterprise-card p-5 flex flex-col h-full w-full">
      <ChartToolbar visualData={safeData}
        title={title} 
        subtitle={subtitle} 
        auditTitle={auditTitle} 
        auditContext={auditContext} 
        auditGrain={auditGrain} 
      />

      <div style={{ height, minHeight: height, width: '100%' }}>
        {!safeData.length ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-4">
            <span className="font-medium text-slate-600 dark:text-slate-300 mb-1">No diminishing returns observations recorded.</span>
            <span className="text-[11px] text-slate-400">Select a wider date range or check data filters.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <ComposedChart data={safeData} margin={{ top: 20, right: 25, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border, #f1f5f9)" />
            
            <XAxis 
              dataKey="bucket" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#64748b' }}
              dy={10}
            />
            
            <YAxis 
              yAxisId="left" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={(val) => formatChartAxis(val)}
            />
            
            <YAxis 
              yAxisId="right" 
              orientation="right"
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={(val) => `${val}%`}
              domain={[0, (dataMax: number) => Math.min(100, Math.ceil(dataMax * 1.25))]}
            />
            
            <Tooltip 
              cursor={{ fill: '#f8fafc' }}
              content={<CustomDiminishingTooltip volumeName={volumeName} />}
            />
            
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />

            {benchmarkThreshold !== undefined && (
              <ReferenceLine 
                yAxisId="right" 
                y={benchmarkThreshold} 
                stroke="#ef4444" 
                strokeDasharray="4 4" 
                label={{ 
                  value: benchmarkLabel, 
                  position: 'insideTopRight', 
                  fill: '#ef4444', 
                  fontSize: 12,
                  fontWeight: 500
                }} 
              />
            )}

            <Bar 
              yAxisId="left" 
              dataKey={volumeKey} 
              name={volumeName} 
              fill="#0F1E2E" 
              radius={[6, 6, 0, 0]} 
              isAnimationActive={false}
              maxBarSize={48}
            />

            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey={primaryLineKey} 
              name={primaryLineName} 
              stroke="#0D9488" 
              strokeWidth={2.5} 
              dot={{ r: 4, fill: '#0D9488', strokeWidth: 2, stroke: '#ffffff' }} 
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
                stroke="#D97706" 
                strokeWidth={2} 
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#D97706', strokeWidth: 2, stroke: '#ffffff' }} 
                activeDot={{ r: 5 }} 
                connectNulls={true}
                isAnimationActive={false} 
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
