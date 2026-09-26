import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  GitFork,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { useAuth } from '../lib/AuthContext';
import { fetchOverview, type OverviewData, type RootCauseData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import RootCauseDrawer from '../components/RootCauseDrawer';

const fmt = (value: number) => value.toLocaleString();
type RootMetric = RootCauseData['metric']['id'];

function Change({ value, unit = '%' }: { value: number | null | undefined; unit?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="cx-command-change muted">No matched comparison</span>;
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
}: {
  label: string;
  value: string;
  note: string;
  change?: number | null;
  changeUnit?: string;
  onWhyChanged?: () => void;
}) {
  return (
    <article className="cx-command-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <div>
        <small>{note}</small>
        <Change value={change} unit={changeUnit} />
      </div>
      {onWhyChanged && (
        <button type="button" className="cx-command-why" onClick={onWhyChanged}>
          Why changed? <Search size={11} />
        </button>
      )}
    </article>
  );
}

export default function ExecutiveOverview() {
  const { selectedClient } = useClient();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters } = useFilters();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rootMetric, setRootMetric] = useState<RootMetric | null>(null);

  const loadData = async (forceRefresh = false) => {
    if (!data) setLoading(true);
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
      setError(err?.message || 'Failed to load operational overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient) loadData();
  }, [selectedClient, startDate, endDate, filters]);

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
      { label: 'RPC rate', value: c.contactRateDelta, unit: 'pp', metric: 'contactRate' as RootMetric },
      { label: 'Sale / fetched', value: c.saleRateDelta, unit: 'pp', metric: 'leadToSaleRate' as RootMetric },
      { label: 'Activation / sale', value: c.activationRateDelta, unit: 'pp', metric: 'activationRate' as RootMetric },
    ].filter(item => item.value !== null).sort((a, b) => Math.abs(Number(b.value)) - Math.abs(Number(a.value))).slice(0, 4);
  }, [data?.comparison]);

  const maxBacklog = Math.max(1, ...(data?.backlog.buckets || []).map(item => item.count));
  const lossKeys = ['fetched-to-delivered', 'delivered-to-dialled', 'dialled-to-rpc', 'rpc-to-sales', 'sales-to-activated'];

  return (
    <div className="cx-command-page">
      <OffernetFilterBar onRefresh={() => loadData(true)} />

      <div className="cx-command-content">
        <header className="cx-command-hero">
          <div>
            <span className="cx-command-eyebrow">Operational command centre</span>
            <h1>{data?.clientName || 'Offernet Performance'}</h1>
            <p>What is happening, where the funnel is leaking, why performance changed, and which records need attention.</p>
          </div>
          <Link to="/reports" className="cx-trust-pill">
            <ShieldCheck size={15} />
            <span>
              <strong>{data?.validationStatus || 'NOT_VERIFIED'}</strong>
              <small>View evidence status</small>
            </span>
            <ArrowRight size={14} />
          </Link>
        </header>

        {error && <div className="cx-command-error" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner" /><span>Building operational view…</span></div>}

        {data && (
          <>
            <section className="cx-command-metrics" aria-label="Primary operational metrics">
              <Metric label="Fetched leads" value={fmt(data.kpis.fetchedLeads)} note="Incoming lead population" change={data.comparison?.fetchedDelta} onWhyChanged={hasComparison ? () => investigate('fetchedLeads') : undefined} />
              <Metric label="Delivery rate" value={`${data.kpis.deliveryRate}%`} note={`${fmt(data.kpis.deliveredLeads)} delivered`} change={data.comparison?.deliveryRateDelta} changeUnit="pp" onWhyChanged={hasComparison ? () => investigate('deliveryRate') : undefined} />
              <Metric label="Dial coverage" value={`${data.kpis.dialRate}%`} note={`${fmt(data.kpis.dialledLeads)} dialled`} change={data.comparison?.dialRateDelta} changeUnit="pp" onWhyChanged={hasComparison ? () => investigate('dialRate') : undefined} />
              <Metric label="RPC rate" value={`${data.kpis.contactRate}%`} note={`${fmt(data.kpis.contactedLeads)} contacted`} change={data.comparison?.contactRateDelta} changeUnit="pp" onWhyChanged={hasComparison ? () => investigate('contactRate') : undefined} />
              <Metric label="Sale / fetched" value={`${data.kpis.leadToSaleRate}%`} note={`${fmt(data.kpis.saleLeads)} recorded sales`} change={data.comparison?.saleRateDelta} changeUnit="pp" onWhyChanged={hasComparison ? () => investigate('leadToSaleRate') : undefined} />
            </section>

            <div className="cx-command-grid cx-command-grid-attention">
              <section className="cx-command-panel">
                <header>
                  <div><span className="cx-command-section-kicker">Act</span><h2>Needs attention</h2><p>Operational exceptions surfaced from the current population.</p></div>
                  <Link to="/exceptions">Open exception queue <ArrowRight size={13} /></Link>
                </header>
                {data.attention.length ? (
                  <div className="cx-attention-list">
                    {data.attention.map(item => (
                      <Link key={item.id} to={isAdmin ? recordLink(item.id) : item.path} className="cx-attention-item" data-severity={item.severity}>
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
                  <div><span className="cx-command-section-kicker">Speed</span><h2>First-dial SLA</h2><p>Delivered leads dialled within {data.sla.firstDialTargetMinutes} minutes.</p></div>
                  {isAdmin ? <Link to={recordLink('sla-breach')}>View breaches <ArrowRight size={13} /></Link> : <Link to="/speed-to-lead">Diagnose <ArrowRight size={13} /></Link>}
                </header>
                <div className="cx-sla-number">{data.sla.complianceRate}%</div>
                <div className="cx-sla-track"><span style={{ width: `${Math.min(100, Math.max(0, data.sla.complianceRate))}%` }} /></div>
                <dl>
                  <div><dt>Median delivery → dial</dt><dd>{data.sla.medianDeliveryToDial}</dd></div>
                  <div><dt>P90 delivery → dial</dt><dd>{data.sla.p90DeliveryToDial}</dd></div>
                  <div><dt>Awaiting first dial</dt><dd>{fmt(data.backlog.awaitingFirstDial)}</dd></div>
                  <div><dt>Waiting &gt;60m</dt><dd>{fmt(data.backlog.over60Minutes)}</dd></div>
                </dl>
              </section>
            </div>

            <section className="cx-command-panel cx-funnel-panel">
              <header>
                <div><span className="cx-command-section-kicker">Diagnose</span><h2>Where the funnel is leaking</h2><p>Each transition shows observed progression and the lead population that did not advance.</p></div>
                <Link to="/funnel">Full funnel <ArrowRight size={13} /></Link>
              </header>
              <div className="cx-funnel-strip">
                {data.funnelStages.map((stage, index) => (
                  <React.Fragment key={stage.key}>
                    {isAdmin ? (
                      <Link className="cx-funnel-stage cx-funnel-stage-link" to={recordLink('funnel-stage', stage.key)} title={`Inspect ${stage.name} leads`}>
                        <span>{stage.name}</span><strong>{fmt(stage.volume)}</strong>{index > 0 && <small>{stage.transitionRate}% from prior stage</small>}
                      </Link>
                    ) : <div className="cx-funnel-stage"><span>{stage.name}</span><strong>{fmt(stage.volume)}</strong>{index > 0 && <small>{stage.transitionRate}% from prior stage</small>}</div>}
                    {index < data.funnelStages.length - 1 && (
                      isAdmin ? (
                        <Link className="cx-funnel-arrow cx-funnel-arrow-link" to={recordLink('funnel-loss', lossKeys[index])} title="Inspect records lost at this transition">
                          <ArrowRight size={15} /><small>−{fmt(data.funnelStages[index + 1].loss)}</small>
                        </Link>
                      ) : <div className="cx-funnel-arrow"><ArrowRight size={15} /><small>−{fmt(data.funnelStages[index + 1].loss)}</small></div>
                    )}
                  </React.Fragment>
                ))}
              </div>
              <div className="cx-funnel-leak">
                <GitFork size={16} />
                <div><span>Largest measured loss</span><strong>{data.funnelLeak.from} → {data.funnelLeak.to}</strong></div>
                <b>−{fmt(data.funnelLeak.loss)}</b><small>{data.funnelLeak.rate}% progressed</small>
              </div>
            </section>

            <div className="cx-command-grid cx-command-grid-backlog">
              <section className="cx-command-panel">
                <header><div><span className="cx-command-section-kicker">Backlog</span><h2>Delivered, not yet dialled</h2><p>Age of currently waiting lead deliveries. {isAdmin ? 'Select a bucket to inspect records.' : ''}</p></div></header>
                <div className="cx-backlog-bars">
                  {data.backlog.buckets.map(bucket => {
                    const body = <><span>{bucket.bucket}</span><div><i style={{ width: `${(bucket.count / maxBacklog) * 100}%` }} /></div><strong>{fmt(bucket.count)}</strong></>;
                    return isAdmin ? (
                      <Link key={bucket.bucket} to={recordLink('backlog-age', bucket.bucket)} className="cx-backlog-row cx-backlog-link" data-severity={bucket.severity}>{body}</Link>
                    ) : <div key={bucket.bucket} className="cx-backlog-row" data-severity={bucket.severity}>{body}</div>;
                  })}
                </div>
              </section>

              <section className="cx-command-panel">
                <header>
                  <div><span className="cx-command-section-kicker">Concentration</span><h2>Backlog by vendor</h2><p>Partners contributing most to undialled volume.</p></div>
                  <Link to="/vendor-quality">Vendor view <ArrowRight size={13} /></Link>
                </header>
                <div className="cx-backlog-vendors">
                  {data.backlog.byVendor.length ? data.backlog.byVendor.map((vendor, index) => {
                    const body = <><span>{vendor.vendor}</span><strong>{fmt(Number(vendor.awaiting_first_dial || 0))}</strong><small>{fmt(Number(vendor.over_60m || 0))} &gt;60m</small></>;
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
                    <span className="cx-command-section-kicker">Explain</span><h2>What changed?</h2>
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
                <header><div><span className="cx-command-section-kicker">Trend</span><h2>Daily run-rate</h2><p>Fetched leads and recorded sales across the latest available days in scope.</p></div></header>
                <div className="cx-command-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.dailyTrends}>
                      <defs><linearGradient id="commandLeads" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3562B3" stopOpacity={0.22} /><stop offset="95%" stopColor="#3562B3" stopOpacity={0.02} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EDF3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} width={42} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #DDE4ED', fontSize: 12 }} />
                      <Area type="monotone" dataKey="leads" name="Fetched leads" stroke="#3562B3" strokeWidth={2} fill="url(#commandLeads)" />
                      <Area type="monotone" dataKey="sales" name="Sales" stroke="#0F766E" strokeWidth={2} fillOpacity={0} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            <section className="cx-command-shortcuts" aria-label="Analysis shortcuts">
              <Link to="/speed-to-lead"><Clock3 size={16} /><span><strong>Contact</strong><small>Latency, cohorts and call strategy</small></span><ArrowRight size={14} /></Link>
              <Link to="/vendor-quality"><Database size={16} /><span><strong>Performance</strong><small>Vendors, quality and source outcomes</small></span><ArrowRight size={14} /></Link>
              <Link to="/reports"><ShieldCheck size={16} /><span><strong>Evidence</strong><small>Definitions, releases and trust status</small></span><ArrowRight size={14} /></Link>
            </section>
          </>
        )}
      </div>

      <RootCauseDrawer open={rootMetric !== null} metric={rootMetric} onClose={() => setRootMetric(null)} />
    </div>
  );
}
