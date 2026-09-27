import React from 'react';
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
import { OperationalError } from '../../components/OperationalState';
import { formatPercent, formatRatioPercent, formatTableNumber } from '../../lib/formatters';
import { MatchedPeriodPanel } from '../../components/LifecycleDiagnostics';
import { SlaBandsPanel } from '../../components/OfferNetControlPanels';
import { useJourneyModel } from './model/useJourneyModel';
import JourneyProgression, { type StageItem } from './components/JourneyProgression';
import JourneySegments, { type JourneyDimension } from './components/JourneySegments';
import JourneyTiming from './components/JourneyTiming';
import type { LifecycleSegment } from '../../../contracts/lifecycleAnalytics';

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

  const handleInspectStage = (stage: StageItem) => {
    setInspectorContent({
      type: 'stage',
      title: `${stage.name} Stage`,
      subtitle: 'Observed lifecycle population across the selected reporting period.',
      value: `${formatTableNumber(stage.volume)} leads`,
      unit: 'records',
      reportPath: '/funnel',
      reportLabel: 'Open deep funnel analysis',
      recordDrill: {
        drill: 'funnel-stage',
        drillValue: stage.key,
        label: `Inspect ${stage.name} lead records in Lead Explorer`,
      },
      scope: {
        clientId: scope.clientId,
        startDate: scope.startDate,
        endDate: scope.endDate,
        filters,
      },
    });
  };

  const handleInspectTransition = (from: string, to: string, lost: number, lossKey: string) => {
    setInspectorContent({
      type: 'stage',
      title: `${from} → ${to} Transition Dropoff`,
      subtitle: `Leads observed in ${from} that did not progress to ${to}.`,
      value: `−${formatTableNumber(lost)} leads`,
      unit: 'dropoff records',
      reportPath: '/funnel',
      reportLabel: 'Open deep funnel analysis',
      recordDrill: {
        drill: 'funnel-loss',
        drillValue: lossKey,
        label: `Inspect ${from} → ${to} loss records in Lead Explorer`,
      },
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

  // KPI calculations
  const totalVolume = data?.lifecycle?.transitions[0]?.population ?? (data?.byVendor ? data.byVendor.reduce((sum, v) => sum + v.leads, 0) : null);
  const deliveredVolume = data?.lifecycle?.transitions[0]?.converted ?? (data?.byVendor ? data.byVendor.reduce((sum, v) => sum + v.delivered, 0) : null);
  const deliveryPct = totalVolume && totalVolume > 0 && deliveredVolume !== null ? (deliveredVolume / totalVolume) * 100 : null;
  const dialledVolume = data?.lifecycle?.transitions[1]?.converted ?? (data?.byVendor ? data.byVendor.reduce((sum, v) => sum + v.dialled, 0) : null);
  const dialPct = deliveredVolume && deliveredVolume > 0 && dialledVolume !== null ? (dialledVolume / deliveredVolume) * 100 : null;
  const rpcVolume = data?.lifecycle?.transitions[2]?.converted ?? (data?.byVendor ? data.byVendor.reduce((sum, v) => sum + v.contacted, 0) : null);
  const rpcPct = dialledVolume && dialledVolume > 0 && rpcVolume !== null ? (rpcVolume / dialledVolume) * 100 : null;
  const salesVolume = data?.lifecycle?.transitions[3]?.converted ?? (data?.byVendor ? data.byVendor.reduce((sum, v) => sum + v.sales, 0) : null);
  const salePct = totalVolume && totalVolume > 0 && salesVolume !== null ? (salesVolume / totalVolume) * 100 : null;
  const activationsVolume = data?.lifecycle?.transitions[4]?.converted ?? (data?.byVendor ? data.byVendor.reduce((sum, v) => sum + v.activations, 0) : null);

  return (
    <div className="space-y-6">
      {/* 1. Scope Bar */}
      <ReportingScopeBar
        onRefresh={refreshAll}
        onExportCsv={data ? handleExportCsv : undefined}
      />

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

        <div className="flex items-center gap-2">
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
        </div>
      </header>

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
          {/* Outcome Summary KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
              <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
                Acquired Demand
              </span>
              <span className="text-2xl font-extrabold text-text-main cx-tabular mt-1 block">
                {totalVolume !== null ? formatTableNumber(totalVolume) : '—'}
              </span>
              <span className="text-[11px] text-text-sec mt-1 block">Intake cohort</span>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
              <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
                Delivery Rate
              </span>
              <span className="text-2xl font-extrabold text-text-main cx-tabular mt-1 block">
                {deliveryPct !== null ? `${deliveryPct.toFixed(1)}%` : '—'}
              </span>
              <span className="text-[11px] text-text-sec mt-1 block">
                {deliveredVolume !== null ? `${formatTableNumber(deliveredVolume)} delivered` : 'Delivered'}
              </span>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
              <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
                Dial Coverage
              </span>
              <span className="text-2xl font-extrabold text-text-main cx-tabular mt-1 block">
                {dialPct !== null ? `${dialPct.toFixed(1)}%` : '—'}
              </span>
              <span className="text-[11px] text-text-sec mt-1 block">
                {dialledVolume !== null ? `${formatTableNumber(dialledVolume)} dialled` : 'Dialled'}
              </span>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
              <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
                Contact Rate (RPC)
              </span>
              <span className="text-2xl font-extrabold text-text-main cx-tabular mt-1 block">
                {rpcPct !== null ? `${rpcPct.toFixed(1)}%` : '—'}
              </span>
              <span className="text-[11px] text-text-sec mt-1 block">
                {rpcVolume !== null ? `${formatTableNumber(rpcVolume)} contacted` : 'Contacted'}
              </span>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
              <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
                Lead → Sale
              </span>
              <span className="text-2xl font-extrabold text-brand-primary cx-tabular mt-1 block">
                {salePct !== null ? `${salePct.toFixed(2)}%` : '—'}
              </span>
              <span className="text-[11px] text-text-sec mt-1 block">
                {salesVolume !== null ? `${formatTableNumber(salesVolume)} sales` : 'Sales'}
              </span>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
              <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
                Activations
              </span>
              <span className="text-2xl font-extrabold text-text-main cx-tabular mt-1 block">
                {activationsVolume !== null ? formatTableNumber(activationsVolume) : '—'}
              </span>
              <span className="text-[11px] text-text-sec mt-1 block">Fulfilled deals</span>
            </div>
          </div>

          {/* Region A: Progression */}
          <section aria-labelledby="progression-heading">
            <h2 id="progression-heading" className="sr-only">
              Lifecycle Stage Progression
            </h2>
            <JourneyProgression
              transitions={data.lifecycle?.transitions}
              totalPopulation={totalVolume}
              onInspectStage={handleInspectStage}
              onInspectTransition={handleInspectTransition}
            />
          </section>

          {/* Region B: Segment Comparison */}
          <section aria-labelledby="segments-heading">
            <h2 id="segments-heading" className="sr-only">
              Segment Decomposition
            </h2>
            <JourneySegments
              segments={data.lifecycle?.segments}
              totalPopulation={totalVolume}
              unsupportedDimensions={data.lifecycle?.unsupportedDimensions}
              onInspectSegment={handleInspectSegment}
            />
          </section>

          {/* Region C: Lifecycle Timing */}
          <section aria-labelledby="timing-heading">
            <h2 id="timing-heading" className="sr-only">
              Lifecycle Timing
            </h2>
            <JourneyTiming
              velocity={data.velocity}
              speedToLeadPath={scoped('/speed-to-lead')}
            />
          </section>

          {/* Region D: Operating Controls & Matched-Period Disclosures */}
          <div className="space-y-4">
            {controls.data && (
              <details
                className="group bg-surface rounded-xl border border-border-subtle overflow-hidden transition-colors"
                open={controlsExpanded}
                onToggle={(e) => setControlsExpanded(e.currentTarget.open)}
              >
                <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-subtle transition-colors list-none select-none">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-main uppercase tracking-wider">
                      Operating Controls & SLA Performance
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-sec text-text-sec border border-border-subtle">
                      Response bands & operating windows
                    </span>
                  </div>
                  <ChevronDown
                    size={16}
                    className="text-text-mute transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>

                <div className="p-5 border-t border-border-subtle bg-surface-subtle/30 space-y-4">
                  <SlaBandsPanel data={controls.data} />
                </div>
              </details>
            )}

            {data.lifecycle?.comparisons && (
              <details
                className="group bg-surface rounded-xl border border-border-subtle overflow-hidden transition-colors"
                open={matchedPeriodExpanded}
                onToggle={(e) => setMatchedPeriodExpanded(e.currentTarget.open)}
              >
                <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-subtle transition-colors list-none select-none">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-main uppercase tracking-wider">
                      Matched Period Comparison
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-sec text-text-sec border border-border-subtle">
                      {data.lifecycle.period ? `${data.lifecycle.period.days} calendar days` : 'Prior period comparison'}
                    </span>
                  </div>
                  <ChevronDown
                    size={16}
                    className="text-text-mute transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>

                <div className="p-5 border-t border-border-subtle bg-surface-subtle/30">
                  <MatchedPeriodPanel data={data.lifecycle} />
                </div>
              </details>
            )}
          </div>

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
              to={scoped('/vendor-quality')}
              className="p-3.5 bg-surface hover:bg-surface-subtle border border-border-subtle rounded-xl flex items-center justify-between group transition-colors shadow-2xs"
            >
              <div>
                <span className="text-xs font-bold text-text-main block">Vendor quality</span>
                <span className="text-[11px] text-text-sec block mt-0.5">Quality grades & vendor downstream</span>
              </div>
              <ArrowRight size={14} className="text-text-mute group-hover:text-brand-primary transition-colors" />
            </Link>

            <Link
              to={scoped('/campaigns')}
              className="p-3.5 bg-surface hover:bg-surface-subtle border border-border-subtle rounded-xl flex items-center justify-between group transition-colors shadow-2xs"
            >
              <div>
                <span className="text-xs font-bold text-text-main block">Acquisition channels</span>
                <span className="text-[11px] text-text-sec block mt-0.5">Media campaigns & acquisition volume</span>
              </div>
              <ArrowRight size={14} className="text-text-mute group-hover:text-brand-primary transition-colors" />
            </Link>

            <Link
              to={scoped('/vetting')}
              className="p-3.5 bg-surface hover:bg-surface-subtle border border-border-subtle rounded-xl flex items-center justify-between group transition-colors shadow-2xs"
            >
              <div>
                <span className="text-xs font-bold text-text-main block">Qualification checks</span>
                <span className="text-[11px] text-text-sec block mt-0.5">Vetting validation & rejection rules</span>
              </div>
              <ArrowRight size={14} className="text-text-mute group-hover:text-brand-primary transition-colors" />
            </Link>
          </section>
        </>
      )}

      {/* Inspector Host */}
      <InspectorHost
        open={Boolean(inspectorContent)}
        onClose={() => setInspectorContent(null)}
        content={inspectorContent}
      />
    </div>
  );
}
