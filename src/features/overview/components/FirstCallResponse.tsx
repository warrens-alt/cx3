import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { OverviewData } from '../../../lib/offernetClient';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import { useScopedNavigationTarget } from '../../../hooks/useScopedNavigationTarget';
import type { InspectorContent } from '../../../shared/evidence/InspectorHost';

/** Displays the existing Overview response; does not request another report. */
export default function FirstCallResponse({ sla, backlog, deliveredCount, onInspect }: Pick<OverviewData, 'sla' | 'backlog'> & { deliveredCount?: number; onInspect?: (content: InspectorContent) => void }) {
  const scoped = useScopedNavigationTarget();
  const compliance = sla?.complianceRate;
  const showCompliance = typeof compliance === 'number' && Number.isFinite(compliance) && compliance >= 0 && compliance <= 100;
  return <section className="cx-overview-response cx-report-panel" aria-label="First-call response">
    <header className="cx-report-panel-heading">
      <div><h2>First-call response</h2><p>{sla ? `Delivered leads called within ${sla.firstDialTargetMinutes} minutes.` : 'Response measurements are unavailable in this selection.'}</p></div>
      <Link to={scoped('/speed-to-lead')}>Response speed <ArrowRight size={13} aria-hidden="true" /></Link>
    </header>
    <strong className="cx-overview-response-value">{formatPercent(sla?.complianceRate)}</strong>
    <div className="cx-overview-response-track" data-evidence={showCompliance ? 'observed' : 'unavailable'} aria-hidden="true">{showCompliance && <span style={{ width: `${compliance}%` }} />}</div>
    <p className="cx-overview-response-context">{sla ? 'Reported first-call target compliance' : 'Target compliance unavailable'}</p>
    {onInspect && <button type="button" className="cx-audit-evidence-control" aria-label="Audit evidence: First-call response compliance" onClick={() => onInspect({ type: 'custom', title: 'First-call response compliance', value: formatPercent(sla?.complianceRate), numeratorCount: null, numeratorLabel: `Delivered leads first dialled within ${sla?.firstDialTargetMinutes ?? 'the target'} minutes (not supplied)`, denominatorCount: deliveredCount ?? null, denominatorLabel: 'Delivered leads', anatomy: { kind: 'ratio', label: 'First-call response compliance', value: formatPercent(sla?.complianceRate), numerator: { key: 'within-target', label: 'Within-target first dials (not supplied)', value: null }, denominator: { key: 'delivered', label: 'Delivered leads', value: deliveredCount ?? null }, detail: 'The response supplies compliance and the delivered population, but does not supply the qualifying first-dial numerator. No numerator is reconstructed from the rounded rate.' }, definition: { meaning: sla ? `Delivered leads with first dial within ${sla.firstDialTargetMinutes} minutes, as returned by Overview.` : 'First-call response measurements were not supplied.', dateBasis: 'Lead capture cohort', nullMeaning: 'Unavailable timing evidence is not measured zero.' }, reportPath: '/speed-to-lead', detailLimitation: 'An exact within-target first-dial record drill is not supplied by the current route.' })}>Audit evidence</button>}
    <dl className="cx-overview-response-details">
      <div><dt>Typical wait</dt><dd>{sla?.medianDeliveryToDial || '—'}</dd></div>
      <div><dt>90% of recorded waits</dt><dd>{sla?.p90DeliveryToDial || '—'}</dd></div>
      <div><dt>Awaiting first call</dt><dd>{formatTableNumber(backlog?.awaitingFirstDial)}</dd></div>
      <div><dt>Waiting over 60 min</dt><dd>{formatTableNumber(backlog?.over60Minutes)}</dd></div>
    </dl>
  </section>;
}
