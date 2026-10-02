import AnalyticsPageLayout from '../../components/AnalyticsPageLayout';
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
import { OperationalError, ReportSkeleton } from '../../components/OperationalState';
import { useSalesActivationModel } from './model/useSalesActivationModel';
import SalesOutcomeSummary from './components/SalesOutcomeSummary';
import SalesOutcomeMap from './components/SalesOutcomeMap';
import ActivationAgeing from './components/ActivationAgeing';
import SalesSegmentComparison from './components/SalesSegmentComparison';
import SalesTimingAndCoverage from './components/SalesTimingAndCoverage';
import BlcReportingPanel from './components/BlcReportingPanel';
import { salesVisualAudit } from '../evidenceWorkspace/metricVisualAudit';

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
    <AnalyticsPageLayout className="cx-sales-page" ariaLabel="Sales & activation workspace" title="Sales & activation" description={<>Recorded sales, activation evidence and post-sale ageing.</>} actions={<ReportActions aboutContent={<div className="space-y-3 text-xs text-text-sec leading-relaxed">
            <section className="space-y-1">
              <h3 className="font-semibold text-text-main">Operational Cohort Scope</h3>
              <p>
                The reporting period filters by <strong>lead intake date</strong> (when the lead was fetched/ingested), not the event timestamp of the subsequent sale or activation. This cohort-based structure allows accurate end-to-end conversion tracking for a cohort of leads, avoiding survival bias.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-text-main">Independent Counts & Ratios</h3>
              <p>
                <strong>Recorded sales</strong> and <strong>Recorded activations</strong> are counted independently within the selected intake cohort. The displayed activation rate is an <em>independent-count ratio</em> (<code>activations / sales</code>), not a conditional transition assumption. Every activation is not assumed to have originated from a sale recorded in the exact same grain.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-text-main">Sales Without Recorded Activation</h3>
              <p>
                Calculated strictly from the observed population where <code>is_sale AND NOT is_activated</code> via the non-overlapping completed-day ageing queue (0–3d, 4–7d, 8–14d, 15–30d, 30d+, and future anomalies). It is <strong>never</strong> calculated as a naive subtraction of totalSales − totalActivations. Missing data remains unavailable.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-text-main">Source-Recorded Revenue Interpretation</h3>
              <p>
                Recorded revenue represents the sum of available source values, including explicit real zero amounts. Sales missing revenue are tracked separately and not defaulted to zero. Source-recorded revenue does not certify billable, invoiced, collected, or earned revenue.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-text-main">Withheld Maturation Curve</h3>
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

          </ReportActions>} scope={<ReportingScopeBar
        onRefresh={refreshAll}
        onExportCsv={handleExportCompleteWorkbook}
      />}>
      {/* Shell Reporting Scope Bar */}

        {/* Page Header */}

        {/* Operational Context Sub-Bar */}
        <details className="cx-sales-scope-detail"><summary>Intake cohort · {model?.summary.currency || 'Currency unavailable'}</summary>
          <p>The reporting period selects lead intake dates; delayed sales and activations stay within that cohort.</p>
          <dl><div><dt>Date basis</dt><dd>Operational intake cohort</dd></div><div><dt>Timezone</dt><dd>{model?.methodology.timezone || 'Workspace standard (UTC)'}</dd></div><div><dt>Currency</dt><dd>{model?.summary.currency || 'Not specified'}</dd></div></dl>
        </details>

        {/* Independent source evidence remains available when the cohort query is unavailable. */}


        {/* Error State */}
        {error && (
          <div className="cx-command-error flex items-center gap-2 p-3 bg-negative-bg border border-negative rounded-lg text-negative text-xs">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && !model && (
          <ReportSkeleton label="Loading recorded sales and activation outcomes" metricCount={4} />
        )}

        {/* Content Body */}
        {model && (
          <div className="space-y-6">
            {/* 1. Principal Outcomes Summary */}
            <SalesOutcomeSummary
              contextOnly
              model={model}
              onInspect={handleInspectSummaryMetric}
            />

            {/* 2. Outcome evidence map */}
            <AuditMetadata dateBasis={rawData?.metadata?.dateBasis || "Lead intake cohort"} validationStatus={suppliedProvenance(rawData).validationStatus} />
            <SalesOutcomeMap
              model={model}
              onInspect={handleInspectSummaryMetric}
              onInspectActivationRatio={() => handleInspectSummaryMetric('activationRatio')}
            />

            {/* 3. Unified Activation Ageing Region */}
            <ActivationAgeing
              model={model}
              onInspectBucket={handleInspectAgeingBucket}
              onExportAgeing={handleExportAgeing}
            />

            {/* 4. Segment Outcomes (Vendor / Source / Grade) */}
            <SalesSegmentComparison
              key={JSON.stringify(scope)}
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
            <details className="cx-evidence-disclosure"><summary>View timing, maturation and operating evidence</summary>
            <SalesTimingAndCoverage
              model={model}
              operatingControlsExpanded={operatingControlsExpanded}
              onToggleOperatingControls={() => setOperatingControlsExpanded((prev) => !prev)}
              controlsData={controls.data}
              controlsLoading={controls.isLoading}
              controlsError={controls.error ? (controls.error as Error).message : null}
            />

            </details>
            {/* 6. Connected Navigation Shortcuts */}
            <section className="cx-command-shortcuts cx-sales-shortcuts">
              <Link
                to={scoped('/commercial')}
                className="cx-sales-shortcut"
              >
                <div className="flex items-center gap-2.5">
                  <DollarSign size={18} className="text-text-sec" />
                  <div>
                    <strong className="text-xs font-semibold text-text-main block">Spend & commercial</strong>
                    <small className="text-[11px] text-text-sec">Relate observed media spend to recorded outcomes</small>
                  </div>
                </div>
                <ArrowRight size={14} className="text-text-mute" />
              </Link>

              <Link
                to={scoped('/funnel')}
                className="cx-sales-shortcut"
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
                className="cx-sales-shortcut"
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

      <details className="cx-evidence-disclosure" open={!model}><summary>View independent BLC source evidence</summary><BlcReportingPanel /></details>

      {/* Inspector Host for Evidence Drawer */}
      <InspectorHost
        open={Boolean(inspectorContent)}
        onClose={() => setInspectorContent(null)}
        content={salesVisualAudit(salesAudit(inspectorContent, rawData), rawData)}
      />
    </AnalyticsPageLayout>
  );
}
