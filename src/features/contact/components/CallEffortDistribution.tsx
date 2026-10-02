import React, { useState } from 'react';
import EvidenceBars from '../../../shared/visuals/EvidenceBars';
import ChartFrame from '../../../shared/visuals/ChartFrame';
import ReportingScopeSummary from '../../../shared/reporting/ReportingScopeSummary';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import { lifecyclePresentation } from '../../../shared/visuals/lifecyclePresentation';
import type { ContactStrategyData } from '../../../lib/offernetClient';

const MEASURES = {
  leads: { label: 'Leads', color: lifecyclePresentation.fetched.color },
  contactRate: { label: 'RPC rate', color: lifecyclePresentation.rpc.color },
  saleRate: { label: 'Sale rate', color: lifecyclePresentation.sales.color },
} as const;
type Measure = keyof typeof MEASURES;

export default function CallEffortDistribution({ rows, onInspectBucket, selectedBucket, onSelectBucket, selection }: {
  rows: ContactStrategyData['attemptPerformance'];
  selectedBucket?: string | null;
  selection?: React.ReactNode;
  onSelectBucket?: (bucket: string) => void;
  onInspectBucket?: (bucket: string, leads: number) => void;
}) {
  const [measure, setMeasure] = useState<Measure>('leads');
  const rate = measure !== 'leads';
  return <ChartFrame className="cx-effort-distribution" title="Recorded call-effort ladder" subtitle={rate ? `${MEASURES[measure].label} by recorded call count.` : 'Lead volume by recorded call count.'} scope={<ReportingScopeSummary />}
    controls={<div className="cx-viz-measure-switch" role="group" aria-label="Distribution measure">{(Object.keys(MEASURES) as Measure[]).map(key =>
      <button type="button" key={key} aria-pressed={measure === key} onClick={() => setMeasure(key)}>{MEASURES[key].label}</button>
    )}</div>} footer={`${rows.length} returned buckets · exact evidence below`}>
    <EvidenceBars hideHeading title="Recorded call-effort ladder" description={rate
      ? `${MEASURES[measure].label} by recorded call count.`
      : 'Lead volume by recorded call count.'}
      maximum={rate ? Math.max(100, ...rows.map(row => Number.isFinite(row[measure]) ? row[measure]! : 0)) : undefined}
      items={rows.map(row => ({ key: row.bucket, label: row.bucket, value: row[measure],
        displayValue: rate ? formatPercent(row[measure], measure === 'saleRate' ? 2 : 1) : undefined,
        detail: `${rate ? `${formatTableNumber(row.leads)} leads` : `RPC ${formatPercent(row.contactRate)} · Sale ${formatPercent(row.saleRate, 2)}`}${row.bucket === 'Unrecorded' ? ' · Call count unavailable' : ''}`,
        appearance: row.bucket === 'Unrecorded' ? 'unrecorded' : undefined,
        color: row.bucket === 'Unrecorded' ? 'var(--cx-text-muted)' : MEASURES[measure].color }))}
      selectedKey={selectedBucket}
      selectionLabel={onSelectBucket ? 'Select' : 'Inspect'}
      onSelect={onSelectBucket || (onInspectBucket ? key => { const row = rows.find(item => item.bucket === key); if (row) onInspectBucket(row.bucket, row.leads); } : undefined)}
    />
    {selection}
  </ChartFrame>;
}
