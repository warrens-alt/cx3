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
import MetricLineageDrawer from '../components/MetricLineageDrawer';
import { AUTHORITATIVE_METRICS, METRIC_REGISTRY_VERSION } from '../../contracts/metricRegistry';
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
  onAbout,
  to,
  inspectLabel,
  denominatorLink,
  denominatorLabel,
}: {
  label: string;
  value: string;
  note: string;
  change?: number | null;
  changeUnit?: string;
  onWhyChanged?: () => void;
  onAbout?: () => void;
  to?: To;
  inspectLabel?: string;
  denominatorLink?: To;
  denominatorLabel?: string;
}) {
  return (
    <article className="cx-command-metric flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-text-sec">{label}</span>
          {onAbout && (
            <button
              type="button"
              className="text-text-mute hover:text-brand-primary p-0.5 rounded transition-colors"
              onClick={onAbout}
              title={`About ${label} definition`}
              aria-label={`About ${label} definition`}
            >
              <Info size={13} />
            </button>
          )}
        </div>
        {to ? (
          <Link to={to} className="cx-command-metric-link block hover:underline hover:text-action transition-colors my-1.5" title={inspectLabel || `Inspect ${label}`}>
            <strong className="text-2xl lg:text-[28px] font-bold font-mono tracking-tight text-text-main">{value}</strong>
          </Link>
        ) : (
          <strong className="text-2xl lg:text-[28px] font-bold font-mono tracking-tight text-text-main block my-1.5">{value}</strong>
        )}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <small className="text-text-sec font-medium">{note}</small>
          <Change value={change} unit={changeUnit} />
        </div>
      </div>
      {(onWhyChanged || to || (denominatorLink && denominatorLabel)) && (
        <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-border-subtle text-[11px]">
          {onWhyChanged && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-action hover:text-action-hover font-medium transition-colors cursor-pointer"
              onClick={onWhyChanged}
            >
              <span>Why changed?</span>
              <Search size={10} aria-hidden="true" />
            </button>
          )}
          {onWhyChanged && to && (
            <span className="text-border-strong text-[10px]" aria-hidden="true">·</span>
          )}
          {to && (
            <Link
              to={to}
              className="inline-flex items-center gap-1 text-action hover:text-action-hover font-medium transition-colors"
              title={inspectLabel || `Inspect ${label} records`}
            >
              <span>Inspect</span>
              <ArrowRight size={10} aria-hidden="true" />
            </Link>
          )}
          {denominatorLink && denominatorLabel && (
            <>
              <span className="text-border-strong text-[10px]" aria-hidden="true">·</span>
              <Link
                to={denominatorLink}
                className="inline-flex items-center gap-1 text-text-mute hover:text-text-sec font-medium transition-colors"
                title="Inspect denominator records"
              >
                <span>{denominatorLabel}</span>
              </Link>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export default function ExecutiveOverview() {
  const scoped = useScopedNavigationTarget();
  const { selectedClient, clientConfig } = useClient();
  const controls = useOperatingControls();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters, appliedFilters } = useFilters();
  const [searchParams] = useSearchParams();
  const [rootMetric, setRootMetric] = useState<RootMetric | null>(null);
  const [aboutMetricId, setAboutMetricId] = useState<string | null>(null);

  const scope = {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  };
  const { data, loading, error, loadData, receivedAt } = useOperationalData<OverviewData & LifecycleExtension & { revenueEvidence?: { missingLeadValues:number; basis:string }; contactEvidence?: { zeroCallLeads:number;oneCallLeads:number;oneCallShare:number|null;multiCallShare:number|null;fivePlusNoRpc:number;medianCaptureToDial:string;p90CaptureToDial:string;within30m:number|null;within60m:number|null;backlogOver15m:number;backlogOver30m:number;backlogOver6h:number;backlogOver12h:number;awaitingActivation:number;activationOver3d:number;activationOver7d:number;activationOver30d:number } }>('ExecutiveOverview', scope, fetchOverview);
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

  const lossKeys = ['fetched-to-delivered', 'delivered-to-dialled', 'dialled-to-rpc', 'rpc-to-sales', 'sales-to-activated'];
  const activeAuthMetric = aboutMetricId ? AUTHORITATIVE_METRICS[aboutMetricId] : undefined;

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
                  onAbout={() => setAboutMetricId('fetched_leads')}
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
                  onAbout={() => setAboutMetricId('delivery_rate')}
                  to={isAdmin ? recordLink('funnel-stage', 'delivered') : scoped('/funnel')}
                  inspectLabel={isAdmin ? 'Inspect delivered lead records (numerator) in evidence surface' : 'View delivery breakdown'}
                  denominatorLink={isAdmin ? recordLink('funnel-stage', 'fetched') : undefined}
                  denominatorLabel="Fetched (denom)"
                />
                <Metric
                  label="Dial coverage"
                  value={formatPercent(data.kpis.dialRate)}
                  note={`${fmt(data.kpis.dialledLeads)} dialled`}
                  change={data.comparison?.dialRateDelta}
                  changeUnit="pp"
                  onWhyChanged={hasComparison ? () => investigate('dialRate') : undefined}
                  onAbout={() => setAboutMetricId('dial_rate')}
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
                  onAbout={() => setAboutMetricId('rpc_rate')}
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
                  onAbout={() => setAboutMetricId('sales_per_fetched_rate')}
                  to={isAdmin ? recordLink('funnel-stage', 'sales') : scoped('/sales-activation')}
                  inspectLabel={isAdmin ? 'Inspect recorded sales in evidence surface' : 'View sales activation'}
                />
              </section>

              <p className="cx-comparison-context"><Clock3 size={13} aria-hidden="true" />{data.comparisonWindow ? `Compared with ${data.comparisonWindow.startDate} – ${data.comparisonWindow.endDate}. Rate changes are percentage points.` : 'Choose a date period to compare performance.'}</p>
            </div>

            {data.kpis.fetchedLeads === 0 && <OperationalEmpty title="No leads in this selection">Try a different period or remove a filter. Measured counts remain zero; rates without a population are unavailable.</OperationalEmpty>}

            {/* Primary Visual Trend & What Changed Analysis near top */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 my-2">
              <section className="lg:col-span-8 bg-surface border border-border rounded-lg p-5 shadow-2xs flex flex-col">
                <header className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-base font-semibold text-text-main">Daily lead trend</h2>
                    <p className="text-xs text-text-sec">Fetched leads and recorded sales across the latest available days in scope.</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted shrink-0">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs inline-block" style={{ backgroundColor: 'var(--cx-data-fetched, #4F5FB7)' }} />
                      <span>Fetched leads</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs inline-block" style={{ backgroundColor: 'var(--cx-data-sales, #426D80)' }} />
                      <span>Recorded sales</span>
                    </span>
                  </div>
                </header>
                <div className="h-[290px] min-h-[280px] w-full flex-1">
                  <DeferredOverviewTrend data={data.dailyTrends} />
                </div>
              </section>

              <section className="lg:col-span-4 bg-surface border border-border rounded-lg p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <header className="mb-2">
                    <h2 className="text-base font-semibold text-text-main">What changed?</h2>
                    <p className="text-xs text-text-sec mt-1">
                      {data.comparisonWindow ? `Compared with matched period ${data.comparisonWindow.startDate} → ${data.comparisonWindow.endDate}.` : 'Choose an explicit date period to compare against the immediately preceding matched period.'}
                    </p>
                  </header>
                  {changes.length ? (
                    <div className="space-y-2 mt-3">
                      {changes.map(item => (
                        <div key={item.label} className="flex items-center justify-between p-2.5 rounded-md bg-surface-subtle border border-border-subtle hover:border-action/40 transition-colors text-xs">
                          <div className="min-w-0 pr-2">
                            <span className="font-medium text-text-main block truncate">{item.label}</span>
                            <div className="mt-0.5">
                              <Change value={item.value} unit={item.unit} />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => investigate(item.metric)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-action hover:text-action-hover px-2 py-1 rounded hover:bg-selected-bg transition-colors cursor-pointer shrink-0"
                            title={`Investigate ${item.label} root cause`}
                          >
                            <span>Why?</span>
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="cx-command-empty p-4 text-center text-xs text-text-muted bg-surface-subtle rounded-md border border-dashed border-border flex flex-col items-center justify-center gap-1.5 my-auto">
                      <Clock3 size={17} className="text-text-muted" />
                      <span>Matched-period changes appear when the selected period has explicit start and end dates.</span>
                    </div>
                  )}
                </div>
                {hasComparison && (
                  <p className="text-[11px] text-text-muted mt-3 pt-2 border-t border-border-subtle">
                    Ranked by absolute rate delta across verified lifecycle milestones.
                  </p>
                )}
              </section>
            </div>

            {/* Operational Attention Queue & First-Call Response */}
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

            <section className="cx-command-panel cx-funnel-panel" aria-label="Lead-to-activation journey and lifecycle progression">
              <header>
                <div><h2>Lead-to-activation journey</h2><p>Follow leads from arrival to activation across independently observed lifecycle stages.</p></div>
                <div className="flex items-center gap-3">
                  {isAdmin && <span className="text-xs text-slate-500">Select any stage or loss to inspect records</span>}
                  <Link to={scoped('/funnel')}>View funnel <ArrowRight size={13} /></Link>
                </div>
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
              {data.funnelStages?.length > 1 && (
                <div className="mt-4 pt-4 border-t border-border-subtle">
                  <FunnelWaterfall
                    title="Lead-to-activation journey"
                    subtitle={data.funnelLeak ? `Largest measured loss: ${stageLabel(data.funnelLeak.from)} → ${stageLabel(data.funnelLeak.to)} · ${fmt(data.funnelLeak.loss)} leads` : 'Observed lifecycle progression in the current scope.'}
                    steps={data.funnelStages.map(stage => ({
                      label: stageLabel(stage.name),
                      value: stage.volume,
                      rate: stage.transitionRate ?? undefined,
                      dropoff: stage.loss ?? undefined,
                    }))}
                  />
                </div>
              )}
            </section>

            <div className="cx-command-grid cx-command-grid-backlog">
              <section className="cx-command-panel">
                <header><div><h2>Waiting for a first call</h2><p>How long delivered leads have been waiting. {isAdmin ? 'Select a bucket to inspect records.' : ''}</p></div></header>
                <div className="cx-backlog-bars">
                  {!(data.backlog?.buckets || []).length && <OperationalEmpty title="No backlog breakdown available">There are no backlog age groups in the current response.</OperationalEmpty>}
                  {(data.backlog?.buckets || []).map(bucket => {
                    const body = <><span>{bucket.bucket}</span><div><i style={{ width: `${(bucket.count / Math.max(1, ...(data.backlog?.buckets || []).map(item => item.count))) * 100}%` }} /></div><strong>{fmt(bucket.count)}</strong></>;
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

      {aboutMetricId && activeAuthMetric && (
        <MetricLineageDrawer
          isOpen={true}
          onClose={() => setAboutMetricId(null)}
          title={activeAuthMetric.businessLabel}
          lineage={{
            canonicalName: activeAuthMetric.technicalLabel,
            metric: activeAuthMetric.businessLabel,
            definition: activeAuthMetric.plainDefinition,
            numerator: activeAuthMetric.numerator ? `${activeAuthMetric.numerator}: ${activeAuthMetric.numeratorDescription}` : undefined,
            denominator: activeAuthMetric.denominator ? `${activeAuthMetric.denominator}: ${activeAuthMetric.denominatorDescription}` : 'None (distinct lead count)',
            source: 'leads (configured tenant source)',
            refreshStrategy: 'Direct analytical query on request',
          }}
          metadata={{
            validationStatus: data?.validationStatus || 'NOT_VERIFIED',
            dateBasis: activeAuthMetric.dateBasis,
            timezone: data?.timezone || clientConfig?.timezone || 'Africa/Johannesburg',
            generatedAt: data?.generatedAt,
            receivedAt,
            definitionVersion: data?.definitionVersion || METRIC_REGISTRY_VERSION,
            dataAsOf: null,
            scope: {
              clientId: selectedClient,
              startDate: startDate || null,
              endDate: endDate || null,
              filters,
            },
          }}
          additionalContent={
            <div className="space-y-4">
              <div className="p-3 bg-brand-primary/5 rounded border border-brand-primary/20 space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-brand-primary">
                  <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> Authoritative Contract</span>
                  <span className="font-mono text-[10px]">{data?.definitionVersion || METRIC_REGISTRY_VERSION}</span>
                </div>
                <p className="text-text-sec">{activeAuthMetric.plainDefinition}</p>
                <dl className="grid grid-cols-2 gap-2 pt-1 border-t border-brand-primary/10">
                  <div>
                    <dt className="text-text-mute font-medium">Counting Grain</dt>
                    <dd className="font-semibold text-text-main">{activeAuthMetric.countingGrain}</dd>
                  </div>
                  <div>
                    <dt className="text-text-mute font-medium">Unit</dt>
                    <dd className="font-semibold text-text-main capitalize">{activeAuthMetric.unit}</dd>
                  </div>
                  <div>
                    <dt className="text-text-mute font-medium">Date Basis</dt>
                    <dd className="font-semibold text-text-main">{activeAuthMetric.dateBasis}</dd>
                  </div>
                  <div>
                    <dt className="text-text-mute font-medium">Treatment of Unknown</dt>
                    <dd className="font-semibold text-text-main">{activeAuthMetric.treatmentOfUnknown.replace(/_/g, ' ')}</dd>
                  </div>
                  {activeAuthMetric.observationCutoff && (
                    <div className="col-span-2">
                      <dt className="text-text-mute font-medium">Observation Horizon</dt>
                      <dd className="text-text-main">{activeAuthMetric.observationCutoff}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="enterprise-card p-3 space-y-2 text-xs">
                <h4 className="font-bold text-text-sec uppercase tracking-wider text-[11px]">Current Displayed Population</h4>
                <dl className="space-y-1.5">
                  <div className="flex justify-between">
                    <dt className="text-text-mute">Client</dt>
                    <dd className="font-semibold text-text-main">{data?.clientName || selectedClient}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-mute">Intake Period</dt>
                    <dd className="font-semibold text-text-main">{startDate && endDate ? `${startDate} → ${endDate}` : 'All available dates'}</dd>
                  </div>
                  {appliedFilters.length > 0 && (
                    <div>
                      <dt className="text-text-mute mb-0.5">Applied Filters</dt>
                      <dd className="font-medium text-text-main">{appliedFilters.map(f => `${f.label}: ${f.value}`).join(' · ')}</dd>
                    </div>
                  )}
                  {aboutMetricId === 'fetched_leads' && (
                    <div className="flex justify-between border-t border-border-subtle pt-1 mt-1 items-center">
                      <dt className="text-text-sec font-semibold">Displayed Count</dt>
                      <dd className="font-bold text-brand-primary text-sm flex items-center gap-1.5">
                        {fmt(data?.kpis.fetchedLeads)} leads
                        {isAdmin && (
                          <Link
                            to={recordLink('funnel-stage', 'fetched')}
                            onClick={() => setAboutMetricId(null)}
                            className="text-brand-primary hover:underline text-xs font-normal inline-flex items-center gap-0.5 ml-1"
                            title="Inspect fetched lead records"
                          >
                            Inspect <ArrowRight size={11} />
                          </Link>
                        )}
                      </dd>
                    </div>
                  )}
                  {aboutMetricId === 'delivered_leads' && (
                    <div className="flex justify-between border-t border-border-subtle pt-1 mt-1 items-center">
                      <dt className="text-text-sec font-semibold">Displayed Count</dt>
                      <dd className="font-bold text-brand-primary text-sm flex items-center gap-1.5">
                        {fmt(data?.kpis.deliveredLeads)} leads
                        {isAdmin && (
                          <Link
                            to={recordLink('funnel-stage', 'delivered')}
                            onClick={() => setAboutMetricId(null)}
                            className="text-brand-primary hover:underline text-xs font-normal inline-flex items-center gap-0.5 ml-1"
                            title="Inspect delivered lead records"
                          >
                            Inspect <ArrowRight size={11} />
                          </Link>
                        )}
                      </dd>
                    </div>
                  )}
                  {aboutMetricId === 'delivery_rate' && (
                    <>
                      <div className="flex justify-between border-t border-border-subtle pt-1 mt-1">
                        <dt className="text-text-sec font-semibold">Displayed Rate</dt>
                        <dd className="font-bold text-brand-primary text-sm">{formatPercent(data?.kpis.deliveryRate)}</dd>
                      </div>
                      <div className="flex justify-between text-slate-500 items-center">
                        <dt>Numerator (Delivered)</dt>
                        <dd className="font-mono flex items-center gap-1.5">
                          {fmt(data?.kpis.deliveredLeads)}
                          {isAdmin && (
                            <Link
                              to={recordLink('funnel-stage', 'delivered')}
                              onClick={() => setAboutMetricId(null)}
                              className="text-brand-primary hover:underline text-xs font-normal inline-flex items-center gap-0.5 ml-1"
                              title="Inspect delivered lead records (numerator)"
                            >
                              Inspect <ArrowRight size={11} />
                            </Link>
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between text-slate-500 items-center">
                        <dt>Denominator (Fetched)</dt>
                        <dd className="font-mono flex items-center gap-1.5">
                          {fmt(data?.kpis.fetchedLeads)}
                          {isAdmin && (
                            <Link
                              to={recordLink('funnel-stage', 'fetched')}
                              onClick={() => setAboutMetricId(null)}
                              className="text-brand-primary hover:underline text-xs font-normal inline-flex items-center gap-0.5 ml-1"
                              title="Inspect fetched lead records (denominator)"
                            >
                              Inspect <ArrowRight size={11} />
                            </Link>
                          )}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>

              {activeAuthMetric.caveats?.length > 0 && (
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-text-sec uppercase tracking-wider text-[11px]">Known Limitations</h4>
                  <ul className="list-disc pl-4 space-y-1 text-text-mute">
                    {activeAuthMetric.caveats.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
            </div>
          }
        />
      )}
    </div>
  );
}
