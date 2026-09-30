import { ReportActions } from '../../shared/reporting/ReportPresentation';
import '../../styles/journeyContactVisuals.css';
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  GitFork,
  Search,
  Timer,
  ChevronDown,
  Layers,
  FileCheck2,
  Megaphone,
  ListChecks,
  Route as RouteIcon,
  BarChart3,
} from 'lucide-react';
import ReportingScopeBar from '../../shared/reporting/ReportingScopeBar';
import InspectorHost from '../../shared/evidence/InspectorHost';
import RootCauseDrawer from '../../components/RootCauseDrawer';
import UnifiedMetricCard from '../../components/UnifiedMetricCard';
import { OperationalError } from '../../components/OperationalState';
import { formatPercent, formatRatioPercent, formatTableNumber } from '../../lib/formatters';
import { MatchedPeriodPanel } from '../../components/LifecycleDiagnostics';
import { SlaBandsPanel } from '../../components/OfferNetControlPanels';
import { useJourneyModel } from './model/useJourneyModel';
import { adaptJourneyData } from './model/journeyAdapter';
import JourneyProgression, { type StageItem } from './components/JourneyProgression';
import JourneySegments, { type JourneyDimension } from './components/JourneySegments';
import JourneyTiming from './components/JourneyTiming';
import type { LifecycleSegment } from '../../../contracts/lifecycleAnalytics';
import type { RootCauseData } from '../../lib/offernetClient';

