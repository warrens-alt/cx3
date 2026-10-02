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
  const numericValue = (value: ExactBarChartItem['value']): number | null => {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const numericValues = chartItems.map(i => numericValue(i.value)).filter((v): v is number => v !== null);
  const max = Math.max(1, ...numericValues.map(Math.abs));
  const signed = numericValues.some(v => v < 0);

  return (
    <section className="enterprise-card p-5 space-y-4" aria-label={title || metricLabel || 'Exact values'}>
      {(title || description) && <header className="pb-3 border-b border-border-subtle">
        {title && <h3 className="font-semibold text-text-main text-sm">{title}</h3>}
        {metricLabel && <p className="text-xs text-text-sec">{metricLabel}</p>}
        {description && <p className="text-xs text-text-sec mt-1">{description}</p>}
      </header>}
      {signed && <p className="text-xs text-text-sec">Zero is at the centre. Negative values extend left; positive values extend right. Labels preserve the supplied precision.</p>}
      <div className="space-y-3">
        {chartItems.map((item, idx) => {
          const itemId = item.id || item.label || String(idx);
          const value = numericValue(item.value);
          const width = value === null ? 0 : Math.abs(value) / max * (signed ? 50 : 100);
          const isSelected = selectedId === itemId;
          const Element = onSelect ? 'button' : 'div';
          return <Element key={itemId} type={onSelect ? 'button' : undefined}
            onClick={onSelect ? () => onSelect(itemId) : undefined}
            aria-pressed={onSelect && selectedId !== undefined ? isSelected : undefined}
            className={`block w-full text-left p-2 rounded-lg ${onSelect ? 'cursor-pointer hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-action' : ''} ${isSelected ? 'ring-1 ring-action' : ''}`}>
            <div className="flex flex-wrap justify-between gap-2 text-xs mb-1">
              <span className="font-medium text-text-sec break-words min-w-0">{item.label}</span>
              <span className="font-sans tabular-nums font-semibold text-text-main tabular-nums break-all">{item.formatted}</span>
            </div>
            <div className="relative w-full bg-surface-subtle h-2 rounded-full overflow-hidden" aria-hidden="true" data-state={value === null ? 'unknown' : value === 0 ? 'zero' : 'observed'}>
              {signed && <span className="absolute top-0 bottom-0 left-1/2 border-l border-text-mute" />}
              <div className="absolute top-0 h-full bg-action rounded-full" style={{width:`${width}%`,left:`${signed ? value !== null && value < 0 ? 50-width : 50 : 0}%`}} />
            </div>
            {value === null && <p className="text-xs text-text-mute mt-1">No numeric evidence</p>}
            {item.secondaryFormatted && <p className="text-xs text-text-sec mt-1 text-right font-sans tabular-nums tabular-nums">{item.secondaryFormatted}</p>}
          </Element>;
        })}
        {chartItems.length === 0 && <p className="text-center py-8 text-xs text-text-sec">{empty || 'No chart data available for the current scope.'}</p>}
      </div>
    </section>
  );
}
