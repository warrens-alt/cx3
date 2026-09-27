import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { OverviewData } from '../lib/offernetClient';
import { formatChartAxis, formatTableNumber } from '../lib/formatters';

export default function OverviewTrendChart({ data }: { data: OverviewData['dailyTrends'] }) {
  if (!data || !data.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
        <span>No daily trend observations recorded.</span>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-md rounded-lg p-2.5 text-xs ring-1 ring-black/5">
        <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-1.5 font-mono">
          {label}
        </div>
        <div className="space-y-1">
          {payload.map((item: any) => (
            <div key={item.dataKey} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.name}:</span>
              </span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {item.value != null ? formatTableNumber(item.value) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <AreaChart data={data} accessibilityLayer margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="commandLeads" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#315BCB" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#315BCB" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EDF3" />
        <XAxis
          dataKey="date"
          tickFormatter={value => String(value).slice(5)}
          minTickGap={26}
          tick={{ fontSize: 11, fill: '#64748B' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={formatChartAxis}
          tick={{ fontSize: 11, fill: '#64748B' }}
          tickLine={false}
          axisLine={false}
          width={46}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="leads"
          name="Fetched leads"
          stroke="#315BCB"
          strokeWidth={2}
          fill="url(#commandLeads)"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="sales"
          name="Recorded sales"
          stroke="#0F766E"
          strokeWidth={2}
          fillOpacity={0}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
