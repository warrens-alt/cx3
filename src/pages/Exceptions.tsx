import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Database, ShieldCheck } from 'lucide-react';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchOverview, type OverviewData } from '../lib/offernetClient';

const fmt = (value: number) => value.toLocaleString();

export default function Exceptions() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchOverview({
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...extractOffernetFilters(filters),
      }, forceRefresh);
      setData(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load operational exceptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient) loadData();
  }, [selectedClient, startDate, endDate, filters]);

  const severityRank = { high: 3, medium: 2, low: 1 } as const;
  const ordered = useMemo(
    () => [...(data?.attention || [])].sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || b.value - a.value),
    [data?.attention],
  );

  return (
    <div className="cx-command-page">
      <OffernetFilterBar onRefresh={() => loadData(true)} />
      <div className="cx-command-content">
        <header className="cx-command-hero">
          <div>
            <span className="cx-command-eyebrow">Operational inbox</span>
            <h1>Exceptions</h1>
            <p>Current populations that require investigation or operational follow-up in the selected scope.</p>
          </div>
          <Link to="/reports" className="cx-trust-pill">
            <ShieldCheck size={15} />
            <span>
              <strong>{data?.validationStatus || 'NOT_VERIFIED'}</strong>
              <small>Operational rules</small>
            </span>
            <ArrowRight size={14} />
          </Link>
        </header>

        {error && <div className="cx-command-error"><AlertTriangle size={17} />{error}</div>}
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
                <strong>{fmt(data.backlog.awaitingFirstDial)}</strong>
                <small>{fmt(data.backlog.over60Minutes)} waiting longer than 60 minutes</small>
              </article>
              <article>
                <span>15-minute SLA</span>
                <strong>{data.sla.complianceRate}%</strong>
                <small>Delivered leads dialled within target</small>
              </article>
            </section>

            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Prioritise</span>
                  <h2>Exception queue</h2>
                  <p>Counts come directly from current warehouse observations. No synthetic thresholds or scores are added.</p>
                </div>
              </header>

              {ordered.length ? (
                <div className="cx-live-exception-list">
                  {ordered.map(item => (
                    <Link key={item.id} to={item.path} className="cx-live-exception" data-severity={item.severity}>
                      <div className="cx-live-exception-icon">
                        {item.id === 'awaiting-first-dial' ? <Clock3 size={17} /> : item.id === 'missing-disposition' ? <Database size={17} /> : <AlertTriangle size={17} />}
                      </div>
                      <div>
                        <span className="cx-live-exception-severity">{item.severity}</span>
                        <h3>{item.title}</h3>
                        <p>{item.detail}</p>
                      </div>
                      <strong>{fmt(item.value)}</strong>
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
                  <Link to="/speed-to-lead">Open contact analysis <ArrowRight size={13} /></Link>
                </header>
                <div className="cx-exception-buckets">
                  {data.backlog.buckets.map(bucket => (
                    <div key={bucket.bucket} data-severity={bucket.severity}>
                      <span>{bucket.bucket}</span>
                      <strong>{fmt(bucket.count)}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="cx-command-panel">
                <header>
                  <div>
                    <span className="cx-command-section-kicker">Ownership</span>
                    <h2>Vendor backlog</h2>
                    <p>Where the undialled population is concentrated.</p>
                  </div>
                  <Link to="/vendor-quality">Performance view <ArrowRight size={13} /></Link>
                </header>
                <div className="cx-backlog-vendors">
                  {data.backlog.byVendor.length ? data.backlog.byVendor.map((vendor, index) => (
                    <div key={`${vendor.vendor}-${index}`}>
                      <span>{vendor.vendor}</span>
                      <strong>{fmt(Number(vendor.awaiting_first_dial || 0))}</strong>
                      <small>{fmt(Number(vendor.over_60m || 0))} &gt;60m</small>
                    </div>
                  )) : <div className="cx-command-empty">No vendor backlog is currently observed.</div>}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
