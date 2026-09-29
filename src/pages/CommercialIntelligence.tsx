import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Database, DollarSign, Search, ShieldCheck } from 'lucide-react';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import SpendReconciliationPanel from '../components/SpendReconciliationPanel';
import RootCauseDrawer from '../components/RootCauseDrawer';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useOperationalData } from '../lib/useOperationalData';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchCommercial } from '../lib/offernetClient';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import { formatPercent, formatTableCurrency, formatTableNumber } from '../lib/formatters';
import { GroupedOutcomeChart, RankedMetricChart } from '../components/charts/OperationalVisuals';

export default function CommercialIntelligence() {
  // Only these two displayed metrics have a matching, supported media decomposition.
  const [rootMetric, setRootMetric] = useState<'spend' | 'cpl' | null>(null);
  const scoped = useScopedNavigationTarget();
  const { selectedClient, clientConfig } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const { data, loading, error, loadData } = useOperationalData('commercial', {
    clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, fetchCommercial);
  useEffect(() => setRootMetric(null), [selectedClient, startDate, endDate, filters]);
  const attribution = data?.attribution, economics = data?.economics, baseline = data?.baseline;
  const currency = data?.currency || clientConfig?.currency;
  const money = (value: number | string | null | undefined) => formatTableCurrency(value, currency || 'Currency unknown');
  const mediaScope = !['source', 'vendor', 'medium', 'grade', 'agent', 'cli'].some(key => filters[key]);
  const canCompareMedia = Boolean(startDate && endDate && mediaScope && data?.mediaComparison && !loading && !error);

  const metrics = baseline ? [
    { label: 'Recorded media spend', value: money(baseline.mediaSpend), note: 'Approved incurred-spend field; never budget.', path: '/campaigns', metric: 'spend' as const, available: baseline.mediaSpend != null },
    { label: 'Platform CPL', value: money(baseline.cpl), note: 'Spend / platform lead events.', path: '/campaigns', metric: 'cpl' as const, available: baseline.cpl != null },
    { label: 'Recorded revenue', value: money(baseline.revenue), note: 'Source-reported value, not invoice or cash evidence. Revenue decomposition is not available.', path: '/sales-activation', metric: null, available: baseline.revenue != null },
    { label: 'Attributed spend / sale', value: money(baseline.blendedCostPerSale), note: 'Matching approved keys only. Not a lead-to-sale-rate decomposition.', path: '/reconciliation', metric: null, available: baseline.blendedCostPerSale != null },
    { label: 'Revenue / media spend', value: baseline.revenueToMediaSpendRatio == null ? '—' : `${baseline.revenueToMediaSpendRatio.toFixed(2)}×`, note: 'Matched recorded value / spend; not profit or cash return.', path: '/reconciliation', metric: null, available: baseline.revenueToMediaSpendRatio != null },
  ] : [];

  return <div className="cx-command-page">
    <OffernetFilterBar onRefresh={() => loadData(true)} />
    <div className="cx-command-content">
      <header className="cx-command-hero"><div><span className="cx-command-eyebrow">Commercial</span><h1>Spend, revenue & efficiency</h1><p>Interpret recorded value, observed media cost and matched operational outcomes separately. Missing financial evidence stays unavailable.</p></div><Link to={scoped('/campaigns')} className="cx-trust-pill"><DollarSign size={15} /><span><strong>MEDIA DETAIL</strong><small>Campaign spend & efficiency</small></span><ArrowRight size={14} /></Link></header>
      {error && <div role="alert" className="cx-command-error"><AlertTriangle size={17} />{error}</div>}
      {loading && !data && <div role="status" className="cx-command-loading">Loading commercial evidence…</div>}
      {loading && data && <p role="status">Refreshing the current commercial scope…</p>}
      {data && baseline && <>
        <section className="cx-command-panel" aria-label="Commercial evidence coverage">
          <header><div><span className="cx-command-section-kicker">Measurement status</span><h2>{data.status}</h2><p>{data.reason}</p></div><ShieldCheck size={17} /></header>
          <div className="cx-commercial-source">
            <div><span>Media spend source</span><strong>{data.media.spendSourceColumn || 'Unavailable'}</strong><small>{data.media.spendSourceTable || 'No approved spend source reported'}</small></div>
            <div><span>Platform population</span><strong>{formatTableNumber(data.media.platformLeads)} platform lead events</strong><small>{formatTableNumber(data.media.platformClicks)} clicks</small></div>
            <div><span>Currency</span><strong>{currency || 'Not established'}</strong><small>No currency conversion is applied.</small></div>
            <div><span>Invoices, cash & clawbacks</span><strong>Unavailable</strong><small>Source-recorded revenue is not settlement evidence.</small></div>
          </div>
        </section>
        <SpendReconciliationPanel reconciliation={data.reconciliation} grain={data.grainDiagnostics} />
        <section className="cx-command-metrics cx-commercial-metrics" aria-label="Commercial summary metrics">
          {metrics.map(item => <article key={item.label} className="cx-command-metric">
            <span>{item.label}</span><strong>{item.value}</strong><div><small>{item.note}</small></div>
            <div className="cx-readiness-actions">
              {item.metric && <button type="button" className="cx-button-secondary" disabled={!canCompareMedia || !item.available} title={!canCompareMedia ? 'Select a supported media scope with a valid matched period.' : `Investigate ${item.label.toLowerCase()}`} onClick={() => setRootMetric(item.metric)}><Search size={12} aria-hidden="true" />Why changed?</button>}
              <Link to={scoped(item.path)} className="cx-button-secondary">Inspect evidence<ArrowRight size={12} aria-hidden="true" /></Link>
            </div>
          </article>)}
        </section>
        <section className="cx-command-panel" aria-label="Commercial matched-period changes">
          <header><div><span className="cx-command-section-kicker">Matched prior period</span><h2>Commercial changes</h2><p>{data.attributionComparison?.reason}</p></div></header>
          <div className="cx-commercial-ratios">
            <div><span>Spend change</span><strong>{money(data.mediaComparison?.spendDelta ?? data.attributionComparison?.spend.absoluteChange)}</strong><small>{formatPercent(data.mediaComparison?.spendDeltaPct ?? data.attributionComparison?.spend.percentageChange)} change</small></div>
            <div><span>Platform CPL change</span><strong>{formatPercent(data.mediaComparison?.cplDeltaPct)}</strong><small>Marketing population only</small></div>
            <div><span>Attributed CPS change</span><strong>{money(data.attributionComparison?.costPerSale.absoluteChange)}</strong><small>{formatPercent(data.attributionComparison?.costPerSale.percentageChange)} change</small></div>
            <div><span>Matched fetched change</span><strong>{formatTableNumber(data.attributionComparison?.fetched.absoluteChange)}</strong><small>Approved matched population, not all fetched leads</small></div>
            <div><span>Matched sales change</span><strong>{formatTableNumber(data.attributionComparison?.sales.absoluteChange)}</strong><small>Approved matched population, not the lead-to-sale rate</small></div>
          </div>
        </section>
        <section className="cx-command-panel">
          <header><div><span className="cx-command-section-kicker">Attribution bridge</span><h2>Spend → operational outcomes</h2><p>{attribution?.reason || 'Attribution status unavailable.'}</p></div><span className="cx-source-status" data-status={attribution?.status || 'UNAVAILABLE'}>{attribution?.status || 'UNAVAILABLE'}</span></header>
          {!loading && Boolean(attribution?.rows?.length) && <ExportAnalysisButton filename="commercial-attribution.csv" validationStatus={attribution?.validationStatus || 'NOT_VERIFIED'} dateBasis="marketing_reporting_date / operational_capture_cohort" definitions={`Currency: ${currency || 'unavailable'}. Spend uses complete unique marketing grain; costs use matching approved keys; null is unavailable; unmatched spend is excluded from attributed costs.`} truncated={attribution?.detailScope?.truncated} rows={[
            ['Approved key', 'Marketing present', 'Operations present', 'Spend', 'Platform leads', 'Fetched', 'Delivered', 'Dialled', 'RPC', 'Sales', 'Activations', 'Recorded revenue', 'Spend / fetched', 'Spend / sale', 'Spend / activation'],
            ...(attribution?.rows || []).map(row => [row.key, row.hasMarketing, row.hasOperations, row.spend, row.platformLeads, row.fetched, row.delivered, row.dialled, row.rpc, row.sales, row.activations, row.recordedRevenue, row.spendPerFetchedLead, row.spendPerSale, row.spendPerActivation]),
          ]} />}
          {attribution?.summary && <div className="cx-commercial-source">
            <div><span>Matched spend</span><strong>{money(attribution.summary.matchedSpend)}</strong><small>{attribution.summary.matchedSpendSharePct == null ? 'Coverage unavailable' : `${formatPercent(attribution.summary.matchedSpendSharePct)} of observed spend`}</small></div>
            <div><span>Unmatched media spend</span><strong>{money(attribution.summary.unmatchedMarketingSpend)}</strong><small>{formatTableNumber(attribution.summary.marketingOnlyKeys)} marketing-only keys</small></div>
            <div><span>Join-key coverage</span><strong>{formatTableNumber(attribution.summary.matchedKeys)} matched keys</strong><small>{formatTableNumber(attribution.summary.operationsOnlyKeys)} operations-only keys</small></div>
          </div>}
          {Boolean(attribution?.rows?.length) && <div className="cx-analytics-visual-grid">
            <GroupedOutcomeChart title="Matched funnel outcomes by attribution key" subtitle="Top 12 displayed attribution keys by fetched volume. Independent recorded outcomes; no nested funnel is assumed." data={[...(attribution?.rows || [])].filter(row => row.hasMarketing && row.hasOperations).sort((a, b) => b.fetched - a.fetched).slice(0, 12)} xKey="key" series={[{ key: 'fetched', label: 'Fetched' }, { key: 'rpc', label: 'RPC' }, { key: 'sales', label: 'Sales' }, { key: 'activations', label: 'Activations' }]} />
            <RankedMetricChart title="Recorded revenue by matched key" subtitle="Only matched keys with recorded values; missing revenue remains unavailable." data={(attribution?.rows || []).filter(row => row.hasMarketing && row.hasOperations && row.recordedRevenue != null).map(row => ({ key: row.key, revenue: row.recordedRevenue }))} categoryKey="key" valueKey="revenue" valueLabel="Recorded revenue" valuePrefix={currency || ''} />
          </div>}
          {attribution?.rows?.length ? <>
            {attribution.detailScope?.truncated && <p className="cx-contract-note">The detailed table and its export are limited by the API. Summary coverage uses the full scoped population.</p>}
            <div className="cx-command-table-wrap"><table className="cx-command-table"><caption>Approved attribution-key evidence; amounts in {currency || 'an unspecified currency'}</caption><thead><tr><th scope="col">Key</th><th>Coverage</th>{['Spend', 'Platform leads', 'Fetched', 'Delivered', 'Dialled', 'RPC', 'Sales', 'Activations', 'Recorded revenue', 'Spend / fetched', 'Spend / sale', 'Spend / activation'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{attribution.rows.map(row => <tr key={row.key}><th scope="row">{row.key}</th><td>{row.hasMarketing && row.hasOperations ? 'Matched' : row.hasMarketing ? 'Marketing only' : 'Operations only'}</td><td>{money(row.spend)}</td><td>{formatTableNumber(row.platformLeads)}</td><td>{formatTableNumber(row.fetched)}</td><td>{formatTableNumber(row.delivered)}</td><td>{formatTableNumber(row.dialled)}</td><td>{formatTableNumber(row.rpc)}</td><td>{formatTableNumber(row.sales)}</td><td>{formatTableNumber(row.activations)}</td><td>{money(row.recordedRevenue)}</td><td>{money(row.spendPerFetchedLead)}</td><td>{money(row.spendPerSale)}</td><td>{money(row.spendPerActivation)}</td></tr>)}</tbody></table></div>
          </> : <div className="cx-command-empty"><ShieldCheck size={17} />{attribution?.status === 'AVAILABLE' ? 'No attribution rows match this selection.' : 'Approved attribution evidence is not available for this selection. Review the mapping and source diagnostics.'}</div>}
        </section>
        <div className="cx-command-grid cx-commercial-grid">
          <section className="cx-command-panel"><header><div><span className="cx-command-section-kicker">Media efficiency</span><h2>Observed cost metrics</h2><p>Platform costs use marketing denominators. Funnel costs require approved matching keys. {economics?.reason}</p></div></header><div className="cx-commercial-ratios">
            {[
              ['CPC', baseline.cpc, 'Spend / clicks'], ['CPM', baseline.cpm, 'Spend / impressions × 1,000'], ['Platform CPL', baseline.cpl, 'Spend / platform lead events'],
              ['Attributed spend / fetched', economics?.spendPerFetchedLead, 'Matched fetched leads'], ['Attributed spend / delivered', economics?.spendPerDeliveredLead, 'Matched delivered leads'], ['Attributed spend / dialled', economics?.spendPerDialledLead, 'Matched dialled leads'], ['Attributed spend / RPC', economics?.spendPerRpc, 'Matched RPC leads'], ['Attributed spend / sale', baseline.blendedCostPerSale, 'Matched sales'], ['Attributed spend / activation', baseline.blendedCostPerActivation, 'Matched activations'],
            ].map(([label, value, note]) => <div key={String(label)}><span>{label}</span><strong>{money(value)}</strong><small>{note}</small></div>)}
          </div></section>
          <section className="cx-command-panel"><header><div><span className="cx-command-section-kicker">Commercial bridge</span><h2>Recorded values</h2><p>This is not a complete P&L. Costs, invoices and settlements have separate evidence requirements.</p></div></header><p className="cx-contract-note">{data.revenueReason}</p><div className="cx-commercial-ratios">
            <div><span>Revenue / fetched</span><strong>{money(baseline.revenuePerLead)}</strong><small>Recorded cohort revenue / fetched</small></div><div><span>Revenue / sale</span><strong>{money(baseline.revenuePerSale)}</strong><small>Recorded cohort revenue / sales</small></div><div><span>Revenue / activation</span><strong>{money(baseline.revenuePerActivation)}</strong><small>Recorded cohort revenue / activations</small></div><div><span>Matched recorded revenue</span><strong>{money(economics?.recordedRevenue)}</strong></div><div><span>Impressions</span><strong>{formatTableNumber(data.media.platformImpressions)}</strong></div><div><span>Reported reach sum</span><strong>{formatTableNumber(data.media.platformReach)}</strong><small>Audience overlap is not deduplicated</small></div><div><span>Outbound clicks</span><strong>{formatTableNumber(data.media.platformOutboundClicks)}</strong></div>
          </div><div className="cx-commercial-bridge">{data.pAndLBreakdown.map(item => <div key={item.type}><span>{item.item}</span><strong>{money(item.amount)}</strong></div>)}</div></section>
        </div>
        <section className="cx-command-panel"><header><div><span className="cx-command-section-kicker">Still withheld</span><h2>Profitability inputs not sourced from approved tables</h2><p>These are not reconstructed from budgets, example rates or assumptions.</p></div><Database size={16} /></header><div className="cx-withheld-grid">{['Telephony cost', 'Agent / delivery cost', 'Commission', 'Fixed overhead', 'Total operating cost', 'Contribution margin', 'Net margin', 'Break-even volume'].map(label => <div key={label}><span>{label}</span><strong>UNAVAILABLE</strong></div>)}</div></section>
      </>}
    </div>
    <RootCauseDrawer open={Boolean(rootMetric)} metric={rootMetric} onClose={() => setRootMetric(null)} />
  </div>;
}
