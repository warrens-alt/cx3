import ConcentrationPanel from '../../workspaces/command/ConcentrationPanel';
import LifecyclePath from '../../shared/visuals/LifecyclePath';
import { AuditMetadata } from '../../shared/evidence/AuditMode';
import { lifecyclePresentation, type LifecycleStage } from '../../shared/visuals/lifecyclePresentation';
import AnalyticsPageLayout from '../../components/AnalyticsPageLayout';
import OverviewChanges from './components/OverviewChanges';
import FirstCallResponse from './components/FirstCallResponse';
import { STAGE_METRIC_IDS } from '../../shared/evidence/auditPresentation';
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScopedNavigationTarget } from '../../hooks/useScopedNavigationTarget';
import { RefreshCw, Settings2, ChevronDown } from 'lucide-react';
import { useOverviewModel, type RootMetric } from './model/useOverviewModel';
import { useFilters } from '../../lib/FilterContext';
import OutcomeStrip from './components/OutcomeStrip';
import PerformanceTrend from './components/PerformanceTrend';
import AttentionList from './components/AttentionList';
import JourneySummary from './components/JourneySummary';
import SegmentComparison from './components/SegmentComparison';
import InspectorHost from '../../shared/evidence/InspectorHost';
import ReportingScopeBar from '../../shared/reporting/ReportingScopeBar';
import { ReportActions } from '../../shared/reporting/ReportPresentation';
import { OperationalEmpty, OperationalError, OverviewSkeleton } from '../../components/OperationalState';
import { statusLabel } from '../../lib/statusPresentation';
import { formatPercent, formatTableNumber } from '../../lib/formatters';
import { downloadAnalysisCsv, type AnalysisCell } from '../../lib/analysisExport';
import { OperatingControlStrip } from '../../components/OfferNetControlPanels';
import OverviewCommercialPanel from '../../components/OverviewCommercialPanel';
import { lifecycleVisualAudit } from '../evidenceWorkspace/metricVisualAudit';

