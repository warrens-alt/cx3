import { useOperationalData } from '../lib/useOperationalData';
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Database, ShieldCheck } from 'lucide-react';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { useAuth } from '../lib/AuthContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchOverview, fetchExceptions, type OverviewData } from '../lib/offernetClient';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import { useOperatingControls } from '../hooks/useOperatingControls';
import { ContactGovernancePanel } from '../components/OfferNetControlPanels';
import { formatPercent, formatTableNumber } from '../lib/formatters';

import type { ExceptionAnalyticsData } from '../../contracts/exceptionAnalytics';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import UnifiedMetricCard from '../components/UnifiedMetricCard';
import RootCauseDrawer from '../components/RootCauseDrawer';
import ExceptionWorkbench from '../features/trust/components/ExceptionWorkbench';
import '../styles/journeyContactVisuals.css';
import '../styles/trustQualityVisuals.css';

const fmt = (value: number | string | null | undefined) => formatTableNumber(value);

export default function Exceptions() {
  const scoped = useScopedNavigationTarget();
  const controls = useOperatingControls();
  const { selectedClient } = useClient();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters } = useFilters();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [rootMetric, setRootMetric] = useState<string | null>(null);
  const [rootMetricLabel, setRootMetricLabel] = useState<string | undefined>(undefined);

  const { data, loading, error, loadData } = useOperationalData<OverviewData>('Exceptions', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, fetchOverview);

  const queue = useOperationalData<ExceptionAnalyticsData>('exception-populations', {
    clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, fetchExceptions);

  const recordLink = (drill: string, drillValue?: string, extra?: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    next.delete('drill');
    next.delete('drillValue');
    next.delete('search');
    next.set('drill', drill);
    if (drillValue) next.set('drillValue', drillValue);
    if (extra) Object.entries(extra).forEach(([key, value]) => next.set(key, value));
    if (selectedClient && !next.has('clientId')) next.set('clientId', selectedClient);
    if (startDate && !next.has('startDate')) next.set('startDate', startDate);
    if (endDate && !next.has('endDate')) next.set('endDate', endDate);
    return `/lead-explorer?${next.toString()}`;
  };

  const severityRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const ordered = useMemo(
    () =>
      [...(queue.data?.exceptions || [])]
        .filter(item => item && Number(item.count || 0) > 0)
        .sort(
          (a, b) =>
            (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0) ||
            Number(b.count || 0) - Number(a.count || 0),
        ),
    [queue.data?.exceptions],
  );

  return (
    <div className="cx-command-page cx-trust-workspace" aria-label="Investigate workspace">
      <OffernetFilterBar onRefresh={async () => { await Promise.all([loadData(true), queue.loadData(true), controls.refetch()]); }} />
      <div className="cx-command-content">
        <header className="cx-command-hero">
          <div>
            <span className="cx-command-eyebrow">Operational inbox</span>
            <h1>Exceptions</h1>
            <p>Current populations that require investigation or operational follow-up in the selected scope.</p>
          </div>
          <Link to={scoped('/reports')} className="cx-trust-pill">
            <ShieldCheck size={15} />
            <span>
              <strong>{queue.data?.validationStatus || data?.validationStatus || 'NOT_VERIFIED'}</strong>
              <small>Operational rules</small>
            </span>
            <ArrowRight size={14} />
          </Link>
        </header>
        <nav className="cx-viz-jump-nav" aria-label="Investigation sections"><a href="#exception-workbench">Exception workbench</a><a href="#exception-backlog">Backlog & vendors</a></nav>

        {(error || queue.error) && <div className="cx-command-error"><AlertTriangle size={17} />{error || queue.error}</div>}
        {(!data && !queue.data && (loading || queue.loading)) ? (
          <div className="cx-command-loading"><div className="cx-command-spinner" />Loading exception populations…</div>
        ) : (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6" aria-label="Exceptions summary metrics">
              <UnifiedMetricCard
                label="Active Exception Types"
                value={queue.loading && !queue.data ? '…' : ordered.length}
                note="Configured checks with affected records"
                onWhyChanged={() => {
                  setRootMetric('deliveryRate');
                  setRootMetricLabel('Active Exception Types');
                }}
                onInspect={() => {
                  const el = document.getElementById('exception-workbench');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                inspectLabel="Inspect queue"
              />

              <UnifiedMetricCard
                label="Awaiting First Dial"
                value={loading && !data ? '…' : fmt(data?.backlog?.awaitingFirstDial)}
                note={loading && !data ? 'Loading backlog…' : data?.backlog ? `${fmt(data.backlog.over60Minutes)} waiting > 60m` : 'Backlog data unavailable'}
                isPositiveGood={false}
                onWhyChanged={() => {
                  setRootMetric('dialRate');
                  setRootMetricLabel('Awaiting First Dial');
                }}
                to={scoped('/speed-to-lead')}
                inspectLabel="Inspect speed"
              />

              <UnifiedMetricCard
                label="15-Minute Response SLA"
                value={loading && !data ? '…' : formatPercent(data?.sla?.complianceRate)}
                note="Delivered leads dialled within target"
                onWhyChanged={() => {
                  setRootMetric('dialRate');
                  setRootMetricLabel('Response SLA Compliance');
                }}
                to={scoped('/speed-to-lead')}
                inspectLabel="Inspect speed"
              />
            </section>

            {queue.loading && !queue.data ? (
              <div className="cx-command-panel p-6 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                <div className="cx-command-spinner" />
                Loading exception ranking chart…
              </div>
            ) : ordered.length > 0 ? (
              !queue.error && <ExceptionWorkbench key={JSON.stringify([selectedClient, startDate, endDate, filters])}
                items={ordered} isAdmin={isAdmin} populationNote={queue.data?.populationNote}
                evidenceHref={id => isAdmin ? recordLink(id) : scoped('/data-integrity')} />
            ) : queue.data && !queue.error ? (
              <div className="cx-command-empty" role="status">No configured operational exception currently has an affected population.</div>
            ) : null}

            {controls.data && <ContactGovernancePanel
              data={controls.data}
              highAttemptHref={isAdmin ? recordLink('high-attempt-no-rpc') : undefined}
              oneCallHref={isAdmin ? recordLink('one-call-only') : undefined}
              missingDispositionHref={isAdmin ? recordLink('missing-disposition') : undefined}
            />}

            <details className="cx-trust-disclosure" open={Boolean(queue.error)}><summary>Full exception evidence and export</summary>
            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Prioritise</span>
                  <h2>Exception queue</h2>
                  <p>{queue.data?.populationNote}</p>
                </div>
              </header>

              {queue.data && <div className="p-4 text-xs text-slate-600">
                <p>{queue.data.comparisonReason}</p>
                {queue.data.comparison && <p>Previous: {queue.data.comparison.previous.startDate} – {queue.data.comparison.previous.endDate} ({queue.data.comparison.days} days)</p>}
                <ExportAnalysisButton filename="exception_populations" rows={[
                  ['Exception', 'Count', 'Previous cohort', 'Absolute change', 'Change (%)', 'Severity', 'Definition'],
                  ...(queue.data.exceptions || []).map(item => [item.title, item.count, item.previousCount, item.absoluteChange, item.percentageChange, item.severity, item.detail]),
                ]} definitions={queue.data.populationNote} validationStatus={queue.data.validationStatus} />
              </div>}
              {queue.loading && !queue.data ? (
                <div className="cx-command-loading">Loading exact exception populations…</div>
              ) : queue.error ? (
                <div className="cx-command-error">
                  <AlertTriangle size={16} />
                  Unable to load exception populations: {queue.error}
                </div>
              ) : ordered.length ? (
                <div className="cx-live-exception-list">
                  {ordered.map(item => (
                    <Link key={item.id} to={isAdmin ? recordLink(item.id) : scoped('/data-integrity')} className="cx-live-exception" data-severity={item.severity}>
                      <div className="cx-live-exception-icon">
                        {item.id === 'awaiting-first-dial' ? <Clock3 size={17} /> : item.id === 'missing-disposition' ? <Database size={17} /> : <AlertTriangle size={17} />}
                      </div>
                      <div>
                        <span className="cx-live-exception-severity">{item.severity}</span>
                        <h3>{item.title}</h3>
                        <p>{item.detail}</p>
                        <p>Previous cohort: {fmt(item.previousCount)} · Δ {item.absoluteChange === null || item.absoluteChange === undefined ? 'Unavailable' : `${Number(item.absoluteChange) > 0 ? '+' : ''}${fmt(item.absoluteChange)}`}</p>
                        <p>Vendors: {(item.byVendor || []).slice(0, 3).map(group => `${group.name || 'Unknown'} (${fmt(group.count)})`).join(', ') || 'None'}</p>
                        <p>Sources: {(item.bySource || []).slice(0, 3).map(group => `${group.name || 'Unknown'} (${fmt(group.count)})`).join(', ') || 'None'}</p>
                      </div>
                      <strong>{fmt(item.count)}</strong>
                      <ArrowRight size={16} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="cx-command-empty">
                  <CheckCircle2 size={18} />
                  No configured operational exception currently has an affected population.
                </div>
              )}
            </section>

            </details>
            <div id="exception-backlog" className="cx-command-grid cx-command-grid-backlog">
              <section className="cx-command-panel">
                <header>
                  <div>
                    <span className="cx-command-section-kicker">Age</span>
                    <h2>First-dial backlog</h2>
                    <p>Delivered leads still waiting for their first recorded dial.</p>
                  </div>
                  <Link to={scoped('/speed-to-lead')}>Open contact analysis <ArrowRight size={13} /></Link>
                </header>
                {loading && !data ? (
                  <div className="cx-command-loading">Loading backlog…</div>
                ) : (
                  <div className="cx-exception-buckets">
                    {(data?.backlog?.buckets || []).map(bucket => {
                      const content = <><span>{bucket.bucket}</span><strong>{fmt(bucket.count)}</strong></>;
                      return isAdmin
                        ? <Link key={bucket.bucket} to={recordLink('backlog-age', bucket.bucket)} data-severity={bucket.severity}>{content}</Link>
                        : <div key={bucket.bucket} data-severity={bucket.severity}>{content}</div>;
                    })}
                  </div>
                )}
              </section>

              <section className="cx-command-panel">
                <header>
                  <div>
                    <span className="cx-command-section-kicker">Ownership</span>
                    <h2>Vendor backlog</h2>
                    <p>Where the undialled population is concentrated.</p>
                  </div>
                  <Link to={scoped('/vendor-quality')}>Performance view <ArrowRight size={13} /></Link>
                </header>
                {loading && !data ? (
                  <div className="cx-command-loading">Loading vendor backlog…</div>
                ) : (
                  <div className="cx-backlog-vendors">
                    {(data?.backlog?.byVendor || []).length ? (data.backlog?.byVendor || []).map((vendor, index) => {
                      const content = <><span>{vendor.vendor}</span><strong>{fmt(vendor.awaiting_first_dial)}</strong><small>{fmt(vendor.over_60m)} &gt;60m</small></>;
                      return isAdmin
                        ? <Link key={`${vendor.vendor}-${index}`} to={recordLink('awaiting-first-dial', undefined, { vendor: vendor.vendor })}>{content}</Link>
                        : <div key={`${vendor.vendor}-${index}`}>{content}</div>;
                    }) : <div className="cx-command-empty">No vendor backlog is currently observed.</div>}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
      <RootCauseDrawer
        open={Boolean(rootMetric)}
        metric={rootMetric}
        metricLabel={rootMetricLabel}
        onClose={() => {
          setRootMetric(null);
          setRootMetricLabel(undefined);
        }}
      />
    </div>
  );
}
