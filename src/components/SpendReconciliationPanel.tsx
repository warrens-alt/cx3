import type { SpendReconciliation } from '../../contracts/commercial';
import { formatTableCurrency, formatTableNumber } from '../lib/formatters';

export default function SpendReconciliationPanel({ reconciliation, grain }: {
  reconciliation?: SpendReconciliation | null;
  grain?: { rowCount: number; distinctGrainCount: number; duplicateGrainRows: number; missingGrainRows?: number; missingSpendRows?: number; fields?: string[] } | null;
}) {
  return <section className="cx-command-panel" aria-label="Spend reconciliation">
    <header><div><span className="cx-command-section-kicker">Spend audit</span><h2>{reconciliation?.status || 'UNAVAILABLE'}</h2>
      <p>{reconciliation?.reason || 'An approved observed-spend population is required before source totals can be reconciled.'}</p></div></header>
    <div className="cx-commercial-ratios">
      <div><span>Raw observed amount</span><strong>{formatTableCurrency(reconciliation?.rawObservedSpend, 'R')}</strong><small>Diagnostic only; may include duplicates or exclude missing amounts</small></div>
      <div><span>Contracted grain spend</span><strong>{formatTableCurrency(reconciliation?.contractedGrainSpend, 'R')}</strong><small>Unique complete grain, complete spend</small></div>
      <div><span>All campaign groups</span><strong>{formatTableCurrency(reconciliation?.campaignAggregationSpend, 'R')}</strong><small>Full scope, before the detail row limit</small></div>
      <div><span>Commercial total spend</span><strong>{formatTableCurrency(reconciliation?.commercialTotalSpend, 'R')}</strong><small>Withheld on a reconciliation failure</small></div>
      <div><span>Reconciliation difference</span><strong>{formatTableCurrency(reconciliation?.difference, 'R')}</strong><small>Campaign aggregation minus contracted grain</small></div>
    </div>
    {grain && <><div className="cx-commercial-source">
      <div><span>Marketing rows</span><strong>{formatTableNumber(grain.rowCount)}</strong><small>{formatTableNumber(grain.distinctGrainCount)} distinct grain rows</small></div>
      <div><span>Duplicate grain rows</span><strong>{formatTableNumber(grain.duplicateGrainRows)}</strong><small>{formatTableNumber(grain.missingGrainRows)} incomplete keys</small></div>
      <div><span>Missing / invalid spend</span><strong>{formatTableNumber(grain.missingSpendRows)}</strong><small>Missing amounts withhold total spend</small></div>
    </div>{grain.fields?.length ? <p className="cx-contract-note">Grain: {grain.fields.join(' × ')}</p> : null}</>}
  </section>;
}
