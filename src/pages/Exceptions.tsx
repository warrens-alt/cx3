import { useOperationalData } from '../lib/useOperationalData';
import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

const fmt = (value: number | string | null | undefined) => formatTableNumber(value);

export default function Exceptions() {
  const scoped = useScopedNavigationTarget();
  const controls = useOperatingControls();
  const { selectedClient } = useClient();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters } = useFilters();
  const [searchParams] = useSearchParams();

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
    return `/lead-explorer?${next.toString()}`;
  };

  const severityRank = { high: 3, medium: 2, low: 1 } as const;
  const ordered = useMemo(
    () => [...(queue.data?.exceptions || [])].filter(item => item.count > 0).sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || b.count - a.count),
    [queue.data?.exceptions],
  );

  return (
    <div className="cx-command-page">
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
              <strong>{data?.validationStatus || 'NOT_VERIFIED'}</strong>
              <small>Operational rules</small>
            </span>
            <ArrowRight size={14} />
          </Link>
        </header>

        {(error || queue.error) && <div className="cx-command-error"><AlertTriangle size={17} />{error || queue.error}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner" />Loading exception populations…</div>}

        {data && (
          <>
            <section className="cx-exception-summary">
              <article>
                <span>Active exception types</span>
                <strong>{ordered.length}</strong>
                <small>Configured operational checks with affected records</small>
              </article>
              <article>
                <span>Awaiting first dial</span>
                <strong>{fmt(data.backlog?.awaitingFirstDial)}</strong>
                <small>{fmt(data.backlog?.over60Minutes)} waiting longer than 60 minutes</small>
              </article>
              <article>
                <span>15-minute SLA</span>
                <strong>{formatPercent(data.sla?.complianceRate)}</strong>
                <small>Delivered leads dialled within target</small>
              </article>
            </section>

            {controls.data && <ContactGovernancePanel
              data={controls.data}
              highAttemptHref={isAdmin ? recordLink('high-attempt-no-rpc') : undefined}
              oneCallHref={isAdmin ? recordLink('one-call-only') : undefined}
            />}

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
                  ...queue.data.exceptions.map(item => [item.title, item.count, item.previousCount, item.absoluteChange, item.percentageChange, item.severity, item.detail]),
                ]} definitions={queue.data.populationNote} validationStatus={queue.data.validationStatus} />
              </div>}
              {queue.loading && !queue.data ? <div className="cx-command-loading">Loading exact exception populations…</div> : ordered.length ? (
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
                        <p>Previous cohort: {fmt(item.previousCount)} · Δ {item.absoluteChange === null ? 'Unavailable' : `${item.absoluteChange > 0 ? '+' : ''}${fmt(item.absoluteChange)}`}</p>
                        <p>Vendors: {item.byVendor.slice(0, 3).map(group => `${group.name} (${group.count.toLocaleString()})`).join(', ') || 'None'}</p>
                        <p>Sources: {item.bySource.slice(0, 3).map(group => `${group.name} (${group.count.toLocaleString()})`).join(', ') || 'None'}</p>
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

            <div className="cx-command-grid cx-command-grid-backlog">
              <section className="cx-command-panel">
                <header>
                  <div>
                    <span className="cx-command-section-kicker">Age</span>
                    <h2>First-dial backlog</h2>
                    <p>Delivered leads still waiting for their first recorded dial.</p>
                  </div>
                  <Link to={scoped('/speed-to-lead')}>Open contact analysis <ArrowRight size={13} /></Link>
                </header>
                <div className="cx-exception-buckets">
                  {data.backlog.buckets.map(bucket => {
                    const content = <><span>{bucket.bucket}</span><strong>{fmt(bucket.count)}</strong></>;
                    return isAdmin
                      ? <Link key={bucket.bucket} to={recordLink('backlog-age', bucket.bucket)} data-severity={bucket.severity}>{content}</Link>
                      : <div key={bucket.bucket} data-severity={bucket.severity}>{content}</div>;
                  })}
                </div>
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
                <div className="cx-backlog-vendors">
                  {data.backlog.byVendor.length ? data.backlog.byVendor.map((vendor, index) => {
                    const content = <><span>{vendor.vendor}</span><strong>{fmt(vendor.awaiting_first_dial)}</strong><small>{fmt(vendor.over_60m)} &gt;60m</small></>;
                    return isAdmin
                      ? <Link key={`${vendor.vendor}-${index}`} to={recordLink('awaiting-first-dial', undefined, { vendor: vendor.vendor })}>{content}</Link>
                      : <div key={`${vendor.vendor}-${index}`}>{content}</div>;
                  }) : <div className="cx-command-empty">No vendor backlog is currently observed.</div>}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
