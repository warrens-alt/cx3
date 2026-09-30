import { ReportActions } from '../../shared/reporting/ReportPresentation';
import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  DollarSign,
  Info,
  PackageCheck,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import ReportingScopeBar from '../../shared/reporting/ReportingScopeBar';
import InspectorHost from '../../shared/evidence/InspectorHost';
import Modal from '../../components/Modal';
import { AuditMetadata } from '../../shared/evidence/AuditMode';
import { salesAudit, suppliedProvenance } from '../evidenceWorkspace/secondaryAudit';
import { OperationalError } from '../../components/OperationalState';
import { useSalesActivationModel } from './model/useSalesActivationModel';
import SalesOutcomeSummary from './components/SalesOutcomeSummary';
import SalesOutcomeMap from './components/SalesOutcomeMap';
import ActivationAgeing from './components/ActivationAgeing';
import SalesSegmentComparison from './components/SalesSegmentComparison';
import SalesTimingAndCoverage from './components/SalesTimingAndCoverage';
import BlcReportingPanel from './components/BlcReportingPanel';

export default function SalesActivationPage() {
  const {
    model,
    rawData,
    loading,
    error,
    refreshAll,
    scope,
    scoped,
    activeDimension,
    setActiveDimension,
    segmentSearch,
    setSegmentSearch,
    showAllSegments,
    setShowAllSegments,
    operatingControlsExpanded,
    setOperatingControlsExpanded,
    aboutOpen,
    setAboutOpen,
    inspectorContent,
    setInspectorContent,
    controls,
    handleInspectSummaryMetric,
    handleInspectAgeingBucket,
    handleInspectSegmentRow,
    handleExportActiveSegments,
    handleExportAgeing,
    handleExportCompleteWorkbook,
  } = useSalesActivationModel();

  return (
    <div className="cx-command-page cx-sales-page" aria-label="Sales & activation workspace">
      {/* Shell Reporting Scope Bar */}


      <div className="cx-command-content space-y-5">
        {/* Page Header */}
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-2 border-b border-border-subtle">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-text-sec">
              <span className="cx-command-eyebrow">Outcomes</span>
              <span className="text-text-muted" aria-hidden="true">·</span>
              <span className="font-medium text-text-muted">Sales & activation</span>
            </div>
            <h1 className="text-2xl font-bold text-text-main mt-1 tracking-tight">
              Sales & activation
            </h1>
            <p className="text-xs text-text-sec mt-1 max-w-2xl leading-relaxed">
              Recorded outcomes for the selected operational intake cohort. Understand confirmed sales, independent activation fulfilment, post-sale queue ageing, and source-recorded revenue.
            </p>
          </div>
          <ReportActions aboutContent={<div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <section className="space-y-1">
              <h3 className="font-semibold text-slate-900">Operational Cohort Scope</h3>
              <p>
                The reporting period filters by <strong>lead intake date</strong> (when the lead was fetched/ingested), not the event timestamp of the subsequent sale or activation. This cohort-based structure allows accurate end-to-end conversion tracking for a cohort of leads, avoiding survival bias.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-slate-900">Independent Counts & Ratios</h3>
              <p>
                <strong>Recorded sales</strong> and <strong>Recorded activations</strong> are counted independently within the selected intake cohort. The displayed activation rate is an <em>independent-count ratio</em> (<code>activations / sales</code>), not a conditional transition assumption. Every activation is not assumed to have originated from a sale recorded in the exact same grain.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-slate-900">Sales Without Recorded Activation</h3>
              <p>
                Calculated strictly from the observed population where <code>is_sale AND NOT is_activated</code> via the non-overlapping completed-day ageing queue (0–3d, 4–7d, 8–14d, 15–30d, 30d+, and future anomalies). It is <strong>never</strong> calculated as a naive subtraction of totalSales − totalActivations. Missing data remains unavailable.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-slate-900">Source-Recorded Revenue Interpretation</h3>
              <p>
                Recorded revenue represents the sum of available source values, including explicit real zero amounts. Sales missing revenue are tracked separately and not defaulted to zero. Source-recorded revenue does not certify billable, invoiced, collected, or earned revenue.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-slate-900">Withheld Maturation Curve</h3>
              <p>
                Maturation curves require an independently validated event-level join model. To preserve evidentiary integrity, ConversionX deliberately withholds synthetic extrapolation or unverified maturation curves until event-level activation models are certified.
              </p>
            </section>
          </div>}>
            <Link
              to={scoped('/commercial')}
              className="cx-button-secondary text-xs flex items-center gap-1 py-1.5 px-3"
              title="Navigate to Spend & commercial workspace"
            >
              <span>Spend & commercial</span>
              <ArrowRight size={13} />
            </Link>

          </ReportActions>
        </header>
      <ReportingScopeBar
        onRefresh={refreshAll}
        onExportCsv={handleExportCompleteWorkbook}
      />

        {/* Operational Context Sub-Bar */}
        <div className="bg-surface-subtle border border-border rounded-lg p-2.5 px-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-text-sec">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-text-sec">Date basis:</span>
              <span className="text-text-main font-mono text-[11px]">
                Operational intake cohort (lead intake date)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-text-sec">Timezone:</span>
              <span className="text-text-main font-mono text-[11px]">
                {model?.methodology.timezone || 'Workspace standard (UTC)'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-text-sec">Currency:</span>
              <span className="text-text-main font-mono text-[11px]">
                {model?.summary.currency || 'Not specified'}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-text-mute">
            Intake window filtering: does not truncate delayed post-sale activation events
          </div>
        </div>

        {/* Independent source evidence remains available when the cohort query is unavailable. */}
        <BlcReportingPanel />

        {/* Error State */}
        {error && (
          <div className="cx-command-error flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && !model && (
          <div className="cx-command-loading py-12 text-center text-sm text-text-sec flex flex-col items-center justify-center gap-3">
            <div className="cx-command-spinner w-6 h-6 border-2 border-action border-t-transparent rounded-full animate-spin" />
            <span>Loading recorded sales and activation outcomes…</span>
          </div>
        )}

        {/* Content Body */}
        {model && (
          <div className="space-y-6">
            {/* 1. Principal Outcomes Summary */}
            <SalesOutcomeSummary
              model={model}
              onInspect={handleInspectSummaryMetric}
            />

            {/* 2. Outcome evidence map */}
            <AuditMetadata dateBasis={rawData?.metadata?.dateBasis || "Lead intake cohort"} validationStatus={suppliedProvenance(rawData).validationStatus} />
            <SalesOutcomeMap
              model={model}
              onInspect={handleInspectSummaryMetric}
            />

            {/* 3. Unified Activation Ageing Region */}
            <ActivationAgeing
              model={model}
              onInspectBucket={handleInspectAgeingBucket}
              onExportAgeing={handleExportAgeing}
            />

            {/* 4. Segment Outcomes (Vendor / Source / Grade) */}
            <SalesSegmentComparison
              model={model}
              activeDimension={activeDimension}
              onSelectDimension={setActiveDimension}
              search={segmentSearch}
              onSearchChange={setSegmentSearch}
              showAllInChart={showAllSegments}
              onToggleShowAllInChart={() => setShowAllSegments((prev) => !prev)}
              onInspectRow={handleInspectSegmentRow}
              onExportSegment={handleExportActiveSegments}
            />

            {/* 5. Timing, Maturation & Operating Controls */}
            <SalesTimingAndCoverage
              model={model}
              operatingControlsExpanded={operatingControlsExpanded}
              onToggleOperatingControls={() => setOperatingControlsExpanded((prev) => !prev)}
              controlsData={controls.data}
              controlsLoading={controls.isLoading}
              controlsError={controls.error ? (controls.error as Error).message : null}
            />

            {/* 6. Connected Navigation Shortcuts */}
            <section className="cx-command-shortcuts grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <Link
                to={scoped('/commercial')}
                className="enterprise-card p-3 flex items-center justify-between hover:bg-surface-subtle transition-colors rounded-lg border border-border"
              >
                <div className="flex items-center gap-2.5">
                  <DollarSign size={18} className="text-purple-600" />
                  <div>
                    <strong className="text-xs font-semibold text-text-main block">Spend & commercial</strong>
                    <small className="text-[11px] text-text-sec">Relate observed media spend to recorded outcomes</small>
                  </div>
                </div>
                <ArrowRight size={14} className="text-text-mute" />
              </Link>

              <Link
                to={scoped('/funnel')}
                className="enterprise-card p-3 flex items-center justify-between hover:bg-surface-subtle transition-colors rounded-lg border border-border"
              >
                <div className="flex items-center gap-2.5">
                  <PackageCheck size={18} className="text-brand-primary" />
                  <div>
                    <strong className="text-xs font-semibold text-text-main block">Funnel progression</strong>
                    <small className="text-[11px] text-text-sec">Trace progression dropoff before sale and activation</small>
                  </div>
                </div>
                <ArrowRight size={14} className="text-text-mute" />
              </Link>

              <Link
                to={scoped('/lead-explorer')}
                className="enterprise-card p-3 flex items-center justify-between hover:bg-surface-subtle transition-colors rounded-lg border border-border"
              >
                <div className="flex items-center gap-2.5">
                  <Search size={18} className="text-semantic-pos" />
                  <div>
                    <strong className="text-xs font-semibold text-text-main block">Lead explorer</strong>
                    <small className="text-[11px] text-text-sec">Inspect individual authorized lead records and timelines</small>
                  </div>
                </div>
                <ArrowRight size={14} className="text-text-mute" />
              </Link>
            </section>
          </div>
        )}
      </div>

      {/* Inspector Host for Evidence Drawer */}
      <InspectorHost
        open={Boolean(inspectorContent)}
        onClose={() => setInspectorContent(null)}
        content={salesAudit(inspectorContent, rawData)}
      />
    </div>
  );
}
