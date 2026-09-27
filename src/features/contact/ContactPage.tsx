import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  PhoneCall,
  BarChart3,
  Timer,
  Search,
  ArrowRight,
} from 'lucide-react';
import ReportingScopeBar from '../../shared/reporting/ReportingScopeBar';
import InspectorHost from '../../shared/evidence/InspectorHost';
import { OperationalError } from '../../components/OperationalState';
import { formatTableNumber } from '../../lib/formatters';
import { useScopedNavigationTarget } from '../../hooks/useScopedNavigationTarget';
import { useContactModel } from './model/useContactModel';
import CallEffortReport from './components/CallEffortReport';
import VendorDispositionReport from './components/VendorDispositionReport';
import VendorOutcomeInspector from './components/VendorOutcomeInspector';

export default function ContactPage() {
  const scoped = useScopedNavigationTarget();
  const {
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
    callCountData,
    callCountLoading,
    callCountError,
    dispData,
    dispLoading,
    dispError,
    inspectorContent,
    setInspectorContent,
    summaryExportError,
    clearSummaryExportError,
    selectedExportError,
    clearSelectedExportError,
    handleExportCallCountsCsv,
    handleExportVendorSummaryTable,
    handleExportVendorRawBreakdown,
    handleExportVendorSelectedBreakdown,
  } = useContactModel();

  const handleInspectBucket = (bucket: string, leads: number) => {
    // Only allowlisted buckets produced by contact service strategy.ts
    const supportedBuckets = ['0 calls', '1 call', '2 calls', '3 calls', '4 calls', '5+ calls', 'Unrecorded'];
    const isSupported = supportedBuckets.includes(bucket);

    // Reuse existing zero-call-leads predicate for '0 calls' where definition exactly matches (m.recorded_call_count = 0).
    // For other allowlisted buckets, use 'call-effort' with the exact bucket value.
    const recordDrill = isSupported
      ? {
          drill: bucket === '0 calls' ? 'zero-call-leads' : 'call-effort',
          drillValue: bucket === '0 calls' ? undefined : bucket,
          label: `Inspect ${bucket} lead records in Lead Explorer`,
        }
      : undefined;

    setInspectorContent({
      type: 'stage',
      title: `Call Bucket: ${bucket}`,
      subtitle: 'Observed lead population for this call-attempt bucket.',
      value: `${formatTableNumber(leads)} leads`,
      unit: 'records',
      reportPath: '/contact-strategy',
      reportLabel: 'Back to contact strategy',
      recordDrill,
      detailLimitation: !isSupported ? 'Individual record drill is not available for this aggregate bucket.' : undefined,
      scope: {
        clientId: scope.clientId,
        startDate: scope.startDate,
        endDate: scope.endDate,
        filters,
      },
    });
  };

  const selectedVendorSummary = useMemo(() => {
    if (!inspectVendor || !dispData?.vendorSummaries) return null;
    return dispData.vendorSummaries.find((v) => v.vendor === inspectVendor) || null;
  }, [inspectVendor, dispData?.vendorSummaries]);

  const selectedVendorRows = useMemo(() => {
    if (!inspectVendor || !dispData?.breakdown) return [];
    return dispData.breakdown.filter((r) => r.vendor === inspectVendor);
  }, [inspectVendor, dispData?.breakdown]);

  const loading = activeTab === 'call_counts' ? callCountLoading : dispLoading;
  const error = activeTab === 'call_counts' ? callCountError : dispError;
  const hasData = activeTab === 'call_counts' ? Boolean(callCountData) : Boolean(dispData);
  const isVendorDispositionsTab = activeTab === 'vendor_dispositions';

  const handleExportCsv =
    activeTab === 'call_counts'
      ? callCountData
        ? handleExportCallCountsCsv
        : undefined
      : dispData
      ? handleExportVendorSummaryTable
      : undefined;

  return (
    <div className="space-y-6">
      {/* 1. Scope Bar */}
      <ReportingScopeBar onRefresh={refreshAll} onExportCsv={handleExportCsv} />

      {/* 2. Page Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-1 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-text-mute uppercase tracking-wider">
            <PhoneCall size={13} className="text-brand-primary" />
            <span>Contact Centre</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text-main mt-0.5">
            Contact Effort & Vendor Outcomes
          </h1>
          <p className="text-sm text-text-sec mt-1">
            Examine observed call attempts, outcome yields, and vendor disposition distributions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tab Switcher */}
          <div className="inline-flex rounded-lg border border-border-subtle p-0.5 bg-surface text-xs font-medium">
            <button
              type="button"
              onClick={() => handleTabChange('call_counts')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeTab === 'call_counts'
                  ? 'bg-brand-primary text-white shadow-2xs font-semibold'
                  : 'text-text-sec hover:text-text-main'
              }`}
            >
              <PhoneCall size={13} />
              <span>Contact effort</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('vendor_dispositions')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeTab === 'vendor_dispositions'
                  ? 'bg-brand-primary text-white shadow-2xs font-semibold'
                  : 'text-text-sec hover:text-text-main'
              }`}
            >
              <BarChart3 size={13} />
              <span>Vendor outcomes</span>
            </button>
          </div>

          <Link
            to={scoped('/speed-to-lead')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle transition-colors text-xs font-medium text-text-sec hover:text-text-main shadow-xs"
            title="Diagnose first-dial latency and response SLAs"
          >
            <Timer size={13} />
            <span>Response speed</span>
          </Link>

          <Link
            to={scoped('/lead-explorer')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle transition-colors text-xs font-medium text-text-sec hover:text-text-main shadow-xs"
            title="Inspect individual lead records"
          >
            <Search size={13} />
            <span>Inspect records</span>
          </Link>
        </div>
      </header>

      {/* Error state */}
      {error && (
        <OperationalError
          message={error}
          onRetry={() => {
            void refreshAll();
          }}
        />
      )}

      {/* Loading state */}
      {loading && !hasData && (
        <div className="p-12 text-center text-sm text-text-sec bg-surface rounded-xl border border-border-subtle animate-pulse">
          Loading contact strategy and disposition evidence…
        </div>
      )}

      {/* Main Content */}
      {activeTab === 'call_counts' && callCountData && (
        <CallEffortReport
          data={callCountData}
          onInspectBucket={handleInspectBucket}
          onExportCsv={handleExportCallCountsCsv}
        />
      )}

      {activeTab === 'vendor_dispositions' && dispData && (
        <VendorDispositionReport
          data={dispData}
          mode={dispositionMode}
          onModeChange={handleModeChange}
          onSelectVendor={handleSelectVendor}
          onFilterReportByVendor={handleFilterReportByVendor}
          onExportSummaryTable={handleExportVendorSummaryTable}
          exportError={summaryExportError}
          onClearExportError={clearSummaryExportError}
        />
      )}

      {/* Contextual navigation shortcuts */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
        <Link
          to={scoped('/speed-to-lead')}
          className="p-3.5 bg-surface hover:bg-surface-subtle border border-border-subtle rounded-xl flex items-center justify-between group transition-colors shadow-2xs"
        >
          <div>
            <span className="text-xs font-bold text-text-main block">Response speed</span>
            <span className="text-[11px] text-text-sec block mt-0.5">Diagnose latency & undialled backlog</span>
          </div>
          <ArrowRight size={14} className="text-text-mute group-hover:text-brand-primary transition-colors" />
        </Link>

        <Link
          to={scoped('/cli-performance')}
          className="p-3.5 bg-surface hover:bg-surface-subtle border border-border-subtle rounded-xl flex items-center justify-between group transition-colors shadow-2xs"
        >
          <div>
            <span className="text-xs font-bold text-text-main block">Caller ID</span>
            <span className="text-[11px] text-text-sec block mt-0.5">CLI numbers & pickup rates</span>
          </div>
          <ArrowRight size={14} className="text-text-mute group-hover:text-brand-primary transition-colors" />
        </Link>

        <Link
          to={scoped('/agent-performance')}
          className="p-3.5 bg-surface hover:bg-surface-subtle border border-border-subtle rounded-xl flex items-center justify-between group transition-colors shadow-2xs"
        >
          <div>
            <span className="text-xs font-bold text-text-main block">Agent activity</span>
            <span className="text-[11px] text-text-sec block mt-0.5">Agent call volume & contact rates</span>
          </div>
          <ArrowRight size={14} className="text-text-mute group-hover:text-brand-primary transition-colors" />
        </Link>

        <Link
          to={scoped('/temporal')}
          className="p-3.5 bg-surface hover:bg-surface-subtle border border-border-subtle rounded-xl flex items-center justify-between group transition-colors shadow-2xs"
        >
          <div>
            <span className="text-xs font-bold text-text-main block">Time & day</span>
            <span className="text-[11px] text-text-sec block mt-0.5">Capture and dialling window patterns</span>
          </div>
          <ArrowRight size={14} className="text-text-mute group-hover:text-brand-primary transition-colors" />
        </Link>
      </section>

      {/* Vendor Outcome Inspector Drawer - active only on vendor_dispositions tab with inspectVendor selection */}
      {isVendorDispositionsTab && inspectVendor && (
        <VendorOutcomeInspector
          open={Boolean(isVendorDispositionsTab && inspectVendor)}
          onClose={() => handleSelectVendor(null)}
          vendor={inspectVendor}
          mode={dispositionMode}
          loading={dispLoading}
          error={dispError}
          onRetry={refreshAll}
          capabilities={
            dispData?.capabilities
              ? {
                  leadStatusSupported: dispData.capabilities.leadStatusSupported,
                  callRecordsSupported: dispData.capabilities.callRecordsSupported,
                  unavailableReason: dispData.unavailableReason,
                }
              : undefined
          }
          vendorSummary={selectedVendorSummary}
          rawRows={selectedVendorRows}
          initialGroupFilter={inspectGroup}
          onGroupFilterChange={handleInspectGroupChange}
          onFilterReportByVendor={handleFilterReportByVendor}
          onExportVendorRaw={handleExportVendorRawBreakdown}
          onExportSelectedBreakdown={handleExportVendorSelectedBreakdown}
          reportVersion={dispData?.reportVersion}
          dateBasis={dispData?.dateBasis}
          countingGrain={dispData?.countingGrain}
          evaluatedAt={dispData?.evaluatedAt}
          timezone={dispData?.timezone}
          reportContext={
            dispData
              ? {
                  reportVersion: dispData.reportVersion,
                  dateBasis: dispData.dateBasis,
                  countingGrain: dispData.countingGrain,
                  evaluatedAt: dispData.evaluatedAt,
                  timezone: dispData.timezone,
                  clientId: dispData.clientId,
                }
              : undefined
          }
          exportError={selectedExportError}
          onClearExportError={clearSelectedExportError}
          explorerPath={scoped('/lead-explorer')}
        />
      )}

      {/* Inspector Host for Call Count Buckets */}
      <InspectorHost
        open={Boolean(inspectorContent)}
        onClose={() => setInspectorContent(null)}
        content={inspectorContent}
      />
    </div>
  );
}
