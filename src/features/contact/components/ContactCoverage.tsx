import React from 'react';
import { PhoneCall, PhoneOff, CircleHelp } from 'lucide-react';
import type { ContactStrategyData } from '../../../lib/offernetClient';
import { formatTableNumber } from '../../../lib/formatters';

export default function ContactCoverage({ summary, onInspectBucket }: {
  summary: NonNullable<ContactStrategyData['summary']>;
  onInspectBucket?: (bucket: string, leads: number) => void;
}) {
  const parts = [
    { name: 'Dialled leads', count: summary.dialledLeads, color: 'var(--cx-data-dialled)', icon: PhoneCall },
    { name: 'Recorded zero calls', count: summary.zeroCallLeads, color: 'var(--cx-warning)', icon: PhoneOff, bucket: '0 calls' },
    { name: 'Call count unrecorded', count: summary.unrecordedCallLeads, color: 'var(--cx-text-muted)', icon: CircleHelp, bucket: 'Unrecorded' },
  ];
  const complete = parts.every(p => p.count != null && Number.isFinite(p.count) && p.count >= 0)
    && Number.isFinite(summary.totalLeads) && summary.totalLeads > 0
    && parts.reduce((sum, p) => sum + p.count, 0) === summary.totalLeads;
  return <section className="cx-contact-coverage" aria-label="Recorded call-count coverage">
    <header className="cx-viz-panel-heading"><div><h3>Recorded call-count coverage</h3><p>Keep confirmed zero-call records separate from missing feedback.</p></div>
      <span className="cx-viz-population"><strong>{formatTableNumber(summary.totalLeads)}</strong> leads in scope</span></header>
    <div className="cx-coverage-track" aria-hidden="true" data-state={complete ? 'observed' : 'unknown'}>
      {complete && parts.map(part => <span key={part.name} style={{ width: `${part.count / summary.totalLeads * 100}%`, background: part.color }} />)}
    </div>
    {!complete && <p className="cx-viz-footnote">{summary.totalLeads === 0 ? 'No lead population in this selection.' : 'A complete partition is unavailable; the returned counts remain separate.'}</p>}
    <div className="cx-coverage-legend">{parts.map(part => {
      const Icon = part.icon;
      const content = <><Icon size={16} style={{ color: part.color }} aria-hidden="true" /><span>{part.name}<strong>{formatTableNumber(part.count)}</strong></span></>;
      return part.bucket && onInspectBucket ? <button type="button" key={part.name} onClick={() => onInspectBucket(part.bucket!, part.count)} aria-label={`Inspect ${part.name}: ${formatTableNumber(part.count)}`}>{content}</button>
        : <div key={part.name}>{content}</div>;
    })}</div>
  </section>;
}
