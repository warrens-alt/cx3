import AnalyticsPageLayout from '../../components/AnalyticsPageLayout';
import { STAGE_METRIC_IDS } from '../../shared/evidence/auditPresentation';
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
import VisualSkeleton from '../../shared/visuals/VisualSkeleton';
import { AuditMetadata } from '../../shared/evidence/AuditMode';
import { OperationalError, ReportSkeleton } from '../../components/OperationalState';
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
  const rateEvidence = [
    { label: 'Acquired demand', value: formatTableNumber(headline.totalVolume), metricId: 'fetched_leads', numerator: headline.totalVolume, denominator: null, basis: 'Intake cohort', stage: 'fetched' },
    { label: 'Delivery rate', value: headline.deliveryPct !== null ? `${headline.deliveryPct.toFixed(1)}%` : '—', metricId: 'delivery_rate', numerator: headline.deliveredVolume, denominator: headline.totalVolume, basis: 'Delivered / fetched', stage: 'delivered' },
    { label: 'Dial coverage', value: headline.dialPct !== null ? `${headline.dialPct.toFixed(1)}%` : '—', metricId: 'dial_rate', numerator: headline.dialledVolume, denominator: headline.deliveredVolume, basis: 'Dialled / delivered', stage: 'dialled' },
    { label: 'Contact rate (RPC)', value: headline.rpcPct !== null ? `${headline.rpcPct.toFixed(1)}%` : '—', metricId: 'rpc_rate', numerator: headline.rpcVolume, denominator: headline.dialledVolume, basis: 'RPC / dialled', stage: 'rpc' },
    { label: 'Lead → Sale', value: headline.salePct !== null ? `${headline.salePct.toFixed(2)}%` : '—', metricId: 'sales_per_fetched_rate', numerator: headline.salesVolume, denominator: headline.totalVolume, basis: 'Sales / fetched', stage: 'sales' },
    { label: 'Activations', value: formatTableNumber(headline.activationsVolume), metricId: 'activated_leads', numerator: headline.activationsVolume, denominator: null, basis: 'Recorded activations', stage: 'activated' },
  ];

  const handleInspectStage = (stage: StageItem) => {
    const isSupported = ['fetched', 'delivered', 'dialled', 'rpc', 'sales', 'activated'].includes(stage.key);
    setInspectorContent({
      type: 'stage',
      metricId: STAGE_METRIC_IDS[stage.key],
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
      metricId: 'fetched_leads',
      title: `${dimension.charAt(0).toUpperCase() + dimension.slice(1)}: ${segment.key}`,
      subtitle: 'Observed outcome rates and stage conversion in current reporting scope.',
      value: `${formatTableNumber(segment.fetched)} leads`,
      unit: 'records',
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
    <AnalyticsPageLayout className="cx-journey-visual-workspace" title="Progression" description={<>Stage populations, qualified transitions and timing.</>} actions={<ReportActions>
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
        </ReportActions>} scope={<ReportingScopeBar
        onRefresh={refreshAll}
        onExportCsv={data ? handleExportCsv : undefined}
      />}>

      {/* Error state */}
      {error && (
        <OperationalError
          message={error}
          onRetry={() => { void refreshAll(); }}
        />
      )}

      {/* Loading state */}
      {loading && !data && (
        <VisualSkeleton kind="lifecycle" label="Loading stage progression and cohort evidence" />
      )}

      {data && (
        <>
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

          <details className="cx-report-disclosure">
            <summary>View stage metrics and rate definitions</summary>
            <div className="cx-viz-table-scroll" role="region" aria-label="Stage metric evidence" tabIndex={0}>
              <table className="cx-viz-table"><caption className="sr-only">Independent stage metrics retain their original numerator and denominator definitions.</caption>
                <thead><tr><th>Measure</th><th>Value</th><th>Numerator</th><th>Denominator</th><th>Basis</th></tr></thead>
                <tbody>{rateEvidence.map(item => <tr key={item.metricId}><th scope="row"><button type="button" className="cx-button-quiet" onClick={() => setInspectorContent({ type: 'metric', metricId: item.metricId, title: item.label, value: item.value, numeratorCount: item.numerator, denominatorCount: item.denominator, scope: { clientId: scope.clientId, startDate: scope.startDate, endDate: scope.endDate, filters }, recordDrill: { drill: 'funnel-stage', drillValue: item.stage } })}>{item.label}</button><AuditMetadata metricId={item.metricId}/></th><td>{item.value}</td><td>{formatTableNumber(item.numerator)}</td><td>{formatTableNumber(item.denominator)}</td><td>{item.basis}</td></tr>)}</tbody>
              </table>
            </div>
          </details>

          {/* Region C: Operational Timing & Velocity */}
          <section id="journey-timing" aria-labelledby="velocity-heading">
            <h2 id="velocity-heading" className="sr-only">
              Lifecycle Transition Velocity
            </h2>
            <JourneyTiming velocity={data.velocity} speedToLeadPath={scoped('/speed-to-lead')} />
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

    </AnalyticsPageLayout>
  );
}
