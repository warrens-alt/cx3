import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { OverviewData } from '../../../lib/offernetClient';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import { useScopedNavigationTarget } from '../../../hooks/useScopedNavigationTarget';

/** Displays the existing Overview response; does not request another report. */
export default function FirstCallResponse({ sla, backlog }: Pick<OverviewData, 'sla' | 'backlog'>) {
  const scoped = useScopedNavigationTarget();
  return <section className="cx-overview-response cx-report-panel" aria-label="First-call response">
    <header className="cx-report-panel-heading">
      <div><h2>First-call response</h2><p>{sla ? `Delivered leads called within ${sla.firstDialTargetMinutes} minutes.` : 'Response measurements are unavailable in this selection.'}</p></div>
      <Link to={scoped('/speed-to-lead')}>Response speed <ArrowRight size={13} aria-hidden="true" /></Link>
    </header>
    <strong className="cx-overview-response-value">{formatPercent(sla?.complianceRate)}</strong>
    <dl className="cx-overview-response-details">
      <div><dt>Typical wait</dt><dd>{sla?.medianDeliveryToDial || '—'}</dd></div>
      <div><dt>90% of recorded waits</dt><dd>{sla?.p90DeliveryToDial || '—'}</dd></div>
      <div><dt>Awaiting first call</dt><dd>{formatTableNumber(backlog?.awaitingFirstDial)}</dd></div>
      <div><dt>Waiting over 60 min</dt><dd>{formatTableNumber(backlog?.over60Minutes)}</dd></div>
    </dl>
  </section>;
}
