import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock3, Search } from 'lucide-react';
import AnalyticsPageLayout from '../../components/AnalyticsPageLayout';
import ReportingScopeBar from '../../shared/reporting/ReportingScopeBar';
import { ReportStatusSlot } from '../../shared/reporting/ReportPresentation';
import ReportingScopeSummary from '../../shared/reporting/ReportingScopeSummary';
import ChartFrame from '../../shared/visuals/ChartFrame';
import EvidenceBars from '../../shared/visuals/EvidenceBars';
import VisualSkeleton from '../../shared/visuals/VisualSkeleton';
import AuditEvidenceButton from '../../shared/evidence/AuditEvidenceButton';
import type { InspectorContent } from '../../shared/evidence/InspectorHost';
import { OperationalError } from '../../components/OperationalState';
import { useClient } from '../../lib/ClientContext';
import { useFilters, extractOffernetFilters } from '../../lib/FilterContext';
import { useOperationalData } from '../../lib/useOperationalData';
import { fetchOverview, type OverviewData } from '../../lib/offernetClient';
import { useOperatingControls } from '../../hooks/useOperatingControls';
import { useScopedNavigationTarget } from '../../hooks/useScopedNavigationTarget';
import { formatTableNumber, formatPercent } from '../../lib/formatters';
import OperationsTrend from './OperationsTrend';
import { operationAttemptItems, attemptInvestigationPath } from './operationsPresentation';

