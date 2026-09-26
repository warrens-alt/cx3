import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, GitBranch, GitFork, Route } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { useClient } from '../lib/ClientContext';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import OperationalPageHeader from '../components/OperationalPageHeader';

export default function RoutingIntelligence() {
  const { clientConfig } = useClient();
  const currency = clientConfig?.currency === 'GBP' ? '£' : clientConfig?.currency === 'USD' ? '$' : 'R ';
  const { data, loading, error, refetch } = useAnalyticsData('routing');

  return (
    <div className="cx-command-page">
      <OffernetFilterBar onRefresh={() => refetch()} />
      <div className="cx-command-content">
        <OperationalPageHeader
          eyebrow="Routing"
          title="Lead routing"
          description="Understand routing depth, partner handoffs, repeated delivery journeys and the records that fail to produce a matched vendor transaction."
          status="NOT_VERIFIED"
          statusLabel="Legacy routing analytics"
          actions={<Link to="/lead-explorer" className="cx-button-secondary">Inspect leads <ArrowRight size={13}/></Link>}
        />

        {error && <div className="cx-command-error"><AlertTriangle size={17}/>{String(error)}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner"/>Loading routing journeys…</div>}

        {data?.overview && (() => {
          const { overview, depthBreakdown = [], partnerHandoff = [], topRoutePaths = [], missingSample = [] } = data;
          return (
            <>
              <section className="cx-command-metrics cx-routing-metrics">
                <article className="cx-command-metric"><span>Routed leads</span><strong>{Number(overview.total_routed_leads || 0).toLocaleString()}</strong><div><small>{Number(overview.routed_lead_share_pct || 0).toFixed(1)}% of captured leads</small></div></article>
                <article className="cx-command-metric"><span>Average route depth</span><strong>{Number(overview.avg_routing_depth || 0).toFixed(2)}</strong><div><small>Partners per routed lead</small></div></article>
                <article className="cx-command-metric"><span>Multi-route leads</span><strong>{Number(overview.multi_route_leads || 0).toLocaleString()}</strong><div><small>Cascaded beyond one route</small></div></article>
                <article className="cx-command-metric"><span>Matched handoff</span><strong>{Number(overview.handoff_rate_pct || 0).toFixed(1)}%</strong><div><small>{Number(overview.missing_handoff_leads || 0).toLocaleString()} unmatched</small></div></article>
                <article className="cx-command-metric"><span>Recorded route revenue</span><strong>{currency}{Number(overview.routed_revenue || 0).toLocaleString(undefined,{maximumFractionDigits:0})}</strong><div><small>Source-recorded value only</small></div></article>
              </section>

              <section className="cx-command-panel">
                <header>
                  <div><span className="cx-command-section-kicker">Depth</span><h2>Routing depth outcomes</h2><p>Lead-level distinct populations by the number of routing partners involved.</p></div>
                  <Route size={16} className="text-slate-400"/>
                </header>
                <div className="cx-performance-table-wrap">
                  <table className="cx-performance-table cx-routing-table">
                    <thead><tr><th>Depth</th><th>Leads</th><th>Share</th><th>Handoff</th><th>Delivery</th><th>Called</th><th>Sale / fetched</th><th>Revenue-matched sale</th><th>Recorded revenue</th><th>Revenue / lead</th></tr></thead>
                    <tbody>
                      {depthBreakdown.map((row:any,index:number)=><tr key={`${row.depth_bucket}-${index}`}>
                        <th>{row.depth_bucket}</th>
                        <td>{Number(row.leads||0).toLocaleString()}</td>
                        <td>{Number(row.lead_share_pct||0).toFixed(1)}%</td>
                        <td>{Number(row.handoff_rate_pct||0).toFixed(1)}%</td>
                        <td>{Number(row.delivery_rate_pct||0).toFixed(1)}%</td>
                        <td>{Number(row.call_rate_pct||0).toFixed(1)}%</td>
                        <td>{Number(row.sale_rate_pct||0).toFixed(1)}%</td>
                        <td>{Number(row.billable_sale_rate_pct||0).toFixed(1)}%</td>
                        <td>{currency}{Number(row.total_revenue||0).toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                        <td>{currency}{Number(row.rev_per_lead||0).toFixed(2)}</td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="cx-command-panel">
                <header>
                  <div><span className="cx-command-section-kicker">Journey</span><h2>Most common route sequences</h2><p>Chronological partner paths ordered by observed volume.</p></div>
                  <GitBranch size={16} className="text-slate-400"/>
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
                        <div><dt>Leads</dt><dd>{Number(row.leads||0).toLocaleString()}</dd></div>
                        <div><dt>Delivery</dt><dd>{Number(row.deliv_pct||0).toFixed(1)}%</dd></div>
                        <div><dt>Sale</dt><dd>{Number(row.sale_pct||0).toFixed(1)}%</dd></div>
                        <div><dt>Revenue / lead</dt><dd>{currency}{Number(row.rev_per_lead||0).toFixed(2)}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
              </section>

              <section className="cx-command-panel">
                <header>
                  <div><span className="cx-command-section-kicker">Handoff</span><h2>Partner handoff matrix</h2><p>Routing volume, cascade delay and matched downstream transaction coverage.</p></div>
                  <GitFork size={16} className="text-slate-400"/>
                </header>
                <div className="cx-performance-table-wrap">
                  <table className="cx-performance-table cx-routing-table">
                    <thead><tr><th>Partner</th><th>Routed</th><th>First route</th><th>Cascade</th><th>Avg delay</th><th>Matched handoff</th><th>Handoff rate</th><th>Delivery</th><th>Revenue-matched sale</th><th>Recorded revenue</th></tr></thead>
                    <tbody>{partnerHandoff.map((row:any,index:number)=><tr key={`${row.partner}-${index}`}>
                      <th>{row.partner}</th>
                      <td>{Number(row.routed_leads||0).toLocaleString()}</td>
                      <td>{Number(row.first_route_leads||0).toLocaleString()}</td>
                      <td>{Number(row.cascade_route_leads||0).toLocaleString()}</td>
                      <td>{row.avg_cascade_delay_sec==null?'—':`${Number(row.avg_cascade_delay_sec).toFixed(0)}s`}</td>
                      <td>{Number(row.handoff_leads||0).toLocaleString()}</td>
                      <td>{Number(row.handoff_rate_pct||0).toFixed(1)}%</td>
                      <td>{Number(row.delivery_rate_pct||0).toFixed(1)}%</td>
                      <td>{Number(row.billable_sale_rate_pct||0).toFixed(1)}%</td>
                      <td>{currency}{Number(row.total_revenue||0).toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                    </tr>)}</tbody>
                  </table>
                </div>
              </section>

              <section className="cx-command-panel">
                <header>
                  <div><span className="cx-command-section-kicker">Exceptions</span><h2>Routing records without matched transactions</h2><p>These records need investigation; absence from this sample is not evidence of complete reconciliation.</p></div>
                  <AlertTriangle size={16} className="text-slate-400"/>
                </header>
                {missingSample.length ? (
                  <div className="cx-performance-table-wrap">
                    <table className="cx-performance-table">
                      <thead><tr><th>Lead</th><th>Consumer</th><th>Partner</th><th>Route sequence</th><th>Source / medium</th><th>Route timestamp</th></tr></thead>
                      <tbody>{missingSample.map((row:any,index:number)=><tr key={`${row.lead_id}-${index}`}><th>{row.lead_id}</th><td>{row.consumer_id||'—'}</td><td>{row.partner||'—'}</td><td>{row.route_sequence||'—'}</td><td>{row.source||'—'} / {row.medium||'—'}</td><td>{row.ror_timestamp?.value||row.ror_timestamp||'—'}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : <div className="cx-command-empty"><CheckCircle2 size={17}/>No unmatched routing sample was returned for this scope.</div>}
              </section>

              <section className="cx-command-shortcuts">
                <Link to="/exceptions"><AlertTriangle size={16}/><span><strong>Exceptions</strong><small>Review operational populations needing attention</small></span><ArrowRight size={14}/></Link>
                <Link to="/lead-explorer"><Clock3 size={16}/><span><strong>Explore leads</strong><small>Inspect record-level timelines</small></span><ArrowRight size={14}/></Link>
              </section>
            </>
          );
        })()}
      </div>
    </div>
  );
}
