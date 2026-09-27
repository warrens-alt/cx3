import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  DollarSign,
  Download,
  Info,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import ReportingScopeBar from '../../shared/reporting/ReportingScopeBar';
import InspectorHost from '../../shared/evidence/InspectorHost';
import Modal from '../../components/Modal';
import { OperationalError } from '../../components/OperationalState';
import { useSalesActivationModel } from './model/useSalesActivationModel';
import SalesOutcomeSummary from './components/SalesOutcomeSummary';
import ActivationAgeing from './components/ActivationAgeing';
import SalesSegmentComparison from './components/SalesSegmentComparison';
import SalesTimingAndCoverage from './components/SalesTimingAndCoverage';

export default function SalesActivationPage() {
  const {
    model,
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
    <div className="cx-command-page" aria-label="Sales & activation workspace">
      {/* Shell Reporting Scope Bar */}
      <ReportingScopeBar
        onRefresh={refreshAll}
        onExportCsv={handleExportCompleteWorkbook}
      />

      <div className="cx-command-content space-y-5">
        {/* Page Header */}
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-2 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                Outcomes
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500">Sales & activation</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              Sales & activation
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Recorded outcomes for the selected operational intake cohort. Understand confirmed sales, independent activation fulfilment, post-sale queue ageing, and source-recorded revenue.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start flex-wrap">
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              className="cx-button-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
              title="Methodology, independent count semantics and limitations"
            >
              <Info size={14} />
              <span>About methodology</span>
            </button>

            <button
              type="button"
              onClick={refreshAll}
              disabled={loading}
              className="cx-button-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
              title="Refresh sales & activation outcomes"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExportCompleteWorkbook}
              disabled={!model}
              className="cx-button-primary text-xs flex items-center gap-1.5 py-1.5 px-3.5"
              title="Download complete sales & activation outcomes CSV"
            >
              <Download size={13} />
              <span>Export outcomes</span>
            </button>

            <Link
              to={scoped('/commercial')}
              className="cx-button-secondary text-xs flex items-center gap-1 py-1.5 px-3"
              title="Navigate to Spend & commercial workspace"
            >
              <span>Spend & commercial</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </header>

        {/* Operational Context Sub-Bar */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 px-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">Date basis:</span>
              <span className="text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded font-mono text-[11px]">
                Operational intake cohort (lead intake date)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">Timezone:</span>
              <span className="text-slate-900 font-mono text-[11px]">
                {model?.methodology.timezone || 'Workspace standard (UTC)'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">Currency:</span>
              <span className="text-slate-900 font-mono text-[11px]">
                {model?.summary.currency || 'Not specified'}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500">
            Intake window filtering: does not truncate delayed post-sale activation events
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="cx-command-error flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && !model && (
          <div className="cx-command-loading py-12 text-center text-sm text-slate-500 flex flex-col items-center justify-center gap-3">
            <div className="cx-command-spinner w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
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

            {/* 2. Unified Activation Ageing Region */}
            <ActivationAgeing
              model={model}
              onInspectBucket={handleInspectAgeingBucket}
              onExportAgeing={handleExportAgeing}
            />

            {/* 3. Segment Outcomes (Vendor / Source / Grade) */}
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

            {/* 4. Timing, Maturation & Operating Controls */}
            <SalesTimingAndCoverage
              model={model}
              operatingControlsExpanded={operatingControlsExpanded}
              onToggleOperatingControls={() => setOperatingControlsExpanded((prev) => !prev)}
              controlsData={controls.data}
              controlsLoading={controls.isLoading}
              controlsError={controls.error ? (controls.error as Error).message : null}
            />

            {/* 5. Connected Navigation Shortcuts */}
            <section className="cx-command-shortcuts grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <Link
                to={scoped('/commercial')}
                className="enterprise-card p-3 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-lg border border-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <DollarSign size={18} className="text-purple-600" />
                  <div>
                    <strong className="text-xs font-semibold text-slate-900 block">Spend & commercial</strong>
                    <small className="text-[11px] text-slate-500">Relate observed media spend to recorded outcomes</small>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400" />
              </Link>

              <Link
                to={scoped('/funnel')}
                className="enterprise-card p-3 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-lg border border-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <PackageCheck size={18} className="text-indigo-600" />
                  <div>
                    <strong className="text-xs font-semibold text-slate-900 block">Funnel progression</strong>
                    <small className="text-[11px] text-slate-500">Trace progression dropoff before sale and activation</small>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400" />
              </Link>

              <Link
                to={scoped('/lead-explorer')}
                className="enterprise-card p-3 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-lg border border-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <Search size={18} className="text-emerald-600" />
                  <div>
                    <strong className="text-xs font-semibold text-slate-900 block">Lead explorer</strong>
                    <small className="text-[11px] text-slate-500">Inspect individual authorized lead records and timelines</small>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400" />
              </Link>
            </section>
          </div>
        )}
      </div>

      {/* Inspector Host for Evidence Drawer */}
      <InspectorHost
        open={Boolean(inspectorContent)}
        onClose={() => setInspectorContent(null)}
        content={inspectorContent}
      />

      {/* About & Methodology Modal */}
      <Modal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        label="About Sales & Activation Analytics"
      >
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <BadgeCheck size={18} className="text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                Sales & Activation Methodology & Governance
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setAboutOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              aria-label="Close about dialog"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
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
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => setAboutOpen(false)}
              className="cx-button-primary text-xs py-1.5 px-4"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