const count = (value: number | null | undefined) => value == null ? 'Unavailable' : formatTableNumber(value);
export default function OperationsOverview() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const scoped = useScopedNavigationTarget();
  const navigate = useNavigate();
  const scope = useMemo(() => ({ clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined, ...extractOffernetFilters(filters) }), [selectedClient, startDate, endDate, filters]);
  // Same resource identities as Command and the existing control lenses: React Query shares work.
  const overview = useOperationalData<OverviewData>('ExecutiveOverview', scope, fetchOverview);
  const controls = useOperatingControls();
  const [vendorMeasure, setVendorMeasure] = useState<'rpcRate' | 'leadToSaleRate' | 'zeroCallLeads'>('rpcRate');
  const data = overview.data;
  const evidence = controls.data;
  const refresh = async () => { await Promise.allSettled([overview.loadData(true), controls.refetch()]); };
  const auditScope = { clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined, filters };
  const audit = (title: string, options: Partial<InspectorContent> = {}): InspectorContent => ({ type: 'custom', title, scope: auditScope, provenance: { validationStatus: 'NOT_VERIFIED' }, definition: { grain: 'Distinct analytical lead', dateBasis: 'Lead capture cohort', nullMeaning: 'Unknown values and counters remain unavailable.' }, ...options });
  const metrics = [
    { label: 'Delivered', value: count(data?.kpis.deliveredLeads), metricId: 'delivered_leads', stage: 'delivered', note: 'Qualified delivery' },
    { label: 'Dialled', value: count(data?.kpis.dialledLeads), metricId: 'dialled_leads', stage: 'dialled', note: 'Qualified first dial' },
    { label: 'RPC', value: count(data?.kpis.contactedLeads), metricId: 'rpc_leads', stage: 'rpc', note: 'Positive recorded RPC' },
    { label: 'Calls / fetched lead', value: count(data?.kpis.callsPerLead), metricId: undefined, stage: undefined, path: '/operations/contact', note: 'Complete recorded counters only' },
    { label: 'Median first dial', value: data?.sla.medianDeliveryToDial || 'Unavailable', metricId: undefined, stage: undefined, path: '/operations/response', note: 'Delivery → first dial' },
    { label: 'Recorded sales', value: count(data?.kpis.saleLeads), metricId: 'sale_leads', stage: 'sales', note: 'Independent recorded population' },
  ];
  const vendorLabel = vendorMeasure === 'rpcRate' ? 'RPC / dialled' : vendorMeasure === 'leadToSaleRate' ? 'Sale / fetched' : 'Zero-call leads';
  return <AnalyticsPageLayout title="Operations" description="Understand what happened after delivery: contact coverage, recorded effort, response and outcomes." className="cx-operations-overview"
    actions={<><Link className="cx-button-secondary" to={scoped('/investigate')}><Search size={14} aria-hidden="true" />Investigate</Link><ReportStatusSlot /></>}
    scope={<ReportingScopeBar onRefresh={refresh} comparisonWindow={data?.comparisonWindow} />}>
    {overview.error && <OperationalError message={overview.error} onRetry={() => { void overview.loadData(true); }} />}
    {overview.loading && !data && <VisualSkeleton kind="bars" label="Loading operational populations" />}
    <section className="cx-operations-metrics" aria-label="Operations summary">{metrics.map(metric => <article key={metric.label}>
      <span>{metric.label}</span><Link to={scoped(metric.stage ? `/investigate?drill=funnel-stage&drillValue=${metric.stage}` : metric.path!)}>{metric.value}</Link><small>{metric.note}</small>
      <AuditEvidenceButton content={audit(metric.label, { metricId: metric.metricId, value: metric.value, ...(metric.stage ? { recordDrill: { drill: 'funnel-stage', drillValue: metric.stage } } : {}) })} />
    </article>)}</section>
    {data && <OperationsTrend rows={data.dailyTrends} audit={audit('Volume and outcome trend', { value: `${data.dailyTrends.length} returned dates`, definition: { meaning: 'Returned daily counts for delivery, qualified dial, RPC and independent recorded sale populations.', grain: 'Distinct analytical lead per capture date', dateBasis: 'Lead capture cohort', nullMeaning: 'Absent observations do not imply zero.' } })} />}
    {controls.error && <OperationalError message={controls.error instanceof Error ? controls.error.message : 'Operational controls are unavailable.'} onRetry={() => { void controls.refetch(); }} />}
    {controls.isLoading && !evidence && <VisualSkeleton kind="bars" label="Loading effort and response evidence" />}
    {evidence && <>
      <div className="cx-operations-two-column">
        <ChartFrame title="Recorded call effort" subtitle="Exclusive lead populations · cumulative counters" scope={<ReportingScopeSummary />} actions={<AuditEvidenceButton content={audit('Recorded call effort', { definition: { calculation: evidence.methodology.callCount, grain: 'One row per analytical lead', dateBasis: 'Lead capture cohort', nullMeaning: 'Unrecorded is separate from explicit zero.' } })} />} footer={<Link to={scoped('/operations/contact')}>Compare contact outcomes by effort<ArrowRight size={13} aria-hidden="true" /></Link>}>
          <EvidenceBars title="Attempt distribution" description="Select a supplied bucket to investigate its exact population." hideHeading items={operationAttemptItems(evidence.attemptBuckets)} onSelect={bucket => { const path = attemptInvestigationPath(bucket); if (path) navigate(scoped(path)); }} />
          <p className="cx-viz-footnote">Unrecorded call count: {count(evidence.summary.unrecordedCallLeads)} leads. A bucket describes recorded effort, not the attempt that caused an outcome.</p>
        </ChartFrame>
        <ChartFrame title="Response speed" subtitle="Delivery → qualified first dial" scope={<ReportingScopeSummary />} actions={<AuditEvidenceButton content={audit('Response speed distribution', { definition: { meaning: 'Supplied delivery-to-dial bands, including undialled and unavailable timing populations.', grain: 'One analytical lead', dateBasis: 'Lead capture cohort', nullMeaning: 'Missing timings remain separate.' } })} />} footer={<Link to={scoped('/operations/response')}>Inspect medians, percentiles and waiting leads<ArrowRight size={13} aria-hidden="true" /></Link>}>
          <div className="cx-operations-response-summary"><Clock3 size={18} aria-hidden="true" /><div><span>Awaiting first dial</span><Link to={scoped('/investigate?drill=awaiting-first-dial')}>{count(evidence.summary.awaitingFirstDial)}</Link></div><div><span>Oldest delivery wait</span><strong>{evidence.summary.oldestDeliveryWait || 'Unavailable'}</strong></div></div>
          <EvidenceBars hideHeading title="Delivery-to-dial distribution" description="The server supplies each timing band and its population." items={evidence.slaBands.map(row => ({ key: row.band, label: row.band, value: row.leads, color: 'var(--cx-data-dialled)', appearance: /Undialled|Not delivered|Invalid/i.test(row.band) ? 'unrecorded' : undefined }))} />
          <details className="cx-report-disclosure"><summary>Exact response-band evidence</summary><div className="cx-viz-table-scroll" role="region" aria-label="Delivery-to-dial band outcomes" tabIndex={0}><table className="cx-viz-table"><thead><tr><th>Band</th><th>Leads</th><th>Share of fetched</th><th>RPC / band leads</th><th>Sale / band leads</th></tr></thead><tbody>{evidence.slaBands.map(row => <tr key={row.band}><th scope="row">{row.band}</th><td>{count(row.leads)}</td><td>{formatPercent(row.sharePct)}</td><td>{formatPercent(row.contactRate)}</td><td>{formatPercent(row.saleRate)}</td></tr>)}</tbody></table></div></details>
        </ChartFrame>
      </div>
      <ChartFrame title="Vendor contact outcomes" subtitle="Descriptive comparison using each lead’s first recorded delivered vendor." scope={<ReportingScopeSummary />}
        controls={<label className="cx-operations-measure">Measure <select aria-label="Vendor outcome measure" value={vendorMeasure} onChange={event => setVendorMeasure(event.target.value as typeof vendorMeasure)}><option value="rpcRate">RPC / dialled</option><option value="leadToSaleRate">Sale / fetched</option><option value="zeroCallLeads">Zero-call leads</option></select></label>}
        actions={<AuditEvidenceButton content={audit('Vendor contact outcomes', { definition: { calculation: evidence.methodology.vendor, grain: 'One assigned vendor per analytical lead', dateBasis: 'Lead capture cohort', meaning: `${vendorLabel}; each rate keeps its labelled denominator.` } })} />} footer={<Link to={scoped('/operations/dispositions')}>Inspect vendor dispositions and evidence<ArrowRight size={13} aria-hidden="true" /></Link>}>
        <EvidenceBars hideHeading title={`${vendorLabel} by vendor`} description="Click a vendor to open its disposition analysis with the reporting scope preserved." items={evidence.vendorControls.map(row => ({ key: row.vendor, label: row.vendor, value: row[vendorMeasure], displayValue: vendorMeasure === 'zeroCallLeads' ? count(row.zeroCallLeads) : formatPercent(row[vendorMeasure]), detail: `${count(row.leads)} fetched · each rate retains its own denominator`, color: vendorMeasure === 'leadToSaleRate' ? 'var(--cx-data-sales)' : 'var(--cx-data-rpc)' }))}
          onSelect={vendor => navigate(scoped(`/operations/dispositions?inspectVendor=${encodeURIComponent(vendor)}`))} />
        <details className="cx-report-disclosure"><summary>Exact vendor outcome evidence</summary><div className="cx-viz-table-scroll" role="region" aria-label="Operations vendor comparison" tabIndex={0}><table className="cx-viz-table"><thead><tr><th>Vendor</th><th>Fetched</th><th>Unrecorded calls</th><th>Zero calls</th><th>RPC / dialled</th><th>Sale / fetched</th><th>Median delivery to dial</th></tr></thead><tbody>{evidence.vendorControls.map(row => <tr key={row.vendor}><th><Link to={scoped(`/operations/dispositions?inspectVendor=${encodeURIComponent(row.vendor)}`)}>{row.vendor}</Link></th><td>{count(row.leads)}</td><td>{count(row.unrecordedCallLeads)}</td><td>{count(row.zeroCallLeads)}</td><td>{formatPercent(row.rpcRate)}</td><td>{formatPercent(row.leadToSaleRate)}</td><td>{row.medianFirstDial}</td></tr>)}</tbody></table></div></details>
      </ChartFrame>
      <details className="cx-report-disclosure"><summary>Capture and first-dial hour evidence</summary><div className="cx-operations-two-column"><EvidenceBars title="Captured by hour" description={`Lead captures in ${evidence.operatingContext.timezone}.`} items={evidence.hourlyFlow.map(row => ({ key: String(row.hour), label: `${String(row.hour).padStart(2, '0')}:00`, value: row.captured, color: 'var(--cx-data-fetched)' }))} /><EvidenceBars title="First dials by hour" description="First-dial lead counts, not call events." items={evidence.hourlyFlow.map(row => ({ key: String(row.hour), label: `${String(row.hour).padStart(2, '0')}:00`, value: row.firstDials, color: 'var(--cx-data-dialled)' }))} /></div><Link className="cx-button-secondary" to={scoped('/operations/time')}>Explore the day × hour heatmap<ArrowRight size={13} aria-hidden="true" /></Link></details>
      <p className="cx-viz-footnote">{evidence.methodology.vendor} Validation remains {evidence.validationStatus}. Live agent states, hopper activity and event-level attempt attribution are not inferred.</p>
    </>}
  </AnalyticsPageLayout>;
}
