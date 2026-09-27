import React from 'react';

export interface ExactBarChartItem {
  id?: string;
  label: string;
  value: string | number | null;
  formatted: string;
  secondary?: string | number | null;
  secondaryFormatted?: string;
}

export interface ExactBarChartProps {
  data?: ExactBarChartItem[];
  items?: ExactBarChartItem[];
  title?: string;
  description?: string;
  empty?: string;
  metricLabel?: string;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}

export default function ExactBarChart({
  data,
  items,
  title,
  description,
  empty,
  metricLabel,
  onSelect,
  selectedId,
}: ExactBarChartProps) {
  const chartItems = data || items || [];
  const numericValues = chartItems
    .map(i => (typeof i.value === 'number' ? i.value : parseFloat(String(i.value || '0'))))
    .filter(v => !Number.isNaN(v) && v > 0);

  const max = numericValues.length > 0 ? Math.max(...numericValues) : 1;

  return (
    <div className="enterprise-card p-5 space-y-4">
      {(title || description) && (
        <div className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            {title && <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>}
            {metricLabel && <span className="text-xs text-slate-500">{metricLabel}</span>}
          </div>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      )}

      <div className="space-y-3">
        {chartItems.map((item, idx) => {
          const itemId = item.id || item.label || String(idx);
          const val = typeof item.value === 'number' ? item.value : parseFloat(String(item.value || '0'));
          const pct = Math.min(100, Math.max(0, (val / max) * 100));
          const isSelected = selectedId === itemId;

          return (
            <div
              key={itemId}
              onClick={() => onSelect && onSelect(itemId)}
              className={`p-2 rounded-lg transition ${
                onSelect ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60' : ''
              } ${isSelected ? 'bg-blue-50 dark:bg-blue-950/40 ring-1 ring-[#315BCB]' : ''}`}
            >
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{item.label}</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{item.formatted}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#315BCB] dark:bg-[#3B82F6] h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {item.secondaryFormatted && (
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 text-right font-mono tabular-nums">
                  {item.secondaryFormatted}
                </div>
              )}
            </div>
          );
        })}

        {chartItems.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400">
            {empty || 'No chart data available for the current scope.'}
          </div>
        )}
      </div>
    </div>
  );
}