export default function JourneyPage() {
  const {
    data,
    loading,
    error,
    refreshAll,
    scope,
    filters,
    scoped,
    controls,
    controlsExpanded,
    setControlsExpanded,
    matchedPeriodExpanded,
    setMatchedPeriodExpanded,
    inspectorContent,
    setInspectorContent,
    handleExportCsv,
  } = useJourneyModel();

  // Authoritative journey display adapter separating stage totals from transition intersections
  const { headline, stages, transitions } = useMemo(() => adaptJourneyData(data), [data]);
  const [rootMetric, setRootMetric] = useState<RootCauseData['metric']['id'] | null>(null);

  const handleInspectStage = (stage: StageItem) => {
    const isSupported = ['fetched', 'delivered', 'dialled', 'rpc', 'sales', 'activated'].includes(stage.key);
    setInspectorContent({
      type: 'stage',
      title: `${stage.name} Stage`,
      subtitle: 'Observed lifecycle population across the selected reporting period.',
      value: stage.volume !== null ? `${formatTableNumber(stage.volume)} leads` : '—',
      unit: 'records',
      reportPath: '/funnel',
      reportLabel: 'Open deep funnel analysis',
      recordDrill: isSupported ? {
        drill: 'funnel-stage',
        drillValue: stage.key,
        label: `Inspect ${stage.name} lead records in Lead Explorer`,
      } : undefined,
      detailLimitation: !isSupported ? `Individual record drill is not supported for ${stage.name}.` : undefined,
      scope: {
        clientId: scope.clientId,
        startDate: scope.startDate,
        endDate: scope.endDate,
        filters,
      },
    });
  };

  const handleInspectTransition = (from: string, to: string, lost: number, lossKey: string) => {
    const isSupported = [
      'fetched-to-delivered',
      'delivered-to-dialled',
      'dialled-to-rpc',
      'rpc-to-sales',
      'sales-to-activated',
    ].includes(lossKey);

    setInspectorContent({
      type: 'stage',
      title: `${from} → ${to} Transition Dropoff`,
      subtitle: `Leads observed in ${from} that did not progress to ${to}.`,
      value: lost !== null && lost !== undefined ? (lost > 0 ? `−${formatTableNumber(lost)} leads` : '0 leads') : '—',
      unit: 'dropoff records',
      reportPath: '/funnel',
      reportLabel: 'Open deep funnel analysis',
      recordDrill: isSupported && lost > 0 ? {
        drill: 'funnel-loss',
        drillValue: lossKey,
        label: `Inspect ${from} → ${to} loss records in Lead Explorer`,
      } : undefined,
      detailLimitation: !isSupported ? 'Loss record drill is not supported for this transition.' : undefined,
      scope: {
        clientId: scope.clientId,
        startDate: scope.startDate,
        endDate: scope.endDate,
        filters,
      },
    });
  };

  const handleInspectSegment = (segment: LifecycleSegment, dimension: JourneyDimension) => {
    setInspectorContent({
      type: 'segment',
      title: `${dimension.charAt(0).toUpperCase() + dimension.slice(1)}: ${segment.key}`,
      subtitle: 'Observed outcome rates and stage conversion in current reporting scope.',
      value: `${formatTableNumber(segment.fetched)} leads`,
      unit: 'records',
      numeratorCount: segment.sales,
      numeratorLabel: 'Recorded sales (sales count)',
      denominatorCount: segment.fetched,
      denominatorLabel: 'Fetched leads (denominator)',
      reportPath: dimension === 'grade' ? '/funnel' : '/vendor-quality',
      reportLabel: `Open complete ${dimension} breakdown`,
      recordDrill: {
        drill: 'lifecycle-segment',
        drillValue: `${dimension}:${segment.key}`,
        label: `Inspect ${segment.key} lead records in Lead Explorer`,
      },
      scope: {
        clientId: scope.clientId,
        startDate: scope.startDate,
        endDate: scope.endDate,
        filters,
      },
    });
  };

  return (
    <div className="cx-visual-workspace cx-journey-visual-workspace space-y-6">
      {/* 1. Scope Bar */}


      <div className="cx-visual-workspace-body space-y-6">
      {/* 2. Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-text-mute uppercase tracking-wider">
            <GitFork size={13} className="text-brand-primary" />
            <span>Lead Journey</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text-main mt-0.5">
            Stage Progression & Lifecycle
          </h1>
          <p className="text-sm text-text-sec mt-1">
            See where acquired demand progresses or drops off across intake, delivery, dialling, contact, and sales.
          </p>
        </div>
        <ReportActions>
          <Link
            to={scoped('/offershop-flow')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle transition-colors text-xs font-medium text-text-sec hover:text-text-main shadow-xs"
            title="Inspect full Offershop deal flow"
          >
            <Layers size={13} />
            <span>Deal flow</span>
          </Link>

          <Link
            to={scoped('/lead-explorer')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle transition-colors text-xs font-medium text-text-sec hover:text-text-main shadow-xs"
            title="Inspect individual lead records"
          >
            <Search size={13} />
            <span>Inspect records</span>
          </Link>
        </ReportActions>
      </header>
      <ReportingScopeBar
        onRefresh={refreshAll}
        onExportCsv={data ? handleExportCsv : undefined}
      />

      <nav className="cx-viz-jump-nav" aria-label="Lead Journey sections"><a href="#journey-progression">Stage progression</a><a href="#journey-segments">Segment comparison</a><a href="#journey-timing">Timing evidence</a></nav>
      {/* Error state */}
      {error && (
        <OperationalError
          message={error}
          onRetry={() => { void refreshAll(); }}
        />
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="p-12 text-center text-sm text-text-sec bg-surface rounded-xl border border-border-subtle animate-pulse">
          Loading stage progression and cohort evidence…
        </div>
      )}

      {data && (
        <>
          {/* Outcome Summary KPI Strip: Authoritative Independent Stage Totals & True Rates */}
          <div className="cx-visual-metric-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <UnifiedMetricCard
              label="Acquired Demand"
              value={headline.totalVolume !== null ? formatTableNumber(headline.totalVolume) : '—'}
              note="Intake cohort"
              onWhyChanged={() => setRootMetric('fetchedLeads')}
              onAbout={stages[0] ? () => handleInspectStage(stages[0]) : undefined}
              to={scoped('/lead-explorer?drill=funnel-stage&drillValue=fetched')}
              inspectLabel="Inspect"
            />

            <UnifiedMetricCard
              label="Delivery Rate"
              value={headline.deliveryPct !== null ? `${headline.deliveryPct.toFixed(1)}%` : '—'}
              note={headline.deliveredVolume !== null ? `${formatTableNumber(headline.deliveredVolume)} delivered` : 'Delivered'}
              denominatorLabel="Fetched leads"
              onWhyChanged={() => setRootMetric('deliveryRate')}
              onAbout={stages[1] ? () => handleInspectStage(stages[1]) : undefined}
              to={scoped('/lead-explorer?drill=funnel-stage&drillValue=delivered')}
              inspectLabel="Inspect"
            />

            <UnifiedMetricCard
              label="Dial Coverage"
              value={headline.dialPct !== null ? `${headline.dialPct.toFixed(1)}%` : '—'}
              note={headline.dialledVolume !== null ? `${formatTableNumber(headline.dialledVolume)} dialled` : 'Dialled'}
              denominatorLabel="Delivered leads"
              onWhyChanged={() => setRootMetric('dialRate')}
              onAbout={stages[2] ? () => handleInspectStage(stages[2]) : undefined}
              to={scoped('/lead-explorer?drill=funnel-stage&drillValue=dialled')}
              inspectLabel="Inspect"
            />

            <UnifiedMetricCard
              label="Contact Rate (RPC)"
              value={headline.rpcPct !== null ? `${headline.rpcPct.toFixed(1)}%` : '—'}
              note={headline.rpcVolume !== null ? `${formatTableNumber(headline.rpcVolume)} contacted` : 'Contacted'}
              denominatorLabel="Dialled leads"
              onWhyChanged={() => setRootMetric('contactRate')}
              onAbout={stages[3] ? () => handleInspectStage(stages[3]) : undefined}
              to={scoped('/lead-explorer?drill=funnel-stage&drillValue=rpc')}
              inspectLabel="Inspect"
            />

            <UnifiedMetricCard
              label="Lead → Sale"
              value={headline.salePct !== null ? `${headline.salePct.toFixed(2)}%` : '—'}
              note={headline.salesVolume !== null ? `${formatTableNumber(headline.salesVolume)} sales` : 'Sales'}
              denominatorLabel="Fetched leads"
              onWhyChanged={() => setRootMetric('leadToSaleRate')}
              onAbout={stages[4] ? () => handleInspectStage(stages[4]) : undefined}
              to={scoped('/lead-explorer?drill=funnel-stage&drillValue=sales')}
              inspectLabel="Inspect"
            />

            <UnifiedMetricCard
              label="Activations"
              value={headline.activationsVolume !== null ? formatTableNumber(headline.activationsVolume) : '—'}
              note="Fulfilled deals"
              denominatorLabel="Recorded sales"
              onWhyChanged={() => setRootMetric('activationRate')}
              onAbout={stages[5] ? () => handleInspectStage(stages[5]) : undefined}
              to={scoped('/lead-explorer?drill=funnel-stage&drillValue=activated')}
              inspectLabel="Inspect"
            />
          </div>

          {/* Region A: Progression Rail and Transition Evidence */}
          <section id="journey-progression" aria-labelledby="progression-heading">
            <h2 id="progression-heading" className="sr-only">
              Lifecycle Stage Progression
            </h2>
            <JourneyProgression
              stages={stages}
              transitions={transitions}
              totalPopulation={headline.totalVolume}
              onInspectStage={handleInspectStage}
              onInspectTransition={handleInspectTransition}
            />
          </section>

          {/* Region B: Segment Comparison */}
          <section id="journey-segments" aria-labelledby="segments-heading">
            <h2 id="segments-heading" className="sr-only">
              Lifecycle Breakdown Dimensions
            </h2>
            <JourneySegments
              segments={data.lifecycle?.segments}
              onInspectSegment={handleInspectSegment}
            />
          </section>

          {/* Region C: Operational Timing & Velocity */}
          <section id="journey-timing" aria-labelledby="velocity-heading">
            <h2 id="velocity-heading" className="sr-only">
              Lifecycle Transition Velocity
            </h2>
            <JourneyTiming velocity={data.velocity} speedToLeadPath={scoped('/speed-to-lead')} />
          </section>

          {/* Region D: Matched Period & Diagnostics Control */}
          {data.lifecycle?.period && (
            <section className="bg-surface rounded-xl border border-border-subtle overflow-hidden">
              <button
                type="button"
                onClick={() => setMatchedPeriodExpanded(!matchedPeriodExpanded)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-subtle transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-brand-soft text-brand-primary">
                    <FileCheck2 size={16} />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-text-main">
                      Period-Over-Period Diagnostics
                    </h3>
                    <p className="text-xs text-text-sec mt-0.5">
                      Matched window comparisons and rate change decompositions.
                    </p>
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-text-mute transition-transform duration-200 ${
                    matchedPeriodExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {matchedPeriodExpanded && (
                <div className="p-5 border-t border-border-subtle bg-surface-sec space-y-4">
                  <MatchedPeriodPanel data={data.lifecycle} />
                </div>
              )}
            </section>
          )}

          {/* Region E: SLA & Operating Parameters */}
          <section className="bg-surface rounded-xl border border-border-subtle overflow-hidden">
            <button
              type="button"
              onClick={() => setControlsExpanded(!controlsExpanded)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-subtle transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-surface-subtle text-text-sec">
                  <RouteIcon size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-text-main">
                    Operating Parameters & SLA Bands
                  </h3>
                  <p className="text-xs text-text-sec mt-0.5">
                    View active tenant SLA targets, dialling windows, and threshold configurations.
                  </p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-text-mute transition-transform duration-200 ${
                  controlsExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            {controlsExpanded && controls.data && (
              <div className="p-5 border-t border-border-subtle bg-surface-sec space-y-4">
                <SlaBandsPanel data={controls.data} />
              </div>
            )}
          </section>
        </>
      )}

      {/* 4. Evidence Inspector Drawer */}
      <InspectorHost
        open={Boolean(inspectorContent)}
        onClose={() => setInspectorContent(null)}
        content={inspectorContent}
      />

      {/* 5. Root-Cause Why Changed Drawer */}
      <RootCauseDrawer
        open={rootMetric !== null}
        metric={rootMetric}
        onClose={() => setRootMetric(null)}
      />
      </div>
    </div>
  );
}
