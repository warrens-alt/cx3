export interface GradePricingMatrix {
  gradeA: number;
  gradeB: number;
  gradeC: number;
  gradeD: number;
  gradeE?: number;
  gradeF?: number;
}

export interface FinancialSimulationResult {
  rates: GradePricingMatrix;
  gradeBreakdown: Array<{
    grade: string;
    label: string;
    leadsCount: number;
    pricePerLead: number;
    grossRevenue: number;
    shareOfVolume: number;
  }>;
  totalLeads: number;
  totalGrossRevenue: number;
  totalGrossRevenueFormatted: string;
  estimatedMediaCost: number;
  estimatedMediaCostFormatted: string;
  netCommercialMargin: number;
  netCommercialMarginFormatted: string;
  yieldMarginPercentage: number;
  averageYieldPerLead: number;
}

export interface VendorYieldItem {
  vendor: string;
  cpl: number;
  cpa: number;
  rpcRate: number;
  deliveryRate: number;
  netYieldMargin: number;
  tier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  activeVolume: number;
  contractStatus: 'CAP_MAX' | 'ACTIVE' | 'UNDER_REVIEW';
}

export interface ReallocationSimulationResult {
  shiftPercentage: number;
  reallocatedVolumeMonthly: number;
  baselineMonthlyProfit: number;
  projectedMonthlyProfit: number;
  incrementalMonthlyProfit: number;
  incrementalMonthlyProfitFormatted: string;
  blendedYieldBefore: number;
  blendedYieldAfter: number;
  tacticalRecommendations: string[];
}

export const DEFAULT_PRICING: GradePricingMatrix = {
  gradeA: 35.00,
  gradeB: 24.00,
  gradeC: 16.50,
  gradeD: 8.00,
  gradeE: 6.00,
  gradeF: 4.50,
};

const GRADE_VOLUMES = [
  { grade: 'Grade A', label: 'Prime Bureau Verified', count: 31968, defaultRate: 35.00 },
  { grade: 'Grade B', label: 'Near Prime Validated', count: 50740, defaultRate: 24.00 },
  { grade: 'Grade C', label: 'Mid-Tier Performing', count: 104395, defaultRate: 16.50 },
  { grade: 'Grade D', label: 'Subprime Dialler Fit', count: 23622, defaultRate: 8.00 },
  { grade: 'Grade E', label: 'Retail Value Mass', count: 81434, defaultRate: 6.00 },
  { grade: 'Grade F', label: 'Low Propensity Cohort', count: 19881, defaultRate: 4.50 },
  { grade: 'Unassigned', label: 'Imputed Post-Intake', count: 38533, defaultRate: 12.00 },
];

export const VENDOR_YIELD_RANKING: VendorYieldItem[] = [
  {
    vendor: 'Lewis Group',
    cpl: 28.50,
    cpa: 180.00,
    rpcRate: 72.4,
    deliveryRate: 94.2,
    netYieldMargin: 38.6,
    tier: 'Tier 1',
    activeVolume: 84500,
    contractStatus: 'CAP_MAX',
  },
  {
    vendor: 'Rewardsco',
    cpl: 26.00,
    cpa: 165.00,
    rpcRate: 68.9,
    deliveryRate: 92.1,
    netYieldMargin: 35.2,
    tier: 'Tier 1',
    activeVolume: 62000,
    contractStatus: 'ACTIVE',
  },
  {
    vendor: 'MTN',
    cpl: 24.00,
    cpa: 150.00,
    rpcRate: 66.5,
    deliveryRate: 91.8,
    netYieldMargin: 32.4,
    tier: 'Tier 1',
    activeVolume: 177638,
    contractStatus: 'ACTIVE',
  },
  {
    vendor: 'Mondo',
    cpl: 22.50,
    cpa: 145.00,
    rpcRate: 63.8,
    deliveryRate: 90.5,
    netYieldMargin: 29.8,
    tier: 'Tier 2',
    activeVolume: 169269,
    contractStatus: 'ACTIVE',
  },
  {
    vendor: 'Ontact - BLC',
    cpl: 21.00,
    cpa: 140.00,
    rpcRate: 61.2,
    deliveryRate: 89.4,
    netYieldMargin: 27.5,
    tier: 'Tier 2',
    activeVolume: 59178,
    contractStatus: 'ACTIVE',
  },
  {
    vendor: 'Real Promotions',
    cpl: 18.00,
    cpa: 130.00,
    rpcRate: 54.1,
    deliveryRate: 86.0,
    netYieldMargin: 22.0,
    tier: 'Tier 3',
    activeVolume: 7444,
    contractStatus: 'UNDER_REVIEW',
  },
];

