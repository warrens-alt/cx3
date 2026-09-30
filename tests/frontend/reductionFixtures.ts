// Synthetic evidence for the presentation reduction. No customer data or inferred verification.
const attributionRows = Array.from({ length: 14 }, (_, index) => ({ key: `Synthetic key ${String(index + 1).padStart(2, '0')}`, hasMarketing: true, hasOperations: index < 12, spend: 100, platformLeads: 10, fetched: 8, delivered: 7, dialled: 6, rpc: 4, sales: 2, activations: 1, recordedRevenue: index === 13 ? null : 200, spendPerFetchedLead: 12.5, spendPerSale: 50, spendPerActivation: 100 }));
export const reductionPayloads = {
  '/api/analytics/offernet/commercial': {
    status: 'PARTIAL', reason: 'Synthetic recorded spend and revenue. Settlement and profitability inputs are unavailable.', currency: 'ZAR', validationStatus: 'NOT_VERIFIED',
    baseline: { mediaSpend: 1400, cpl: 10, revenue: 2600, blendedCostPerSale: 50, revenueToMediaSpendRatio: null, cpc: 2, cpm: 20, revenuePerLead: 20, revenuePerSale: 100, revenuePerActivation: 200, blendedCostPerActivation: 100 },
    media: { platformLeads: 140, platformClicks: 700, platformImpressions: 70000, platformReach: null, platformOutboundClicks: 600, spendSourceColumn: 'synthetic_observed_spend', spendSourceTable: 'synthetic.marketing', reason: 'Synthetic approved spend field; not budget.' },
    attribution: { status: 'AVAILABLE', reason: 'Synthetic matching keys; operational and marketing populations remain separate.', validationStatus: 'NOT_VERIFIED', rows: attributionRows, summary: { matchedSpend: 1200, unmatchedMarketingSpend: 200, matchedSpendSharePct: 85.7, matchedKeys: 12, marketingOnlyKeys: 2, operationsOnlyKeys: 0 }, detailScope: { truncated: false } },
    economics: { reason: 'Synthetic matched population only.', spendPerFetchedLead: 12.5, spendPerDeliveredLead: 14.29, spendPerDialledLead: 16.67, spendPerRpc: 25, recordedRevenue: 2400 },
    mediaComparison: { spendDelta: 100, spendDeltaPct: 7.7, cplDeltaPct: 0 },
    attributionComparison: { reason: 'Matched prior period supplied by synthetic fixture.', spend: { absoluteChange: 100, percentageChange: 7.7 }, costPerSale: { absoluteChange: 0, percentageChange: 0 }, fetched: { absoluteChange: 10 }, sales: { absoluteChange: 2 } },
    reconciliation: { status: 'NOT_VERIFIED', reason: 'Synthetic reconciliation has not been independently verified.', rawObservedSpend: 1400, contractedGrainSpend: 1400, campaignAggregationSpend: 1400, commercialTotalSpend: 1400, difference: 0 },
    grainDiagnostics: { rowCount: 14, distinctGrainCount: 14, duplicateGrainRows: 0, missingGrainRows: 0, missingSpendRows: 0, fields: ['synthetic key'] },
    revenueReason: 'Recorded revenue is not settlement evidence.', pAndLBreakdown: [{ type: 'revenue', item: 'Recorded revenue', amount: 2600 }, { type: 'cost', item: 'Operating cost', amount: null }],
  },
  '/api/analytics/offernet/data-integrity': {
    totalRecordsAudited: 120, validationStatus: 'NOT_VERIFIED', reason: 'Synthetic source observations. Checks may overlap; unavailable counts are not zero.',
    sources: [
      { key: 'leads', label: 'Synthetic lead source', status: 'OBSERVED', table: 'synthetic.leads', latestRecordAt: '2026-09-28T10:00:00Z', ageHours: 48, rowCount: 120, detail: 'Observed timestamp; no freshness SLA inferred.' },
      { key: 'calls', label: 'Synthetic calls', status: 'TIMESTAMP_CONTRACT_REQUIRED', table: 'synthetic.calls', latestRecordAt: null, ageHours: null, rowCount: null, detail: 'Timestamp contract unavailable.' },
    ],
    checks: Array.from({ length: 14 }, (_, i) => ({ checkName: `Synthetic check ${i + 1}`, category: 'Returned check', status: i === 13 ? 'UNAVAILABLE' : i === 0 ? 'WARNING' : 'OBSERVED', evidence: i === 13 ? 'NOT_VERIFIED' : 'OBSERVED', discrepancyCount: i === 13 ? null : i === 0 ? 7 : 0, detail: i === 13 ? 'Missing source contract; no measured count supplied.' : 'Returned synthetic count; overlapping populations are not additive.' })),
  },
};
