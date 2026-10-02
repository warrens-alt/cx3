import React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartFrame from '../../shared/visuals/ChartFrame';
import ChartTooltip from '../../shared/visuals/ChartTooltip';
import ReportingScopeSummary from '../../shared/reporting/ReportingScopeSummary';
import AuditEvidenceButton from '../../shared/evidence/AuditEvidenceButton';
import type { InspectorContent } from '../../shared/evidence/InspectorHost';
import { formatTableNumber } from '../../lib/formatters';

export const OPERATIONAL_TREND_SERIES = [
  { key: 'delivered', label: 'Delivered', color: 'var(--cx-data-delivered)', dash: undefined },
  { key: 'dialled', label: 'Dialled', color: 'var(--cx-data-dialled)', dash: '6 3' },
  { key: 'contacted', label: 'RPC', color: 'var(--cx-data-rpc)', dash: '2 3' },
  { key: 'sales', label: 'Recorded sales', color: 'var(--cx-data-sales)', dash: '8 3 2 3' },
];
export default function OperationsTrend({ rows, audit }: { rows: Array<{ date: string; delivered?: number | null; dialled?: number | null; contacted?: number | null; sales?: number | null }>; audit: InspectorContent }) {
  return <ChartFrame title="Volume and outcome trend" subtitle="Daily lead capture cohorts · stage populations retain their own qualification rules." scope={<ReportingScopeSummary />} actions={<AuditEvidenceButton content={audit} />}>
    {!rows.length ? <p className="cx-viz-empty">No daily observations were returned for this scope.</p> : <>
      <div className="cx-operations-trend-legend">{OPERATIONAL_TREND_SERIES.map(series => <span key={series.key}><i style={{ borderColor: series.color, borderStyle: series.dash ? 'dashed' : 'solid' }} aria-hidden="true" />{series.label}</span>)}</div>
      <div className="cx-operations-trend-canvas"><ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
        <LineChart data={rows} accessibilityLayer margin={{ top: 12, left: 0, right: 14, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--cx-border-subtle)" />
          <XAxis dataKey="date" minTickGap={40} tickFormatter={value => String(value).slice(5)} tick={{ fontSize: 11, fill: 'var(--cx-text-muted)' }} tickLine={false} />
          <YAxis width={45} allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--cx-text-muted)' }} axisLine={false} tickLine={false} />
          <Tooltip content={({ active, payload, label }) => active && payload?.length ? <ChartTooltip title={label} rows={payload.map(item => ({ label: String(item.name), color: item.color, value: typeof item.value === 'number' || typeof item.value === 'string' ? formatTableNumber(item.value) : 'Unavailable' }))} /> : null} />
          {OPERATIONAL_TREND_SERIES.map(series => <Line key={series.key} dataKey={series.key} name={series.label} type="linear" stroke={series.color} strokeDasharray={series.dash} strokeWidth={2} dot={rows.length < 3} connectNulls={false} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer></div>
      <details className="cx-report-disclosure"><summary>Exact daily trend values</summary><div className="cx-viz-table-scroll" role="region" aria-label="Operational daily trend values" tabIndex={0}><table className="cx-viz-table"><thead><tr><th>Capture date</th>{OPERATIONAL_TREND_SERIES.map(series => <th key={series.key}>{series.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.date}><th scope="row">{row.date}</th>{OPERATIONAL_TREND_SERIES.map(series => <td key={series.key}>{row[series.key as 'delivered'] == null ? 'Unavailable' : formatTableNumber(row[series.key as 'delivered'])}</td>)}</tr>)}</tbody></table></div></details>
    </>}
    <p className="cx-viz-footnote">Up to 60 returned capture dates. Missing daily values stay absent; this is not an event-date trend or a matched previous-period series.</p>
  </ChartFrame>;
}
