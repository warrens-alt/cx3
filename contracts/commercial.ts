import { compareExactDecimal } from './exactDecimal';

export const COMMERCIAL_CONTRACT_VERSION = 'cx.commercial.1.0.0';

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
