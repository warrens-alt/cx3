import React, { useState } from 'react';
import { Text } from 'recharts';

/** Keep category labels at reading size; full source text remains in the SVG title. */
export function CategoryAxisTick({ x = 0, y = 0, payload, horizontal = false }: {
  x?: number; y?: number; payload?: { value?: unknown }; horizontal?: boolean;
}) {
  const label = String(payload?.value ?? '');
  return <g className="cx-category-tick" aria-label={label}>
    <title>{label}</title>
    <Text x={x} y={horizontal ? y : y + 8} width={horizontal ? 126 : 104} maxLines={1} breakAll
      textAnchor={horizontal ? 'end' : 'middle'} verticalAnchor={horizontal ? 'middle' : 'start'}
      style={{ fontSize: 12 }} fill="var(--cx-text-secondary)">{label}</Text>
  </g>;
}

export const categoryPlotWidth = (count: number, axisSpace = 128) => count * 120 + axisSpace;
export const chartTooltipWrapperStyle: React.CSSProperties = {
  position: 'absolute', top: 8, left: 8, maxWidth: 'calc(100% - 16px)', pointerEvents: 'none',
};

/** The legend and tooltip stay in the visible frame while the dense plot scrolls. */
export function CategoryChartFrame({ title, height, minWidth, legend, children }: {
  title: string; height: number; minWidth: number;
  legend?: Array<{ label: string; color: string }>;
  children: (portal: HTMLDivElement | null) => React.ReactNode;
}) {
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  return <div className="cx-category-chart">
    <div className="cx-chart-tooltip-host" ref={setPortal} />
    <div className="cx-chart-scroll" role="region" aria-label={`${title} chart`} tabIndex={0}>
      <div style={{ height, minHeight: height, width: '100%', minWidth }}>{children(portal)}</div>
    </div>
    {legend && <ul className="cx-chart-series" aria-label="Chart series">{legend.map(item =>
      <li key={item.label}><i aria-hidden="true" style={{ background: item.color }} />{item.label}</li>)}</ul>}
  </div>;
}
