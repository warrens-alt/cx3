import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { useClient } from './ClientContext';
import { useFilters } from './FilterContext';
import { createEvidenceReport, fetchReportingCatalogue } from './reportingClient';
import { getAnalyticalSessionKey } from './analyticalSession';
import { reportingFilters, reportingScopeError, reportLocalScopeError } from './reportingScope';
import type { ReportRequest, ReportResult } from '../../contracts/reporting';

export interface UseEvidenceWorkspaceOptions {
  metrics: string[];
  grouping?: 'none' | 'source' | 'vendor' | 'capture_month';
  dateBasis?: 'capture_cohort' | 'event_date';
  comparisons?: boolean;
}

export function useEvidenceWorkspace(options: UseEvidenceWorkspaceOptions) {
  const { clientId, clientConfig } = useClient();
  const { startDate, endDate, filters, filterError } = useFilters();
  const location = useLocation();
  const sessionKey = getAnalyticalSessionKey();
  const catalogue = useQuery({
    queryKey: ['reporting-catalogue', sessionKey, clientId],
    queryFn: ({ signal }) => fetchReportingCatalogue(clientId, signal),
    staleTime: 60000, retry: false,
  });
  const release = !catalogue.error ? catalogue.data?.release || null : null;
  const scopeFilters = useMemo(() => {
    try { return { value: reportingFilters(filters), error: null }; }
    catch (error) { return { value: {}, error: error instanceof Error ? error.message : 'Unsupported reporting filters.' }; }
  }, [filters]);
  const previousPeriod = useMemo(() => {
    const start = Date.parse(startDate), end = Date.parse(endDate);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return { startDate: '', endDate: '' };
    const previousEnd = start - 86400000;
    return { startDate: new Date(previousEnd - (end - start)).toISOString().slice(0, 10), endDate: new Date(previousEnd).toISOString().slice(0, 10) };
  }, [startDate, endDate]);
  const request: ReportRequest = useMemo(() => ({
    tenantId: clientId, startDate, endDate, observationCutoff: release?.cutoff || '',
    dateBasis: options.dateBasis || 'capture_cohort', grouping: options.grouping || 'none',
    currency: clientConfig?.currency || 'ZAR', metrics: options.metrics, filters: scopeFilters.value,
  }), [clientId, startDate, endDate, release?.cutoff, options.dateBasis, options.grouping, options.metrics, clientConfig?.currency, scopeFilters.value]);
  const scopeError = filterError || scopeFilters.error || reportLocalScopeError(location.search) || reportingScopeError(request, release);
  const isAvailable = catalogue.data?.status === 'AVAILABLE' && !!release?.execution;
  const enabled = isAvailable && !scopeError;
  const current = useQuery<ReportResult>({
    queryKey: ['reporting-report', sessionKey, release?.releaseId, request],
    queryFn: ({ signal }) => createEvidenceReport(request, release?.releaseId, signal),
    enabled, staleTime: 60000, retry: false,
  });
  const previousRequest: ReportRequest = useMemo(() => ({ ...request, ...previousPeriod }), [request, previousPeriod]);
  const previous = useQuery<ReportResult>({
    queryKey: ['reporting-report-previous', sessionKey, release?.releaseId, previousRequest],
    queryFn: ({ signal }) => createEvidenceReport(previousRequest, release?.releaseId, signal),
    enabled: enabled && !!options.comparisons && !reportingScopeError(previousRequest, release),
    staleTime: 60000, retry: false,
  });
  const expose = (query: typeof current, allowed: boolean) => ({
    isLoading: allowed && query.isLoading, isFetching: allowed && query.isFetching,
    error: allowed ? query.error : null, data: allowed && !query.error ? query.data || null : null,
    refetch: () => allowed ? query.refetch() : Promise.resolve(undefined),
  });
  return {
    catalogue: { isLoading: catalogue.isLoading, error: catalogue.error,
      data: catalogue.data ? { available: isAvailable, reason: isAvailable ? undefined : catalogue.data.message || 'No approved executable reporting snapshot published' } : undefined,
      refetch: catalogue.refetch },
    current: expose(current, enabled), previous: expose(previous, enabled && !!options.comparisons),
    // Both views use the declared previous equal-length interval. Never label a second current query as previous evidence.
    matched: expose(previous, enabled && !!options.comparisons),
    release, request, previousPeriod, matchedPeriod: previousPeriod, scopeError,
  };
}
