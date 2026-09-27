import { useState, useMemo, useEffect } from 'react';
import { useOperationalData } from '../../../lib/useOperationalData';
import { useFilters, extractOffernetFilters } from '../../../lib/FilterContext';
import { useClient } from '../../../lib/ClientContext';
import { fetchSpeedToLead, type SpeedToLeadData } from '../../../lib/offernetClient';
import { useOperatingControls } from '../../../hooks/useOperatingControls';
import { useScopedNavigationTarget } from '../../../hooks/useScopedNavigationTarget';
import { downloadAnalysisCsv } from '../../../lib/analysisExport';

export type SpeedData = Omit<SpeedToLeadData, 'timingStages'> & {
  timingStages: Array<SpeedToLeadData['timingStages'][number] & { p95?: string }>;
  backlog?: {
    awaitingFirstDial: number;
    currentSlaBreaches: number;
    completedDialBreaches: number;
    oldestUndialled: string;
  };
  methodology?: string;
};

export function useSpeedModel() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const scoped = useScopedNavigationTarget();
  const [controlsExpanded, setControlsExpanded] = useState(false);

  const scope = useMemo(() => ({
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }), [selectedClient, startDate, endDate, filters]);

  const speedQuery = useOperationalData<SpeedData>(
    'SpeedToLeadIntelligence',
    scope,
    fetchSpeedToLead
  );
  const controls = useOperatingControls(controlsExpanded);

  const data = speedQuery.data;
  const loading = speedQuery.loading;
  const error = speedQuery.error;

  const refreshAll = async () => {
    const tasks: Promise<any>[] = [speedQuery.loadData(true)];
    if (controlsExpanded) {
      tasks.push(controls.refetch());
    }
    await Promise.allSettled(tasks);
  };

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ['Lead-age cohort', 'Leads', 'RPC', 'RPC rate', 'Sales', 'Sale rate', 'Activations', 'Activation rate'],
      ...data.cohorts.map((row) => [
        row.cohort,
        row.leads,
        row.contacted,
        row.contactRate,
        row.sales,
        row.saleRate,
        row.activations,
        row.activationRate,
      ]),
    ];
    downloadAnalysisCsv(
      `contact_timing_${selectedClient}_${startDate || 'all'}_${endDate || 'all'}`,
      rows,
      {
        clientId: selectedClient,
        startDate,
        endDate,
        filters,
        validationStatus: 'NOT_VERIFIED',
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
    handleExportCsv,
  };
}
