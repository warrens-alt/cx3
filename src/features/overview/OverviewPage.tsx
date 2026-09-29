import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Info, ArrowRight, RefreshCw, Settings2, ChevronDown, Clock3, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { useOverviewModel, type RootMetric } from './model/useOverviewModel';
import { useFilters } from '../../lib/FilterContext';
import OutcomeStrip from './components/OutcomeStrip';
import PerformanceTrend from './components/PerformanceTrend';
import AttentionList from './components/AttentionList';
import JourneySummary from './components/JourneySummary';
import SegmentComparison from './components/SegmentComparison';
import ChangeContributionPanel from './components/ChangeContributionPanel';
import InspectorHost from '../../shared/evidence/InspectorHost';
import ReportingScopeBar from '../../shared/reporting/ReportingScopeBar';
import { OperationalEmpty, OperationalError, OverviewSkeleton } from '../../components/OperationalState';
import { statusLabel } from '../../lib/statusPresentation';
import { useScopedNavigationTarget } from '../../hooks/useScopedNavigationTarget';
import RootCauseDrawer from '../../components/RootCauseDrawer';
import { formatPercent, formatTableNumber } from '../../lib/formatters';
import { downloadAnalysisCsv, type AnalysisCell } from '../../lib/analysisExport';
import { OperatingControlStrip } from '../../components/OfferNetControlPanels';
import OverviewCommercialPanel from '../../components/OverviewCommercialPanel';

