import type { BlcReport } from '../../contracts/blcReporting';
import { analyticsUrl, fetchAnalyticsJson } from './analyticsRequest';

/** Same-origin authenticated transport; never send warehouse credentials to the browser. */
export async function fetchBlcReport(params: Record<string, any>, forceRefresh = false, signal?: AbortSignal): Promise<BlcReport> {
  const response = await fetchAnalyticsJson<BlcReport>(analyticsUrl('/blc/report', params, forceRefresh ? { refresh: 'true' } : undefined), signal);
  if (!response.success || !response.data) throw new Error('BLC reporting response is unavailable');
  return response.data;
}
