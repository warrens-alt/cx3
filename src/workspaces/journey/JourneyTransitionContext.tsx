import React, { useEffect } from 'react';
import { Link, type To } from 'react-router-dom';
import { useOperationalData } from '../../lib/useOperationalData';
import { fetchSpeedToLead, fetchContactStrategy, fetchSalesActivation, type ContactStrategyData, type SalesActivationData } from '../../lib/offernetClient';
import type { SpeedData } from '../../features/contact/model/useSpeedModel';
import { OperationalError } from '../../components/OperationalState';
import VisualSkeleton from '../../shared/visuals/VisualSkeleton';
import EvidenceBars from '../../shared/visuals/EvidenceBars';
import PercentileRail from '../../shared/visuals/PercentileRail';
import AuditEvidenceButton from '../../shared/evidence/AuditEvidenceButton';
import type { InspectorContent } from '../../shared/evidence/InspectorHost';
import { formatPercent, formatTableNumber } from '../../lib/formatters';
import { attemptInvestigationPath } from '../operations/operationsPresentation';
import type { JourneySelection } from './journeySelection';

const count = (value: number | null | undefined) => value == null ? 'Unavailable' : formatTableNumber(value);

/** Query identities match the detailed lenses; only the selected transition requests data. */
export default function JourneyTransitionContext({ selection, scope, auditScope, scoped, registerRefresh }: {
  selection: JourneySelection;
  scope: Record<string, unknown>;
  auditScope: InspectorContent['scope'];
  scoped: (path: string) => To;
  registerRefresh: (refresh: (() => Promise<void>) | null) => void;
}) {
  const speed = useOperationalData<SpeedData>('SpeedToLeadIntelligence', scope, fetchSpeedToLead, selection === 'delivered-to-dialled');
  const contact = useOperationalData<ContactStrategyData>('ContactStrategyIntelligence', scope, fetchContactStrategy, selection === 'dialled-to-rpc');
  const sales = useOperationalData<SalesActivationData>('SalesActivationPage', scope, fetchSalesActivation, selection === 'sales-to-activated');
  const query = selection === 'delivered-to-dialled' ? speed : selection === 'dialled-to-rpc' ? contact : sales;
  useEffect(() => { registerRefresh(() => query.loadData(true)); return () => registerRefresh(null); }, [query.loadData, registerRefresh]);
  const title = selection === 'delivered-to-dialled' ? 'Response speed in this cohort' : selection === 'dialled-to-rpc' ? 'Contact effort and outcomes in this cohort' : 'Activation ageing in this cohort';
  const audit: InspectorContent = { type: 'custom', title, scope: auditScope, provenance: { validationStatus: 'NOT_VERIFIED' }, definition: { meaning: 'Context for the selected transition across the same intake cohort. These measurements keep their original eligible populations; they are not filtered to the transition intersection or loss.', dateBasis: 'Lead capture cohort', nullMeaning: 'Missing values remain unavailable; recorded zero is retained.' } };
  const timing = speed.data?.timingStages?.find(stage => stage.stage === 'Delivery → First Dial');
  return <section className="cx-journey-transition-context" aria-label={title}>
    <header><h3>{title}</h3><AuditEvidenceButton content={audit} /></header>
    <p className="cx-viz-footnote">Same reporting scope · each analysis retains its own eligible population. Context does not imply that these records are the selected transition loss.</p>
    {query.error && <OperationalError message={query.error} onRetry={() => { void query.loadData(true); }} />}
    {query.loading && !query.data && <VisualSkeleton kind="bars" label={`Loading ${title.toLowerCase()}`} />}
    {selection === 'delivered-to-dialled' && speed.data && <>
      <PercentileRail title="Delivery → First Dial" description={timing?.description || 'No eligible delivery-to-dial timing observations were supplied.'} unitLabel="s" points={[
        { key: 'median', label: 'Median', value: timing?.medianSec, displayValue: timing?.median },
        { key: 'p75', label: 'P75', value: timing?.p75Sec, displayValue: timing?.p75 },
        { key: 'p90', label: 'P90', value: timing?.p90Sec, displayValue: timing?.p90 },
      ]} />
      <div className="cx-journey-context-values"><span>Awaiting first dial <strong>{count(speed.data.backlog?.awaitingFirstDial)}</strong></span><span>Oldest undialled <strong>{speed.data.backlog?.oldestUndialled || 'Unavailable'}</strong></span></div>
      <Link className="cx-button-secondary" to={scoped('/operations/response')}>Explore response distributions and waiting leads</Link>
    </>}
    {selection === 'dialled-to-rpc' && contact.data && <>
      <EvidenceBars title="Recorded call effort" description="Exclusive cumulative call-count buckets. Unrecorded counters are separate from zero; outcomes are not attributed to a particular attempt." items={contact.data.attemptPerformance.map(row => ({ key: row.bucket, label: row.bucket, value: row.leads, appearance: row.bucket === 'Unrecorded' ? 'unrecorded' : undefined, detail: `${formatPercent(row.contactRate)} RPC / dialled · ${formatPercent(row.saleRate)} sale / bucket leads`, color: 'var(--cx-data-dialled)' }))} />
      <details className="cx-report-disclosure"><summary>Exact contact effort evidence</summary><div className="cx-viz-table-scroll" role="region" aria-label="Journey call effort outcomes" tabIndex={0}><table className="cx-viz-table"><thead><tr><th>Bucket</th><th>Leads</th><th>Dialled</th><th>RPC</th><th>RPC / dialled</th><th>Sales</th><th>Sale / bucket leads</th><th>Records</th></tr></thead><tbody>{contact.data.attemptPerformance.map(row => <tr key={row.bucket}><th scope="row">{row.bucket}</th><td>{count(row.leads)}</td><td>{count(row.dialled)}</td><td>{count(row.contacted)}</td><td>{formatPercent(row.contactRate)}</td><td>{count(row.sales)}</td><td>{formatPercent(row.saleRate)}</td><td>{attemptInvestigationPath(row.bucket) ? <Link to={scoped(attemptInvestigationPath(row.bucket)!)}>Inspect bucket</Link> : 'Drill unavailable'}</td></tr>)}</tbody></table></div></details>
      <Link className="cx-button-secondary" to={scoped('/operations/contact')}>Explore contact effort and vendor outcomes</Link>
    </>}
    {selection === 'sales-to-activated' && sales.data && <>
      <div className="cx-journey-context-values"><span>Recorded sales <strong>{count(sales.data.reconciliation?.totalSales)}</strong></span><span>Recorded activations <strong>{count(sales.data.reconciliation?.totalActivations)}</strong></span></div>
      <EvidenceBars title="Sales awaiting activation by completed age" description="Returned non-overlapping age buckets. Future timestamp anomalies remain separate; the pending population is never derived by subtracting activations from sales." items={(sales.data.activationAgeing || []).map(row => ({ key: row.bucket, label: row.bucket, value: row.sales, appearance: row.bucket === 'Invalid future sale' ? 'invalid' : 'queue', color: row.bucket === 'Invalid future sale' ? 'var(--cx-negative)' : 'var(--cx-data-activation)' }))} />
      {!sales.data.activationAgeing?.length && <p className="cx-viz-footnote">Activation queue evidence unavailable.</p>}
      <Link className="cx-button-secondary" to={scoped('/journey/outcomes')}>Explore activation outcomes and source revenue</Link>
    </>}
  </section>;
}
