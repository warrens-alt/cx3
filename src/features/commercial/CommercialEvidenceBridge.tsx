import React from 'react';
import { CircleDollarSign, ShieldQuestion, WalletCards } from 'lucide-react';
import type { CommercialData } from '../../lib/offernetClient';
import { formatTableCurrency, formatTableNumber } from '../../lib/formatters';
import { lifecyclePresentation } from '../../shared/visuals/lifecyclePresentation';
import ChartFrame from '../../shared/visuals/ChartFrame';
import ReportingScopeSummary from '../../shared/reporting/ReportingScopeSummary';
import AttributionBoundary from './AttributionBoundary';

export default function CommercialEvidenceBridge({ data, currency }: { data: CommercialData; currency?: string }) {
  const { baseline, economics, attribution } = data;
  const money = (value: number | null | undefined) => formatTableCurrency(value, currency || 'Currency unknown');
  const matched = attribution?.status === 'AVAILABLE' && (attribution.summary?.matchedKeys ?? 0) > 0;
  const partial = matched && ((attribution?.summary?.marketingOnlyKeys ?? 0) > 0 || (attribution?.summary?.operationsOnlyKeys ?? 0) > 0);
  const revenueLinked = matched && economics?.status === 'AVAILABLE' && economics.recordedRevenue != null;
  const outcomeRows = [
    { stage: lifecyclePresentation.fetched, value: economics?.fetched },
    { stage: lifecyclePresentation.sales, value: economics?.sales },
    { stage: lifecyclePresentation.activated, value: economics?.activations },
  ];
  return <ChartFrame title="Follow the available evidence" subtitle="Marketing, matched operations and recorded value" className="cx-commercial-evidence-bridge cx-analytical-canvas" scope={<ReportingScopeSummary />}>
    <div className="cx-commercial-lineage">
      <article className="cx-lineage-marketing" data-state={baseline.mediaSpend == null ? 'unavailable' : 'observed'}>
        <h3><WalletCards size={18} aria-hidden="true" />Marketing platform</h3>
        <span className="cx-bridge-value-label">Observed media spend</span><strong className="cx-bridge-value">{money(baseline.mediaSpend)}</strong>
        <small>{baseline.mediaSpend == null ? 'Spend evidence unavailable' : baseline.mediaSpend === 0 ? 'Observed zero' : 'Observed incurred spend'}</small>
        <dl><div><dt>Platform lead events</dt><dd>{formatTableNumber(data.media.platformLeads)}</dd></div><div><dt>CPC</dt><dd>{money(baseline.cpc)}</dd></div></dl>
      </article>
      <AttributionBoundary state={partial ? 'partial' : matched ? 'matched' : attribution?.status === 'AVAILABLE' ? 'unverified' : 'unavailable'}
        label={partial ? 'Partial match coverage' : matched ? 'Approved matched keys' : attribution?.status === 'AVAILABLE' ? 'No matched keys recorded' : 'Attribution unavailable'}
        detail={matched ? `${formatTableNumber(attribution?.summary?.matchedKeys)} matched keys · ${formatTableNumber(attribution?.summary?.marketingOnlyKeys)} marketing only · ${formatTableNumber(attribution?.summary?.operationsOnlyKeys)} operations only` : attribution?.reason || 'No approved cross-source match evidence returned.'} />
      <article className="cx-lineage-operations" data-state={economics?.status === 'AVAILABLE' ? 'matched' : 'unavailable'}>
        <h3><lifecyclePresentation.fetched.Icon size={18} aria-hidden="true" />Matched operational outcomes</h3>
        <small>Approved matching keys only</small>
        <dl className="cx-bridge-lifecycle">{outcomeRows.map(({ stage, value }) => <div key={stage.label}><dt><stage.Icon size={16} aria-hidden="true" style={{ color: stage.color }} />{stage.label}</dt><dd>{value == null ? '—' : formatTableNumber(value)}</dd></div>)}</dl>
        {economics?.status !== 'AVAILABLE' && <small>Matched outcome evidence unavailable</small>}
      </article>
      <article className="cx-lineage-cohort" data-state={baseline.revenue == null ? 'unavailable' : 'observed'}>
        <h3><CircleDollarSign size={18} aria-hidden="true" />Recorded revenue</h3>
        <span className="cx-bridge-value-label">Source-recorded cohort value</span><strong className="cx-bridge-value">{money(baseline.revenue)}</strong>
        <small>{baseline.revenue == null ? 'Revenue evidence unavailable' : baseline.revenue === 0 ? 'Observed zero' : 'Recorded source value'}</small>
        <p>Separate cohort · no cross-source link implied</p>
      </article>
      <article className="cx-lineage-matched-revenue" data-linked={revenueLinked} data-state={economics?.recordedRevenue == null ? 'unavailable' : 'observed'}>
        <h3><CircleDollarSign size={18} aria-hidden="true" />Matched recorded revenue</h3>
        <strong className="cx-bridge-value">{money(economics?.recordedRevenue)}</strong>
        <small>{economics?.recordedRevenue == null ? 'Matched value unavailable' : revenueLinked ? 'Approved matched population' : 'Returned matched value · lineage unverified'}</small>
      </article>
    </div>
    <div className="cx-commercial-missing-inputs" aria-label="Unavailable profitability inputs">
      {['Telephony cost', 'Commission', 'Overhead'].map(label => <div key={label}><span>{label}</span><strong>—</strong><small>Unavailable</small></div>)}
      <div className="cx-commercial-not-calculable"><ShieldQuestion size={18} aria-hidden="true" /><span>Contribution / profit</span><strong>Not calculable</strong><small>Required cost inputs are unavailable</small></div>
    </div>
    <details className="cx-evidence-disclosure"><summary>Lineage methodology</summary><p className="cx-viz-footnote">Marketing activity, approved matched outcomes and source-recorded cohort revenue retain their separate populations. The cohort value is not a matched revenue node. Invoice, cash settlement and earned-revenue verification are unavailable. No additive waterfall is available across these different populations. No subtotal is inferred from spend and recorded revenue.</p></details>
  </ChartFrame>;
}
