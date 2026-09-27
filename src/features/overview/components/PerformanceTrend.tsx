import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Clock3 } from 'lucide-react';
import { formatTableNumber } from '../../../lib/formatters';

interface DailyTrendItem {
  date: string;
  fetchedLeads?: number;
  deliveredLeads?: number;
  dialledLeads?: number;
  saleLeads?: number;
  activatedLeads?: number;
  [key: string]: any;
}

interface PerformanceTrendProps {
  data?: DailyTrendItem[];
  comparisonWindow?: {
    startDate: string;
    endDate: string;
  };
}

export default function PerformanceTrend({ data = [], comparisonWindow }: PerformanceTrendProps) {
  const [activeMetric, setActiveMetric] = useState<'fetchedLeads' | 'saleLeads' | 'deliveredLeads'>('fetchedLeads');

  const metricConfigs = {
    fetchedLeads: { label: 'Fetched leads', color: '#3562B3' },
    deliveredLeads: { label: 'Delivered leads', color: '#0284C7' },
    saleLeads: { label: 'Recorded sales', color: '#059669' },
  };

  const currentConfig = metricConfigs[activeMetric];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="cx-chart-tooltip">
        <div className="cx-chart-tooltip-title">{label}</div>
        <div className="cx-chart-tooltip-row">
          <span className="cx-chart-tooltip-label">{currentConfig.label}:</span>
          <span className="cx-chart-tooltip-value">
            {formatTableNumber(payload[0]?.value)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <section className="cx-card p-5 flex flex-col justify-between" aria-label="Performance trend">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-text-main">Performance trend</h2>
          <p className="text-xs text-text-sec mt-0.5">
            Daily progression across the selected reporting period.
          </p>
        </div>

        {/* Metric Selector Tabs */}
        <div className="flex items-center gap-1 bg-surface-subtle p-1 rounded-lg border border-border-subtle text-xs">
          {(Object.keys(metricConfigs) as Array<keyof typeof metricConfigs>).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveMetric(key)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                activeMetric === key
                  ? 'bg-surface text-text-main shadow-xs font-semibold'
                  : 'text-text-mute hover:text-text-main'
              }`}
            >
              {metricConfigs[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border-subtle)" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--cx-text-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--cx-border-subtle)' }}
              />
              <YAxis
                tick={{ fill: 'var(--cx-text-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={val => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val))}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey={activeMetric}
                stroke={currentConfig.color}
                strokeWidth={2.5}
                dot={{ r: 2, fill: currentConfig.color }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-text-mute">
            No daily trend data available in this scope.
          </div>
        )}
      </div>

      {/* Comparison Context Footer */}
      <div className="pt-3 mt-2 border-t border-border-subtle flex items-center gap-1.5 text-xs text-text-mute">
        <Clock3 size={13} aria-hidden="true" />
        <span>
          {comparisonWindow
            ? `Compared against preceding matched window (${comparisonWindow.startDate} – ${comparisonWindow.endDate}).`
            : 'Select explicit dates in the scope bar to enable matched-period comparison.'}
        </span>
      </div>
    </section>
  );
}
