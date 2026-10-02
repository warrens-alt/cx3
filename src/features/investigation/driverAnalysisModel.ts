import type { RootCauseData } from '../../lib/offernetClient';

export const OPERATIONAL_DRIVER_METRICS = ['fetchedLeads', 'deliveryRate', 'dialRate', 'contactRate', 'leadToSaleRate', 'activationRate'] as const;
/** Exact existing registry identities for the operational root-cause measures. */
export const OPERATIONAL_DRIVER_METRIC_IDS: Record<typeof OPERATIONAL_DRIVER_METRICS[number], string> = {
  fetchedLeads: 'fetched_leads', deliveryRate: 'delivery_rate', dialRate: 'dial_rate',
  contactRate: 'rpc_rate', leadToSaleRate: 'sales_per_fetched_rate', activationRate: 'activation_rate',
};
export const MARKETING_DRIVER_METRICS = ['spend', 'cpc', 'cpm', 'cpl', 'ctr', 'leads'] as const;
export type DriverDimension = RootCauseData['dimensions'][number]['key'];
export const DRIVER_SEGMENT_PARAMS: Record<DriverDimension, string> = {
  vendor: 'segmentVendor', source: 'segmentSource', grade: 'segmentGrade', leadAge: 'segmentLeadAge',
};
export const DRIVER_SCOPE_PARAMS = ['drill', 'drillValue', ...Object.values(DRIVER_SEGMENT_PARAMS)] as const;

/** API metric IDs only. A count, revenue value, or SLA must never silently become another rate. */
export function driverMetricKind(metric: string | null | undefined): 'operational' | 'marketing' | null {
  if (OPERATIONAL_DRIVER_METRICS.some(id => id === metric)) return 'operational';
  if (MARKETING_DRIVER_METRICS.some(id => id === metric)) return 'marketing';
  return null;
}

export function driverScope(params: URLSearchParams): Record<string, string> {
  return Object.fromEntries(DRIVER_SCOPE_PARAMS.flatMap(key => params.get(key) ? [[key, params.get(key)!]] : []));
}

/** Narrowing is independent of global filters and keeps the original population predicate intact. */
export function driverSegmentLink(params: URLSearchParams, dimension: DriverDimension, name: string, recordsAllowed: boolean, metric?: string | null): string {
  const next = new URLSearchParams(params);
  for (const key of ['page', 'search', 'sourceSearch', 'sourceMode', 'view', 'preset', 'leadId', 'lead_id', 'selectedLead', 'selectedLeadId', 'selectedIDs', 'id']) next.delete(key);
  for (const key of [...next.keys()]) if (/^(consumer[_-]?id|transaction[_-]?id)$/i.test(key)) next.delete(key);
  next.set(DRIVER_SEGMENT_PARAMS[dimension], !name.trim() ? 'Unrecorded' : name);
  if (metric && driverMetricKind(metric)) next.set('investigationMetric', metric);
  if (recordsAllowed) next.set('view', 'population');
  return `${recordsAllowed ? '/lead-explorer' : '/investigate'}?${next.toString()}`;
}
