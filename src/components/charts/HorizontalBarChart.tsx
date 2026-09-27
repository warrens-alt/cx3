import React from 'react';
import { formatChartAxis, formatTableNumber } from '../../lib/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartToolbar } from './ChartToolbar';

interface HorizontalBarChartProps {
  title: string;
  subtitle?: string;
  auditTitle?: string;
  auditContext?: any;
  auditGrain?: string;
  data: any[];
  categoryKey: string;
  valueKey: string;
  valuePrefix?: string;
  valueSuffix?: string;
  height?: number;
  color?: string;
}

export function HorizontalBarChart({
  title,
  subtitle,
  data,
  categoryKey,
  valueKey,
  valuePrefix = '',
  valueSuffix = '',
  height = 300,
  color = '#315BCB',
  auditTitle,
  auditContext,
  auditGrain
}: HorizontalBarChartProps) {
  
  const totalVal = data.reduce((acc, curr) => acc + (Number(curr[valueKey]) || 0), 0);
  const maxVal = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);

  const formatValue = (val: number) => {
    return `${valuePrefix}${formatTableNumber(val)}${valueSuffix}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    const val = Number(item[valueKey]) || 0;
    const sharePct = totalVal > 0 ? ((val / totalVal) * 100).toFixed(1) : '0.0';
    const pctOfMax = ((val / maxVal) * 100).toFixed(1);

    return (
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[190px] ring-1 ring-black/5">
        <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-2">
          {item[categoryKey]}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Metric Value</span>
            <span className="font-mono font-bold text-slate-900 tabular-nums">
              {formatValue(val)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Share of Total</span>
            <span className="font-mono font-semibold text-blue-700 tabular-nums">
              {sharePct}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400 pt-1 border-t border-slate-100">
            <span>Relative to Peak</span>
            <span className="font-mono tabular-nums">{pctOfMax}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="enterprise-card p-5 flex flex-col h-full w-full">
      <ChartToolbar visualData={data} title={title} subtitle={subtitle} auditTitle={auditTitle} auditContext={auditContext} auditGrain={auditGrain} />
      
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis 
              type="number"
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(val) => `${valuePrefix}${formatChartAxis(val)}${valueSuffix}`}
            />
            <YAxis 
              type="category"
              dataKey={categoryKey} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }}
              width={140}
            />
            <RechartsTooltip content={<CustomTooltip />} />
            <Bar dataKey={valueKey} radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
