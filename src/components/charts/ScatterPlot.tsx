import React from 'react';
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
  
  // Calculate means for quadrant reference lines
  const avgX = data.length > 0 
    ? data.reduce((acc, curr) => acc + (Number(curr[xKey]) || 0), 0) / data.length 
    : 0;
  const avgY = data.length > 0 
    ? data.reduce((acc, curr) => acc + (Number(curr[yKey]) || 0), 0) / data.length 
    : 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const pt = payload[0].payload;

    return (
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[200px] ring-1 ring-black/5">
        <div className="font-semibold text-slate-900 border-b border-slate-100 pb-1 mb-2">
          {pt[nameKey] || 'Item'}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">{xLabel || xKey}</span>
            <span className="font-mono font-bold text-slate-800 tabular-nums">
              {typeof pt[xKey] === 'number' ? formatTableNumber(pt[xKey]) : pt[xKey]}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">{yLabel || yKey}</span>
            <span className="font-mono font-bold text-emerald-700 tabular-nums">
              {typeof pt[yKey] === 'number' ? `${Number(pt[yKey]).toFixed(1)}%` : pt[yKey]}
            </span>
          </div>
          {zKey && pt[zKey] !== undefined && (
            <div className="flex items-center justify-between gap-3 text-slate-500 pt-1 border-t border-slate-100">
              <span>Volume</span>
              <span className="font-mono tabular-nums">{formatTableNumber(Number(pt[zKey]))}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="enterprise-card p-5 flex flex-col h-full w-full">
      <ChartToolbar 
        visualData={data} 
        title={title} 
        subtitle={subtitle} 
        auditTitle={auditTitle} 
        auditContext={auditContext} 
        auditGrain={auditGrain} 
      />
      
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#f1f5f9" />
            <XAxis 
              type="number" 
              dataKey={xKey} 
              name={xLabel || xKey} 
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatChartAxis(v)}
            />
            <YAxis 
              type="number" 
              dataKey={yKey} 
              name={yLabel || yKey} 
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${formatChartAxis(v)}%`}
            />
            {zKey && <ZAxis type="number" dataKey={zKey} range={[80, 420]} />}
            {avgX > 0 && (
              <ReferenceLine x={avgX} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={1.5} />
            )}
            {avgY > 0 && (
              <ReferenceLine y={avgY} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={1.5} />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Scatter name="Entities" data={data} fill="#2563EB" fillOpacity={0.75} stroke="#1D4ED8" strokeWidth={1} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
