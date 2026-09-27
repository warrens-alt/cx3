import { useState, useMemo } from 'react';
import { useOperationalData } from '../../../lib/useOperationalData';
import { useFilters, extractOffernetFilters } from '../../../lib/FilterContext';
import { useClient } from '../../../lib/ClientContext';
import { useAuth } from '../../../lib/AuthContext';
import { fetchOverview, fetchCommercial, type OverviewData, type RootCauseData } from '../../../lib/offernetClient';
import type { LifecycleExtension } from '../../../../contracts/lifecycleAnalytics';
import { useOperatingControls } from '../../../hooks/useOperatingControls';
import type { InspectorContent } from '../../../shared/evidence/InspectorHost';

export type RootMetric = RootCauseData['metric']['id'];

export type FullOverviewData = OverviewData & LifecycleExtension & {
  revenueEvidence?: { missingLeadValues: number; basis: string };
  contactEvidence?: {
    zeroCallLeads: number;
    oneCallLeads: number;
    oneCallShare: number | null;
    multiCallShare: number | null;
    fivePlusNoRpc: number;
    medianCaptureToDial: string;
    p90CaptureToDial: string;
    within30m: number | null;
    within60m: number | null;
    backlogOver15m: number;
    backlogOver30m: number;
    backlogOver6h: number;
    backlogOver12h: number;
    awaitingActivation: number;
    activationOver3d: number;
    activationOver7d: number;
    activationOver30d: number;
  };
};

export function useOverviewModel() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const { isAdmin } = useAuth();

  const [inspectorContent, setInspectorContent] = useState<InspectorContent | null>(null);
  const [rootMetric, setRootMetric] = useState<RootMetric | null>(null);

  const scope = useMemo(() => ({
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }), [selectedClient, startDate, endDate, filters]);

  const overviewQuery = useOperationalData<FullOverviewData>('ExecutiveOverview', scope, fetchOverview);
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

  const investigate = (metric: RootMetric) => {
    if (hasComparison) {
      setRootMetric(metric);
    }
  };

  return {
    data,
    loading,
    error,
    refreshAll,
    hasComparison,
    investigate,
    isAdmin,
    inspectorContent,
    setInspectorContent,
    closeInspector: () => setInspectorContent(null),
    rootMetric,
    setRootMetric,
    commercial: commercialQuery,
    controls,
    scope,
  };
}
