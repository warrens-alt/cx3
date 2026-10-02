import TelemetryRail from '../shared/visuals/TelemetryRail';
import AnalyticsPageLayout from '../components/AnalyticsPageLayout';
import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, GitBranch, GitFork, Route } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { useClient } from '../lib/ClientContext';
import { useAuth } from '../lib/AuthContext';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import { formatPercent, formatTableNumber, formatTableCurrency } from '../lib/formatters';
import OperationalPageHeader from '../components/OperationalPageHeader';
import { RankedMetricChart, VolumeRateComboChart } from '../components/charts/OperationalVisuals';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';

export default function RoutingIntelligence() {
  const scoped = useScopedNavigationTarget();
  const { isAdmin } = useAuth();
  const { clientConfig } = useClient();
  const currency = clientConfig?.currency === 'GBP' ? '£' : clientConfig?.currency === 'USD' ? '$' : 'R ';
  const { data, loading, error, refetch } = useAnalyticsData('routing');

  return (
    <AnalyticsPageLayout className="cx-routing-page" title="Routing" header={<OperationalPageHeader
          eyebrow="Routing"
          title="Routing"
          description="Routing depth, partner handoffs and unmatched transactions."
          status="NOT_VERIFIED"
          statusLabel="Legacy routing analytics"
          actions={
            <div className="flex items-center gap-2">
              <Link to="/offershop-flow" className="cx-button-secondary">Offershop Deal Flow <GitFork size={13}/></Link>
              <Link to={scoped('/lead-explorer')} className="cx-button-secondary">Inspect leads <ArrowRight size={13}/></Link>
            </div>
          }
        />} scope={<OffernetFilterBar onRefresh={() => refetch()} />}>

        {error && <div className="cx-command-error"><AlertTriangle size={17}/>{String(error)}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner"/>Loading routing journeys…</div>}

        {data?.overview && (() => {
          const { overview, depthBreakdown = [], partnerHandoff = [], topRoutePaths = [], missingSample = [] } = data;
          return (
            <>
              <TelemetryRail label="RoutingIntelligence key measures">
                <article className="cx-command-metric flex flex-col justify-between">
                  <div>
                    <span>Routed leads</span>
                    <strong>{formatTableNumber(overview.total_routed_leads)}</strong>
                    <div><small>{formatPercent(overview.routed_lead_share_pct)} of captured leads</small></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-2.5 mt-2.5 border-t border-border-subtle">
                    <Link to={scoped('/lead-explorer')} className="inline-flex items-center gap-1 text-text-sec hover:text-action font-medium transition-colors">
                      <span>Inspect</span>
                      <ArrowRight size={10} aria-hidden="true" />
                    </Link>
                  </div>
                </article>

                <article className="cx-command-metric flex flex-col justify-between">
                  <div>
                    <span>Average route depth</span>
                    <strong>{overview.avg_routing_depth == null ? '—' : Number(overview.avg_routing_depth).toFixed(2)}</strong>
                    <div><small>Partners per routed lead</small></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-2.5 mt-2.5 border-t border-border-subtle">
                    <Link to={scoped('/offershop-flow')} className="inline-flex items-center gap-1 text-text-sec hover:text-action font-medium transition-colors">
                      <span>Inspect</span>
                      <ArrowRight size={10} aria-hidden="true" />
                    </Link>
                  </div>
                </article>

                <article className="cx-command-metric flex flex-col justify-between">
                  <div>
                    <span>Multi-route leads</span>
                    <strong>{formatTableNumber(overview.multi_route_leads)}</strong>
                    <div><small>Cascaded beyond one route</small></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-2.5 mt-2.5 border-t border-border-subtle">
                    <Link to={scoped('/lead-explorer')} className="inline-flex items-center gap-1 text-text-sec hover:text-action font-medium transition-colors">
                      <span>Inspect</span>
                      <ArrowRight size={10} aria-hidden="true" />
                    </Link>
                  </div>
                </article>

                <article className="cx-command-metric flex flex-col justify-between">
                  <div>
                    <span>Matched handoff</span>
                    <strong>{formatPercent(overview.handoff_rate_pct)}</strong>
                    <div><small>{formatTableNumber(overview.missing_handoff_leads)} unmatched</small></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-2.5 mt-2.5 border-t border-border-subtle">
                    <Link to={scoped('/lead-explorer')} className="inline-flex items-center gap-1 text-text-sec hover:text-action font-medium transition-colors">
                      <span>Inspect</span>
                      <ArrowRight size={10} aria-hidden="true" />
                    </Link>
                  </div>
                </article>

                <article className="cx-command-metric flex flex-col justify-between">
                  <div>
                    <span>Recorded route revenue</span>
                    <strong>{formatTableCurrency(overview.routed_revenue, currency)}</strong>
                    <div><small>Source-recorded value only</small></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-2.5 mt-2.5 border-t border-border-subtle">
                    <Link to={scoped('/commercial')} className="inline-flex items-center gap-1 text-text-sec hover:text-action font-medium transition-colors">
                      <span>Inspect</span>
                      <ArrowRight size={10} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              </TelemetryRail>

              <div className="cx-analytics-visual-grid">
                <VolumeRateComboChart
                  title="Routing depth and observed outcomes"
                  subtitle="Lead volume by routing depth with handoff, delivery and sale rates overlaid."
                  data={depthBreakdown.map((row:any) => ({
                    depth: row.depth_bucket,
                    leads: row.leads,
                    handoffRate: row.handoff_rate_pct,
                    deliveryRate: row.delivery_rate_pct,
                    saleRate: row.sale_rate_pct,
                  }))}
                  xKey="depth"
                  volumeKey="leads"
                  volumeLabel="Leads"
                  rateSeries={[
                    { key: 'handoffRate', label: 'Handoff rate' },
                    { key: 'deliveryRate', label: 'Delivery rate' },
                    { key: 'saleRate', label: 'Sale rate' },
                  ]}
                />
                <RankedMetricChart
                  title="Most common route sequences"
                  subtitle="Chronological partner paths ranked by observed lead volume."
                  data={topRoutePaths.map((row:any) => ({ route: row.route_path || 'Unknown', leads: row.leads }))}
                  categoryKey="route"
                  valueKey="leads"
                  valueLabel="Leads"
                  maxItems={10}
                />
              </div>

              <section className="cx-command-panel">
                <header>
                  <div><span className="cx-command-section-kicker">Depth</span><h2>Routing depth outcomes</h2><p>Lead-level distinct populations by the number of routing partners involved.</p></div>
                  <ExportAnalysisButton filename="routing-depth" rows={[
                  ['Depth', 'Leads', 'Handoff %', 'Delivery %', 'Dial %', 'Sale %', 'Recorded revenue'],
                  ...depthBreakdown.map((row:any) => [row.depth_bucket, row.leads, row.handoff_rate_pct, row.delivery_rate_pct, row.call_rate_pct, row.sale_rate_pct, row.total_revenue]),
                ]} definitions="Distinct lead outcomes grouped by observed routing depth. Revenue is recorded source value." />
                </header>
                <div className="cx-performance-table-wrap">
                  <table className="cx-performance-table cx-routing-table">
                    <thead><tr><th>Depth</th><th>Leads</th><th>Share</th><th>Handoff</th><th>Delivery</th><th>Called</th><th>Sale / fetched</th><th>Revenue-matched sale</th><th>Recorded revenue</th><th>Revenue / lead</th></tr></thead>
                    <tbody>
                      {depthBreakdown.map((row:any,index:number)=><tr key={`${row.depth_bucket}-${index}`}>
                        <th>{row.depth_bucket}</th>
                        <td>{formatTableNumber(row.leads)}</td>
                        <td>{formatPercent(row.lead_share_pct)}</td>
                        <td>{formatPercent(row.handoff_rate_pct)}</td>
                        <td>{formatPercent(row.delivery_rate_pct)}</td>
                        <td>{formatPercent(row.call_rate_pct)}</td>
                        <td>{formatPercent(row.sale_rate_pct)}</td>
                        <td>{formatPercent(row.billable_sale_rate_pct)}</td>
                        <td>{formatTableCurrency(row.total_revenue, currency)}</td>
                        <td>{formatTableCurrency(row.rev_per_lead, currency)}</td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="cx-command-panel">
                <header>
                  <div><span className="cx-command-section-kicker">Journey</span><h2>Most common route sequences</h2><p>Chronological partner paths ordered by observed volume.</p></div>
                  <GitBranch size={16} className="text-text-muted"/>
                </header>
                <div className="cx-route-paths">
                  {topRoutePaths.slice(0,12).map((row:any,index:number)=>(
                    <article key={`${row.route_path}-${index}`}>
                      <div className="cx-route-sequence">
                        {String(row.route_path||'Unknown').split(' -> ').map((partner:string,partnerIndex:number,arr:string[])=>(
                          <React.Fragment key={`${partner}-${partnerIndex}`}>
                            <span>{partner}</span>{partnerIndex<arr.length-1&&<ArrowRight size={12}/>}
                          </React.Fragment>
                        ))}
                      </div>
                      <dl>
                        <div><dt>Leads</dt><dd>{formatTableNumber(row.leads)}</dd></div>
                        <div><dt>Delivery</dt><dd>{formatPercent(row.deliv_pct)}</dd></div>
                        <div><dt>Sale</dt><dd>{formatPercent(row.sale_pct)}</dd></div>
                        <div><dt>Revenue / lead</dt><dd>{formatTableCurrency(row.rev_per_lead, currency)}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
              </section>

              <section className="cx-command-panel">
                <header>
                  <div><span className="cx-command-section-kicker">Handoff</span><h2>Partner handoff matrix</h2><p>Routing volume, cascade delay and matched downstream transaction coverage.</p></div>
                  <GitFork size={16} className="text-text-muted"/>
                </header>
                <div className="cx-performance-table-wrap">
                  <table className="cx-performance-table cx-routing-table">
                    <thead><tr><th>Partner</th><th>Routed</th><th>First route</th><th>Cascade</th><th>Avg delay</th><th>Matched handoff</th><th>Handoff rate</th><th>Delivery</th><th>Revenue-matched sale</th><th>Recorded revenue</th></tr></thead>
                    <tbody>{partnerHandoff.map((row:any,index:number)=><tr key={`${row.partner}-${index}`}>
                      <th>{row.partner}</th>
                      <td>{formatTableNumber(row.routed_leads)}</td>
                      <td>{formatTableNumber(row.first_route_leads)}</td>
                      <td>{formatTableNumber(row.cascade_route_leads)}</td>
                      <td>{row.avg_cascade_delay_sec==null?'—':`${Number(row.avg_cascade_delay_sec).toFixed(0)}s`}</td>
                      <td>{formatTableNumber(row.handoff_leads)}</td>
                      <td>{formatPercent(row.handoff_rate_pct)}</td>
                      <td>{formatPercent(row.delivery_rate_pct)}</td>
                      <td>{formatPercent(row.billable_sale_rate_pct)}</td>
                      <td>{formatTableCurrency(row.total_revenue, currency)}</td>
                    </tr>)}</tbody>
                  </table>
                </div>
              </section>

              <section className="cx-command-panel">
                <header>
                  <div><span className="cx-command-section-kicker">Exceptions</span><h2>Routing records without matched transactions</h2><p>These records need investigation; absence from this sample is not evidence of complete reconciliation.</p></div>
                  <AlertTriangle size={16} className="text-text-muted"/>
                </header>
                {!isAdmin ? <div className="cx-command-empty">Individual routing records require administrator access.</div> : missingSample.length ? (
                  <div className="cx-performance-table-wrap">
                    <table className="cx-performance-table">
                      <thead><tr><th>Lead</th><th>Consumer</th><th>Partner</th><th>Route sequence</th><th>Source / medium</th><th>Route timestamp</th></tr></thead>
                      <tbody>{missingSample.map((row:any,index:number)=><tr key={`${row.lead_id}-${index}`}><th>{row.lead_id}</th><td>{row.consumer_id||'—'}</td><td>{row.partner||'—'}</td><td>{row.route_sequence||'—'}</td><td>{row.source||'—'} / {row.medium||'—'}</td><td>{row.ror_timestamp?.value||row.ror_timestamp||'—'}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : <div className="cx-command-empty"><CheckCircle2 size={17}/>No unmatched routing sample was returned for this scope.</div>}
              </section>

              <nav className="cx-next-analyses" aria-label="Next analyses"><strong>Next analyses</strong>
                <Link to={scoped('/exceptions')}><AlertTriangle size={16}/><span><strong>Exceptions</strong></span><ArrowRight size={14}/></Link>
                <Link to={scoped('/lead-explorer')}><Clock3 size={16}/><span><strong>Explore leads</strong></span><ArrowRight size={14}/></Link>
              </nav>
            </>
          );
        })()}

    </AnalyticsPageLayout>
  );
}
