import { useQuery } from '@tanstack/react-query';
import { useClient } from './ClientContext';
import { useFilters } from './FilterContext';
import { operationalQueryOptions, operationalQueryView } from './operationalQueries';

/** Results are bound to the complete request, including pagination and filters. */
export function useOperationalData<T>(name: string, params: Record<string, any>, fetcher: (params: Record<string, any>, forceRefresh?: boolean, signal?: AbortSignal) => Promise<T>, enabled = true) {
  const { ready, loading: workspaceLoading, error: workspaceError, reportAuthenticationFailure } = useClient();
  const { filterError } = useFilters();
  const active = enabled && ready && !filterError && Boolean(params.clientId);
  const query = useQuery(operationalQueryOptions(name, params, async (scope, forceRefresh, signal) => {
    try {
      return await fetcher(scope, forceRefresh, signal);
    } catch (error) {
      if ((error as { status?: number }).status === 401 && !signal?.aborted) reportAuthenticationFailure((error as Error).message);
      throw error;
    }
  }, active));
  const view = operationalQueryView(query, active);
  return {
    ...view,
    // This is browser receipt time, not the warehouse event or source cutoff.
    receivedAt: active && !query.error ? query.dataUpdatedAt || null : null,
    loading: enabled && !filterError && (workspaceLoading || view.loading),
    initialLoading: enabled && !filterError && (workspaceLoading || view.initialLoading),
    error: enabled ? filterError || workspaceError || view.error : null,
    loadData: async (_forceRefresh = false) => { if (active) await query.refetch(); },
  };
}
