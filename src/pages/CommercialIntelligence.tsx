import React from 'react';
import { useOperationalData } from '../lib/useOperationalData';
import { AlertTriangle, ArrowRight, Database, DollarSign, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import {
  fetchCommercial,
  fetchMarketingAttribution,
  type MarketingAttributionData,
} from '../lib/offernetClient';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import { formatPercent, formatTableCurrency, formatTableNumber } from '../lib/formatters';

const money = (value: number | null | undefined) => formatTableCurrency(value, 'R');

export default function CommercialIntelligence() {
  const scoped = useScopedNavigationTarget();
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const { data: result, loading, error, loadData } = useOperationalData('commercial', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, async (scope, forceRefresh) => Promise.all([
    fetchCommercial(scope, forceRefresh),
    fetchMarketingAttribution(scope, forceRefresh).catch(err => ({
      status: 'UNAVAILABLE',
      reason: err?.message || 'Attribution unavailable',
      rows: [],
    } as MarketingAttributionData)),
  ]));
  const data = result?.[0] ?? null;
  const attribution = result?.[1] ?? null;

  const baseline = data?.baseline;

  return (
    <div className="cx-command-page">
      <OffernetFilterBar onRefresh={() => loadData(true)} />
      <div className="cx-command-content">
        <header className="cx-command-hero">
          <div>
            <span className="cx-command-eyebrow">Commercial</span>
            <h1>Spend, revenue & efficiency</h1>
            <p>Observed media spend and recorded revenue, with attributed funnel economics activated only by an explicit cross-source key contract.</p>
          </div>
          <Link to={scoped('/campaigns')} className="cx-trust-pill">
            <DollarSign size={15}/>
            <span><strong>MEDIA DETAIL</strong><small>Campaign spend & efficiency</small></span>
            <ArrowRight size={14}/>
          </Link>
        </header>

        {error && <div className="cx-command-error"><AlertTriangle size={17}/>{error}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner"/>Loading commercial evidence…</div>}

        {data && baseline && (
          <>
            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Measurement status</span>
                  <h2>{data.status}</h2>
                  <p>{data.reason}</p>
                </div>
                <ShieldCheck size={17} className="text-slate-400"/>
              </header>
              <div className="cx-commercial-source">
                <div><span>Media spend source</span><strong>{data.media.spendSourceColumn || 'Unavailable'}</strong></div>
                <div><span>Source table</span><strong>{data.media.spendSourceTable || 'Unavailable'}</strong></div>
                <div><span>Platform population</span><strong>{data.media.platformLeads.toLocaleString()} leads · {data.media.platformClicks.toLocaleString()} clicks</strong></div>
              </div>
            </section>

            <section className="cx-command-metrics cx-commercial-metrics">
              <article className="cx-command-metric"><span>Recorded media spend</span><strong>{money(baseline.mediaSpend)}</strong><div><small>Approved marketing source only</small></div></article>
              <article className="cx-command-metric"><span>Platform CPL</span><strong>{money(baseline.cpl)}</strong><div><small>Spend / platform leads</small></div></article>
              <article className="cx-command-metric"><span>Recorded revenue</span><strong>{money(baseline.revenue)}</strong><div><small>Lead-ledger revenue field</small></div></article>
              <article className="cx-command-metric"><span>Blended cost / sale</span><strong>{money(baseline.blendedCostPerSale)}</strong><div><small>Period-level media spend / sales</small></div></article>
              <article className="cx-command-metric"><span>Revenue / media spend</span><strong>{baseline.revenueToMediaSpendRatio == null ? '—' : `${baseline.revenueToMediaSpendRatio.toFixed(2)}×`}</strong><div><small>Unreconciled period-level ratio</small></div></article>
            </section>

            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Attribution bridge</span>
                  <h2>Spend → operational outcomes</h2>
                  <p>{attribution?.reason || 'Attribution status unavailable.'}</p>
                </div>
                <span className="cx-source-status" data-status={attribution?.status || 'UNAVAILABLE'}>{attribution?.status || 'UNAVAILABLE'}</span>
              </header>

              {attribution?.summary && (
                <div className="cx-commercial-source">
                  <div><span>Matched spend</span><strong>{money(attribution.summary.matchedSpend)}</strong><small>{attribution.summary.matchedSpendSharePct == null ? 'Coverage unavailable' : `${formatPercent(attribution.summary.matchedSpendSharePct)} of observed spend`}</small></div>
                  <div><span>Unmatched media spend</span><strong>{money(attribution.summary.unmatchedMarketingSpend)}</strong><small>{formatTableNumber(attribution.summary.marketingOnlyKeys)} marketing-only keys</small></div>
                  <div><span>Join-key coverage</span><strong>{formatTableNumber(attribution.summary.matchedKeys)} matched keys</strong><small>{formatTableNumber(attribution.summary.operationsOnlyKeys)} operations-only keys</small></div>
                </div>
              )}

              {attribution?.rows?.length ? (
                <div className="cx-performance-table-wrap">
                  <table className="cx-performance-table cx-attribution-table">
                    <thead>
                      <tr>
                        <th>Approved join key</th>
                        <th>Coverage</th>
                        <th>Spend</th>
                        <th>Platform leads</th>
                        <th>Fetched</th>
                        <th>Delivered</th>
                        <th>Dialled</th>
                        <th>RPC</th>
                        <th>Sales</th>
                        <th>Activated</th>
                        <th>Spend / fetched</th>
                        <th>Spend / sale</th>
                        <th>Spend / activation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attribution.rows.map(row => (
                        <tr key={row.key}>
                          <th>{row.key}</th>
                          <td>{row.hasMarketing && row.hasOperations ? 'Matched' : row.hasMarketing ? 'Marketing only' : 'Operations only'}</td>
                          <td>{money(row.spend)}</td>
                          <td>{formatTableNumber(row.platformLeads)}</td>
                          <td>{formatTableNumber(row.fetched)}</td>
                          <td>{formatTableNumber(row.delivered)}</td>
                          <td>{formatTableNumber(row.dialled)}</td>
                          <td>{formatTableNumber(row.rpc)}</td>
                          <td>{formatTableNumber(row.sales)}</td>
                          <td>{formatTableNumber(row.activations)}</td>
                          <td>{money(row.spendPerFetchedLead)}</td>
                          <td>{money(row.spendPerSale)}</td>
                          <td>{money(row.spendPerActivation)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="cx-command-empty">
                  <ShieldCheck size={17}/>
                  Configure and reconcile <code>CX_MARKETING_ATTRIBUTION_JSON</code> before CX3 joins media spend to operational outcomes.
                </div>
              )}
            </section>

            <div className="cx-command-grid cx-commercial-grid">
              <section className="cx-command-panel">
                <header><div><span className="cx-command-section-kicker">Media efficiency</span><h2>Observed cost metrics</h2><p>These metrics stay inside the marketing-source population.</p></div></header>
                <div className="cx-commercial-ratios">
                  <div><span>CPC</span><strong>{money(baseline.cpc)}</strong><small>Spend / clicks</small></div>
                  <div><span>CPM</span><strong>{money(baseline.cpm)}</strong><small>Spend / 1,000 impressions</small></div>
                  <div><span>Platform CPL</span><strong>{money(baseline.cpl)}</strong><small>Spend / platform leads</small></div>
                  <div><span>Blended cost / fetched lead</span><strong>{money(baseline.blendedCostPerFetchedLead)}</strong><small>Cross-source, unreconciled</small></div>
                  <div><span>Blended cost / sale</span><strong>{money(baseline.blendedCostPerSale)}</strong><small>Cross-source, unreconciled</small></div>
                  <div><span>Blended cost / activation</span><strong>{money(baseline.blendedCostPerActivation)}</strong><small>Cross-source, unreconciled</small></div>
                </div>
              </section>

              <section className="cx-command-panel">
                <header><div><span className="cx-command-section-kicker">Commercial bridge</span><h2>Recorded values</h2><p>This is not a complete P&L because operating costs, commissions and overhead are not approved inputs.</p></div></header>
                <div className="cx-commercial-bridge">
                  {data.pAndLBreakdown.map(item => (
                    <div key={item.type}><span>{item.item}</span><strong className={item.amount < 0 ? 'negative' : ''}>{money(Math.abs(item.amount))}{item.amount < 0 ? ' outflow' : ''}</strong></div>
                  ))}
                </div>
              </section>
            </div>

            <section className="cx-command-panel">
              <header><div><span className="cx-command-section-kicker">Still withheld</span><h2>Profitability inputs not sourced from approved tables</h2><p>These remain unavailable rather than being reconstructed from assumptions.</p></div><Database size={16} className="text-slate-400"/></header>
              <div className="cx-withheld-grid">
                {['Telephony cost','Agent / delivery cost','Commission','Fixed overhead','Total operating cost','Contribution margin','Net margin','Break-even volume'].map(label => (
                  <div key={label}><span>{label}</span><strong>UNAVAILABLE</strong></div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
