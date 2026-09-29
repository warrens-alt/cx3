import type { BlcReport } from '../../contracts/blcReporting';
import type {
  RubixStatusResponse,
  RubixCapabilitiesResponse,
  RubixReportResponse,
  RubixReconciliationResponse,
} from '../../contracts/rubixPowerBi';
import { analyticsUrl, fetchAnalyticsJson } from './analyticsRequest';

/** Same-origin authenticated transport; never send warehouse credentials to the browser. */
export async function fetchBlcReport(
  params: Record<string, any>,
  forceRefresh = false,
  signal?: AbortSignal
): Promise<BlcReport> {
  const response = await fetchAnalyticsJson<BlcReport>(
    analyticsUrl('/blc/report', params, forceRefresh ? { refresh: 'true' } : undefined),
    signal
  );
  if (!response.success || !response.data) {
    throw new Error('BLC reporting response is unavailable');
  }
  return response.data;
}

/** Check Rubix Power BI connector status, dataset, and entity bindings. */
export async function fetchRubixPowerBiStatus(
  clientId: string,
  signal?: AbortSignal
): Promise<RubixStatusResponse> {
  const response = await fetchAnalyticsJson<RubixStatusResponse>(
    analyticsUrl('/blc/powerbi/status', { clientId }),
    signal
  );
  if (!response.success || !response.data) {
    throw new Error('Rubix Power BI status is unavailable');
  }
  return response.data;
}

/** Retrieve Rubix Power BI capability matrix and supported/unsupported filters. */
export async function fetchRubixPowerBiCapabilities(
  clientId: string,
  signal?: AbortSignal
): Promise<RubixCapabilitiesResponse> {
  const response = await fetchAnalyticsJson<RubixCapabilitiesResponse>(
    analyticsUrl('/blc/powerbi/capabilities', { clientId }),
    signal
  );
  if (!response.success || !response.data) {
    throw new Error('Rubix Power BI capabilities are unavailable');
  }
  return response.data;
}

/** Query Rubix Power BI public-report semantic model. */
export async function fetchRubixPowerBiReport(
  params: {
    clientId: string;
    queryType?: string;
    startDate?: string;
    endDate?: string;
    team?: string;
    segment?: string;
    agent?: string;
    refresh?: boolean;
  },
  signal?: AbortSignal
): Promise<RubixReportResponse> {
  const { refresh, ...queryArgs } = params;
  const response = await fetchAnalyticsJson<RubixReportResponse>(
    analyticsUrl(
      '/blc/powerbi/report',
      queryArgs,
      refresh ? { refresh: 'true' } : undefined
    ),
    signal
  );
  if (!response.success || !response.data) {
    throw new Error('Rubix Power BI report data is unavailable');
  }
  return response.data;
}

/** Retrieve cross-source reconciliation between BigQuery tbl_blc_activations and Power BI. */
export async function fetchRubixPowerBiReconciliation(
  params: {
    clientId: string;
    startDate?: string;
    endDate?: string;
    refresh?: boolean;
  },
  signal?: AbortSignal
): Promise<RubixReconciliationResponse> {
  const { refresh, ...queryArgs } = params;
  const response = await fetchAnalyticsJson<RubixReconciliationResponse>(
    analyticsUrl(
      '/blc/powerbi/reconciliation',
      queryArgs,
      refresh ? { refresh: 'true' } : undefined
    ),
    signal
  );
  if (!response.success || !response.data) {
    throw new Error('Rubix Power BI reconciliation data is unavailable');
  }
  return response.data;
}
