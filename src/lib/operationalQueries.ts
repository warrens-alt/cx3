export function operationalQueryOptions<T>(name: string, params: Record<string, any>, fetcher: (params: Record<string, any>, forceRefresh?: boolean, signal?: AbortSignal) => Promise<T>, enabled = true) {
  return {
    queryKey: ['offernet-view', name, params] as const,
    // React Query owns freshness; bypass the second cache when it requests data.
    queryFn: ({ signal }: { signal: AbortSignal }) => fetcher(params, true, signal),
    enabled: enabled && Boolean(params.clientId),
    staleTime: 60000,
    retry: false as const,
    refetchOnWindowFocus: false,
  };
}

export function operationalQueryView<T>(query: { data?: T; error: unknown; isFetching: boolean }, enabled = true) {
  return {
    data: enabled && !query.error ? query.data ?? null : null,
    loading: enabled && query.isFetching,
    initialLoading: enabled && query.isFetching && query.data === undefined,
    refreshing: enabled && query.isFetching && query.data !== undefined,
    error: enabled && query.error instanceof Error ? query.error.message : null,
  };
}
