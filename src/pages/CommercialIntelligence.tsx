import React from 'react';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import SpendReconciliationPanel from '../components/SpendReconciliationPanel';
import { useOperationalData } from '../lib/useOperationalData';
import { AlertTriangle, ArrowRight, Database, DollarSign, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import {
  fetchCommercial,
} from '../lib/offernetClient';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import { formatPercent, formatTableCurrency, formatTableNumber } from '../lib/formatters';
import { GroupedOutcomeChart, RankedMetricChart } from '../components/charts/OperationalVisuals';

const money = (value: number | null | undefined) => formatTableCurrency(value, 'R');

export default function CommercialIntelligence() {
  const scoped = useScopedNavigationTarget();
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const { data, loading, error, loadData } = useOperationalData('commercial', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, fetchCommercial);
  const attribution = data?.attribution;
  const economics = data?.economics;

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
                <div><span>Platform population</span><strong>{formatTableNumber(data.media.platformLeads)} platform lead events · {formatTableNumber(data.media.platformClicks)} clicks</strong></div>
              </div>
            </section>

            <SpendReconciliationPanel reconciliation={data.reconciliation} grain={data.grainDiagnostics} />
            <section className="cx-command-metrics cx-commercial-metrics">
              <article className="cx-command-metric"><span>Recorded media spend</span><strong>{money(baseline.mediaSpend)}</strong><div><small>Approved marketing source only</small></div></article>
              <article className="cx-command-metric"><span>Platform CPL</span><strong>{money(baseline.cpl)}</strong><div><small>Spend / platform lead events</small></div></article>
              <article className="cx-command-metric"><span>Recorded revenue</span><strong>{money(baseline.revenue)}</strong><div><small>Lead-ledger revenue field</small></div></article>
              <article className="cx-command-metric"><span>Attributed spend / sale</span><strong>{money(baseline.blendedCostPerSale)}</strong><div><small>Matched spend / matched sales</small></div></article>
              <article className="cx-command-metric"><span>Revenue / media spend</span><strong>{baseline.revenueToMediaSpendRatio == null ? '—' : `${baseline.revenueToMediaSpendRatio.toFixed(2)}×`}</strong><div><small>Matched revenue / matched spend</small></div></article>
            </section>

            <section className="cx-command-panel" aria-label="Commercial matched-period changes">
              <header><div><span className="cx-command-section-kicker">Matched prior period</span><h2>Commercial changes</h2><p>{data.attributionComparison?.reason}</p></div></header>
              <div className="cx-commercial-ratios">
                <div><span>Spend change</span><strong>{money(data.mediaComparison?.spendDelta ?? data.attributionComparison?.spend.absoluteChange)}</strong><small>{formatPercent(data.mediaComparison?.spendDeltaPct ?? data.attributionComparison?.spend.percentageChange)} change</small></div>
                <div><span>Platform CPL change</span><strong>{formatPercent(data.mediaComparison?.cplDeltaPct)}</strong><small>Marketing population only</small></div>
                <div><span>Attributed CPS change</span><strong>{money(data.attributionComparison?.costPerSale.absoluteChange)}</strong><small>{formatPercent(data.attributionComparison?.costPerSale.percentageChange)} change</small></div>
                <div><span>Matched fetched change</span><strong>{formatTableNumber(data.attributionComparison?.fetched.absoluteChange)}</strong><small>Warehouse fetched leads</small></div>
                <div><span>Matched sales change</span><strong>{formatTableNumber(data.attributionComparison?.sales.absoluteChange)}</strong><small>Approved matched population</small></div>
              </div>
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

              <ExportAnalysisButton filename="commercial-attribution.csv" validationStatus={attribution?.validationStatus || 'NOT_VERIFIED'} dateBasis="marketing_reporting_date / operational_capture_cohort"
                definitions="Spend uses complete unique marketing grain; costs use matching approved keys; null is unavailable; unmatched spend is excluded from attributed costs."
                truncated={attribution?.detailScope?.truncated} rows={[
                  ['Approved key', 'Marketing present', 'Operations present', 'Spend', 'Platform leads', 'Fetched', 'Delivered', 'Dialled', 'RPC', 'Sales', 'Activations', 'Recorded revenue', 'Spend / fetched', 'Spend / sale', 'Spend / activation'],
                  ...(attribution?.rows || []).map(row => [row.key, row.hasMarketing, row.hasOperations, row.spend, row.platformLeads, row.fetched, row.delivered, row.dialled, row.rpc, row.sales, row.activations, row.recordedRevenue, row.spendPerFetchedLead, row.spendPerSale, row.spendPerActivation]),
                ]} />
              {attribution?.summary && (
                <div className="cx-commercial-source">
                  <div><span>Matched spend</span><strong>{money(attribution.summary.matchedSpend)}</strong><small>{attribution.summary.matchedSpendSharePct == null ? 'Coverage unavailable' : `${formatPercent(attribution.summary.matchedSpendSharePct)} of observed spend`}</small></div>
                  <div><span>Unmatched media spend</span><strong>{money(attribution.summary.unmatchedMarketingSpend)}</strong><small>{formatTableNumber(attribution.summary.marketingOnlyKeys)} marketing-only keys</small></div>
                  <div><span>Join-key coverage</span><strong>{formatTableNumber(attribution.summary.matchedKeys)} matched keys</strong><small>{formatTableNumber(attribution.summary.operationsOnlyKeys)} operations-only keys</small></div>
                </div>
              )}

              {attribution?.rows?.length ? <div className="cx-analytics-visual-grid">
                <GroupedOutcomeChart
                  title="Matched funnel outcomes by attribution key"
                  subtitle="Operational counts for the approved matching keys. Spend is deliberately not plotted as an outcome count."
                  data={[...attribution.rows].sort((a, b) => b.fetched - a.fetched).slice(0, 12)}
                  xKey="key"
                  series={[
                    { key: 'fetched', label: 'Fetched' },
                    { key: 'rpc', label: 'RPC' },
                    { key: 'sales', label: 'Sales' },
                    { key: 'activations', label: 'Activations' },
                  ]}
                />
                <RankedMetricChart
                  title="Recorded revenue by matched key"
                  subtitle="Source-recorded revenue only; missing values remain unavailable."
                  data={attribution.rows.filter(row => row.recordedRevenue != null).map(row => ({ key: row.key, revenue: row.recordedRevenue }))}
                  categoryKey="key"
                  valueKey="revenue"
                  valueLabel="Recorded revenue"
                  valuePrefix="R "
                  maxItems={12}
                />
              </div> : null}
              {attribution?.detailScope?.truncated && <p className="cx-control-note">Showing {attribution.detailScope.displayedKeys} of {attribution.detailScope.totalKeys} keys. Coverage and economics include every key.</p>}
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
                <header><div><span className="cx-command-section-kicker">Media efficiency</span><h2>Observed cost metrics</h2><p>Platform costs use marketing denominators. Funnel costs require matching approved keys: {economics?.reason}</p></div></header>
                <div className="cx-commercial-ratios">
                  <div><span>CPC</span><strong>{money(baseline.cpc)}</strong><small>Spend / clicks</small></div>
                  <div><span>CPM</span><strong>{money(baseline.cpm)}</strong><small>Spend / impressions × 1,000</small></div>
                  <div><span>Platform CPL</span><strong>{money(baseline.cpl)}</strong><small>Spend / platform lead events</small></div>
                  <div><span>Attributed spend / fetched</span><strong>{money(economics?.spendPerFetchedLead)}</strong><small>Matched fetched leads</small></div>
                  <div><span>Attributed spend / delivered</span><strong>{money(economics?.spendPerDeliveredLead)}</strong><small>Matched delivered leads</small></div>
                  <div><span>Attributed spend / dialled</span><strong>{money(economics?.spendPerDialledLead)}</strong><small>Matched dialled leads</small></div>
                  <div><span>Attributed spend / RPC</span><strong>{money(economics?.spendPerRpc)}</strong><small>Matched RPC leads</small></div>
                  <div><span>Attributed spend / sale</span><strong>{money(baseline.blendedCostPerSale)}</strong><small>Matching approved keys only</small></div>
                  <div><span>Attributed spend / activation</span><strong>{money(baseline.blendedCostPerActivation)}</strong><small>Matching approved keys only</small></div>
                </div>
              </section>

              <section className="cx-command-panel">
                <header><div><span className="cx-command-section-kicker">Commercial bridge</span><h2>Recorded values</h2><p>This is not a complete P&L because operating costs, commissions and overhead are not approved inputs.</p></div></header>
                <p className="cx-contract-note">{data.revenueReason}</p>
                <div className="cx-commercial-ratios">
                  <div><span>Revenue / fetched</span><strong>{money(baseline.revenuePerLead)}</strong><small>Recorded capture-cohort revenue / fetched</small></div>
                  <div><span>Revenue / sale</span><strong>{money(baseline.revenuePerSale)}</strong><small>Recorded capture-cohort revenue / sale</small></div>
                  <div><span>Revenue / activation</span><strong>{money(baseline.revenuePerActivation)}</strong><small>Recorded capture-cohort revenue / activation</small></div>
                  <div><span>Matched recorded revenue</span><strong>{money(economics?.recordedRevenue)}</strong><small>Approved matching keys only</small></div>
                  <div><span>Impressions</span><strong>{formatTableNumber(data.media.platformImpressions)}</strong></div>
                  <div><span>Reported reach sum</span><strong>{formatTableNumber(data.media.platformReach)}</strong><small>Audience overlap is not deduplicated</small></div>
                  <div><span>Outbound clicks</span><strong>{formatTableNumber(data.media.platformOutboundClicks)}</strong></div>
                </div>
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
