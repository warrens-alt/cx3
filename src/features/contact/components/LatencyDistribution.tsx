import React, { useState } from 'react';
import EvidenceBars from '../../../shared/visuals/EvidenceBars';
import { lifecyclePresentation } from '../../../shared/visuals/lifecyclePresentation';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import type { SpeedToLeadData } from '../../../lib/offernetClient';

const measures = {
  leads: { label: 'Leads', color: lifecyclePresentation.dialled.color },
  contactRate: { label: 'RPC rate', color: lifecyclePresentation.rpc.color },
  saleRate: { label: 'Sale rate', color: lifecyclePresentation.sales.color },
} as const;
type Measure = keyof typeof measures;

/** Classify the label for presentation only; keep all returned cohort rows intact. */
export function latencyAppearance(cohort: string): 'invalid' | 'unrecorded' | 'queue' | undefined {
  if (/invalid|negative|anomal/i.test(cohort)) return 'invalid';
  if (/unrecorded|missing|unknown|unavailable/i.test(cohort)) return 'unrecorded';
  if (/undialled|undialed|awaiting|not dialled|no dial/i.test(cohort)) return 'queue';
  return undefined;
}

export default function LatencyDistribution({ rows }: { rows: SpeedToLeadData['cohorts'] }) {
  const [measure, setMeasure] = useState<Measure>('leads');
  const rate = measure !== 'leads';
  return <section className="cx-speed-distribution" aria-label="First-dial latency distribution">
    <div className="cx-viz-measure-switch" role="group" aria-label="Latency distribution measure">
      {(Object.keys(measures) as Measure[]).map(key => <button key={key} type="button" aria-pressed={measure === key} onClick={() => setMeasure(key)}>{measures[key].label}</button>)}
    </div>
    <EvidenceBars title="First-dial latency distribution"
      description="Capture to first dial: each row is a returned timing cohort. Undialled leads and invalid timing remain separate from measured latency."
      maximum={rate ? Math.max(100, ...rows.map(row => Number.isFinite(row[measure]) ? row[measure]! : 0)) : undefined}
      items={rows.map((row, index) => {
        const appearance = latencyAppearance(row.cohort);
        return {
          key: `${row.cohort}-${index}`, label: row.cohort, value: row[measure],
          displayValue: rate ? formatPercent(row[measure], measure === 'saleRate' ? 2 : 1) : formatTableNumber(row.leads),
          detail: `${formatTableNumber(row.leads)} leads · RPC ${formatPercent(row.contactRate)} · Sale ${formatPercent(row.saleRate, 2)}`,
          color: appearance ? 'var(--cx-text-muted)' : measures[measure].color,
          appearance,
        };
      })}
      scaleNote="Rates are descriptive associations within the supplied cohorts. Missing values have no bar; returned zero remains zero." />
  </section>;
}
