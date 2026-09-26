import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useClient } from './ClientContext';
import { useFilters } from './FilterContext';
import { createEvidenceReport, fetchReportingCatalogue } from './reportingClient';
import type { ReportRequest, ReportResult } from '../../contracts/reporting';

export interface UseEvidenceWorkspaceOptions {
  metrics: string[];
  grouping?: 'none' | 'source' | 'vendor' | 'capture_month';
  dateBasis?: 'capture_cohort' | 'event_date';
  comparisons?: boolean;
}

export function useEvidenceWorkspace(options: UseEvidenceWorkspaceOptions) {
  const { clientId, clientConfig } = useClient();
  const { startDate, endDate, filters } = useFilters();

  const previousPeriod = useMemo(() => {
    if (!startDate || !endDate) {
      return { startDate: '', endDate: '' };
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { startDate: '', endDate: '' };
    }
    const diff = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - diff);
    return {
      startDate: prevStart.toISOString().slice(0, 10),
      endDate: prevEnd.toISOString().slice(0, 10),
    };
  }, [startDate, endDate]);

  const request: ReportRequest = useMemo(() => {
    const vList = filters?.vendor?.values?.map(String) || (filters?.vendor?.value !== undefined ? [String(filters.vendor.value)] : undefined);
    const sList = filters?.source?.values?.map(String) || (filters?.source?.value !== undefined ? [String(filters.source.value)] : undefined);
    const mList = filters?.medium?.values?.map(String) || (filters?.medium?.value !== undefined ? [String(filters.medium.value)] : undefined);
    const gList = filters?.grade?.values?.map(String) || (filters?.grade?.value !== undefined ? [String(filters.grade.value)] : undefined);

    return {
      tenantId: clientId,
      startDate,
      endDate,
      observationCutoff: new Date().toISOString(),
      dateBasis: options.dateBasis || 'capture_cohort',
      grouping: options.grouping || 'none',
      currency: clientConfig?.currency || 'ZAR',
      metrics: options.metrics,
      filters: {
        vendor: vList,
        source: sList,
        medium: mList,
        grade: gList,
      },
    };
  }, [clientId, startDate, endDate, clientConfig?.currency, options.metrics, options.grouping, options.dateBasis, filters]);

  const catalogue = useQuery({
    queryKey: ['reporting-catalogue', clientId],
    queryFn: () => fetchReportingCatalogue(),
    staleTime: 60000,
    retry: false,
  });

  const release = catalogue.data?.release || null;
  const isAvailable = catalogue.data?.status === 'AVAILABLE' && !!release;

  const current = useQuery<ReportResult>({
    queryKey: ['reporting-report', release?.releaseId, request],
    queryFn: ({ signal }) => createEvidenceReport(request, release?.releaseId, signal),
    enabled: isAvailable,
    staleTime: 60000,
    retry: false,
  });

  const previousRequest: ReportRequest = useMemo(() => ({
    ...request,
    startDate: previousPeriod.startDate,
    endDate: previousPeriod.endDate,
  }), [request, previousPeriod]);

  const previous = useQuery<ReportResult>({
    queryKey: ['reporting-report-previous', release?.releaseId, previousRequest],
    queryFn: ({ signal }) => createEvidenceReport(previousRequest, release?.releaseId, signal),
    enabled: isAvailable && !!options.comparisons,
    staleTime: 60000,
    retry: false,
  });

  const matched = useQuery<ReportResult>({
    queryKey: ['reporting-report-matched', release?.releaseId, request],
    queryFn: ({ signal }) => createEvidenceReport(request, release?.releaseId, signal),
    enabled: isAvailable,
    staleTime: 60000,
    retry: false,
  });

  const catalogueData = catalogue.data ? {
    available: isAvailable,
    reason: isAvailable ? undefined : (catalogue.data.message || 'No approved reporting release published'),
  } : undefined;

  return {
    catalogue: {
      isLoading: catalogue.isLoading,
      error: catalogue.error,
      data: catalogueData,
      refetch: catalogue.refetch,
    },
    current: {
      isLoading: current.isLoading,
      isFetching: current.isFetching,
      error: current.error,
      data: current.data || null,
      refetch: current.refetch,
    },
    previous: {
      isLoading: previous.isLoading,
      isFetching: previous.isFetching,
      error: previous.error,
      data: previous.data || null,
      refetch: previous.refetch,
    },
    matched: {
      isLoading: matched.isLoading,
      isFetching: matched.isFetching,
      error: matched.error,
      data: matched.data || null,
      refetch: matched.refetch,
    },
    release,
    request,
    previousPeriod,
    matchedPeriod: previousPeriod,
    scopeError: null,
  };
}