export default function OverviewPage() {
  const scoped = useScopedNavigationTarget();
  const { filters } = useFilters();
  const {
    data,
    loading,
    error,
    refreshAll,
    hasComparison,
    investigate,
    isAdmin,
    inspectorContent,
    setInspectorContent,
    closeInspector,
    rootMetric,
    setRootMetric,
    commercial,
    controls,
    controlsExpanded,
    setControlsExpanded,
    commercialExpanded,
    setCommercialExpanded,
    scope,
  } = useOverviewModel();

  // Export Overview summary CSV carrying full scope and analytical audit metadata
  const handleExportOverviewCsv = () => {
    if (!data) return;
    const clientId = scope.clientId || 'overview';
    const filename = `overview_${clientId}_${scope.startDate || 'all'}_${scope.endDate || 'all'}`;

    const rows: AnalysisCell[][] = [
      ['Section', 'Metric / Item', 'Observed Value', 'Rate / Context'],
      ['Outcomes', 'Fetched leads', data.kpis.fetchedLeads, 'Total acquired demand'],
      ['Outcomes', 'Delivered leads', data.kpis.deliveredLeads, `${formatPercent(data.kpis.deliveryRate)} delivery rate`],
      ['Outcomes', 'Dialled leads', data.kpis.dialledLeads, `${formatPercent(data.kpis.dialRate)} dial rate`],
      ['Outcomes', 'Right-party contact (RPC)', data.kpis.contactedLeads, `${formatPercent(data.kpis.contactRate)} contact rate`],
      ['Outcomes', 'Recorded sales', data.kpis.saleLeads, `${formatPercent(data.kpis.leadToSaleRate)} lead-to-sale rate`],
      ['Outcomes', 'Activations', data.kpis.activatedLeads, `${formatPercent(data.kpis.activationRate)} of recorded sales`],
      ...(data.funnelStages || []).map(stage => [
        'Lifecycle Journey',
        stage.name,
        stage.volume,
        stage.transitionRate != null ? `${formatPercent(stage.transitionRate)} from prior` : 'Intake population',
      ]),
      ...(data.attention || []).map(att => [
        'Attention Queue',
        att.title,
        att.value,
        att.detail,
      ]),
    ];

    downloadAnalysisCsv(filename, rows, {
      clientId,
      startDate: scope.startDate,
      endDate: scope.endDate,
      filters: filters,
      validationStatus: data.validationStatus || 'NOT_VERIFIED',
      dateBasis: 'lead_capture_cohort',
      definitions: ['fetched_leads', 'delivery_rate', 'dial_rate', 'rpc_rate', 'sales_per_fetched_rate', 'activation_rate'],
    });
  };

  // Matched-period meaningful changes: volume shift (%) and conversion rate shifts (pp) are kept distinct
  const meaningfulChanges = useMemo(() => {
    if (!data?.comparison) return [];
    const c = data.comparison;
    const vol = c.fetchedDelta != null && Number.isFinite(c.fetchedDelta)
      ? [{ label: 'Lead volume', value: c.fetchedDelta, unit: '%', metric: 'fetchedLeads' as RootMetric }]
      : [];
    const rates = [
      { label: 'Delivery rate', value: c.deliveryRateDelta, unit: 'pp', metric: 'deliveryRate' as RootMetric },
      { label: 'Dial coverage', value: c.dialRateDelta, unit: 'pp', metric: 'dialRate' as RootMetric },
      { label: 'Right-party contact', value: c.contactRateDelta, unit: 'pp', metric: 'contactRate' as RootMetric },
      { label: 'Lead-to-sale rate', value: c.saleRateDelta, unit: 'pp', metric: 'leadToSaleRate' as RootMetric },
      { label: 'Activation / sale', value: c.activationRateDelta, unit: 'pp', metric: 'activationRate' as RootMetric },
    ]
      .filter(item => item.value !== null && Number.isFinite(item.value))
      .sort((a, b) => Math.abs(Number(b.value)) - Math.abs(Number(a.value)));
    return [...vol, ...rates.slice(0, 3)];
  }, [data?.comparison]);

  return (
    <div className="cx-command-page cx-overview-page" aria-label="Overview workspace">
      {/* Scope Bar */}
      <ReportingScopeBar
        onRefresh={refreshAll}
        onExportCsv={data ? handleExportOverviewCsv : undefined}
      />

      <div className="cx-command-content space-y-6">
        {/* Page Header */}
        <header className="cx-workspace-heading flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-2 border-b border-border-subtle">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-text-sec">
              <span className="font-semibold text-action uppercase tracking-wider">Outcomes</span>
              <span className="text-text-muted" aria-hidden="true">·</span>
              <span className="font-medium text-text-muted">{data?.clientName || 'Workspace'}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text-main mt-1">
              Overview
            </h1>
            <p className="text-xs text-text-sec mt-1 max-w-2xl leading-relaxed">
              Follow acquired demand through intake, delivery, contact, sales, and activations across the selected reporting cohort.
            </p>
          </div>

          <Link
            to={scoped('/reports')}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle transition-colors text-xs text-text-sec shadow-xs shrink-0 self-start"
            title="Inspect evidence and verification status"
          >
            <Info size={14} className="text-action" aria-hidden="true" />
            <span>
              <strong>{statusLabel(data?.validationStatus || 'NOT_VERIFIED')}</strong>
              <span className="text-text-mute ml-1">· Evidence status</span>
            </span>
            <ArrowRight size={13} className="text-text-mute" />
          </Link>
        </header>

      {/* Error state */}
      {error && (
        <OperationalError
          message={error}
          onRetry={() => { void refreshAll(); }}
          retrying={loading}
        />
      )}

      {/* Loading Skeleton */}
      {loading && !data && <OverviewSkeleton />}

      {/* Updating indicator */}
      {loading && data && (
        <p className="cx-view-updating text-xs text-text-mute flex items-center gap-1.5" role="status">
          <RefreshCw size={12} className="animate-spin text-brand-primary" />
          <span>Updating overview evidence…</span>
        </p>
      )}

      {/* Populated Content */}
      {data && (
        <>
          {/* 1. Principal Supported Outcome Measures */}
          <OutcomeStrip
            data={data}
            onInspect={content => setInspectorContent({
              ...content,
              scope: {
                clientId: scope.clientId,
                startDate: scope.startDate,
                endDate: scope.endDate,
                filters,
              },
            })}
            onWhyChanged={investigate}
            isAdmin={isAdmin}
            hasComparison={hasComparison}
          />

          {data.kpis?.fetchedLeads === 0 && (
            <OperationalEmpty title="No leads in this selection">
              Try a different period or remove a filter. Measured counts remain zero; rates without a population are unavailable.
            </OperationalEmpty>
          )}

          {/* Meaningful Matched-Period Changes Banner (when comparison is active) */}
          {hasComparison && meaningfulChanges.length > 0 && (
            <section
              aria-label="Meaningful outcome changes"
              className="cx-change-rail p-3.5 rounded-lg bg-surface-subtle border border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2 text-text-sec shrink-0">
                <Clock3 size={15} className="text-brand-primary" />
                <span className="font-semibold text-text-main">Meaningful changes:</span>
                <span className="text-text-mute hidden lg:inline">
                  Ranked by shift vs {data.comparisonWindow?.startDate} – {data.comparisonWindow?.endDate}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {meaningfulChanges.map(change => {
                  const val = Number(change.value);
                  const isPos = val > 0;
                  const isZero = val === 0;
                  const Icon = isPos ? TrendingUp : isZero ? ArrowRight : TrendingDown;
                  return (
                    <button
                      key={change.label}
                      type="button"
                      onClick={() => investigate(change.metric)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface border border-border-subtle hover:border-brand-primary/40 hover:text-brand-primary transition-colors cursor-pointer group"
                      title={`Investigate ${change.label} shift`}
                    >
                      <span className="text-text-sec">{change.label}:</span>
                      <span
                        className={`font-semibold cx-tabular inline-flex items-center gap-0.5 ${
                          isPos ? 'text-semantic-pos' : isZero ? 'text-text-mute' : 'text-semantic-neg'
                        }`}
                      >
                        <Icon size={11} />
                        <span>{isPos ? '+' : ''}{change.value}{change.unit}</span>
                      </span>
                      <span className="text-xs text-text-mute group-hover:text-brand-primary inline-flex items-center ml-0.5">
                        Why? <Search size={11} className="ml-0.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* 2. Primary 8/4 Layout: Performance Trend (2/3) + Needs Attention (1/3) */}
          <div className="cx-overview-primary grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8">
              <PerformanceTrend
                data={data.dailyTrends}
                comparisonWindow={data.comparisonWindow}
              />
            </div>
            <div className="lg:col-span-4">
              <AttentionList
                items={data.attention}
                isAdmin={isAdmin}
              />
            </div>
          </div>

          {/* 3. Lead-to-Activation Progression Journey */}
          <JourneySummary
            stages={data.funnelStages}
            funnelLeak={data.funnelLeak}
            isAdmin={isAdmin}
            onInspectStage={(stage) => {
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
            }}
            onInspectLoss={(from, to, loss, lossKey) => {
              setInspectorContent({
                type: 'stage',
                title: `${from} → ${to} Transition Dropoff`,
                subtitle: `Leads observed in ${from} that did not progress to ${to}.`,
                value: `−${formatTableNumber(loss)} leads`,
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
            }}
          />

          {/* 4. Segment Comparison (Receives verified lifecycle segments, no backlog fallback!) */}
          <SegmentComparison
            segments={data.lifecycle?.segments || null}
            totalPopulation={data.kpis?.fetchedLeads}
            unsupportedDimensions={data.lifecycle?.unsupportedDimensions}
            onInspectSegment={(segment) => {
              setInspectorContent({
                type: 'segment',
                title: `${segment.dimension.charAt(0).toUpperCase() + segment.dimension.slice(1)}: ${segment.name}`,
                subtitle: `Observed outcome rates and stage conversion in current reporting scope.`,
                value: `${formatTableNumber(segment.volume)} leads`,
                unit: 'records',
                numeratorCount: segment.sales,
                numeratorLabel: 'Recorded sales (sales count)',
                denominatorCount: segment.volume,
                denominatorLabel: 'Fetched leads (denominator)',
                reportPath: segment.dimension === 'grade' ? '/funnel' : '/vendor-quality',
                reportLabel: `Open complete ${segment.dimension} breakdown`,
                recordDrill: {
                  drill: 'lifecycle-segment',
                  drillValue: `${segment.dimension}:${segment.name}`,
                  label: `Inspect ${segment.name} lead records in Lead Explorer`,
                },
                scope: {
                  clientId: scope.clientId,
                  startDate: scope.startDate,
                  endDate: scope.endDate,
                  filters,
                },
                details: (
                  <div className="space-y-3 p-4 bg-surface border border-border-subtle rounded-lg text-xs">
                    <h3 className="font-semibold text-text-mute uppercase tracking-wider">
                      Segment Lifecycle Progression
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-text-sec">
                      <div className="p-2 rounded bg-surface-subtle border border-border-subtle">
                        <span className="text-[11px] text-text-mute block">Delivered</span>
                        <span className="font-bold text-sm cx-tabular text-text-main">
                          {formatTableNumber(segment.delivered)}
                        </span>
                        <span className="text-text-mute ml-1">({formatPercent(segment.deliveryRate)})</span>
                      </div>
                      <div className="p-2 rounded bg-surface-subtle border border-border-subtle">
                        <span className="text-[11px] text-text-mute block">Right-Party Contact</span>
                        <span className="font-bold text-sm cx-tabular text-text-main">
                          {formatTableNumber(segment.rpc)}
                        </span>
                        <span className="text-text-mute ml-1">({formatPercent(segment.contactRate)})</span>
                      </div>
                      <div className="p-2 rounded bg-surface-subtle border border-border-subtle">
                        <span className="text-[11px] text-text-mute block">Recorded Sales</span>
                        <span className="font-bold text-sm cx-tabular text-text-main">
                          {formatTableNumber(segment.sales)}
                        </span>
                        <span className="text-text-mute ml-1">({formatPercent(segment.saleRate)})</span>
                      </div>
                      <div className="p-2 rounded bg-surface-subtle border border-border-subtle">
                        <span className="text-[11px] text-text-mute block">Activations</span>
                        <span className="font-bold text-sm cx-tabular text-text-main">
                          {formatTableNumber(segment.activations)}
                        </span>
                      </div>
                    </div>
                  </div>
                ),
              });
            }}
          />

          {/* 5. Collapsible Operating Controls (Deferred Query) */}
          <details
            open={controlsExpanded}
            onToggle={(e) => setControlsExpanded(e.currentTarget.open)}
            className="cx-overview-controls rounded-lg border border-border-subtle bg-surface p-4"
          >
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <div className="flex items-center gap-2">
                <Settings2 size={18} className="text-brand-primary" aria-hidden="true" />
                <div>
                  <strong className="text-sm text-text-main block">Operating controls</strong>
                  <small className="text-xs text-text-mute">Call effort, coverage and activation backlog</small>
                </div>
              </div>
              <ChevronDown size={16} className={`text-text-mute transition-transform ${controlsExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
            </summary>
            {controlsExpanded && (
              <div className="mt-4 pt-4 border-t border-border-subtle">
                {controls.error ? (
                  <OperationalError
                    message={controls.error instanceof Error ? controls.error.message : 'Operating controls are unavailable.'}
                    onRetry={() => { void controls.refetch(); }}
                    retrying={controls.isFetching}
                  />
                ) : controls.data ? (
                  <OperatingControlStrip data={controls.data} />
                ) : (
                  <p className="text-xs text-text-mute py-4" role="status">Loading operating controls…</p>
                )}
              </div>
            )}
          </details>

          {/* 6. Collapsible Commercial Summary (Deferred Query) */}
          <details
            open={commercialExpanded}
            onToggle={(e) => setCommercialExpanded(e.currentTarget.open)}
            className="rounded-lg border border-border-subtle bg-surface p-4"
          >
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <div className="flex items-center gap-2">
                <Settings2 size={18} className="text-brand-primary" aria-hidden="true" />
                <div>
                  <strong className="text-sm text-text-main block">Commercial overview</strong>
                  <small className="text-xs text-text-mute">Spend, revenue and unit economics reconciliation</small>
                </div>
              </div>
              <ChevronDown size={16} className={`text-text-mute transition-transform ${commercialExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
            </summary>
            {commercialExpanded && (
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <OverviewCommercialPanel
                  data={commercial.data ?? null}
                  loading={commercial.loading}
                  error={commercial.error}
                  onRetry={() => { void commercial.loadData(true); }}
                />
              </div>
            )}
          </details>
        </>
      )}

      {/* Contextual Inspector Modal */}
      <InspectorHost
        open={inspectorContent !== null}
        onClose={closeInspector}
        content={inspectorContent}
      />

      {/* Root Cause Drawer for drilldowns */}
      <RootCauseDrawer
        open={rootMetric !== null}
        metric={rootMetric}
        onClose={() => setRootMetric(null)}
      />
      </div>
    </div>
  );
}
