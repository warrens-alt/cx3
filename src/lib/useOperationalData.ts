import { useQuery } from '@tanstack/react-query';
import { operationalQueryOptions, operationalQueryView } from './operationalQueries';

/** Results are bound to the complete request, including pagination and filters. */
export function useOperationalData<T>(name: string, params: Record<string, any>, fetcher: (params: Record<string, any>, forceRefresh?: boolean) => Promise<T>, enabled = true) {
  const query = useQuery(operationalQueryOptions(name, params, fetcher, enabled));
  return {
    ...operationalQueryView(query, enabled),
    loadData: async (_forceRefresh = false) => { if (enabled && params.clientId) await query.refetch(); },
  };
}