export function calculateFinancialSimulation(customRates?: Partial<GradePricingMatrix>): FinancialSimulationResult {
  const rates: GradePricingMatrix = {
    gradeA: customRates?.gradeA != null ? Number(customRates.gradeA) : DEFAULT_PRICING.gradeA,
    gradeB: customRates?.gradeB != null ? Number(customRates.gradeB) : DEFAULT_PRICING.gradeB,
    gradeC: customRates?.gradeC != null ? Number(customRates.gradeC) : DEFAULT_PRICING.gradeC,
    gradeD: customRates?.gradeD != null ? Number(customRates.gradeD) : DEFAULT_PRICING.gradeD,
    gradeE: customRates?.gradeE != null ? Number(customRates.gradeE) : (DEFAULT_PRICING.gradeE || 6.00),
    gradeF: customRates?.gradeF != null ? Number(customRates.gradeF) : (DEFAULT_PRICING.gradeF || 4.50),
  };

  const rateLookup: Record<string, number> = {
    'Grade A': rates.gradeA,
    'Grade B': rates.gradeB,
    'Grade C': rates.gradeC,
    'Grade D': rates.gradeD,
    'Grade E': rates.gradeE || 6.00,
    'Grade F': rates.gradeF || 4.50,
    'Unassigned': 12.00,
  };

  const totalLeads = 350573;
  let totalGrossRevenue = 0;

  const breakdown = GRADE_VOLUMES.map(item => {
    const price = rateLookup[item.grade] ?? item.defaultRate;
    const gross = item.count * price;
    totalGrossRevenue += gross;
    return {
      grade: item.grade,
      label: item.label,
      leadsCount: item.count,
      pricePerLead: price,
      grossRevenue: gross,
      shareOfVolume: Number(((item.count / totalLeads) * 100).toFixed(1)),
    };
  });

  const estimatedMediaCost = Math.round(totalLeads * 5.25); // Average acquisition cost per lead R 5.25
  const netCommercialMargin = totalGrossRevenue - estimatedMediaCost;
  const yieldMarginPercentage = Number(((netCommercialMargin / totalGrossRevenue) * 100).toFixed(1));
  const averageYieldPerLead = Number((totalGrossRevenue / totalLeads).toFixed(2));

  return {
    rates,
    gradeBreakdown: breakdown,
    totalLeads,
    totalGrossRevenue,
    totalGrossRevenueFormatted: `R ${totalGrossRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`,
    estimatedMediaCost,
    estimatedMediaCostFormatted: `R ${estimatedMediaCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`,
    netCommercialMargin,
    netCommercialMarginFormatted: `R ${netCommercialMargin.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`,
    yieldMarginPercentage,
    averageYieldPerLead,
  };
}

export function simulateTrafficReallocation(shiftPercentage: number): ReallocationSimulationResult {
  const clampedShift = Math.max(0, Math.min(50, Math.round(shiftPercentage)));
  const baselineMonthlyProfit = 1430000; // Baseline net margin per month
  const incrementalProfitPerPercent = 14300; // R 14,300 profit per 1% shifted
  const incrementalMonthlyProfit = clampedShift * incrementalProfitPerPercent;
  const projectedMonthlyProfit = baselineMonthlyProfit + incrementalMonthlyProfit;
  const reallocatedVolumeMonthly = Math.round((clampedShift / 100) * 38400); // 38,400 monthly volume pool

  const blendedYieldBefore = 13.95;
  const blendedYieldAfter = Number((13.95 + (clampedShift * 0.082)).toFixed(2));

  const recommendations: string[] = [];

  if (clampedShift <= 10) {
    recommendations.push(
      'Conservative Pilot: Reallocate 5-10% of Facebook Grade C/D leads into Lewis Group high-touch dialler queues to benchmark dial-to-RPC efficiency.',
      'Maintain existing Mondo and MTN baseline commitments without triggering contract minimum penalties.'
    );
  } else if (clampedShift <= 25) {
    recommendations.push(
      'Scale Top-Tier Routing: Enforce cap-and-collar commercial clauses on MTN and Mondo to guarantee a minimum 65% Right Party Contact rate on Grade B volume.',
      'Divert unallocated affiliate lead flows away from low-yield brokers into Rewardsco motor warranty campaign (+R 143k to R 357k incremental yield).'
    );
  } else if (clampedShift <= 40) {
    recommendations.push(
      'High-Performance Optimization: Reposition 30-40% of Grade C volume into targeted SMS/WhatsApp pre-vetting funnels before releasing to dialler queues.',
      'Renegotiate Tier 1 rate card payouts with Lewis Group and Rewardsco to capture volume tier discount (+R 429k to R 572k monthly profit).'
    );
  } else {
    recommendations.push(
      'Max Yield Monetization: Maximum 50% shift executed. Deprioritize unvetted Grade D affiliate traffic and redirect exclusive delivery to Lewis Group, Rewardsco, and MTN premium queues.',
      `Capturing full target of +R 715,000/month incremental net margin with blended lead yield scaling to R ${blendedYieldAfter.toFixed(2)} / lead.`,
      'Establish real-time webhook throttling for low-performing sources failing the 91.4% delivery SLA.'
    );
  }

  return {
    shiftPercentage: clampedShift,
    reallocatedVolumeMonthly,
    baselineMonthlyProfit,
    projectedMonthlyProfit,
    incrementalMonthlyProfit,
    incrementalMonthlyProfitFormatted: `+R ${incrementalMonthlyProfit.toLocaleString('en-ZA')}/month`,
    blendedYieldBefore,
    blendedYieldAfter,
    tacticalRecommendations: recommendations,
  };
}
