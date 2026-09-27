import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { categoryColour, CHART_PALETTE } from '../../lib/visuals/palette';

export interface VettingChartProps {
  title: string;
  description?: string;
  rows: any[];
  series: Array<{ key: string; label: string }>;
  disjoint?: boolean;
  initial?: 'bar' | 'column' | 'line' | 'pie' | 'donut';
  onSelect?: (val: string) => void;
  ordered?: boolean;
  unit?: string;
}

export default function VettingChart({
  title,
  description,
  rows,
  series,
  disjoint,
  initial = 'bar',
  onSelect,
  ordered,
  unit,
}: VettingChartProps) {
  const [chartType, setChartType] = useState(initial);

  const formattedRows = (rows || []).map((r) => {
    const obj: any = { label: r.label || r.key || 'Unknown', key: r.key || r.label };
    for (const s of series) {
      const val = r[s.key];
      obj[s.key] = val !== null && val !== undefined ? (typeof val === 'number' ? val : parseFloat(val)) : null;
    }
    return obj;
  });

  const pieSeriesKey = series[0]?.key || 'leads';
  const validPieRows = formattedRows.filter((r) => (r[pieSeriesKey] ?? 0) > 0);

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-3 text-xs min-w-[180px] ring-1 ring-black/5 dark:ring-white/5">
        <div className="font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1 mb-2 font-mono">
          {label || payload[0]?.name || 'Segment'}
        </div>
        <div className="space-y-1.5">
          {payload.map((entry: any, idx: number) => (
            <div key={`tip-${idx}`} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: entry.color || entry.fill }} />
                <span>{entry.name}</span>
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {typeof entry.value === 'number' ? entry.value.toLocaleString() : (entry.value ?? '—')}
                {unit ? ` ${unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="enterprise-card p-5 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded text-[11px]">
          {(['bar', 'line', 'donut'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setChartType(t)}
              className={`px-2 py-0.5 rounded capitalize ${
                chartType === t ? 'bg-white shadow-xs font-semibold text-[#315BCB]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 w-full">
        {!formattedRows.length ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 p-4">
            <span className="font-medium text-slate-600 mb-1">No vetting records available.</span>
            <span className="text-[11px] text-slate-400">Current filter scope returned zero matching groups.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
            {chartType === 'donut' || chartType === 'pie' ? (
              <PieChart>
                <Tooltip content={<CustomChartTooltip />} />
                <Pie
                  data={validPieRows}
                  dataKey={pieSeriesKey}
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={chartType === 'donut' ? '40%' : 0}
                  outerRadius="75%"
                  onClick={(e: any) => onSelect && onSelect(e.payload?.key || e.name)}
                >
                  {validPieRows.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={categoryColour(entry.label)} />
                  ))}
                </Pie>
              </PieChart>
            ) : chartType === 'line' ? (
              <LineChart data={formattedRows} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => typeof v === 'number' ? v.toLocaleString() : v} />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                {series.map((s, idx) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={CHART_PALETTE[idx % CHART_PALETTE.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart data={formattedRows} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => typeof v === 'number' ? v.toLocaleString() : v} />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                {series.map((s, idx) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                    onClick={(e: any) => onSelect && onSelect(e.key || e.label)}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
