import type { MatchedPeriodWindow, MetricComparison, decomposeRateChange } from './periodComparison';
export interface LifecycleCounts { fetched: number; delivered: number; dialled: number; rpc: number; sales: number; activations: number }
export interface LifecycleSegment extends LifecycleCounts {
  key: string; revenue: number | null; missingRevenueLeads: number; deliveryRate: number | null; dialRate: number | null; rpcRate: number | null; saleRate: number | null; activationRate: number | null;
  within15mRate: number | null; oneCallShare: number | null; fivePlusNoRpc: number; dispositionCompleteness: number | null; invalidLeads: number; missingSource: number; missingGrade: number;
}
export interface LifecycleTransition { from: string; to: string; population: number; converted: number; lost: number | null; conversionRate: number | null; lossRate: number | null; deteriorationPp: number | null; status: 'OBSERVED' | 'NON_NESTED' }
export interface LifecycleDiagnostics {
  period: MatchedPeriodWindow | null;
  comparisons: Record<string, MetricComparison>;
  transitions: LifecycleTransition[];
  largestLeakage: LifecycleTransition | null;
  largestDeterioration: LifecycleTransition | null;
  segments: Record<string, LifecycleSegment[]>;
  priorSegments: Record<string, LifecycleSegment[]>;
  rateContributions: Record<string, Record<string, ReturnType<typeof decomposeRateChange>>>;
  velocity: { captureToDeliverySec:number|null; deliveryToDialSec:number|null; dialToSaleSec:number|null; saleToActivationSec:number|null };
  validationStatus: 'NOT_VERIFIED';
  methodology: string;
  unsupportedDimensions: string[];
}
export interface LifecycleExtension { lifecycle?: LifecycleDiagnostics }
