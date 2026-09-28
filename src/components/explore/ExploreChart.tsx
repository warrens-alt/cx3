import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import type { ExploreRow, ExploreView } from '../../lib/explore/model';
import { categoryColour, CHART_PALETTE } from '../../lib/visuals/palette';
import { formatChartAxis, formatTableNumber } from '../../lib/formatters';

export interface ExploreChartProps {
  rows: ExploreRow[];
  view: ExploreView;
  currency: string;
  limit: number;
  selectedSeries: string[];
  onInspect: (r: ExploreRow) => void;
  context: string;
}

export default function ExploreChart({
  rows,
  view,
  currency,
  limit,
  selectedSeries,
  onInspect,
  context,
}: ExploreChartProps) {
  const chartType = view.chart || 'bar';
  const displayed = (rows || []).slice(0, limit);

  const formatted = displayed.map((r) => {
    const val = typeof r.value === 'number' ? r.value : parseFloat(String(r.value || '0'));
    return {
      ...r,
      numericValue: Number.isNaN(val) ? 0 : val,
    };
  });

  const validPieRows = formatted.filter(r => r.numericValue > 0);

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const pt = payload[0];
    const row = pt?.payload;
    const val = typeof row?.numericValue === 'number' ? row.numericValue : pt?.value;

    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-3 text-xs min-w-[180px] ring-1 ring-black/5 dark:ring-white/5">
        <div className="font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1 mb-2 font-mono">
          {row?.label || label || 'Item'}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-600 dark:text-slate-400">Value</span>
          <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {typeof val === 'number' ? formatTableNumber(val) : val}
          </span>
        </div>
      </div>
    );
  };

  if (!formatted.length) {
    return (
      <div className="w-full h-80 my-4 flex flex-col items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 p-4">
        <span className="font-medium text-slate-600 mb-1">No exploration observations found.</span>
        <span className="text-[11px] text-slate-400">Try adjusting your dimension or filters.</span>
      </div>
    );
  }

  return (
    <div className="w-full h-80 min-h-[320px] my-4">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
        {chartType === 'line' ? (
          <LineChart data={formatted} margin={{ top: 12, right: 16, left: -10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={formatChartAxis} />
            <Tooltip content={<CustomChartTooltip />} />
            <Line
              type="monotone"
              dataKey="numericValue"
              stroke="#315BCB"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={true}
              isAnimationActive={false}
            />
          </LineChart>
        ) : chartType === 'area' ? (
          <AreaChart data={formatted} margin={{ top: 12, right: 16, left: -10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={formatChartAxis} />
            <Tooltip content={<CustomChartTooltip />} />
            <Area
              type="monotone"
              dataKey="numericValue"
              stroke="#315BCB"
              fill="#315BCB"
              fillOpacity={0.2}
              connectNulls={true}
              isAnimationActive={false}
            />
          </AreaChart>
        ) : chartType === 'donut' ? (
          <PieChart>
            <Tooltip content={<CustomChartTooltip />} />
            <Pie
              data={validPieRows}
              dataKey="numericValue"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="75%"
              onClick={(e: any) => onInspect(e.payload)}
            >
              {validPieRows.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={categoryColour(entry.label)} />
              ))}
            </Pie>
          </PieChart>
        ) : chartType === 'column' ? (
          <BarChart data={formatted} margin={{ top: 12, right: 16, left: -10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={formatChartAxis} />
            <Tooltip content={<CustomChartTooltip />} />
            <Bar
              dataKey="numericValue"
              fill="#315BCB"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
              onClick={(e: any) => onInspect(e)}
            />
          </BarChart>
        ) : (
          <BarChart data={formatted} layout="vertical" margin={{ top: 8, right: 16, left: 10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={formatChartAxis} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={120} />
            <Tooltip content={<CustomChartTooltip />} />
            <Bar
              dataKey="numericValue"
              fill="#315BCB"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
              onClick={(e: any) => onInspect(e)}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
