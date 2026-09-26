const VIEW_RESOURCES: Record<string, string> = {
  ExecutiveOverview: 'overview', Overview: 'overview', ManagementReview: 'overview',
  FunnelIntelligence: 'funnel', SpeedToLeadIntelligence: 'speed-to-lead',
  ContactStrategyIntelligence: 'contact-strategy', VendorLeadQuality: 'vendor-quality',
  TemporalIntelligence: 'temporal', SalesActivationIntelligence: 'sales-activation',
  CommercialIntelligence: 'commercial', DataIntegrityIntelligence: 'data-integrity',
  AgentPerformanceIntelligence: 'agent-performance', CampaignIntelligence: 'campaigns',
};
export function operationalQueryOptions<T>(name: string, params: Record<string, any>, fetcher: (params: Record<string, any>, forceRefresh?: boolean, signal?: AbortSignal) => Promise<T>, enabled = true) {
  return {
    queryKey: ['offernet-view', VIEW_RESOURCES[name] || name, params] as const,
    // React Query owns retention; do not stack a second browser TTL over it.
    queryFn: ({ signal }: { signal: AbortSignal }) => fetcher(params, true, signal),
    enabled: enabled && Boolean(params.clientId),
    staleTime: 60000,
    gcTime: 300000,
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
