import { compareExactDecimal } from './exactDecimal';

export const COMMERCIAL_CONTRACT_VERSION = 'cx.commercial.1.0.0';

export type SpendReconciliationStatus = 'RECONCILED' | 'PARTIAL' | 'INVALID_GRAIN' | 'UNAVAILABLE' | 'NOT_VERIFIED';

export interface SpendReconciliation {
  status: SpendReconciliationStatus;
  validationStatus: 'OBSERVED' | 'NOT_VERIFIED';
  rawObservedSpend: number | null;
  contractedGrainSpend: number | null;
  campaignAggregationSpend: number | null;
  commercialTotalSpend: number | null;
  difference: number | null;
  reason: string;
}

export interface AttributedEconomics {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  reason: string;
  matchedSpend: number | null;
  fetched: number | null;
  delivered: number | null;
  dialled: number | null;
  rpc: number | null;
  sales: number | null;
  activations: number | null;
  recordedRevenue: number | null;
  spendPerFetchedLead: number | null;
  spendPerDeliveredLead: number | null;
  spendPerDialledLead: number | null;
  spendPerRpc: number | null;
  spendPerSale: number | null;
  spendPerActivation: number | null;
  revenueToSpend: number | null;
}

/** Zero observed spend is valid; a missing numerator or zero denominator is unavailable. */
export function commercialRatio(numerator: number | null | undefined, denominator: number | null | undefined, multiplier = 1): number | null {
  return numerator != null && denominator != null && Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
    ? Number(((numerator / denominator) * multiplier).toFixed(2)) : null;
}

export function reconcileSpend(input: { rowCount: number; duplicateGrainRows: number; missingGrainRows: number; missingSpendRows: number; rawObservedSpend: number | null; campaignAggregationSpend: number | null; hasApprovedSpend: boolean }): SpendReconciliation {
  const invalidGrain = input.duplicateGrainRows > 0 || input.missingGrainRows > 0;
  const complete = input.hasApprovedSpend && input.rowCount > 0 && input.missingSpendRows === 0 && input.rawObservedSpend !== null && Number.isFinite(input.rawObservedSpend);
  const raw = input.rawObservedSpend !== null && Number.isFinite(input.rawObservedSpend) ? input.rawObservedSpend : null;
  const contracted = !invalidGrain && complete ? raw : null;
  const campaign = contracted !== null && input.campaignAggregationSpend !== null && Number.isFinite(input.campaignAggregationSpend) ? input.campaignAggregationSpend : null;
  const difference = contracted !== null && campaign !== null ? Number((campaign - contracted).toFixed(6)) : null;
  const status: SpendReconciliationStatus = invalidGrain ? 'INVALID_GRAIN' : !input.hasApprovedSpend || input.rowCount === 0 ? 'UNAVAILABLE'
    : !complete ? 'PARTIAL' : campaign === null ? 'NOT_VERIFIED' : difference !== 0 ? 'PARTIAL' : 'RECONCILED';
  return {
    status, validationStatus: status === 'RECONCILED' ? 'OBSERVED' : 'NOT_VERIFIED', rawObservedSpend: raw,
    contractedGrainSpend: contracted, campaignAggregationSpend: campaign,
    commercialTotalSpend: status === 'RECONCILED' ? contracted : null, difference,
    reason: invalidGrain ? 'Spend is withheld: duplicate or incomplete contracted grain keys.'
      : !input.hasApprovedSpend ? 'No approved observed-spend field is available. Budget is never spend.'
        : input.rowCount === 0 ? 'No marketing rows in the selected scope; absence is not observed zero spend.'
          : !complete ? 'Spend is withheld: at least one selected marketing row has missing or invalid spend.'
            : campaign === null ? 'Campaign aggregation has not been reconciled to the full marketing population.'
              : difference !== 0 ? 'Spend is withheld: marketing and campaign totals differ.'
                : 'Raw marketing rows, unique contracted grain and full campaign aggregation reconcile within the same query snapshot. This verifies arithmetic, not external billing.',
  };
}

export interface VendorAgreement {
  agreementId: string;
  version: string;
  vendor: string;
  currency: string;
  effectiveFrom: string;
  effectiveThrough: string | null;
  product?: string;
  grade?: string;
  eligibleEvent: 'sale' | 'activation';
  unitRate: string;
  approvalReference: string;
}

export interface CommercialMatchEvidence {
  saleKey: string;
  agreementId: string | null;
  agreementVersion: string | null;
  invoiceKey: string | null;
  collectionKey: string | null;
  status: 'MATCHED' | 'AGREEMENT_UNAVAILABLE' | 'INVOICE_UNAVAILABLE' | 'COLLECTION_UNAVAILABLE' | 'AMBIGUOUS';
  reason: string | null;
}

function utcDay(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Agreement effective dates must be UTC calendar dates.');
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) throw new Error('Invalid agreement effective date.');
  return parsed;
}

/** Deterministic effective-date selection. Ambiguity is rejected, never resolved by array order. */
export function resolveVendorAgreement(agreements: VendorAgreement[], input: { vendor: string; eventDate: string; currency: string; product?: string; grade?: string; eligibleEvent: 'sale' | 'activation' }): VendorAgreement | null {
  const day = utcDay(input.eventDate);
  const matches = agreements.filter(agreement => agreement.vendor === input.vendor && agreement.currency === input.currency && agreement.eligibleEvent === input.eligibleEvent
    && utcDay(agreement.effectiveFrom) <= day && (agreement.effectiveThrough === null || utcDay(agreement.effectiveThrough) >= day)
    && (agreement.product === undefined || agreement.product === input.product)
    && (agreement.grade === undefined || agreement.grade === input.grade));
  if (matches.length > 1) throw new Error('Overlapping agreement versions require an explicit approval resolution.');
  if (matches[0] && compareExactDecimal(matches[0].unitRate, '0') < 0) throw new Error('Agreement unit rate cannot be negative.');
  return matches[0] ?? null;
}
