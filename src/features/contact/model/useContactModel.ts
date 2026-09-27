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

  // Invalidate inspector when scope changes
  useEffect(() => {
    setInspectorContent(null);
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
    const isCallMode = dispositionMode === 'call_records';
    const report = dispQuery.data;
    return {
      clientId: selectedClient,
      startDate: startDate || null,
      endDate: endDate || null,
      filters: extractOffernetFilters(filters),
      mode: dispositionMode,
      dateBasis: report?.dateBasis || (isCallMode ? 'call_event_timestamp' : 'lead_capture_cohort'),
      countingGrain: report?.countingGrain || (isCallMode ? 'call_event' : 'lead_record'),
      totalPopulation: report?.summary.totalEntities || 0,
      denominatorDefinition: isCallMode
        ? 'Total verified call attempts in selected period'
        : 'Dialled leads within capture cohort (leads with at least one dial attempt)',
      isTruncated,
      taxonomyVersion: report?.reportVersion || DISPOSITION_REPORT_VERSION,
      userRole: profile?.role || 'user',
      userEmail: user?.email || undefined,
      generatedAt: report?.evaluatedAt || new Date().toISOString(),
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
    if (!dispQuery.data?.vendorSummaries) return;
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
  };

  // Result-bound vendor raw breakdown export matching exact inspected filteredRows
  const handleExportVendorSelectedBreakdown = (params: {
    vendor: string;
    groupFilter: string;
    searchQuery: string;
    rows: DetailedDispositionRow[];
  }) => {
    const { vendor, groupFilter, searchQuery, rows } = params;
    const isCallMode = dispositionMode === 'call_records';
    const report = dispQuery.data;

    // Group totals for this vendor from report breakdown
    const allVendorRows = report?.breakdown.filter(r => r.vendor === vendor) || [];
    const groupTotals = new Map<string, number>();
    for (const r of allVendorRows) {
      groupTotals.set(r.approvedGroup, (groupTotals.get(r.approvedGroup) || 0) + r.count);
    }

    const headers = [
      'Vendor',
      'Raw Disposition Code',
      'Description',
      'Approved Outcome Group',
      'Volume',
      'Share of Group %',
      'Share of Vendor %',
      'Mapping Status',
      'RPC',
      'Sales',
      'Callbacks',
      ...(isCallMode ? ['Avg Duration (sec)', 'Valid Duration Count', 'Latest Observation'] : []),
    ];

    const dataRows = [
      headers,
      ...rows.map(r => {
        const grpTotal = groupTotals.get(r.approvedGroup) || 0;
        const shareOfGrp = grpTotal > 0 ? (r.count / grpTotal) * 100 : null;
        const shareOfVendor = r.percentOfBase;
        return [
          r.vendor,
          r.rawDisposition,
          r.rawDescription || '—',
          r.approvedGroupLabel,
          r.count,
          shareOfGrp !== null ? `${shareOfGrp.toFixed(1)}%` : '—',
          shareOfVendor !== null ? `${shareOfVendor}%` : '—',
          r.isUnmapped || r.approvedGroup === 'UNMAPPED' ? 'UNMAPPED' : (r.mappingStatus || 'APPROVED'),
          r.rpcCount,
          r.saleCount,
          r.callbackCount,
          ...(isCallMode ? [r.avgDurationSec ?? '—', r.validDurationCount ?? '—', r.latestObservation ?? '—'] : []),
        ];
      }),
    ];

    const totalVolume = rows.reduce((sum, r) => sum + r.count, 0);
    const groupPart = groupFilter && groupFilter !== 'ALL' ? `_${groupFilter.toLowerCase()}` : '';
    const searchPart = searchQuery.trim() ? '_filtered' : '';
    const filename = `raw_dispositions_${vendor}${groupPart}${searchPart}_${dispositionMode}_${selectedClient}`;

    const metadata: DispositionExportMetadata = {
      clientId: selectedClient,
      startDate: startDate || null,
      endDate: endDate || null,
      filters: extractOffernetFilters(filters),
      mode: dispositionMode,
      dateBasis: report?.dateBasis || (isCallMode ? 'call_event_timestamp' : 'lead_capture_cohort'),
      countingGrain: report?.countingGrain || (isCallMode ? 'call_event' : 'lead_record'),
      totalPopulation: totalVolume,
      denominatorDefinition: isCallMode
        ? `Call attempts recorded for vendor ${vendor}`
        : `Dialled leads recorded for vendor ${vendor}`,
      isTruncated: false,
      taxonomyVersion: report?.reportVersion || DISPOSITION_REPORT_VERSION,
      userRole: profile?.role || 'user',
      userEmail: user?.email || undefined,
      generatedAt: report?.evaluatedAt || new Date().toISOString(),
      inspectedVendor: vendor,
      activeGroupFilter: groupFilter,
      searchQuery: searchQuery || null,
      returnedRowCount: rows.length,
    };

    downloadDispositionExportCsv(filename, dataRows, metadata);
  };

  // Backward-compatible fallback for raw export
  const handleExportVendorRawBreakdown = (vendor: string) => {
    const rows = dispQuery.data?.breakdown.filter(r => r.vendor === vendor) || [];
    handleExportVendorSelectedBreakdown({
      vendor,
      groupFilter: inspectGroup || 'ALL',
      searchQuery: '',
      rows,
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
    handleExportCallCountsCsv,
    handleExportVendorSummaryTable,
    handleExportVendorRawBreakdown,
    handleExportVendorSelectedBreakdown,
    getDispositionExportMeta,
  };
}
