import React, { useState } from 'react';
import EvidenceBars from '../../../shared/visuals/EvidenceBars';
import { formatPercent } from '../../../lib/formatters';
import type { ContactStrategyData } from '../../../lib/offernetClient';

const MEASURES = {
  leads: { label: 'Leads', color: 'var(--cx-data-fetched)' },
  contactRate: { label: 'RPC rate', color: 'var(--cx-data-rpc)' },
  saleRate: { label: 'Sale rate', color: 'var(--cx-data-sales)' },
} as const;
type Measure = keyof typeof MEASURES;

export default function CallEffortDistribution({ rows, onInspectBucket }: {
  rows: ContactStrategyData['attemptPerformance'];
  onInspectBucket?: (bucket: string, leads: number) => void;
}) {
  const [measure, setMeasure] = useState<Measure>('leads');
  const rate = measure !== 'leads';
  return <section className="cx-effort-distribution" aria-label="Call-count distribution">
    <div className="cx-viz-measure-switch" role="group" aria-label="Distribution measure">{(Object.keys(MEASURES) as Measure[]).map(key =>
      <button type="button" key={key} aria-pressed={measure === key} onClick={() => setMeasure(key)}>{MEASURES[key].label}</button>
    )}</div>
    <EvidenceBars title="Call-count distribution" description={rate
      ? `${MEASURES[measure].label} within each recorded call-count bucket. This is an association, not the outcome of that particular attempt.`
      : 'Lead volumes by total recorded calls. Select a bar to inspect that exact bucket.'}
      maximum={rate ? Math.max(100, ...rows.map(row => Number.isFinite(row[measure]) ? row[measure]! : 0)) : undefined}
      items={rows.map(row => ({ key: row.bucket, label: row.bucket, value: row[measure],
        displayValue: rate ? formatPercent(row[measure]) : undefined,
        color: row.bucket === 'Unrecorded' ? 'var(--cx-text-muted)' : MEASURES[measure].color }))}
      onSelect={onInspectBucket ? key => { const row = rows.find(item => item.bucket === key); if (row) onInspectBucket(row.bucket, row.leads); } : undefined}
      scaleNote={rate ? 'Returned rates are preserved. Unavailable rates have no bar; zero remains zero.' : 'All returned buckets are shown. Bar lengths reflect counts, not targets or recommended effort.'}
    />
  </section>;
}
