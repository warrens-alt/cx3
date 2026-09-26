import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchCommercial } from '../lib/offernetClient';
import { useOperationalData } from '../lib/useOperationalData';
import { formatTableCurrency } from '../lib/formatters';

/** Shares the canonical commercial endpoint; no independent financial arithmetic in Overview. */
export default function OverviewCommercialPanel() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const { data, loading, error } = useOperationalData('overview-commercial', {
    clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined, ...extractOffernetFilters(filters),
  }, fetchCommercial);
  const change = (value: number | null | undefined) => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  const money = (value: number | null | undefined) => formatTableCurrency(value, 'R');
  return <section className="cx-command-panel" aria-label="Commercial overview">
    <header><div><span className="cx-command-section-kicker">Commercial evidence</span><h2>Spend → recorded outcomes</h2><p>{data?.reason || (loading ? 'Loading approved commercial evidence…' : error || 'Commercial evidence unavailable.')}</p></div></header>
    {data && <><div className="cx-commercial-ratios">
      <div><span>Total observed spend</span><strong>{money(data.baseline.mediaSpend)}</strong><small>{data.reconciliation?.status || 'UNAVAILABLE'} reconciliation</small></div>
      <div><span>Recorded revenue</span><strong>{money(data.baseline.revenue)}</strong><small>Selected capture cohort</small></div>
      <div><span>Spend / fetched</span><strong>{money(data.economics?.spendPerFetchedLead)}</strong><small>Approved matching keys only</small></div>
      <div><span>Spend / sale</span><strong>{money(data.economics?.spendPerSale)}</strong><small>Approved matching keys only</small></div>
      <div><span>Spend / activation</span><strong>{money(data.economics?.spendPerActivation)}</strong><small>Approved matching keys only</small></div>
      <div><span>Revenue / spend</span><strong>{data.economics?.revenueToSpend == null ? '—' : `${data.economics.revenueToSpend}×`}</strong><small>Approved matching keys only</small></div>
      <div><span>Spend change</span><strong>{change(data.mediaComparison?.spendDeltaPct ?? data.attributionComparison?.spend.percentageChange)}</strong><small>{money(data.mediaComparison?.spendDelta ?? data.attributionComparison?.spend.absoluteChange)} absolute change</small></div>
      <div><span>Platform CPL change</span><strong>{change(data.mediaComparison?.cplDeltaPct)}</strong><small>Matched prior marketing period</small></div>
      <div><span>Attributed CPS change</span><strong>{change(data.attributionComparison?.costPerSale.percentageChange)}</strong><small>{money(data.attributionComparison?.costPerSale.absoluteChange)} absolute change</small></div>
    </div><p className="cx-contract-note">{data.attributionComparison?.reason}</p><p className="cx-contract-note">{data.economics?.reason}</p></>}
  </section>;
}
