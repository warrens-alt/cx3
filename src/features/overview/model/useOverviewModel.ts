import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOperationalData } from '../../../lib/useOperationalData';
import { useFilters, extractOffernetFilters } from '../../../lib/FilterContext';
import { useClient } from '../../../lib/ClientContext';
import { useAuth } from '../../../lib/AuthContext';
import { fetchOverview, fetchCommercial, type OverviewData, type RootCauseData } from '../../../lib/offernetClient';
import { useOperatingControls } from '../../../hooks/useOperatingControls';
import type { InspectorContent } from '../../../shared/evidence/InspectorHost';

export type RootMetric = RootCauseData['metric']['id'];

export function useOverviewModel() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();

  const [inspectorContent, setInspectorContent] = useState<InspectorContent | null>(null);
  const [rootMetric, setRootMetric] = useState<RootMetric | null>(null);

  const scope = useMemo(() => ({
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }), [selectedClient, startDate, endDate, filters]);

  const overviewQuery = useOperationalData<OverviewData>('ExecutiveOverview', scope, fetchOverview);
  const commercialQuery = useOperationalData('commercial', scope, fetchCommercial);
  const controls = useOperatingControls();

  const data = overviewQuery.data;
  const loading = overviewQuery.loading;
  const error = overviewQuery.error;

  const refreshAll = async () => {
    await Promise.allSettled([
      overviewQuery.loadData(true),
      commercialQuery.loadData(true),
      controls.refetch(),
    ]);
  };

  const hasComparison = Boolean(startDate && endDate && data?.comparisonWindow);

  return {
    data,
    loading,
    error,
    refreshAll,
    hasComparison,
    isAdmin,
    inspectorContent,
    setInspectorContent,
    closeInspector: () => setInspectorContent(null),
    rootMetric,
    setRootMetric,
    commercial: commercialQuery,
    controls,
  };
}
