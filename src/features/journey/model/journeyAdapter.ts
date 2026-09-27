import type { LifecycleTransition } from '../../../../contracts/lifecycleAnalytics';
import type { JourneyData } from './useJourneyModel';

export type FunnelStageKey = 'fetched' | 'delivered' | 'dialled' | 'rpc' | 'sales' | 'activated';

export interface JourneyStageItem {
  key: FunnelStageKey;
  name: string;
  volume: number | null;
  conversionRate: number | null;
  dropoff: number | null;
  description: string;
  stepNumber: number;
}

export interface JourneyHeadlineMetrics {
  totalVolume: number | null;
  deliveredVolume: number | null;
  deliveryPct: number | null;
  dialledVolume: number | null;
  dialPct: number | null;
  rpcVolume: number | null;
  rpcPct: number | null;
  salesVolume: number | null;
  salePct: number | null;
  activationsVolume: number | null;
  activationPct: number | null;
}

export interface JourneyDisplayAdapterResult {
  headline: JourneyHeadlineMetrics;
  stages: JourneyStageItem[];
  transitions: LifecycleTransition[];
}

function extractCount(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const num = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(num) ? num : null;
}

function calculateRate(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || !Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return null;
  }
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

/**
 * Authoritative typed journey display adapter.
 * Reconciles independent stage totals from transitions, comparisons, and genuine response aggregates.
 * Never sums byVendor subsets as globally unique totals.
 * Preserves zero as 0; unknown as null. Empty eligible populations return null rates.
 */
export function adaptJourneyData(data?: JourneyData | null): JourneyDisplayAdapterResult {
  const comparisons = data?.lifecycle?.comparisons;
  const transitions = data?.lifecycle?.transitions ?? [];

  // 1. Independent stage counts
  // Read from authoritative comparisons built from current cohort counts first.
  // Fall back only to exact stage-specific population denominators in transitions.
  // Never sum byVendor rows.
  const fetched = extractCount(
    comparisons?.fetched?.current !== undefined
      ? comparisons.fetched.current
      : transitions[0]?.population
  );

  const delivered = extractCount(
    comparisons?.delivered?.current !== undefined
      ? comparisons.delivered.current
      : transitions[0]?.converted !== undefined
      ? transitions[0].converted
      : transitions[1]?.population
  );

  const dialled = extractCount(
    comparisons?.dialled?.current !== undefined
      ? comparisons.dialled.current
      : transitions[2]?.population
  );

  const rpc = extractCount(
    comparisons?.rpc?.current !== undefined
      ? comparisons.rpc.current
      : transitions[3]?.population
  );

  const sales = extractCount(
    comparisons?.sales?.current !== undefined
      ? comparisons.sales.current
      : transitions[4]?.population
  );

  const activations = extractCount(comparisons?.activations?.current);

  // 2. Headline rates: prefer comparison rates when available, otherwise exact independent count ratios.
  // Empty eligible populations (denominator 0) yield null.
  const deliveryPct =
    comparisons?.deliveryRate?.current != null
      ? comparisons.deliveryRate.current
      : calculateRate(delivered, fetched);

  const dialPct =
    comparisons?.dialRate?.current != null
      ? comparisons.dialRate.current
      : calculateRate(dialled, delivered);

  const rpcPct =
    comparisons?.rpcRate?.current != null
      ? comparisons.rpcRate.current
      : calculateRate(rpc, dialled);

  const salePct =
    comparisons?.saleRate?.current != null
      ? comparisons.saleRate.current
      : calculateRate(sales, fetched);

  const activationPct =
    comparisons?.activationRate?.current != null
      ? comparisons.activationRate.current
      : calculateRate(activations, sales);

  const headline: JourneyHeadlineMetrics = {
    totalVolume: fetched,
    deliveredVolume: delivered,
    deliveryPct,
    dialledVolume: dialled,
    dialPct,
    rpcVolume: rpc,
    rpcPct,
    salesVolume: sales,
    salePct,
    activationsVolume: activations,
    activationPct,
  };

  // 3. Stage Cards Rail
  // Uses authorised independent counts for all 6 stages.
  // Conversion rates reflect the genuine transition progression into that stage.
  const stages: JourneyStageItem[] = [
    {
      key: 'fetched',
      name: 'Intake (Capture)',
      volume: fetched,
      conversionRate: null,
      dropoff: null,
      description: 'Acquired demand cohort captured in scope.',
      stepNumber: 1,
    },
    {
      key: 'delivered',
      name: 'Delivery',
      volume: delivered,
      conversionRate: transitions[0]?.conversionRate ?? null,
      dropoff: transitions[0]?.lost ?? null,
      description: 'Leads successfully delivered to dialler or partners.',
      stepNumber: 2,
    },
    {
      key: 'dialled',
      name: 'Dial',
      volume: dialled,
      conversionRate: transitions[1]?.conversionRate ?? null,
      dropoff: transitions[1]?.lost ?? null,
      description: 'Leads with at least one recorded call attempt.',
      stepNumber: 3,
    },
    {
      key: 'rpc',
      name: 'RPC',
      volume: rpc,
      conversionRate: transitions[2]?.conversionRate ?? null,
      dropoff: transitions[2]?.lost ?? null,
      description: 'Leads with verified right-party contact.',
      stepNumber: 4,
    },
    {
      key: 'sales',
      name: 'Sale',
      volume: sales,
      conversionRate: transitions[3]?.conversionRate ?? null,
      dropoff: transitions[3]?.lost ?? null,
      description: 'Recorded sales closed from acquired demand.',
      stepNumber: 5,
    },
    {
      key: 'activated',
      name: 'Activation',
      volume: activations,
      conversionRate: transitions[4]?.conversionRate ?? null,
      dropoff: transitions[4]?.lost ?? null,
      description: 'Fulfilled deals and activated policies/accounts.',
      stepNumber: 6,
    },
  ];

  return {
    headline,
    stages,
    transitions,
  };
}
