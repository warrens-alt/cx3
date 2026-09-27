import type { SalesActivationData } from '../../../lib/offernetClient';
import { formatTableCurrency, formatPercent } from '../../../lib/formatters';

export type SegmentDimension = 'vendor' | 'source' | 'grade';

export interface AdaptedSegmentRow {
  dimension: SegmentDimension;
  name: string;
  sales: number;
  activations: number;
  activationRatio: number | null;
  revenue: number | null;
  revenuePerSale: number | null;
  unrecordedRevenueSales: number;
}

export interface AdaptedAgeingBucket {
  bucket: string;
  sales: number;
  shareOfUnactivated: number | null;
  isInvalidFuture: boolean;
  description: string;
  drillSupported: boolean;
  drill?: string;
  drillValue?: string;
}

export interface AdaptedSalesActivation {
  summary: {
    totalSales: number;
    totalActivations: number;
    activationRatio: number | null;
    salesWithoutActivation: number | null;
    validPendingActivation: number | null;
    invalidFutureSales: number;
    realizedRevenue: number | null;
    salesWithRecordedRevenue: number | null;
    unbilledSales: number;
    unrecordedRevenueSales: number;
    currency: string;
  };
  ageing: {
    buckets: AdaptedAgeingBucket[];
    totalUnactivated: number;
    validAwaiting: number;
    invalidFuture: number;
    hasInvalidFuture: boolean;
  };
  segments: {
    vendor: AdaptedSegmentRow[];
    source: AdaptedSegmentRow[];
    grade: AdaptedSegmentRow[];
  };
  timing: {
    avgTimeToSale: string;
    avgTimeToActivation: string;
    medianTimeToSale: string;
    medianTimeToActivation: string;
  };
  maturation: {
    status: string;
    reason: string;
    curve: Array<{ day: string; activationSharePct: number | null; cumulativePct: number }>;
  };
  methodology: {
    revenueEvidence: string;
    segmentMethodology: string;
    timezone?: string;
    dateBasis: string;
  };
}

export const CANONICAL_AGEING_BUCKETS = [
  '0–3d',
  '4–7d',
  '8–14d',
  '15–30d',
  '30d+',
  'Invalid future sale',
] as const;

export function formatWorkspaceCurrency(
  val: number | string | null | undefined,
  currency?: string | null
): string {
  if (val === null || val === undefined || val === '') return '—';
  const prefix = currency ? (currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency) : '';
  return formatTableCurrency(val, prefix).trim();
}

