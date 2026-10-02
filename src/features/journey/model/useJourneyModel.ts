import { METRIC_REGISTRY_VERSION } from '../../../../contracts/metricRegistry';
import { useState, useMemo, useEffect } from 'react';
import { useOperationalData } from '../../../lib/useOperationalData';
import { useFilters, extractOffernetFilters } from '../../../lib/FilterContext';
import { useClient } from '../../../lib/ClientContext';
import { fetchFunnel, type FunnelData } from '../../../lib/offernetClient';
import type { LifecycleExtension } from '../../../../contracts/lifecycleAnalytics';
import { useOperatingControls } from '../../../hooks/useOperatingControls';
import { useScopedNavigationTarget } from '../../../hooks/useScopedNavigationTarget';
import type { InspectorContent } from '../../../shared/evidence/InspectorHost';
import { downloadAnalysisCsv } from '../../../lib/analysisExport';

export type JourneyData = FunnelData & LifecycleExtension;

export function useJourneyModel() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const scoped = useScopedNavigationTarget();

  const [inspectorContent, setInspectorContent] = useState<InspectorContent | null>(null);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [matchedPeriodExpanded, setMatchedPeriodExpanded] = useState(false);

  // Invalidate contextual inspection whenever reporting scope changes
  useEffect(() => {
    setInspectorContent(null);
  }, [selectedClient, startDate, endDate, filters]);

  const scope = useMemo(() => ({
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }), [selectedClient, startDate, endDate, filters]);

  const funnelQuery = useOperationalData<JourneyData>('FunnelIntelligence', scope, fetchFunnel);
  const controls = useOperatingControls(controlsExpanded);

  const data = funnelQuery.data;
  const loading = funnelQuery.loading;
  const error = funnelQuery.error;

  const refreshAll = async () => {
    const refreshTasks: Promise<any>[] = [funnelQuery.loadData(true)];
    if (controlsExpanded) {
      refreshTasks.push(controls.refetch());
    }
    const results = await Promise.allSettled(refreshTasks);
    for (const res of results) {
      if (res.status === 'rejected') {
        console.error('Journey refresh failed:', res.reason);
      }
    }
  };

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ['Dimension', 'Segment', 'Fetched', 'Delivered', 'Dialled', 'RPC', 'Sales', 'Activations'],
      ...((data.byVendor || []).map(v => ['Vendor', v.vendor, v.leads, v.delivered, v.dialled, v.contacted, v.sales, v.activations])),
      ...((data.bySource || []).map(s => ['Source', s.source, s.leads, s.delivered, s.dialled, s.contacted, s.sales, s.activations])),
      ...((data.byGrade || []).map(g => ['Grade', g.grade, g.leads, g.delivered, g.dialled, g.contacted, g.sales, g.activations])),
    ];
    downloadAnalysisCsv(
      `funnel_${selectedClient}_${startDate || 'all'}_${endDate || 'all'}`,
      rows,
      {
        clientId: selectedClient,
        startDate,
        endDate,
        filters,
        validationStatus: data.lifecycle?.validationStatus || 'NOT_VERIFIED',
        dateBasis: 'Lead intake/capture cohort', countingGrain: 'Distinct lead per returned segment',
        definitionVersion: METRIC_REGISTRY_VERSION,
        definitions: data.lifecycle?.methodology,
      }
    );
  };

  return {
    data,
    loading,
    error,
    refreshAll,
    scope,
    filters,
    scoped,
    controls,
    controlsExpanded,
    setControlsExpanded,
    matchedPeriodExpanded,
    setMatchedPeriodExpanded,
    inspectorContent,
    setInspectorContent,
    handleExportCsv,
  };
}