export default function OverviewPage() {
  const navigate = useNavigate();
  const scoped = useScopedNavigationTarget();
  const { filters } = useFilters();
  const {
    data,
    loading,
    error,
    refreshAll,
    hasComparison,
    isAdmin,
    inspectorContent,
    setInspectorContent,
    closeInspector,
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
      ['Outcomes', 'Recorded activations', data.kpis.activatedLeads, `${formatPercent(data.kpis.activationRate)} of recorded sales`],
      ...(data.funnelStages || []).map(stage => [
        'Lifecycle Journey',
        stage.name,
        stage.volume,
        stage.transitionRate != null ? `${formatPercent(stage.transitionRate)} from prior` : 'Intake population',
      ]),
      ['Contact controls', 'Zero calls', controls.data?.summary.zeroCallLeads ?? null, 'Explicit recorded cumulative zero; unavailable when controls are not loaded'],
      ['Contact controls', 'Call count unrecorded', controls.data?.summary.unrecordedCallLeads ?? null, 'No valid non-negative cumulative call counter'],
      ['Contact controls', 'Qualified dialled leads', controls.data?.summary.dialledLeads ?? null, 'Denominator for one-call and multi-call shares'],
      ['Contact controls', 'Dialled leads with call count unrecorded', controls.data?.summary.dialledUnrecordedCallLeads ?? null, formatPercent(controls.data?.summary.dialledUnrecordedCallSharePct)],
      ['Contact controls', 'One-call share', controls.data?.summary.singleAttemptSharePct ?? null, 'Exactly one recorded call / qualified dialled leads (%)'],
      ['Contact controls', 'Multi-call share', controls.data?.summary.multiAttemptSharePct ?? null, 'Two or more recorded calls / qualified dialled leads (%)'],
      ...(controls.data?.vendorControls || []).flatMap(vendor => [
        ['Vendor contact controls', `${vendor.vendor}: Zero calls`, vendor.zeroCallLeads, 'Explicit recorded cumulative zero'],
        ['Vendor contact controls', `${vendor.vendor}: Call count unrecorded`, vendor.unrecordedCallLeads, 'No valid non-negative cumulative call counter'],
        ['Vendor contact controls', `${vendor.vendor}: Dialled call count unrecorded`, vendor.dialledUnrecordedCallLeads, formatPercent(vendor.dialledUnrecordedCallSharePct)],
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
      definitionVersion: data.definitionVersion,
      countingGrain: 'distinct scoped lead',
      timezone: data.timezone,
      generatedAt: data.generatedAt,
      truncated: false,
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
    <AnalyticsPageLayout className="cx-overview-page" ariaLabel="Command workspace"
      title="Command" description="Observe the operation. Follow the evidence."
      actions={<ReportActions aboutContent={<p>Command evidence: {statusLabel(data?.validationStatus || 'NOT_VERIFIED')}</p>} />}
      scope={<ReportingScopeBar comparisonWindow={data?.comparisonWindow} onRefresh={refreshAll} onExportCsv={data ? handleExportOverviewCsv : undefined} />}>

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
              provenance: { validationStatus: data.validationStatus, generatedAt: data.generatedAt, metricVersion: data.definitionVersion, timezone: data.timezone },
              scope: {
                clientId: scope.clientId,
                clientLabel: data?.clientName,
                startDate: scope.startDate,
                endDate: scope.endDate,
                filters,
              },
            })}
            onWhyChanged={metric => navigate(scoped(`/investigate?investigationMetric=${encodeURIComponent(metric)}`))}
            includeUnavailableStages
            isAdmin={isAdmin}
            hasComparison={hasComparison}
          />

          {data.kpis?.fetchedLeads === 0 && (
            <OperationalEmpty title="No leads in this selection">
              Try a different period or remove a filter. Measured counts remain zero; rates without a population are unavailable.
            </OperationalEmpty>
          )}

          <AuditMetadata grain="Distinct scoped lead" dateBasis="Lead capture cohort" validationStatus={data.validationStatus} definitionVersion={data.definitionVersion} generatedAt={data.generatedAt} />

          <div className="cx-overview-primary">
            <PerformanceTrend data={data.dailyTrends} comparisonWindow={data.comparisonWindow} onAudit={(metricId, label) => setInspectorContent({ type: 'metric', metricId, title: `${label} daily evidence`, subtitle: 'Current capture-cohort daily observations. A previous daily series is not supplied.', provenance: { validationStatus: data.validationStatus, generatedAt: data.generatedAt, metricVersion: data.definitionVersion, timezone: data.timezone }, scope: { clientId: scope.clientId, startDate: scope.startDate, endDate: scope.endDate, filters } })} />
            <AttentionList items={data.attention} isAdmin={isAdmin} />
          </div>

          <div className="cx-overview-secondary">
            <OverviewChanges changes={meaningfulChanges} hasComparison={hasComparison}
              comparisonWindow={data.comparisonWindow} onInvestigate={metric => navigate(scoped(`/investigate?investigationMetric=${encodeURIComponent(metric)}`))} />
            <FirstCallResponse sla={data.sla} backlog={data.backlog} deliveredCount={data.kpis.deliveredLeads} onInspect={content => setInspectorContent({ ...content, provenance: { validationStatus: data.validationStatus, generatedAt: data.generatedAt, metricVersion: data.definitionVersion, timezone: data.timezone }, scope: { clientId: scope.clientId, startDate: scope.startDate, endDate: scope.endDate, filters } })} />
          </div>

          <ConcentrationPanel lifecycle={data.lifecycle} />

          <section className="cx-overview-more" aria-label="Explore more analysis">
            <h2>Explore more analysis</h2>
            <details className="cx-report-disclosure cx-overview-lifecycle-disclosure">
              <summary>Lifecycle progression <small>Stage populations and transition evidence</small></summary>
          <LifecyclePath title="Lifecycle overview" compact
            stages={(data.funnelStages || []).filter(stage => stage.key in lifecyclePresentation).map(stage => ({ ...stage, key: stage.key as LifecycleStage }))}
            transitions={data.lifecycle?.transitions}
            onSelectStage={key => setInspectorContent(lifecycleVisualAudit({ type: 'stage', metricId: STAGE_METRIC_IDS[key], title: `${lifecyclePresentation[key].label} evidence`, value: formatTableNumber(data.funnelStages?.find(stage => stage.key === key)?.volume), reportPath: '/funnel', reportLabel: 'Explore full journey', recordDrill: { drill: 'funnel-stage', drillValue: key }, provenance: { validationStatus: data.validationStatus, generatedAt: data.generatedAt, metricVersion: data.definitionVersion, timezone: data.timezone }, scope: { clientId: scope.clientId, startDate: scope.startDate, endDate: scope.endDate, filters } }, data.funnelStages?.find(stage => stage.key === key)?.volume, key, data.lifecycle))}
          />

          <JourneySummary
            stages={data.funnelStages}
            funnelLeak={data.funnelLeak}
            isAdmin={isAdmin}
            onInspectStage={(stage) => {
              setInspectorContent({
                type: 'stage',
                metricId: STAGE_METRIC_IDS[stage.key],
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
                clientLabel: data?.clientName,
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
                value: loss === 0 ? '0 leads' : `−${formatTableNumber(loss)} leads`,
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
                clientLabel: data?.clientName,
                  startDate: scope.startDate,
                  endDate: scope.endDate,
                  filters,
                },
              });
            }}
          />
            </details>

          {/* 4. Segment Comparison (Receives verified lifecycle segments, no backlog fallback!) */}
          <details className="cx-report-disclosure"><summary>Segment breakdowns</summary>
          <SegmentComparison
            segments={data.lifecycle?.segments || null}
            totalPopulation={data.kpis?.fetchedLeads}
            unsupportedDimensions={data.lifecycle?.unsupportedDimensions}
            onInspectSegment={(segment) => {
              setInspectorContent({
                type: 'segment',
                title: `${segment.dimension.charAt(0).toUpperCase() + segment.dimension.slice(1)}: ${segment.name}`,
                subtitle: `Fetched leads in the selected ${segment.dimension} segment.`,
                metricId: 'fetched_leads',
                value: `${formatTableNumber(segment.volume)} leads`,
                unit: 'records',
                reportPath: segment.dimension === 'grade' ? '/funnel' : '/vendor-quality',
                reportLabel: `Open complete ${segment.dimension} breakdown`,
                recordDrill: {
                  drill: 'lifecycle-segment',
                  drillValue: `${segment.dimension}:${segment.name}`,
                  label: `Inspect ${segment.name} lead records in Lead Explorer`,
                },
                scope: {
                  clientId: scope.clientId,
                clientLabel: data?.clientName,
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

          </details>

          {/* 5. Collapsible Operating Controls (Deferred Query) */}
          <details
            open={controlsExpanded}
            onToggle={(e) => setControlsExpanded(e.currentTarget.open)}
            className="cx-overview-controls cx-report-disclosure"
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
            className="cx-report-disclosure"
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
          </section>
        </>
      )}

      {/* Contextual Inspector Modal */}
      <InspectorHost
        open={inspectorContent !== null}
        onClose={closeInspector}
        content={inspectorContent}
      />

    </AnalyticsPageLayout>
  );
}
