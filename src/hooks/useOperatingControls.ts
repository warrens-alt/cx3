import { useQuery } from '@tanstack/react-query';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchOperatingControls } from '../lib/offernetClient';
import { operationalQueryOptions } from '../lib/operationalQueries';

export function useOperatingControls() {
  const { selectedClient, ready, reportAuthenticationFailure } = useClient();
  const { startDate, endDate, filters, filterError } = useFilters();
  const enabled = ready && !filterError && Boolean(selectedClient);
  const query = useQuery(operationalQueryOptions('operating-controls', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, async (params, forceRefresh, signal) => {
    if (!enabled) throw new Error(filterError || 'Workspace is not ready.');
    try {
      return await fetchOperatingControls(params, forceRefresh, signal);
    } catch (error) {
      if ((error as { status?: number }).status === 401 && !signal?.aborted) reportAuthenticationFailure((error as Error).message);
      throw error;
    }
  }, enabled));
  return { ...query, data: enabled && !query.error ? query.data : undefined };
}
