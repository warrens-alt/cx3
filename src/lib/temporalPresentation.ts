import type { TemporalData } from './offernetClient';

/** A missing requested event basis cannot substitute another timestamp population. */
export function selectTemporalHeatmap(data: (TemporalData & { timeBases?: Array<{ basis: string; heatmap: TemporalData['heatmap'] }> }) | undefined, basis: string): TemporalData['heatmap'] {
  const selected = data?.timeBases?.find(item => item.basis === basis);
  if (selected) return selected.heatmap || [];
  return basis === 'Capture' ? data?.heatmap || [] : [];
}
