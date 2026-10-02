import React from 'react';

/** Shared aligned tooltip shell; exact values also belong in the visual or evidence table. */
export default function ChartTooltip({ title, rows }: {
  title: React.ReactNode;
  rows: { label: string; value: React.ReactNode; color?: string }[];
}) {
  return <div className="cx-chart-tooltip cx-analytics-tooltip">
    <strong className="cx-chart-tooltip-title">{title}</strong>
    {rows.map(row => <div className="cx-chart-tooltip-row" key={row.label}>
      <span className="cx-chart-tooltip-label">{row.color && <i style={{ background: row.color }} aria-hidden="true" />} {row.label}</span>
      <span className="cx-chart-tooltip-value">{row.value}</span>
    </div>)}
  </div>;
}
