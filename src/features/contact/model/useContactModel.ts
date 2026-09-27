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
  type ApprovedDispositionGroup,
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

  // Mode change handler
  const handleModeChange = (newMode: DispositionReportingMode) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newMode === 'lead_status') {
        next.delete('mode');
      } else {
        next.set('mode', 'call_records');
      }
      // Clear drawer selection on mode switch
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
    return {
      clientId: selectedClient,
      startDate: startDate || null,
      endDate: endDate || null,
      filters: extractOffernetFilters(filters),
      mode: dispositionMode,
      dateBasis: isCallMode ? 'call_event_timestamp' : 'lead_capture_cohort',
      countingGrain: isCallMode ? 'call_event' : 'lead_record',
      totalPopulation: dispQuery.data?.summary.totalEntities || 0,
      denominatorDefinition: isCallMode
        ? 'Total verified call attempts in selected period'
        : 'Dialled leads within capture cohort (leads with at least one dial attempt)',
      isTruncated,
      taxonomyVersion: DISPOSITION_REPORT_VERSION,
      userRole: profile?.role || 'user',
      userEmail: user?.email || undefined,
      generatedAt: new Date().toISOString(),
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

  // Raw breakdown export for single vendor
  const handleExportVendorRawBreakdown = (vendor: string) => {
    const rows = dispQuery.data?.breakdown.filter(r => r.vendor === vendor) || [];
    const isCallMode = dispositionMode === 'call_records';
    const headers = [
      'Vendor',
      'Raw Disposition Code',
      'Raw Description',
      'Approved Outcome Group',
      'Count',
      '% of Vendor Base',
      'Mapping Status',
      'Right-Party Contact (RPC)',
      'Reported Sales',
      'Callbacks Requested',
      ...(isCallMode ? ['Avg Duration (sec)', 'Valid Duration Count', 'Latest Observation'] : []),
    ];
    const dataRows = [
      headers,
      ...rows.map(r => [
        r.vendor,
        r.rawDisposition,
        r.rawDescription,
        r.approvedGroupLabel,
        r.count,
        r.percentOfBase !== null ? `${r.percentOfBase}%` : '—',
        r.mappingStatus || (r.isUnmapped ? 'UNMAPPED' : 'APPROVED'),
        r.rpcCount,
        r.saleCount,
        r.callbackCount,
        ...(isCallMode ? [r.avgDurationSec ?? '—', r.validDurationCount ?? '—', r.latestObservation ?? '—'] : []),
      ]),
    ];
    downloadDispositionExportCsv(
      `raw_dispositions_${vendor}_${dispositionMode}_${selectedClient}`,
      dataRows,
      getDispositionExportMeta(false)
    );
  };

  return {
    activeTab,
    dispositionMode,
    inspectVendor,
    inspectGroup,
    handleTabChange,
    handleModeChange,
    handleSelectVendor,
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
    getDispositionExportMeta,
  };
}
