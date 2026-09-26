import React from 'react';
import { formatChartAxis, formatTableNumber } from '../../lib/formatters';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { ChartToolbar } from './ChartToolbar';

interface ComboChartProps {
  title: string;
  subtitle?: string;
  auditTitle?: string;
  auditContext?: any;
  auditGrain?: string;
  data: any[];
  xKey: string;
  barKey: string;
  lineKey: string;
  barName?: string;
  lineName?: string;
  barColor?: string;
  lineColor?: string;
  height?: number;
}

export function ComboChart({
  title,
  subtitle,
  data,
  xKey,
  barKey,
  lineKey,
  barName,
  lineName,
  barColor = '#18364F',
  lineColor = '#059669',
  height = 350,
  auditTitle,
  auditContext,
  auditGrain
}: ComboChartProps) {
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const barVal = payload.find((p: any) => p.dataKey === barKey)?.value;
    const lineVal = payload.find((p: any) => p.dataKey === lineKey)?.value;

    return (
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[180px] ring-1 ring-black/5">
        <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-2 font-mono">
          {label}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: barColor }} />
              <span>{barName || barKey}</span>
            </div>
            <span className="font-mono font-bold text-slate-900 tabular-nums">
              {barVal !== undefined ? formatTableNumber(Number(barVal)) : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 shrink-0" style={{ backgroundColor: lineColor }} />
              <span>{lineName || lineKey}</span>
            </div>
            <span className="font-mono font-bold tabular-nums" style={{ color: lineColor }}>
              {lineVal !== undefined ? `${Number(lineVal).toFixed(1)}%` : '—'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="enterprise-card p-5 flex flex-col h-full w-full">
      <ChartToolbar visualData={data} title={title} subtitle={subtitle} auditTitle={auditTitle} auditContext={auditContext} auditGrain={auditGrain} />
      
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 14, left: -10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey={xKey} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: '#64748b' }} 
              dy={10}
            />
            <YAxis 
              yAxisId="left" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: '#64748b' }} 
              tickFormatter={(val) => formatChartAxis(val)}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: '#64748b' }} 
              tickFormatter={(val) => `${formatChartAxis(val)}%`}
            />
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }} />
            <Bar 
              yAxisId="left" 
              dataKey={barKey} 
              name={barName || barKey} 
              radius={[4, 4, 0, 0]} 
              isAnimationActive={false}
              maxBarSize={48}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={barColor} />
              ))}
            </Bar>
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey={lineKey} 
              name={lineName || lineKey} 
              stroke={lineColor} 
              strokeWidth={2.5} 
              dot={{ r: 3.5, fill: '#ffffff', stroke: lineColor, strokeWidth: 2 }} 
              activeDot={{ r: 5, fill: lineColor, stroke: '#ffffff', strokeWidth: 2 }} 
              isAnimationActive={false} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
