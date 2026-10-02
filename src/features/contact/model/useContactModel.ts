import { METRIC_REGISTRY_VERSION } from '../../../../contracts/metricRegistry';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOperationalData } from '../../../lib/useOperationalData';
import { useFilters, extractOffernetFilters } from '../../../lib/FilterContext';
import { useClient } from '../../../lib/ClientContext';
import { useAuth } from '../../../lib/AuthContext';
import {
  fetchContactStrategy,
  fetchContactDispositions,
  type ContactStrategyData,
  type ContactDispositionsData,
} from '../../../lib/offernetClient';
import {
  DISPOSITION_REPORT_VERSION,
  type DispositionReportingMode,
  type DetailedDispositionRow,
} from '../../../../contracts/vendorDispositions';
import {
  downloadAnalysisCsv,
  downloadDispositionExportCsv,
  validateDateBound,
  validateDateOrdering,
  validateFilters,
  type DispositionExportMetadata,
} from '../../../lib/analysisExport';
import { buildVendorSelectedExport } from './dispositionSelection';
import { vendorSummaryExportRows, vendorOutcomeExportRows } from './dispositionComparison';
import type { InspectorContent } from '../../../shared/evidence/InspectorHost';

export type ContactTab = 'call_counts' | 'vendor_dispositions';