export function adaptSalesActivationData(
  data: SalesActivationData | null | undefined,
  workspaceCurrency?: string | null
): AdaptedSalesActivation | null {
  if (!data) return null;

  const recon = data.reconciliation || ({} as Partial<SalesActivationData['reconciliation']>);
  const totalSales = Number(recon.totalSales ?? 0);
  const totalActivations = Number(recon.totalActivations ?? 0);
  const activationRatio = recon.activationRate !== undefined && recon.activationRate !== null
    ? Number(recon.activationRate)
    : (totalSales > 0 ? (totalActivations / totalSales) * 100 : null);

  // Resolved currency: prefer workspace client currency or response metadata, never hardcode 'R'
  const resolvedCurrency = workspaceCurrency || data.currency || (data as any)?.metadata?.currency || '';

  // Process activation ageing in strict chronological order
  const rawAgeing = Array.isArray(data.activationAgeing) ? data.activationAgeing : [];
  const ageingMap = new Map<string, number>();
  for (const item of rawAgeing) {
    if (item && item.bucket) {
      ageingMap.set(item.bucket, Number(item.sales || 0));
    }
  }

  // Calculate sum of unactivated sales from canonical aggregate
  let totalUnactivated = 0;
  let validAwaiting = 0;
  let invalidFuture = 0;

  const buckets: AdaptedAgeingBucket[] = CANONICAL_AGEING_BUCKETS.map((bucket) => {
    const sales = ageingMap.get(bucket) ?? 0;
    const isInvalid = bucket === 'Invalid future sale';
    totalUnactivated += sales;
    if (isInvalid) {
      invalidFuture += sales;
    } else {
      validAwaiting += sales;
    }

    let description = '';
    let drillSupported = false;
    let drill: string | undefined;
    let drillValue: string | undefined;

    switch (bucket) {
      case '0–3d':
        description = '0 to 3 completed days since recorded sale timestamp';
        break;
      case '4–7d':
        description = '4 to 7 completed days since recorded sale timestamp';
        break;
      case '8–14d':
        description = '8 to 14 completed days since recorded sale timestamp';
        break;
      case '15–30d':
        description = '15 to 30 completed days since recorded sale timestamp (exceeds 14-day benchmark)';
        drillSupported = true;
        drill = 'unactivated-sales';
        break;
      case '30d+':
        description = 'Over 30 completed days since recorded sale timestamp without recorded activation';
        drillSupported = true;
        drill = 'unactivated-sales';
        break;
      case 'Invalid future sale':
        description = 'Sale timestamp occurs after the evaluation cutoff; requires data-integrity remediation';
        break;
    }

    return {
      bucket,
      sales,
      shareOfUnactivated: null, // Will be computed after totalUnactivated is finalized
      isInvalidFuture: isInvalid,
      description,
      drillSupported,
      drill,
      drillValue,
    };
  });

  // Second pass for shareOfUnactivated
  for (const b of buckets) {
    b.shareOfUnactivated = totalUnactivated > 0 ? (b.sales / totalUnactivated) * 100 : 0;
  }

  // Sales without activation is the complete non-overlapping aggregate
  const salesWithoutActivation = rawAgeing.length > 0 ? totalUnactivated : null;

  // Segment adaptations: preserve exact keys, whitespace, casing, and unrecorded grouping
  const adaptRows = (
    list: Array<{ dimension?: string; segment?: string; vendor?: string; sales: number; activations: number; revenue: number | null; unrecorded_revenue_sales?: number }> | undefined,
    dim: SegmentDimension
  ): AdaptedSegmentRow[] => {
    if (!Array.isArray(list)) return [];
    return list.map((item) => {
      const name = String(item.vendor || item.segment || 'Unrecorded');
      const sales = Number(item.sales || 0);
      const activations = Number(item.activations || 0);
      const revenue = item.revenue !== null && item.revenue !== undefined ? Number(item.revenue) : null;
      const activationRatio = sales > 0 ? (activations / sales) * 100 : null;
      const revenuePerSale = revenue !== null && sales > 0 ? revenue / sales : null;
      const unrecordedRev = Number(item.unrecorded_revenue_sales ?? 0);

      return {
        dimension: dim,
        name,
        sales,
        activations,
        activationRatio,
        revenue,
        revenuePerSale,
        unrecordedRevenueSales: unrecordedRev,
      };
    });
  };

  const vendorRows = adaptRows(data.byVendor, 'vendor');
  const sourceRows = adaptRows(data.bySource, 'source');
  const gradeRows = adaptRows(data.byGrade, 'grade');

  // Revenue completeness metrics
  const salesWithRecordedRevenue = recon.salesWithRecordedRevenue !== undefined
    ? Number(recon.salesWithRecordedRevenue)
    : null;
  const unbilledSales = Number(recon.unbilledSales ?? 0);
  const unrecordedRevenueSales = Number(recon.unrecordedRevenueSales ?? 0);

  return {
    summary: {
      totalSales,
      totalActivations,
      activationRatio,
      salesWithoutActivation,
      validPendingActivation: validAwaiting,
      invalidFutureSales: invalidFuture,
      realizedRevenue: recon.realizedRevenue !== null && recon.realizedRevenue !== undefined ? Number(recon.realizedRevenue) : null,
      salesWithRecordedRevenue,
      unbilledSales,
      unrecordedRevenueSales,
      currency: resolvedCurrency,
    },
    ageing: {
      buckets,
      totalUnactivated,
      validAwaiting,
      invalidFuture,
      hasInvalidFuture: invalidFuture > 0,
    },
    segments: {
      vendor: vendorRows,
      source: sourceRows,
      grade: gradeRows,
    },
    timing: {
      avgTimeToSale: recon.avgTimeToSale || '—',
      avgTimeToActivation: recon.avgTimeToActivation || '—',
      medianTimeToSale: recon.medianTimeToSale || '—',
      medianTimeToActivation: recon.medianTimeToActivation || '—',
    },
    maturation: {
      status: data.maturationStatus || 'UNAVAILABLE',
      reason: data.maturationReason || 'Activation maturation is withheld until event-level activation joins are independently validated.',
      curve: Array.isArray(data.maturationCurve) ? data.maturationCurve : [],
    },
    methodology: {
      revenueEvidence: data.revenueEvidence || 'Recorded revenue is the sum of available source values, including real zero. Sales with missing revenue are reported separately; recorded revenue is not a complete revenue estimate.',
      segmentMethodology: data.segmentMethodology || 'One lead per segment. Vendor uses earliest recorded delivery vendor. Revenue per sale is recorded segment revenue / recorded segment sales; null revenue and empty denominators remain unavailable.',
      timezone: data.timezone || (data as any)?.metadata?.timezone,
      dateBasis: 'Operational intake cohort (leads fetched within selected period)',
    },
  };
}
