import type { CommercialData } from '../../lib/offernetClient';
import type { InspectorContent } from '../../shared/evidence/InspectorHost';
import { formatTableCurrency, formatTableNumber } from '../../lib/formatters';
import { suppliedProvenance } from '../evidenceWorkspace/secondaryAudit';
import { suppliedCount } from '../evidenceWorkspace/metricVisualAudit';

export type CommercialAuditNode = 'spend' | 'cpl' | 'attribution' | 'outcomes' | 'cohortRevenue' | 'matchedRevenue' | 'profit' | 'telephony' | 'commission' | 'overhead' | 'cps' | 'revenueSpend';
export function commercialNodeAudit(data: CommercialData, node: CommercialAuditNode, scope: InspectorContent['scope'], currency?: string): InspectorContent {
  const { baseline, media, economics, attribution, reconciliation, grainDiagnostics: grain } = data;
  const money = (value: number | null | undefined) => formatTableCurrency(value, currency || data.currency || 'Currency unknown');
  const common: Partial<InspectorContent> = { scope, provenance: suppliedProvenance(data), detailLimitation: 'A matching record-level drill is not supplied for this commercial aggregate.' };
  const spendConsistency: InspectorContent['reconciliation'] = reconciliation ? {
    label: 'Marketing spend arithmetic and delivery consistency', kind: 'delivery_consistency',
    state: reconciliation.status === 'RECONCILED' ? 'formula_checked' : reconciliation.difference != null && reconciliation.difference !== 0 ? 'mismatch' : reconciliation.status === 'UNAVAILABLE' ? 'unavailable' : 'partial',
    values: [
      { key: 'raw', label: 'Raw observed marketing spend', value: reconciliation.rawObservedSpend },
      { key: 'grain', label: 'Contracted-grain spend', value: reconciliation.contractedGrainSpend },
      { key: 'campaign', label: 'Campaign aggregation spend', value: reconciliation.campaignAggregationSpend },
      { key: 'commercial', label: 'Returned commercial spend', value: reconciliation.commercialTotalSpend },
      { key: 'difference', label: 'Returned campaign minus contracted-grain difference', value: reconciliation.difference },
    ],
    comparisons: [{ key: 'campaign-grain', label: 'Campaign minus contracted grain', observed: reconciliation.campaignAggregationSpend, expected: reconciliation.contractedGrainSpend, detail: 'Exact difference between the two supplied amounts from the same query snapshot.' }],
    detail: `${reconciliation.reason} This comparison uses the same query snapshot. It does not establish independent billing reconciliation or business verification.`,
  } : undefined;
  if (node === 'spend' || node === 'cpl') return {
    ...common, type: 'metric', title: node === 'spend' ? 'Observed media spend' : 'Platform CPL', value: money(node === 'spend' ? baseline.mediaSpend : baseline.cpl), reportPath: '/campaigns',
    provenance: { ...suppliedProvenance(data), ...(media.spendSourceTable ? { source: media.spendSourceTable } : {}) },
    definition: { meaning: node === 'spend' ? 'Observed incurred spend from the returned approved marketing field; budget is never substituted.' : 'Approved observed spend divided by returned platform lead events.', grain: grain?.fields?.join(' × '), dateBasis: 'Marketing reporting date', calculation: node === 'cpl' ? 'Observed media spend / platform lead events' : 'Source-recorded amount at the approved unique marketing grain', nullMeaning: 'A missing or withheld spend value is unavailable, not zero.', limitations: [media.reason] },
    anatomy: node === 'spend' ? { kind: 'financial', label: 'Observed media spend', value: suppliedCount(baseline.mediaSpend), unit: currency || data.currency, completeness: { key: 'coverage', label: 'Spend evidence coverage', state: baseline.mediaSpend === null ? 'unavailable' : grain?.missingSpendRows === undefined ? 'not_verified' : grain.missingSpendRows > 0 ? 'partial' : 'observed', detail: media.reason } } : { kind: 'ratio', label: 'Platform CPL', value: money(baseline.cpl), numerator: { key: 'spend', label: 'Observed media spend', value: suppliedCount(baseline.mediaSpend) }, denominator: { key: 'leads', label: 'Platform lead events', value: suppliedCount(media.platformLeads) }, formula: 'Observed media spend / platform lead events' },
    trace: [
      ...(media.spendSourceTable ? [{ key: 'source', type: 'source' as const, label: media.spendSourceTable, state: reconciliation?.rawObservedSpend != null ? 'observed' as const : 'unavailable' as const, detail: 'Source table reported by the marketing response.' }] : []),
      ...(media.spendSourceColumn ? [{ key: 'field', type: 'field' as const, label: media.spendSourceColumn, state: 'mapped' as const, detail: 'Returned approved observed-spend field. Budget is not substituted.' }] : []),
      ...(grain?.fields?.length ? [{ key: 'grain', type: 'qualification' as const, label: 'Approved marketing grain', value: grain.fields.join(' × '), state: grain.duplicateGrainRows > 0 || (grain.missingGrainRows ?? 0) > 0 ? 'partial' as const : 'mapped' as const, detail: 'Returned grain fields and diagnostics.' }] : []),
      { key: 'metric', type: 'metric', label: node === 'spend' ? 'Observed media spend' : 'Platform CPL', value: money(node === 'spend' ? baseline.mediaSpend : baseline.cpl), state: (node === 'spend' ? baseline.mediaSpend : baseline.cpl) == null ? 'unavailable' : 'observed' },
      { key: 'display', type: 'display', label: 'Commercial overview', value: money(node === 'spend' ? baseline.mediaSpend : baseline.cpl), state: (node === 'spend' ? baseline.mediaSpend : baseline.cpl) == null ? 'unavailable' : 'presentation_consistent', detail: 'Shows the returned metric using the workspace currency formatter.' },
    ],
    ...(node === 'cpl' ? { numeratorCount: baseline.mediaSpend, numeratorLabel: 'Observed media spend', denominatorCount: media.platformLeads, denominatorLabel: 'Platform lead events' } : {}),
    coverage: grain ? { label: 'Marketing spend evidence coverage', composition: 'separate', categories: [{ key: 'rows', label: 'Selected marketing rows', value: suppliedCount(grain.rowCount) }, { key: 'missing', label: 'Rows missing or invalid spend', value: suppliedCount(grain.missingSpendRows) }], detail: 'The missing-spend count is a subset of selected rows. Explicit zero-spend row coverage is not returned; no zero category is inferred.' } : undefined,
    qualification: grain ? { label: 'Contracted marketing grain', recorded: { key: 'rows', label: 'Returned marketing rows', value: suppliedCount(grain.rowCount) }, qualified: { key: 'keys', label: 'Distinct contracted keys', value: suppliedCount(grain.distinctGrainCount) }, reasons: [{ key: 'duplicate', label: 'Duplicate-grain rows', value: suppliedCount(grain.duplicateGrainRows) }, { key: 'missing', label: 'Rows missing required grain fields', value: suppliedCount(grain.missingGrainRows) }], detail: 'Grain diagnostics are shown exactly as returned. The reason populations may overlap; they are not added into a synthetic excluded total.' } : undefined,
    reconciliation: spendConsistency,
    details: media.spendSourceColumn ? `Returned approved spend field: ${media.spendSourceColumn}` : 'The response does not supply an approved spend field.',
  };
  if (node === 'attribution') return {
    ...common, type: 'custom', title: 'Approved attribution-key match', value: attribution?.summary ? `${formatTableNumber(attribution.summary.matchedKeys)} matched keys` : null,
    definition: { meaning: attribution?.reason || 'No approved cross-source attribution evidence is returned.', grain: 'Approved attribution key', dateBasis: 'Marketing reporting date / operational capture cohort', limitations: ['Matching approved keys does not establish independently reconciled spend, revenue, invoices or cash.'] },
    coverage: attribution?.summary ? { label: 'Attribution-key coverage', composition: 'mutually-exclusive', categories: [{ key: 'matched', label: 'Matched keys', value: suppliedCount(attribution.summary.matchedKeys) }, { key: 'marketing', label: 'Marketing-only keys', value: suppliedCount(attribution.summary.marketingOnlyKeys) }, { key: 'operations', label: 'Operations-only keys', value: suppliedCount(attribution.summary.operationsOnlyKeys) }], detail: 'Returned distinct key populations. This is literal match coverage, not commercial verification.' } : undefined,
    reportPath: '/commercial',
  };
  if (node === 'outcomes') return {
    ...common, type: 'custom', title: 'Matched operational outcomes', value: economics?.status === 'AVAILABLE' ? formatTableNumber(economics.fetched) : null,
    definition: { meaning: economics?.reason || 'Matched outcomes are unavailable.', grain: 'Distinct leads at approved matching attribution keys', dateBasis: 'Operational capture cohort', limitations: ['Fetched, sales and activation populations are independently observed; this bridge does not imply a nested funnel.'] },
    coverage: { label: 'Returned matched populations', composition: 'separate', categories: [{ key: 'fetched', label: 'Matched fetched leads', value: suppliedCount(economics?.fetched) }, { key: 'sales', label: 'Matched recorded sales', value: suppliedCount(economics?.sales) }, { key: 'activations', label: 'Matched recorded activations', value: suppliedCount(economics?.activations) }], detail: 'Independent populations can overlap and use separate bars.' }, reportPath: '/commercial',
  };
  if (node === 'profit' || node === 'telephony' || node === 'commission' || node === 'overhead') return {
    ...common, type: 'custom', title: node === 'profit' ? 'Contribution / profit' : node === 'telephony' ? 'Telephony cost' : node === 'commission' ? 'Commission' : 'Fixed overhead', value: node === 'overhead' ? money(baseline.fixedOverhead) : null,
    definition: { meaning: node === 'profit' ? 'Contribution and profit cannot be established without the required approved financial inputs.' : node === 'overhead' && baseline.fixedOverhead != null ? 'The fixed-overhead amount is displayed as returned.' : 'This approved financial input is not supplied by the commercial response.', nullMeaning: 'Unavailable cost evidence is not zero. No profit amount is reconstructed from spend and source-recorded revenue.' },
    dependencies: { label: 'Required profitability inputs', inputs: [{ key: 'spend', label: 'Observed media spend', value: suppliedCount(baseline.mediaSpend), required: true, available: baseline.mediaSpend != null }, { key: 'revenue', label: 'Recorded cohort revenue', value: suppliedCount(baseline.revenue), required: true, available: baseline.revenue != null }, { key: 'telephony', label: 'Telephony cost', value: null, required: true, available: false, state: 'unavailable' }, { key: 'commission', label: 'Commission', value: null, required: true, available: false, state: 'unavailable' }, { key: 'overhead', label: 'Fixed overhead', value: suppliedCount(baseline.fixedOverhead), required: true, available: baseline.fixedOverhead != null }], detail: 'Input availability is literal returned evidence. Spend and revenue retain separate populations; availability does not make them commercially reconciled.' },
  };
  if (node === 'cps' || node === 'revenueSpend') return {
    ...common, type: 'metric', title: node === 'cps' ? 'Attributed spend / sale' : 'Matched revenue / spend', value: node === 'cps' ? money(baseline.blendedCostPerSale) : baseline.revenueToMediaSpendRatio == null ? null : `${baseline.revenueToMediaSpendRatio.toFixed(2)}×`,
    anatomy: { kind: 'ratio', label: node === 'cps' ? 'Attributed spend / sale' : 'Matched revenue / spend', value: node === 'cps' ? money(baseline.blendedCostPerSale) : baseline.revenueToMediaSpendRatio, numerator: { key: 'numerator', label: node === 'cps' ? 'Approved matched spend' : 'Matched recorded revenue', value: suppliedCount(node === 'cps' ? economics?.matchedSpend : economics?.recordedRevenue) }, denominator: { key: 'denominator', label: node === 'cps' ? 'Matched recorded sales' : 'Approved matched spend', value: suppliedCount(node === 'cps' ? economics?.sales : economics?.matchedSpend) } },
    definition: { meaning: economics?.reason || 'Approved matched economics are unavailable.', dateBasis: 'Approved marketing-to-operational matched population', nullMeaning: 'Missing inputs or empty denominator remain unavailable.', limitations: ['This does not establish profit, earned revenue or cash return.'] }, reportPath: '/commercial',
  };
  const matched = node === 'matchedRevenue';
  const amount = matched ? economics?.recordedRevenue : baseline.revenue;
  return {
    ...common, type: 'metric', title: matched ? 'Matched recorded revenue' : 'Source-recorded cohort revenue', value: money(amount),
    anatomy: { kind: 'financial', label: matched ? 'Matched recorded revenue' : 'Source-recorded cohort revenue', value: suppliedCount(amount), unit: currency || data.currency, detail: 'Revenue field completeness counts are not returned by this commercial response. Source-recorded revenue is not invoice, settlement or earned-revenue evidence.' },
    definition: { meaning: matched ? economics?.reason || 'Matched revenue unavailable.' : data.revenueReason || 'Recorded source-system value for the operational intake cohort.', dateBasis: matched ? 'Approved matched operational capture cohort' : 'Operational capture cohort', nullMeaning: 'Missing revenue remains unavailable.', limitations: [matched ? 'This value uses approved matched keys; it does not establish business verification.' : 'This is a separate cohort population. No cross-source link to media spend is implied.'] }, reportPath: '/sales-activation',
  };
}
