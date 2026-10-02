import TelemetryRail from '../shared/visuals/TelemetryRail';
import '../styles/acquisitionEvidenceVisuals.css';
import AnalyticsPageLayout from '../components/AnalyticsPageLayout';
import { ReportSkeleton } from '../components/OperationalState';
import ReportSections from '../shared/reporting/ReportSections';
import TablePreview from '../shared/reporting/TablePreview';
import UnifiedMetricCard from '../components/UnifiedMetricCard';
import { ReportActions } from '../shared/reporting/ReportPresentation';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Database, DollarSign, ShieldCheck } from 'lucide-react';
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
import InspectorHost, { type InspectorContent } from '../shared/evidence/InspectorHost';
import { AuditMetadata } from '../shared/evidence/AuditMode';
import { suppliedProvenance } from '../features/evidenceWorkspace/secondaryAudit';
import CommercialEvidenceBridge from '../features/commercial/CommercialEvidenceBridge';
import CommercialEvidenceMap, { type CommercialEvidenceItem } from '../features/commercial/CommercialEvidenceMap';

export default function CommercialIntelligence() {
  // Only these two displayed metrics have a matching, supported media decomposition.
  const [section, setSection] = useState('summary');
  const [audit, setAudit] = useState<InspectorContent | null>(null);
  const [rootMetric, setRootMetric] = useState<'spend' | 'cpl' | null>(null);
  const scoped = useScopedNavigationTarget();
  const { selectedClient, clientConfig } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const { data, loading, error, loadData } = useOperationalData('commercial', {
    clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, fetchCommercial);
  const auditScope = { clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined, filters };
  useEffect(() => setAudit(null), [selectedClient, startDate, endDate, filters]);
  useEffect(() => setRootMetric(null), [selectedClient, startDate, endDate, filters]);
  const attribution = data?.attribution, economics = data?.economics, baseline = data?.baseline;
  const currency = data?.currency || clientConfig?.currency;
  const money = (value: number | string | null | undefined) => formatTableCurrency(value, currency || 'Currency unknown');
  const mediaScope = !['source', 'vendor', 'medium', 'grade', 'agent', 'cli'].some(key => filters[key]);
  const canCompareMedia = Boolean(startDate && endDate && mediaScope && data?.mediaComparison && !loading && !error);

  const commercialEvidence: CommercialEvidenceItem[] = data && baseline ? [
    {
      label: 'Marketing activity',
      state: data.media.platformLeads != null || data.media.platformClicks != null ? 'available' : 'unavailable',
      detail: data.media.platformLeads != null ? `${formatTableNumber(data.media.platformLeads)} platform lead events · ${formatTableNumber(data.media.platformClicks)} clicks` : 'No measured marketing activity returned for this scope.',
    },
    {
      label: 'Observed media spend',
      state: baseline.mediaSpend != null ? 'available' : 'unavailable',
      detail: baseline.mediaSpend != null ? 'Approved incurred-spend evidence is available for the selected scope.' : (data.media.reason || 'No approved observed-spend field is available; budget is never substituted.'),
    },
    {
      label: 'Recorded operational revenue',
      state: baseline.revenue != null ? 'available' : (data.revenueReason ? 'incomplete' : 'unavailable'),
      detail: baseline.revenue != null ? 'Source-recorded operational value is available; this is not invoice or cash settlement evidence.' : (data.revenueReason || 'Recorded revenue evidence is unavailable for this scope.'),
    },
    {
      label: 'Cross-source attribution',
      state: attribution?.status === 'AVAILABLE' ? 'available' : 'unavailable',
      detail: attribution?.reason || 'No approved marketing-to-operational attribution evidence is available.',
    },
    {
      label: 'Profitability / P&L',
      state: 'unavailable',
      detail: 'Rate-card costs, fixed overhead, contribution, margin and break-even remain withheld without approved evidence.',
    },
    {
      label: 'Currency context',
      state: currency ? 'available' : 'unavailable',
      detail: currency ? `${currency}; no currency conversion is applied.` : 'Workspace currency has not been established.',
    },
  ] : [];

  const metrics = baseline ? [
    { label: 'Recorded media spend', value: money(baseline.mediaSpend), note: 'Approved incurred-spend field; never budget.', path: '/campaigns', metric: 'spend' as const, available: baseline.mediaSpend != null },
    { label: 'Platform CPL', value: money(baseline.cpl), note: 'Spend / platform lead events.', path: '/campaigns', metric: 'cpl' as const, available: baseline.cpl != null },
    { label: 'Recorded revenue', value: money(baseline.revenue), note: 'Source-reported value, not invoice or cash evidence. Revenue decomposition is not available.', path: '/sales-activation', metric: null, available: baseline.revenue != null },
    { label: 'Attributed spend / sale', value: money(baseline.blendedCostPerSale), note: 'Matching approved keys only. Not a lead-to-sale-rate decomposition.', path: '/reconciliation', metric: null, available: baseline.blendedCostPerSale != null },
    { label: 'Revenue / media spend', value: baseline.revenueToMediaSpendRatio == null ? '—' : `${baseline.revenueToMediaSpendRatio.toFixed(2)}×`, note: 'Matched recorded value / spend; not profit or cash return.', path: '/reconciliation', metric: null, available: baseline.revenueToMediaSpendRatio != null },
  ] : [];

  return <AnalyticsPageLayout className="cx-commercial-page" title="Commercial overview" description={<>Recorded spend, revenue and matched outcomes.</>} actions={<ReportActions><Link to={scoped('/campaigns')} className="cx-button-secondary"><DollarSign size={15} /><span><strong>Media detail</strong><small>Campaign spend & efficiency</small></span><ArrowRight size={14} /></Link></ReportActions>} scope={<OffernetFilterBar onRefresh={() => loadData(true)} />}>

      {error && <div role="alert" className="cx-command-error"><AlertTriangle size={17} />{error}</div>}
      {loading && !data && <ReportSkeleton label="Loading commercial evidence" />}
      {loading && data && <p role="status">Refreshing the current commercial scope…</p>}
      {data && baseline && <>
        <div className="cx-commercial-notices"><p className="cx-contract-note" role="note">{data.status} · {data.reason}</p>
        {data.reconciliation && data.reconciliation.status !== 'RECONCILED' && <p className="cx-contract-note" role="note">{data.reconciliation.reason}</p>}</div>
        <ReportSections label="Commercial sections" value={section} onChange={setSection} sections={[
          { id: 'summary', label: 'Summary', content: <><TelemetryRail label="Commercial efficiency context">
          {metrics.filter((_, index) => index === 1 || index === 3).map(item => <UnifiedMetricCard key={item.label} label={item.label} value={item.value} note={item.note}
            change={item.metric && canCompareMedia && item.available ? item.metric === 'spend' ? data.mediaComparison?.spendDeltaPct : data.mediaComparison?.cplDeltaPct : undefined}
            isPositiveGood={false}
            onWhyChanged={item.metric && canCompareMedia && item.available && Number.isFinite(item.metric === 'spend' ? data.mediaComparison?.spendDeltaPct : data.mediaComparison?.cplDeltaPct) ? () => setRootMetric(item.metric) : undefined}
            auditContent={{ type: 'metric', title: item.label, value: item.value, scope: auditScope, definition: { meaning: item.note, dateBasis: item.metric ? 'Marketing reporting date' : 'Operational capture cohort / approved matched marketing population', nullMeaning: 'Unavailable financial evidence is not zero and budget is never substituted.' }, provenance: { ...suppliedProvenance(data), ...(item.metric && data.media.spendSourceTable ? { source: data.media.spendSourceTable } : {}) }, ...(item.metric === 'cpl' ? { numeratorCount: baseline.mediaSpend, numeratorLabel: 'Observed media spend', denominatorCount: data.media.platformLeads, denominatorLabel: 'Platform lead events' } : {}), reportPath: item.path, detailLimitation: 'A matching record-level drill is not supplied for this commercial aggregate.' }} />)}
        </TelemetryRail><CommercialEvidenceBridge data={data} currency={currency} /><details className="cx-evidence-disclosure"><summary>View period comparison and attribution detail</summary><TelemetryRail label="Commercial source values">
          {metrics.filter((_, index) => index === 0 || index === 2).map(item => <UnifiedMetricCard key={item.label} label={item.label} value={item.value} note={item.note}
            change={item.metric && canCompareMedia && item.available ? data.mediaComparison?.spendDeltaPct : undefined}
            isPositiveGood={false}
            onWhyChanged={item.metric && canCompareMedia && item.available && Number.isFinite(data.mediaComparison?.spendDeltaPct) ? () => setRootMetric(item.metric) : undefined}
            auditContent={{ type: 'metric', title: item.label, value: item.value, scope: auditScope, definition: { meaning: item.note, dateBasis: item.metric ? 'Marketing reporting date' : 'Operational capture cohort / approved matched marketing population', nullMeaning: 'Unavailable financial evidence is not zero and budget is never substituted.' }, provenance: { ...suppliedProvenance(data), ...(item.metric && data.media.spendSourceTable ? { source: data.media.spendSourceTable } : {}) }, reportPath: item.path, detailLimitation: 'A matching record-level drill is not supplied for this commercial aggregate.' }} />)}
        </TelemetryRail><section className="cx-command-panel cx-commercial-summary-detail" aria-label="Commercial matched-period changes">
          <header><div><h2>Previous-period comparison</h2><p>{data.attributionComparison?.reason}</p></div></header>
          <div className="cx-commercial-ratios">
            <div><span>Spend change</span><strong>{money(data.mediaComparison?.spendDelta ?? data.attributionComparison?.spend.absoluteChange)}</strong><small>{formatPercent(data.mediaComparison?.spendDeltaPct ?? data.attributionComparison?.spend.percentageChange)} change</small></div>
            <div><span>Platform CPL change</span><strong>{formatPercent(data.mediaComparison?.cplDeltaPct)}</strong><small>Marketing population only</small></div>
            <div><span>Attributed CPS change</span><strong>{money(data.attributionComparison?.costPerSale.absoluteChange)}</strong><small>{formatPercent(data.attributionComparison?.costPerSale.percentageChange)} change</small></div>
            <div><span>Matched fetched change</span><strong>{formatTableNumber(data.attributionComparison?.fetched.absoluteChange)}</strong><small>Approved matched population, not all fetched leads</small></div>
            <div><span>Matched sales change</span><strong>{formatTableNumber(data.attributionComparison?.sales.absoluteChange)}</strong><small>Approved matched population, not the lead-to-sale rate</small></div>
          </div>
        </section>
<section className="cx-command-panel cx-commercial-summary-detail" aria-label="Attribution coverage"><header><div><h2>Attribution coverage</h2><p>{attribution?.reason || 'Attribution status unavailable.'}</p></div><button type="button" className="cx-admin-text-button" onClick={() => setSection('attribution')}>Inspect attribution →</button></header>          {attribution?.summary && <div className="cx-commercial-source">
            <div><span>Matched spend</span><strong>{money(attribution.summary.matchedSpend)}</strong><small>{attribution.summary.matchedSpendSharePct == null ? 'Coverage unavailable' : `${formatPercent(attribution.summary.matchedSpendSharePct)} of observed spend`}</small></div>
            <div><span>Unmatched media spend</span><strong>{money(attribution.summary.unmatchedMarketingSpend)}</strong><small>{formatTableNumber(attribution.summary.marketingOnlyKeys)} marketing-only keys</small></div>
            <div><span>Join-key coverage</span><strong>{formatTableNumber(attribution.summary.matchedKeys)} matched keys</strong><small>{formatTableNumber(attribution.summary.operationsOnlyKeys)} operations-only keys</small></div>
          </div>}
</section></details><AuditMetadata dateBasis="Marketing reporting date / operational capture cohort" validationStatus={suppliedProvenance(data).validationStatus} /></> },
          { id: 'attribution', label: 'Attribution', content: <>        <section className="cx-command-panel">
          <header><div><span className="cx-command-section-kicker">Attribution coverage</span><h2>Spend → operational outcomes</h2><p>{attribution?.reason || 'Attribution status unavailable.'}</p></div><span className="cx-source-status" data-status={attribution?.status || 'UNAVAILABLE'}>{attribution?.status || 'UNAVAILABLE'}</span></header>
          {!loading && Boolean(attribution?.rows?.length) && <ExportAnalysisButton filename="commercial-attribution.csv" validationStatus={attribution?.validationStatus || 'NOT_VERIFIED'} dateBasis="marketing_reporting_date / operational_capture_cohort" definitions={`Currency: ${currency || 'unavailable'}. Spend uses complete unique marketing grain; costs use matching approved keys; null is unavailable; unmatched spend is excluded from attributed costs.`} truncated={attribution?.detailScope?.truncated} rows={[
            ['Approved key', 'Marketing present', 'Operations present', 'Spend', 'Platform leads', 'Fetched', 'Delivered', 'Dialled', 'RPC', 'Sales', 'Activations', 'Recorded revenue', 'Spend / fetched', 'Spend / sale', 'Spend / activation'],
            ...(attribution?.rows || []).map(row => [row.key, row.hasMarketing, row.hasOperations, row.spend, row.platformLeads, row.fetched, row.delivered, row.dialled, row.rpc, row.sales, row.activations, row.recordedRevenue, row.spendPerFetchedLead, row.spendPerSale, row.spendPerActivation]),
          ]} />}
          {attribution?.summary && <div className="cx-commercial-source">
            <div><span>Matched spend</span><strong>{money(attribution.summary.matchedSpend)}</strong><small>{attribution.summary.matchedSpendSharePct == null ? 'Coverage unavailable' : `${formatPercent(attribution.summary.matchedSpendSharePct)} of observed spend`}</small></div>
            <div><span>Unmatched media spend</span><strong>{money(attribution.summary.unmatchedMarketingSpend)}</strong><small>{formatTableNumber(attribution.summary.marketingOnlyKeys)} marketing-only keys</small></div>
            <div><span>Join-key coverage</span><strong>{formatTableNumber(attribution.summary.matchedKeys)} matched keys</strong><small>{formatTableNumber(attribution.summary.operationsOnlyKeys)} operations-only keys</small></div>
          </div>}
          {section === 'attribution' && Boolean(attribution?.rows?.length) && <div className="cx-analytics-visual-grid">
            <GroupedOutcomeChart minPlotWidth={520} title="Matched funnel outcomes by attribution key" subtitle="Top 12 displayed attribution keys by fetched volume. Independent recorded outcomes; no nested funnel is assumed." data={[...(attribution?.rows || [])].filter(row => row.hasMarketing && row.hasOperations).sort((a, b) => b.fetched - a.fetched).slice(0, 12)} xKey="key" series={[{ key: 'fetched', label: 'Fetched' }, { key: 'rpc', label: 'RPC' }, { key: 'sales', label: 'Sales' }, { key: 'activations', label: 'Activations' }]} />
            <RankedMetricChart title="Recorded revenue by matched key" subtitle="Only matched keys with recorded values; missing revenue remains unavailable." data={(attribution?.rows || []).filter(row => row.hasMarketing && row.hasOperations && row.recordedRevenue != null).map(row => ({ key: row.key, revenue: row.recordedRevenue }))} categoryKey="key" valueKey="revenue" valueLabel="Recorded revenue" valuePrefix={currency || ''} />
          </div>}
          {attribution?.rows?.length ? <>
            {attribution.detailScope?.truncated && <p className="cx-contract-note">The detailed table and its export are limited by the API. Summary coverage uses the full scoped population.</p>}
            <details className="cx-evidence-disclosure"><summary>View exact attribution evidence</summary><TablePreview rows={attribution.rows} label="attribution rows">{visibleRows => <div className="cx-command-table-wrap cx-attribution-table-scroll" role="region" aria-label="Attribution evidence table" tabIndex={0}><table className="cx-command-table cx-attribution-table"><caption>Approved attribution-key evidence; amounts in {currency || 'an unspecified currency'}</caption><thead><tr><th scope="col">Key</th><th>Coverage</th>{['Spend', 'Platform leads', 'Fetched', 'Delivered', 'Dialled', 'RPC', 'Sales', 'Activations', 'Recorded revenue', 'Spend / fetched', 'Spend / sale', 'Spend / activation'].map(label => <th key={label} scope="col">{label}</th>)}<th scope="col">Evidence</th></tr></thead><tbody>{visibleRows.map(row => <tr key={row.key}><th scope="row">{row.key}</th><td>{row.hasMarketing && row.hasOperations ? 'Matched' : row.hasMarketing ? 'Marketing only' : 'Operations only'}</td><td>{money(row.spend)}</td><td>{formatTableNumber(row.platformLeads)}</td><td>{formatTableNumber(row.fetched)}</td><td>{formatTableNumber(row.delivered)}</td><td>{formatTableNumber(row.dialled)}</td><td>{formatTableNumber(row.rpc)}</td><td>{formatTableNumber(row.sales)}</td><td>{formatTableNumber(row.activations)}</td><td>{money(row.recordedRevenue)}</td><td>{money(row.spendPerFetchedLead)}</td><td>{money(row.spendPerSale)}</td><td>{money(row.spendPerActivation)}</td><td><button type="button" className="cx-button-secondary" onClick={() => setAudit({ type: 'segment', title: `${row.key} · observed spend`, value: money(row.spend), scope: auditScope, definition: { meaning: 'Returned spend for this approved attribution key. Coverage states whether matching marketing and operational records are present.', grain: 'Approved attribution key', dateBasis: 'Marketing reporting date / operational capture cohort', nullMeaning: 'Missing spend remains unavailable.' }, provenance: suppliedProvenance(attribution), relatedValue: { label: 'Coverage', value: row.hasMarketing && row.hasOperations ? 'Matched' : row.hasMarketing ? 'Marketing only' : 'Operations only' }, reportPath: '/commercial', detailLimitation: 'A record drill by attribution key is not supplied.' })}>Inspect</button></td></tr>)}</tbody></table></div>}</TablePreview></details>
          </> : <div className="cx-command-empty"><ShieldCheck size={17} />{attribution?.status === 'AVAILABLE' ? 'No attribution rows match this selection.' : 'Approved attribution evidence is not available for this selection. Review the mapping and source diagnostics.'}</div>}
        </section>
</> },
          { id: 'economics', label: 'Economics', content: <><TelemetryRail label="Commercial value ratio">
          {metrics.slice(4).map(item => <UnifiedMetricCard key={item.label} label={item.label} value={item.value} note={item.note}
            change={item.metric && canCompareMedia && item.available ? item.metric === 'spend' ? data.mediaComparison?.spendDeltaPct : data.mediaComparison?.cplDeltaPct : undefined}
            isPositiveGood={false}
            onWhyChanged={item.metric && canCompareMedia && item.available && Number.isFinite(item.metric === 'spend' ? data.mediaComparison?.spendDeltaPct : data.mediaComparison?.cplDeltaPct) ? () => setRootMetric(item.metric) : undefined}
            auditContent={{ type: 'metric', title: item.label, value: item.value, scope: auditScope, definition: { meaning: item.note, dateBasis: item.metric ? 'Marketing reporting date' : 'Operational capture cohort / approved matched marketing population', nullMeaning: 'Unavailable financial evidence is not zero and budget is never substituted.' }, provenance: { ...suppliedProvenance(data), ...(item.metric && data.media.spendSourceTable ? { source: data.media.spendSourceTable } : {}) }, ...(item.metric === 'cpl' ? { numeratorCount: baseline.mediaSpend, numeratorLabel: 'Observed media spend', denominatorCount: data.media.platformLeads, denominatorLabel: 'Platform lead events' } : {}), reportPath: item.path, detailLimitation: 'A matching record-level drill is not supplied for this commercial aggregate.' }} />)}
        </TelemetryRail>        <div className="cx-command-grid cx-commercial-grid">
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
</> },
          { id: 'evidence', label: 'Evidence', content: <>        <section className="cx-command-panel" aria-label="Commercial evidence coverage">
          <header><div><span className="cx-command-section-kicker">Evidence availability</span><h2>{data.status}</h2><p>{data.reason}</p></div><ShieldCheck size={17} /></header>
          <div className="cx-commercial-source">
            <div><span>Media spend source</span><strong>{data.media.spendSourceColumn || 'Unavailable'}</strong><small>{data.media.spendSourceTable || 'No approved spend source reported'}</small></div>
            <div><span>Platform population</span><strong>{formatTableNumber(data.media.platformLeads)} platform lead events</strong><small>{formatTableNumber(data.media.platformClicks)} clicks</small></div>
            <div><span>Currency</span><strong>{currency || 'Not established'}</strong><small>No currency conversion is applied.</small></div>
            <div><span>Invoices, cash & clawbacks</span><strong>Unavailable</strong><small>Source-recorded revenue is not settlement evidence.</small></div>
          </div>
        </section>
        <CommercialEvidenceMap items={commercialEvidence} />
        <SpendReconciliationPanel reconciliation={data.reconciliation} grain={data.grainDiagnostics} />
        <section className="cx-command-panel"><header><div><span className="cx-command-section-kicker">Inputs currently unavailable</span><h2>Profitability inputs not sourced from approved tables</h2><p>These are not reconstructed from budgets, example rates or assumptions.</p></div><Database size={16} /></header><div className="cx-withheld-grid">{['Telephony cost', 'Agent / delivery cost', 'Commission', 'Fixed overhead', 'Total operating cost', 'Contribution margin', 'Net margin', 'Break-even volume'].map(label => <div key={label}><span>{label}</span><strong>UNAVAILABLE</strong></div>)}</div></section>
</> },
        ]} />
      </>}

    <InspectorHost open={Boolean(audit)} onClose={() => setAudit(null)} content={audit} />
    <RootCauseDrawer open={Boolean(rootMetric)} metric={rootMetric} onClose={() => setRootMetric(null)} />
  </AnalyticsPageLayout>;
}
