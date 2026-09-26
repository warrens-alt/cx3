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

  const formattedRows = rows.map((r) => {
    const obj: any = { label: r.label || r.key || 'Unknown', key: r.key || r.label };
    for (const s of series) {
      const val = r[s.key];
      obj[s.key] = val !== null && val !== undefined ? (typeof val === 'number' ? val : parseFloat(val)) : null;
    }
    return obj;
  });

  return (
    <div className="enterprise-card p-5 space-y-4">
      <div className="flex items-start justify-between">
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
                chartType === t ? 'bg-white shadow-xs font-semibold text-blue-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'donut' || chartType === 'pie' ? (
            <PieChart>
              <Tooltip />
              <Pie
                data={formattedRows.filter(r => r[series[0]?.key] > 0)}
                dataKey={series[0]?.key || 'leads'}
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={chartType === 'donut' ? '40%' : 0}
                outerRadius="75%"
                onClick={(e: any) => onSelect && onSelect(e.payload?.key || e.name)}
              >
                {formattedRows.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={categoryColour(entry.label)} />
                ))}
              </Pie>
            </PieChart>
          ) : chartType === 'line' ? (
            <LineChart data={formattedRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map((s, idx) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={CHART_PALETTE[idx % CHART_PALETTE.length]}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={formattedRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map((s, idx) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
                  maxBarSize={36}
                  onClick={(e: any) => onSelect && onSelect(e.key || e.label)}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
