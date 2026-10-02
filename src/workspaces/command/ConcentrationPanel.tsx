import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LifecycleDiagnostics } from '../../../contracts/lifecycleAnalytics';
import { useScopedNavigationTarget } from '../../hooks/useScopedNavigationTarget';
import ChartFrame from '../../shared/visuals/ChartFrame';
import EvidenceBars from '../../shared/visuals/EvidenceBars';
import ReportingScopeSummary from '../../shared/reporting/ReportingScopeSummary';

const DIMENSIONS = ['vendor', 'source', 'grade'] as const;
type Dimension = typeof DIMENSIONS[number];

/** Presentation uses returned populations. No inferred rates or contribution methodology. */
export function concentrationRows(lifecycle: LifecycleDiagnostics | undefined, dimension: Dimension) {
  if (!lifecycle || lifecycle.unsupportedDimensions?.includes(dimension)) return [];
  return (lifecycle.segments?.[dimension] || []).map(row => ({
    key: row.key, label: row.key, value: Number.isFinite(row.fetched) ? row.fetched : null,
  })).sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.label.localeCompare(b.label));
}

export default function ConcentrationPanel({ lifecycle }: { lifecycle?: LifecycleDiagnostics }) {
  const [dimension, setDimension] = useState<Dimension>('vendor');
  const rows = useMemo(() => concentrationRows(lifecycle, dimension), [lifecycle, dimension]);
  const navigate = useNavigate();
  const scoped = useScopedNavigationTarget();
  return <ChartFrame title="Where is the population concentrated?" scope={<ReportingScopeSummary />}
    subtitle="Descriptive concentration of fetched leads. Select a segment to investigate its exact population."
    controls={<label className="cx-command-lens-control">Lens <select aria-label="Concentration lens" value={dimension} onChange={event => setDimension(event.target.value as Dimension)}>
      {DIMENSIONS.filter(item => !lifecycle?.unsupportedDimensions?.includes(item)).map(item => <option value={item} key={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>)}
    </select></label>}
    footer={`Showing ${Math.min(8, rows.length)} of ${rows.length} returned segments. This is population concentration, not causal attribution.`}>
    <EvidenceBars title="Current fetched population" description="Fetched lead count in each returned segment; unavailable counts remain unavailable."
      items={rows.slice(0, 8)} selectionLabel="Investigate" onSelect={key => navigate(scoped(`/investigate?drill=lifecycle-segment&drillValue=${encodeURIComponent(`${dimension}:${key}`)}`))} />
    {rows.length > 8 && <details className="cx-report-disclosure"><summary>All returned segments</summary><EvidenceBars title="Exact segment populations" description="Complete returned breakdown."
      items={rows} selectionLabel="Investigate" onSelect={key => navigate(scoped(`/investigate?drill=lifecycle-segment&drillValue=${encodeURIComponent(`${dimension}:${key}`)}`))} /></details>}
  </ChartFrame>;
}
