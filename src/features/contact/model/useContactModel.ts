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
  type DispositionExportMetadata,
} from '../../../lib/analysisExport';
import { buildVendorSelectedExport } from './dispositionSelection';
import type { InspectorContent } from '../../../shared/evidence/InspectorHost';

export type ContactTab = 'call_counts' | 'vendor_dispositions';

export function useContactModel() {
  const { selectedClient, clientConfig } = useClient();
  const { user, profile } = useAuth();
  const { startDate, endDate, filters, setVendor } = useFilters();
  const [searchParams, setSearchParams] = useSearchParams();

  // Authoritative URL state
  const tabParam = searchParams.get('tab');
  const activeTab: ContactTab = tabParam === 'vendor_dispositions' ? 'vendor_dispositions' : 'call_counts';

  const modeParam = searchParams.get('mode');
  const dispositionMode: DispositionReportingMode = modeParam === 'call_records' ? 'call_records' : 'lead_status';

  // Report-local inspection selections, separate from global vendor filter
  const inspectVendor = searchParams.get('inspectVendor') || null;
  const inspectGroup = searchParams.get('inspectGroup') || 'ALL';

  // Inspector host state for call effort bucket inspections
  const [inspectorContent, setInspectorContent] = useState<InspectorContent | null>(null);

  // Export error state for accessible feedback
  const [exportError, setExportError] = useState<string | null>(null);
  const clearExportError = () => setExportError(null);

  // Invalidate inspector when scope changes
  useEffect(() => {
    setInspectorContent(null);
    setExportError(null);
  }, [selectedClient, startDate, endDate, filters]);

  // Reset drawer selection on client changes without modifying global filters
  useEffect(() => {
    if (inspectVendor) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('inspectVendor');
        next.delete('inspectGroup');
        return next;
      }, { replace: true });
    }
    setExportError(null);
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

  // Tab change handler
  const handleTabChange = (newTab: ContactTab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newTab === 'call_counts') {
        next.delete('tab');
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
    const report = dispQuery.data;
    if (!report) {
      throw new Error('Cannot export summary: Disposition report data is not available.');
    }
    if (!report.reportVersion || !report.reportVersion.trim()) {
      throw new Error('Cannot export summary: Missing reportVersion in report data.');
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

    const isCallMode = report.mode === 'call_records';
    return {
      clientId: report.clientId || selectedClient || 'unknown_tenant',
      startDate: startDate || null,
      endDate: endDate || null,
      filters: extractOffernetFilters(filters),
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
      ['Bucket', 'Leads', 'Share %', 'RPC', 'RPC / dialled %', 'Sales', 'Sale / lead %', 'Activations', 'Activation / sale %'],
      ...callCountQuery.data.attemptPerformance.map(r => [
        r.bucket,
        r.leads,
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
      }
    );
  };

  // Vendor summary table export
  const handleExportVendorSummaryTable = () => {
    try {
      setExportError(null);
      if (!dispQuery.data?.vendorSummaries) {
        throw new Error('Cannot export summary: No vendor summary data is available.');
      }
      const isCallMode = dispositionMode === 'call_records';
      const headers = [
        'Vendor',
        isCallMode ? 'Total Calls' : 'Total Leads',
        isCallMode ? 'Dialled Calls' : 'Dialled Leads',
        'Disposition Coverage %',
        'Mapping Coverage %',
        'RPC Count',
        'Sale Count',
        'Callback Count',
      ];
      const dataRows = [
        headers,
        ...dispQuery.data.vendorSummaries.map(v => [
          v.vendor,
          v.totalPopulation,
          v.dialledCount,
          v.dispositionCoveragePct !== null ? `${v.dispositionCoveragePct}%` : '—',
          v.mappingCoveragePct !== null ? `${v.mappingCoveragePct}%` : '—',
          v.rpcCount,
          v.saleCount,
          v.callbackCount,
        ]),
      ];
      downloadDispositionExportCsv(
        `vendor_dispositions_summary_${dispositionMode}_${selectedClient}`,
        dataRows,
        getDispositionExportMeta(false)
      );
    } catch (err: any) {
      setExportError(err?.message || 'Failed to export vendor summary table.');
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
      setExportError(null);
      const result = buildVendorSelectedExport({
        report: dispQuery.data,
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
        setExportError(`No disposition records matched the filter "${params.searchQuery}". Export cancelled.`);
        return;
      }

      downloadDispositionExportCsv(result.filename, result.dataRows, result.metadata);
    } catch (err: any) {
      setExportError(err?.message || 'Failed to generate disposition export.');
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
    dispData: dispQuery.data,
    dispLoading: dispQuery.loading,
    dispError: dispQuery.error,
    inspectorContent,
    setInspectorContent,
    exportError,
    clearExportError,
    handleExportCallCountsCsv,
    handleExportVendorSummaryTable,
    handleExportVendorRawBreakdown,
    handleExportVendorSelectedBreakdown,
    getDispositionExportMeta,
  };
}