export function useContactModel(initialTab?: ContactTab) {
  const { selectedClient, clientConfig } = useClient();
  const { user, profile } = useAuth();
  const { startDate, endDate, filters, setVendor } = useFilters();
  const [searchParams, setSearchParams] = useSearchParams();

  // Authoritative URL state: vendor inspection direct links preserve active vendor_dispositions tab
  const tabParam = searchParams.get('tab');
  const activeTab: ContactTab = initialTab ?? (
    tabParam === 'vendor_dispositions' || (!tabParam && searchParams.has('inspectVendor'))
      ? 'vendor_dispositions'
      : 'call_counts');

  const modeParam = searchParams.get('mode');
  const dispositionMode: DispositionReportingMode = modeParam === 'call_records' ? 'call_records' : 'lead_status';

  // Report-local inspection selections, separate from global vendor filter
  const inspectVendor = searchParams.get('inspectVendor') || null;
  const inspectGroup = searchParams.get('inspectGroup') || 'ALL';

  // Inspector host state for call effort bucket inspections
  const [inspectorContent, setInspectorContent] = useState<InspectorContent | null>(null);

  // Export error states for accessible feedback - separated between report summary and active modal
  const [summaryExportError, setSummaryExportError] = useState<string | null>(null);
  const [selectedExportError, setSelectedExportError] = useState<string | null>(null);
  const clearSummaryExportError = () => setSummaryExportError(null);
  const clearSelectedExportError = () => setSelectedExportError(null);

  // Invalidate inspector and errors when scope changes
  useEffect(() => {
    setInspectorContent(null);
    setSummaryExportError(null);
    setSelectedExportError(null);
  }, [selectedClient, startDate, endDate, filters]);

  // Reset export errors on client changes
  useEffect(() => {
    setSummaryExportError(null);
    setSelectedExportError(null);
  }, [selectedClient]);

  const scope = useMemo(() => ({
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }), [selectedClient, startDate, endDate, filters]);

  // Query 1: Call Effort outcomes (only queried when activeTab === 'call_counts')
  const callCountQuery = useOperationalData<
    Omit<ContactStrategyData, 'summary' | 'attemptPerformance'> & {
      attemptPerformance: Array<
        ContactStrategyData['attemptPerformance'][number] & { noRpc?: number; rpcUnrecorded?: number }
      >;
      summary?: ContactStrategyData['summary'] & { oneCallNoRpcLeads?: number; zeroCallNoRpcLeads?: number };
      effortEvidence?: { reason: string };
    }
  >(
    'ContactStrategyIntelligence',
    scope,
    fetchContactStrategy,
    activeTab === 'call_counts'
  );

  // Query 2: Vendor Dispositions (only queried when activeTab === 'vendor_dispositions')
  const dispQuery = useOperationalData<ContactDispositionsData>(
    `ContactDispositionsIntelligence-${dispositionMode}`,
    { ...scope, mode: dispositionMode },
    fetchContactDispositions,
    activeTab === 'vendor_dispositions'
  );

  // Results must remain bound to the active workspace, period, mode and filters.
  // Never interpret a missing clientId field as independent proof of ownership; use the established authorised request identity and query key.
  const isDispDataCurrentClient = Boolean(
    dispQuery.data &&
    selectedClient &&
    dispQuery.data.clientId &&
    dispQuery.data.clientId === selectedClient
  );
  const dispData = isDispDataCurrentClient ? dispQuery.data : null;

  // Tab change handler: deliberate tab changes clear local inspection parameters consistently
  const handleTabChange = (newTab: ContactTab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newTab === 'call_counts') {
        next.delete('tab');
        next.delete('inspectVendor');
        next.delete('inspectGroup');
      } else {
        next.set('tab', 'vendor_dispositions');
      }
      return next;
    }, { replace: false });
  };

  // Mode change handler: resets local drawer selection without altering global vendor filter
  const handleModeChange = (newMode: DispositionReportingMode) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newMode === 'lead_status') {
        next.delete('mode');
      } else {
        next.set('mode', 'call_records');
      }
      next.delete('inspectVendor');
      next.delete('inspectGroup');
      return next;
    }, { replace: false });
  };

  // Vendor inspection selection (does NOT alter canonical vendor filter)
  const handleSelectVendor = (vendor: string | null, group?: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (vendor) {
        next.set('inspectVendor', vendor);
        if (group && group !== 'ALL') {
          next.set('inspectGroup', group);
        } else {
          next.delete('inspectGroup');
        }
      } else {
        next.delete('inspectVendor');
        next.delete('inspectGroup');
      }
      return next;
    }, { replace: false });
  };

  const handleInspectGroupChange = (group: string) => {
    if (inspectVendor) {
      handleSelectVendor(inspectVendor, group);
    }
  };

  // Explicit action to filter entire report by vendor
  const handleFilterReportByVendor = (vendor: string) => {
    setVendor(vendor);
  };

  // Refresh active query
  const refreshAll = async () => {
    if (activeTab === 'call_counts') {
      await callCountQuery.loadData(true);
    } else {
      await dispQuery.loadData(true);
    }
  };

  // Metadata generator for disposition exports
  const getDispositionExportMeta = (isTruncated = false): DispositionExportMetadata => {
    const report = dispData;
    if (!report) {
      throw new Error('Cannot export summary: No active report data available.');
    }
    if (!report.reportVersion || !report.reportVersion.trim()) {
      throw new Error('Cannot export summary: Missing taxonomyVersion in report data.');
    }
    if (!report.dateBasis || !report.dateBasis.trim()) {
      throw new Error('Cannot export summary: Missing dateBasis in report data.');
    }
    if (!report.countingGrain || !report.countingGrain.trim()) {
      throw new Error('Cannot export summary: Missing countingGrain in report data.');
    }
    if (!report.evaluatedAt || !report.evaluatedAt.trim()) {
      throw new Error('Cannot export summary: Missing evaluatedAt timestamp in report data.');
    }
    if (
      report.summary === undefined ||
      report.summary === null ||
      typeof report.summary.totalEntities !== 'number' ||
      isNaN(report.summary.totalEntities)
    ) {
      throw new Error('Cannot export summary: Missing total population in report summary.');
    }

    const resolvedClientId = report.clientId || selectedClient;
    if (!resolvedClientId || !resolvedClientId.trim()) {
      throw new Error('Cannot export summary: Missing clientId in report data.');
    }
    if (report.clientId && selectedClient && report.clientId !== selectedClient) {
      throw new Error(`Cannot export summary: Report clientId "${report.clientId}" contradicts selected clientId "${selectedClient}".`);
    }

    const resolvedTimezone = report.timezone || clientConfig?.timezone;
    if (!resolvedTimezone || !resolvedTimezone.trim()) {
      throw new Error('Cannot export summary: Missing required timezone in report context.');
    }

    const effectiveStartDate = startDate || null;
    const effectiveEndDate = endDate || null;
    validateDateBound(effectiveStartDate, 'startDate');
    validateDateBound(effectiveEndDate, 'endDate');
    validateDateOrdering(effectiveStartDate, effectiveEndDate);
    const validatedFilters = validateFilters(extractOffernetFilters(filters));

    const isCallMode = report.mode === 'call_records';
    return {
      clientId: resolvedClientId,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      filters: validatedFilters,
      timezone: resolvedTimezone.trim(),
      mode: report.mode,
      dateBasis: report.dateBasis,
      countingGrain: report.countingGrain,
      totalPopulation: report.summary.totalEntities,
      reportPopulation: report.summary.totalEntities,
      denominatorDefinition: isCallMode
        ? 'Total call events recorded during selected period'
        : 'Dialled leads within capture cohort (leads with at least one dial attempt)',
      isTruncated,
      taxonomyVersion: report.reportVersion,
      userRole: profile?.role || 'user',
      userEmail: user?.email || undefined,
      generatedAt: report.evaluatedAt,
      exportScope: 'SUMMARY_TABLE',
    };
  };

  // Call count export
  const handleExportCallCountsCsv = () => {
    if (!callCountQuery.data) return;
    const rows = [
      ['Bucket', 'Leads', 'Qualified dialled', 'RPC unknown', 'Share %', 'RPC', 'RPC / dialled %', 'Recorded sales', 'Sale / lead %', 'Recorded activations', 'Independent activation / sale %'],
      ...callCountQuery.data.attemptPerformance.map(r => [
        r.bucket,
        r.leads,
        r.dialled,
        r.rpcUnrecorded,
        r.sharePct,
        r.contacted,
        r.contactRate,
        r.sales,
        r.saleRate,
        r.activations,
        r.activationRate,
      ]),
    ];
    downloadAnalysisCsv(
      `contact_attempt_outcomes_${selectedClient}_${startDate || 'all'}_${endDate || 'all'}`,
      rows,
      {
        clientId: selectedClient,
        startDate,
        endDate,
        filters,
        validationStatus: 'NOT_VERIFIED',
        dateBasis: 'Lead intake/capture cohort', countingGrain: 'Distinct lead per exclusive recorded-call bucket',
        definitionVersion: METRIC_REGISTRY_VERSION, definitions: callCountQuery.data.methodology,
      }
    );
  };

  // Vendor summary table export
  const handleExportVendorSummaryTable = () => {
    try {
      setSummaryExportError(null);
      if (!dispData?.vendorSummaries) {
        throw new Error('Cannot export summary: No vendor summary data is available.');
      }
      const dataRows = vendorSummaryExportRows(dispData);
      downloadDispositionExportCsv(
        `vendor_dispositions_summary_${dispositionMode}_${selectedClient}`,
        dataRows,
        getDispositionExportMeta(false)
      );
    } catch (err: any) {
      setSummaryExportError(err?.message || 'Failed to export vendor summary table.');
    }
  };

  // Export the complete returned vendor comparison, independent of chart Top-N state.
  const handleExportOutcomeComparison = () => {
    try {
      setSummaryExportError(null);
      if (!dispData) throw new Error('Cannot export comparison: No active report data available.');
      downloadDispositionExportCsv(
        `vendor_outcomes_comparison_${dispositionMode}_${selectedClient}`,
        vendorOutcomeExportRows(dispData),
        { ...getDispositionExportMeta(false), exportScope: 'OUTCOME_COMPARISON' }
      );
    } catch (err: any) {
      setSummaryExportError(err?.message || 'Failed to export vendor outcome comparison.');
    }
  };

  // Result-bound vendor raw breakdown export matching exact inspected selection
  const handleExportVendorSelectedBreakdown = (params: {
    vendor: string;
    groupFilter: string;
    searchQuery: string;
    rows?: DetailedDispositionRow[];
  }) => {
    try {
      setSelectedExportError(null);
      const result = buildVendorSelectedExport({
        report: dispData,
        requestContext: {
          clientId: selectedClient,
          startDate: startDate || null,
          endDate: endDate || null,
          filters: extractOffernetFilters(filters),
          timezone: dispQuery.data?.timezone || clientConfig?.timezone,
          userRole: profile?.role,
          userEmail: user?.email,
        },
        selection: {
          vendor: params.vendor,
          groupFilter: params.groupFilter,
          searchQuery: params.searchQuery,
        },
      });

      if (result.isEmptyMatch) {
        setSelectedExportError(`No disposition records matched the filter "${params.searchQuery}". Export cancelled.`);
        return;
      }

      downloadDispositionExportCsv(result.filename, result.dataRows, result.metadata);
    } catch (err: any) {
      setSelectedExportError(err?.message || 'Failed to generate disposition export.');
    }
  };

  // Backward-compatible fallback for raw export
  const handleExportVendorRawBreakdown = (vendor: string) => {
    handleExportVendorSelectedBreakdown({
      vendor,
      groupFilter: inspectGroup || 'ALL',
      searchQuery: '',
    });
  };

  return {
    activeTab,
    dispositionMode,
    inspectVendor,
    inspectGroup,
    handleTabChange,
    handleModeChange,
    handleSelectVendor,
    handleInspectGroupChange,
    handleFilterReportByVendor,
    refreshAll,
    scope,
    filters,
    selectedClient,
    clientConfig,
    callCountData: callCountQuery.data,
    callCountLoading: callCountQuery.loading,
    callCountError: callCountQuery.error,
    dispData,
    dispLoading: dispQuery.loading || (Boolean(dispQuery.data) && !isDispDataCurrentClient),
    dispError: dispQuery.error,
    inspectorContent,
    setInspectorContent,
    summaryExportError,
    clearSummaryExportError,
    selectedExportError,
    clearSelectedExportError,
    exportError: selectedExportError || summaryExportError,
    clearExportError: () => {
      clearSummaryExportError();
      clearSelectedExportError();
    },
    handleExportCallCountsCsv,
    handleExportVendorSummaryTable,
    handleExportOutcomeComparison,
    handleExportVendorRawBreakdown,
    handleExportVendorSelectedBreakdown,
    getDispositionExportMeta,
  };
}
