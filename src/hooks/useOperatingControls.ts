import { useQuery } from '@tanstack/react-query';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchOperatingControls } from '../lib/offernetClient';

export function useOperatingControls() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const scopedFilters = extractOffernetFilters(filters);

  return useQuery({
    queryKey: ['offernet-operating-controls', selectedClient, startDate, endDate, scopedFilters],
    queryFn: () => fetchOperatingControls({
      clientId: selectedClient,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      ...scopedFilters,
    }),
    enabled: Boolean(selectedClient),
    staleTime: 60000,
    retry: 1,
  });
}
