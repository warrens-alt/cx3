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
  const displayed = rows.slice(0, limit);

  const formatted = displayed.map((r) => {
    const val = typeof r.value === 'number' ? r.value : parseFloat(String(r.value || '0'));
    return {
      ...r,
      numericValue: Number.isNaN(val) ? 0 : val,
    };
  });

  return (
    <div className="w-full h-80 my-4">
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 'line' ? (
          <LineChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="numericValue"
              stroke="#315BCB"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        ) : chartType === 'area' ? (
          <AreaChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="numericValue"
              stroke="#315BCB"
              fill="#315BCB"
              fillOpacity={0.2}
            />
          </AreaChart>
        ) : chartType === 'donut' ? (
          <PieChart>
            <Tooltip />
            <Pie
              data={formatted.filter(r => r.numericValue > 0)}
              dataKey="numericValue"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="75%"
              onClick={(e: any) => onInspect(e.payload)}
            >
              {formatted.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={categoryColour(entry.label)} />
              ))}
            </Pie>
          </PieChart>
        ) : chartType === 'column' ? (
          <BarChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar
              dataKey="numericValue"
              fill="#315BCB"
              maxBarSize={36}
              onClick={(e: any) => onInspect(e)}
            />
          </BarChart>
        ) : (
          <BarChart data={formatted} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={120} />
            <Tooltip />
            <Bar
              dataKey="numericValue"
              fill="#315BCB"
              maxBarSize={24}
              onClick={(e: any) => onInspect(e)}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
