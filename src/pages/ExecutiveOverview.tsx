import OverviewCommercialPanel from '../components/OverviewCommercialPanel';
import type { LifecycleExtension } from '../../contracts/lifecycleAnalytics';
import { MatchedPeriodPanel } from '../components/LifecycleDiagnostics';
import { useOperationalData } from '../lib/useOperationalData';
import React, { useMemo, useState } from 'react';
import { Link, useSearchParams, type To } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  DollarSign,
  GitFork,
  Settings2,
  Info,
  ChevronDown,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { useAuth } from '../lib/AuthContext';
import { fetchCommercial, fetchOverview, type OverviewData, type RootCauseData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import RootCauseDrawer from '../components/RootCauseDrawer';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import { useOperatingControls } from '../hooks/useOperatingControls';
import { OperatingControlStrip } from '../components/OfferNetControlPanels';
import { formatPercent, formatTableNumber } from '../lib/formatters';
import { statusLabel } from '../lib/statusPresentation';
import { OperationalEmpty, OperationalError, OverviewSkeleton } from '../components/OperationalState';
import DeferredOverviewTrend from '../components/DeferredOverviewTrend';
import { FunnelWaterfall } from '../components/charts/FunnelWaterfall';

const fmt = (value: number | string | null | undefined) => formatTableNumber(value);
const stageLabel = (name: string) => name === 'RPC' ? 'Contacted' : name;
type RootMetric = RootCauseData['metric']['id'];

function Change({ value, unit = '%' }: { value: number | null | undefined; unit?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const positive = value > 0;
  const Icon = positive ? TrendingUp : value < 0 ? TrendingDown : ArrowRight;
  return (
    <span className={`cx-command-change ${positive ? 'positive' : value < 0 ? 'negative' : 'muted'}`}>
      <Icon size={12} />
      {positive ? '+' : ''}{value}{unit}
    </span>
  );
}

function Metric({
  label,
  value,
  note,
  change,
  changeUnit = '%',
  onWhyChanged,
  to,
  inspectLabel,
}: {
  label: string;
  value: string;
  note: string;
  change?: number | null;
  changeUnit?: string;
  onWhyChanged?: () => void;
  to?: To;
  inspectLabel?: string;
}) {
  return (
    <article className="cx-command-metric">
      <span>{label}</span>
      {to ? (
        <Link to={to} className="cx-command-metric-link block hover:underline" title={inspectLabel || `Inspect ${label}`}>
          <strong>{value}</strong>
        </Link>
      ) : (
        <strong>{value}</strong>
      )}
      <div>
        <small>{note}</small>
        <Change value={change} unit={changeUnit} />
      </div>
      <div className="flex items-center gap-2 mt-1">
        {onWhyChanged && (
          <button type="button" className="cx-command-why" onClick={onWhyChanged}>
            Why changed? <Search size={11} />
          </button>
        )}
        {to && (
          <Link to={to} className="cx-command-why" title={inspectLabel || `Inspect ${label} records`}>
            Inspect <ArrowRight size={11} />
          </Link>
        )}
      </div>
    </article>
  );
}

export default function ExecutiveOverview() {
  const scoped = useScopedNavigationTarget();
  const { selectedClient } = useClient();
  const controls = useOperatingControls();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters } = useFilters();
  const [searchParams] = useSearchParams();
  const [rootMetric, setRootMetric] = useState<RootMetric | null>(null);

  const scope = {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  };
  const { data, loading, error, loadData } = useOperationalData<OverviewData & LifecycleExtension & { revenueEvidence?: { missingLeadValues:number; basis:string }; contactEvidence?: { zeroCallLeads:number;oneCallLeads:number;oneCallShare:number|null;multiCallShare:number|null;fivePlusNoRpc:number;medianCaptureToDial:string;p90CaptureToDial:string;within30m:number|null;within60m:number|null;backlogOver15m:number;backlogOver30m:number;backlogOver6h:number;backlogOver12h:number;awaitingActivation:number;activationOver3d:number;activationOver7d:number;activationOver30d:number } }>('ExecutiveOverview', scope, fetchOverview);
  // Start independent evidence together and share the same cache key as the Commercial page.
  const commercial = useOperationalData('commercial', scope, fetchCommercial);

  const hasComparison = Boolean(startDate && endDate && data?.comparisonWindow);
  const investigate = (metric: RootMetric) => hasComparison && setRootMetric(metric);

  const recordLink = (drill: string, drillValue?: string, extra?: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    next.delete('drill');
    next.delete('drillValue');
    next.delete('search');
    next.set('drill', drill);
    if (drillValue) next.set('drillValue', drillValue);
    if (extra) Object.entries(extra).forEach(([key, value]) => next.set(key, value));
    return `/lead-explorer?${next.toString()}`;
  };

  const changes = useMemo(() => {
    if (!data?.comparison) return [];
    const c = data.comparison;
    return [
      { label: 'Lead volume', value: c.fetchedDelta, unit: '%', metric: 'fetchedLeads' as RootMetric },
      { label: 'Delivery rate', value: c.deliveryRateDelta, unit: 'pp', metric: 'deliveryRate' as RootMetric },
      { label: 'Dial coverage', value: c.dialRateDelta, unit: 'pp', metric: 'dialRate' as RootMetric },
      { label: 'Right-party contact', value: c.contactRateDelta, unit: 'pp', metric: 'contactRate' as RootMetric },
      { label: 'Lead-to-sale rate', value: c.saleRateDelta, unit: 'pp', metric: 'leadToSaleRate' as RootMetric },
      { label: 'Activation / sale', value: c.activationRateDelta, unit: 'pp', metric: 'activationRate' as RootMetric },
    ].filter(item => item.value !== null).sort((a, b) => Math.abs(Number(b.value)) - Math.abs(Number(a.value))).slice(0, 4);
  }, [data?.comparison]);

  const maxBacklog = Math.max(1, ...(data?.backlog.buckets || []).map(item => item.count));
  const lossKeys = ['fetched-to-delivered', 'delivered-to-dialled', 'dialled-to-rpc', 'rpc-to-sales', 'sales-to-activated'];

  return (
    <div className="cx-command-page cx-overview-page">
      <OffernetFilterBar onRefresh={async () => { await Promise.all([loadData(true), controls.refetch(), commercial.loadData(true)]); }} />

      <div className="cx-command-content">
        <header className="cx-command-hero">
          <div>
            <h1>{data?.clientName || 'Offernet Performance'}</h1>
            <p>Track lead performance and see what needs your attention.</p>
          </div>
          <Link to={scoped('/reports')} className="cx-trust-pill">
            <Info size={15} aria-hidden="true" />
            <span>
              <strong>{statusLabel(data?.validationStatus || 'NOT_VERIFIED')}</strong>
              <small>View evidence status</small>
            </span>
            <ArrowRight size={14} />
          </Link>
        </header>

        {error && <OperationalError message={error} onRetry={() => { void loadData(true); }} retrying={loading} />}
        {loading && !data && <OverviewSkeleton />}
        {loading && data && <p className="cx-view-updating" role="status">Updating this overview…</p>}


        {data && (
          <>
            <div className="cx-overview-summary">
              <section className="cx-command-metrics" aria-label="Primary operational metrics">
                <Metric
                  label="Fetched leads"
                  value={fmt(data.kpis.fetchedLeads)}
                  note="Incoming leads"
                  change={data.comparison?.fetchedDelta}
                  onWhyChanged={hasComparison ? () => investigate('fetchedLeads') : undefined}
                  to={isAdmin ? recordLink('funnel-stage', 'fetched') : scoped('/funnel')}
                  inspectLabel={isAdmin ? 'Inspect fetched lead records in evidence surface' : 'View funnel breakdown'}
                />
                <Metric
                  label="Delivery rate"
                  value={formatPercent(data.kpis.deliveryRate)}
                  note={`${fmt(data.kpis.deliveredLeads)} delivered`}
                  change={data.comparison?.deliveryRateDelta}
                  changeUnit="pp"
                  onWhyChanged={hasComparison ? () => investigate('deliveryRate') : undefined}
                  to={isAdmin ? recordLink('funnel-stage', 'delivered') : scoped('/funnel')}
                  inspectLabel={isAdmin ? 'Inspect delivered lead records in evidence surface' : 'View delivery breakdown'}
                />
                <Metric
                  label="Dial coverage"
                  value={formatPercent(data.kpis.dialRate)}
                  note={`${fmt(data.kpis.dialledLeads)} dialled`}
                  change={data.comparison?.dialRateDelta}
                  changeUnit="pp"
                  onWhyChanged={hasComparison ? () => investigate('dialRate') : undefined}
                  to={isAdmin ? recordLink('funnel-stage', 'dialled') : scoped('/speed-to-lead')}
                  inspectLabel={isAdmin ? 'Inspect dialled lead records in evidence surface' : 'View response times'}
                />
                <Metric
                  label="Right-party contact"
                  value={formatPercent(data.kpis.contactRate)}
                  note={`${fmt(data.kpis.contactedLeads)} contacted`}
                  change={data.comparison?.contactRateDelta}
                  changeUnit="pp"
                  onWhyChanged={hasComparison ? () => investigate('contactRate') : undefined}
                  to={isAdmin ? recordLink('funnel-stage', 'rpc') : scoped('/contact-strategy')}
                  inspectLabel={isAdmin ? 'Inspect contacted (RPC) lead records in evidence surface' : 'View contact strategy'}
                />
                <Metric
                  label="Lead-to-sale rate"
                  value={formatPercent(data.kpis.leadToSaleRate)}
                  note={`${fmt(data.kpis.saleLeads)} recorded sales`}
                  change={data.comparison?.saleRateDelta}
                  changeUnit="pp"
                  onWhyChanged={hasComparison ? () => investigate('leadToSaleRate') : undefined}
                  to={isAdmin ? recordLink('funnel-stage', 'sales') : scoped('/sales-activation')}
                  inspectLabel={isAdmin ? 'Inspect recorded sales in evidence surface' : 'View sales activation'}
                />
              </section>

              <p className="cx-comparison-context"><Clock3 size={13} aria-hidden="true" />{data.comparisonWindow ? `Compared with ${data.comparisonWindow.startDate} – ${data.comparisonWindow.endDate}. Rate changes are percentage points.` : 'Choose a date period to compare performance.'}</p>
            </div>

            {data.kpis.fetchedLeads === 0 && <OperationalEmpty title="No leads in this selection">Try a different period or remove a filter. Measured counts remain zero; rates without a population are unavailable.</OperationalEmpty>}

            {data.funnelStages?.length > 1 && <FunnelWaterfall
              title="Lead-to-activation journey"
              subtitle={data.funnelLeak ? `Largest measured loss: ${stageLabel(data.funnelLeak.from)} → ${stageLabel(data.funnelLeak.to)} · ${fmt(data.funnelLeak.loss)} leads` : 'Observed lifecycle progression in the current scope.'}
              steps={data.funnelStages.map(stage => ({
                label: stageLabel(stage.name),
                value: stage.volume,
                rate: stage.transitionRate ?? undefined,
                dropoff: stage.loss ?? undefined,
              }))}
            />}

            <div className="cx-command-grid cx-command-grid-attention">
              <section className="cx-command-panel">
                <header>
                  <div><h2>Needs attention</h2><p>Start with these leads to keep work moving.</p></div>
                  <Link to={scoped('/exceptions')}>View all exceptions <ArrowRight size={13} /></Link>
                </header>
                {data.attention.length ? (
                  <div className="cx-attention-list">
                    {data.attention.map(item => (
                      <Link key={item.id} to={isAdmin ? recordLink(item.id) : scoped(item.path)} className="cx-attention-item" data-severity={item.severity}>
                        <span className="cx-attention-dot" />
                        <div><strong>{item.title}</strong><small>{item.detail}</small></div>
                        <b>{fmt(item.value)}</b><ArrowRight size={15} />
                      </Link>
                    ))}
                  </div>
                ) : <div className="cx-command-empty"><CheckCircle2 size={18} />No configured operational exception is active in this scope.</div>}
              </section>

              <section className="cx-command-panel cx-sla-panel">
                <header>
                  <div><h2>First-call response</h2><p>Delivered leads called within {data.sla.firstDialTargetMinutes} minutes.</p></div>
                  {isAdmin ? <Link to={recordLink('sla-breach')}>View breaches <ArrowRight size={13} /></Link> : <Link to={scoped('/speed-to-lead')}>View response times <ArrowRight size={13} /></Link>}
                </header>
                <div className="cx-sla-number">{formatPercent(data.sla.complianceRate)}</div>
                {data.sla.complianceRate != null && <div className="cx-sla-track"><span style={{ width: `${Math.min(100, Math.max(0, data.sla.complianceRate))}%` }} /></div>}
                <dl>
                  <div><dt title="Median time from delivery to the first dial">Typical wait</dt><dd>{data.sla?.medianDeliveryToDial || '—'}</dd></div>
                  <div><dt title="90% of recorded delivery-to-first-call times fall within this duration">90% of recorded waits</dt><dd>{data.sla?.p90DeliveryToDial || '—'}</dd></div>
                  <div><dt>Awaiting first call</dt><dd>{fmt(data.backlog?.awaitingFirstDial)}</dd></div>
                  <div><dt>Waiting over 60 min</dt><dd>{fmt(data.backlog?.over60Minutes)}</dd></div>
                </dl>
              </section>
            </div>

            <details className="cx-overview-controls">
              <summary><Settings2 size={20} aria-hidden="true" /><div><strong>Operating controls</strong><small>Call effort, coverage and activation backlog</small></div><ChevronDown size={18} aria-hidden="true" /></summary>
              {controls.error ? <OperationalError message={controls.error instanceof Error ? controls.error.message : 'Operating controls are unavailable.'} onRetry={() => { void controls.refetch(); }} retrying={controls.isFetching} /> : controls.data ? <OperatingControlStrip data={controls.data} /> : <p className="cx-view-updating" role="status">Loading operating controls…</p>}
            </details>

            <section className="cx-command-panel cx-funnel-panel">
              <header>
                <div><h2>Lead journey</h2><p>Follow leads from arrival to activation.</p></div>
                <Link to={scoped('/funnel')}>View funnel <ArrowRight size={13} /></Link>
              </header>
              <div className="cx-funnel-strip" role="region" aria-label="Lead journey stages" tabIndex={0}>
                {(data.funnelStages || []).map((stage, index) => (
                  <React.Fragment key={stage.key}>
                    {isAdmin ? (
                      <Link className="cx-funnel-stage cx-funnel-stage-link" to={recordLink('funnel-stage', stage.key)} title={`Inspect ${stageLabel(stage.name)} leads`}>
                        <span>{stageLabel(stage.name)}</span><strong>{fmt(stage.volume)}</strong>{index > 0 && <small>{formatPercent(stage.transitionRate)} from prior stage</small>}
                      </Link>
                    ) : <div className="cx-funnel-stage"><span>{stageLabel(stage.name)}</span><strong>{fmt(stage.volume)}</strong>{index > 0 && <small>{formatPercent(stage.transitionRate)} from prior stage</small>}</div>}
                    {index < (data.funnelStages?.length || 0) - 1 && (
                      isAdmin ? (
                        <Link className="cx-funnel-arrow cx-funnel-arrow-link" to={recordLink('funnel-loss', lossKeys[index])} title="Inspect records lost at this transition">
                          <ArrowRight size={15} /><small>−{fmt(data.funnelStages?.[index + 1]?.loss)}</small>
                        </Link>
                      ) : <div className="cx-funnel-arrow"><ArrowRight size={15} /><small>−{fmt(data.funnelStages?.[index + 1]?.loss)}</small></div>
                    )}
                  </React.Fragment>
                ))}
              </div>
              {data.funnelLeak && (
                <div className="cx-funnel-leak">
                  <GitFork size={16} />
                  <div><span>Largest measured loss</span><strong>{stageLabel(data.funnelLeak.from)} → {stageLabel(data.funnelLeak.to)}</strong></div>
                  <b>−{fmt(data.funnelLeak.loss)}</b><small>{formatPercent(data.funnelLeak.rate)} progressed</small>
                </div>
              )}
            </section>

            <div className="cx-command-grid cx-command-grid-backlog">
              <section className="cx-command-panel">
                <header><div><h2>Waiting for a first call</h2><p>How long delivered leads have been waiting. {isAdmin ? 'Select a bucket to inspect records.' : ''}</p></div></header>
                <div className="cx-backlog-bars">
                  {!(data.backlog?.buckets || []).length && <OperationalEmpty title="No backlog breakdown available">There are no backlog age groups in the current response.</OperationalEmpty>}
                  {(data.backlog?.buckets || []).map(bucket => {
                    const body = <><span>{bucket.bucket}</span><div><i style={{ width: `${(bucket.count / maxBacklog) * 100}%` }} /></div><strong>{fmt(bucket.count)}</strong></>;
                    return isAdmin ? (
                      <Link key={bucket.bucket} to={recordLink('backlog-age', bucket.bucket)} className="cx-backlog-row cx-backlog-link" data-severity={bucket.severity}>{body}</Link>
                    ) : <div key={bucket.bucket} className="cx-backlog-row" data-severity={bucket.severity}>{body}</div>;
                  })}
                </div>
              </section>

              <section className="cx-command-panel">
                <header>
                  <div><h2>Backlog by vendor</h2><p>Vendors with the most leads awaiting a first call.</p></div>
                  <Link to={scoped('/vendor-quality')}>Vendor view <ArrowRight size={13} /></Link>
                </header>
                <div className="cx-backlog-vendors">
                  {(data.backlog?.byVendor || []).length ? (data.backlog?.byVendor || []).map((vendor, index) => {
                    const body = <><span>{vendor.vendor}</span><strong>{fmt(vendor.awaiting_first_dial)}</strong><small>{fmt(vendor.over_60m)} &gt;60m</small></>;
                    return isAdmin ? (
                      <Link key={`${vendor.vendor}-${index}`} to={recordLink('awaiting-first-dial', undefined, { vendor: vendor.vendor })}>{body}</Link>
                    ) : <div key={`${vendor.vendor}-${index}`}>{body}</div>;
                  }) : <div className="cx-command-empty">No current vendor backlog.</div>}
                </div>
              </section>
            </div>

            <div className="cx-command-grid cx-command-grid-change">
              <section className="cx-command-panel">
                <header>
                  <div>
                    <h2>What changed?</h2>
                    <p>{data.comparisonWindow ? `Compared with the matched period ${data.comparisonWindow.startDate} → ${data.comparisonWindow.endDate}.` : 'Choose an explicit date period to compare against the immediately preceding matched period.'}</p>
                  </div>
                </header>
                {changes.length ? (
                  <div className="cx-change-list">
                    {changes.map(item => (
                      <button key={item.label} type="button" onClick={() => investigate(item.metric)}>
                        <span>{item.label}</span><Change value={item.value} unit={item.unit} /><span className="cx-change-explain">Why? <ArrowRight size={14} /></span>
                      </button>
                    ))}
                  </div>
                ) : <div className="cx-command-empty"><Clock3 size={17} />Matched-period changes appear when the selected period has explicit start and end dates.</div>}
              </section>

              <section className="cx-command-panel">
                <header><div><h2>Daily lead trend</h2><p>Fetched leads and recorded sales across the latest available days in scope.</p></div></header>
                <DeferredOverviewTrend data={data.dailyTrends} />
              </section>
            </div>

        {data?.lifecycle && <MatchedPeriodPanel data={data.lifecycle} />}
        {data?.contactEvidence && <section className="cx-command-panel"><header><div><h2>Contact effort, speed and fulfilment</h2><p>Recorded call counters are distinct from missing counters. SLA percentages use delivered leads; call shares use dialled leads. Each call average requires recorded counters for all leads in its stated denominator.</p></div></header><div className="cx-performance-table-wrap"><table className="cx-performance-table"><thead><tr><th>Measure</th><th>Observed value</th></tr></thead><tbody>
          <tr><th>Capture → first dial median / P90</th><td>{data.contactEvidence.medianCaptureToDial} / {data.contactEvidence.p90CaptureToDial}</td></tr>
          <tr><th>Dialled within 30m / 60m of delivery</th><td>{formatPercent(data.contactEvidence.within30m)} / {formatPercent(data.contactEvidence.within60m)}</td></tr>
          <tr><th>Zero-call leads / one-call leads</th><td>{fmt(data.contactEvidence.zeroCallLeads)} / {fmt(data.contactEvidence.oneCallLeads)}</td></tr>
          <tr><th>One-call / multi-call share</th><td>{formatPercent(data.contactEvidence.oneCallShare)} / {formatPercent(data.contactEvidence.multiCallShare)}</td></tr>
          <tr><th>Average recorded calls / lead</th><td>{fmt(data.kpis.callsPerLead)}</td></tr>
          <tr><th>Average recorded calls / dialled lead</th><td>{fmt(data.kpis.callsPerDialledLead)}</td></tr>
          <tr><th>Recorded sale / RPC · activation / sale</th><td>{formatPercent(data.kpis.contactToSaleRate)} / {formatPercent(data.kpis.activationRate)}</td></tr>
          <tr><th>5+ calls with explicit no RPC</th><td>{fmt(data.contactEvidence.fivePlusNoRpc)}</td></tr>
          <tr><th>Undialled backlog &gt;15m / &gt;30m / &gt;6h / &gt;12h</th><td>{fmt(data.contactEvidence.backlogOver15m)} / {fmt(data.contactEvidence.backlogOver30m)} / {fmt(data.contactEvidence.backlogOver6h)} / {fmt(data.contactEvidence.backlogOver12h)}</td></tr>
          <tr><th>Sales awaiting activation</th><td>{fmt(data.contactEvidence.awaitingActivation)}</td></tr>
          <tr><th>Awaiting activation &gt;3d / &gt;7d / &gt;30d</th><td>{fmt(data.contactEvidence.activationOver3d)} / {fmt(data.contactEvidence.activationOver7d)} / {fmt(data.contactEvidence.activationOver30d)}</td></tr>
        </tbody></table></div></section>}
        {data?.revenueEvidence && <p className="cx-control-note">{data.revenueEvidence.basis} {fmt(data.revenueEvidence.missingLeadValues)} lead values are missing.</p>}
        <OverviewCommercialPanel data={commercial.data} loading={commercial.loading} error={commercial.error} onRetry={() => { void commercial.loadData(true); }} />

            <section className="cx-command-shortcuts" aria-label="Analysis shortcuts">
              <Link to={scoped('/speed-to-lead')}><Clock3 size={16} /><span><strong>Contact</strong><small>Latency, cohorts and call strategy</small></span><ArrowRight size={14} /></Link>
              <Link to={scoped('/vendor-quality')}><Database size={16} /><span><strong>Performance</strong><small>Vendors, quality and source outcomes</small></span><ArrowRight size={14} /></Link>
              <Link to={scoped('/campaigns')}><DollarSign size={16} /><span><strong>Spend</strong><small>Campaign spend, CPC, CPM and CPL</small></span><ArrowRight size={14} /></Link>
              <Link to={scoped('/reports')}><ShieldCheck size={16} /><span><strong>Evidence</strong><small>Definitions, releases and trust status</small></span><ArrowRight size={14} /></Link>
            </section>
          </>
        )}
      </div>

      <RootCauseDrawer open={rootMetric !== null} metric={rootMetric} onClose={() => setRootMetric(null)} />
    </div>
  );
}
