import { useClient } from './ClientContext';
import { useQuery } from '@tanstack/react-query';
import { useFilters } from './FilterContext';
import { analyticsUrl, fetchAnalyticsJson } from './analyticsRequest';
import type { Filters } from '../../server/bigquery/filters';

export { fetchAnalyticsJson } from './analyticsRequest';

export interface FetchAnalyticsResult<T> { data: T | null; loading: boolean; error: string | null; metadata?: any; fetching?: boolean; refetch: () => Promise<void>; }
interface AnalyticsOptions { enabled?: boolean; contextFilters?: Filters; }

export function useAnalyticsData<T = any>(endpoint: string, extraParams: Record<string, any> = {}, options: AnalyticsOptions = {}): FetchAnalyticsResult<T> {
  const { startDate, endDate, filters, filterError } = useFilters();
  const { selectedClient, ready, loading: workspaceLoading, error: workspaceError, reportAuthenticationFailure } = useClient();
  const scopedFilters = { ...filters, ...options.contextFilters };
  const enabled = ready && !filterError && options.enabled !== false;
  const result = useQuery({
    queryKey: ['analytics', endpoint, selectedClient, startDate, endDate, scopedFilters, extraParams, filterError],
    enabled,
    queryFn: async ({ signal }) => {
      if (!enabled) throw Object.assign(new Error(filterError || workspaceError || 'Workspace is not ready.'), { status: 400 });
      try {
        return await fetchAnalyticsJson<T>(analyticsUrl(endpoint, { clientId: selectedClient, startDate, endDate, filters: scopedFilters }, extraParams), signal);
      } catch (error) {
        // 403 can be an endpoint-specific capability denial; only 401 invalidates authentication.
        if ((error as { status?: number }).status === 401 && !signal.aborted) reportAuthenticationFailure((error as Error).message);
        throw error;
      }
    },
    retry: (count, error: Error & { status?: number; retryable?: boolean }) => error.retryable !== false && (error.status ?? 0) >= 500 && count < 1,
    staleTime: 120000, gcTime: 600000, refetchOnWindowFocus: false,
  });
  const unavailable = !enabled || !!result.error;
  return {
    data: unavailable ? null : result.data?.data ?? null,
    metadata: unavailable ? null : result.data?.metadata ?? null,
    loading: options.enabled !== false && !filterError && (workspaceLoading || result.isLoading),
    fetching: enabled && result.isFetching,
    error: filterError || workspaceError || (result.error instanceof Error ? result.error.message : null),
    refetch: async () => { if (enabled) await result.refetch(); },
  };
}
