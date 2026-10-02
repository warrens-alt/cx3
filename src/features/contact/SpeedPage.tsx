import AnalyticsPageLayout from '../../components/AnalyticsPageLayout';
import { ReportActions } from '../../shared/reporting/ReportPresentation';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Timer,
  Clock3,
  AlertTriangle,
  ArrowRight,
  PhoneCall,
  BarChart3,
  ChevronDown,
} from 'lucide-react';
import ReportingScopeBar from '../../shared/reporting/ReportingScopeBar';
import { OperationalError, ReportSkeleton } from '../../components/OperationalState';
import { formatPercent, formatTableNumber } from '../../lib/formatters';
import { VolumeRateComboChart } from '../../components/charts/OperationalVisuals';
import UnifiedMetricCard from '../../components/UnifiedMetricCard';
import EvidenceBars from '../../shared/visuals/EvidenceBars';
import PercentileRail from '../../shared/visuals/PercentileRail';
import { lifecyclePresentation } from '../../shared/visuals/lifecyclePresentation';
import LatencyDistribution from './components/LatencyDistribution';
import '../../styles/contactTemporalVisuals.css';
import {
  CaptureTurnaroundPanel,
  SlaBandsPanel,
  OperatingWindowPanel,
} from '../../components/OfferNetControlPanels';
import { useSpeedModel, type SpeedData } from './model/useSpeedModel';
import AuditEvidenceButton from '../../shared/evidence/AuditEvidenceButton';
import InspectorHost, { type InspectorContent } from '../../shared/evidence/InspectorHost';

export default function SpeedPage() {
  const {
    data,
    loading,
    error,
    refreshAll,
    scoped,
    controls,
    controlsExpanded,
    setControlsExpanded,
    handleExportCsv,
    scope,
    filters,
  } = useSpeedModel();
  const auditScope = { clientId: scope.clientId, startDate: scope.startDate, endDate: scope.endDate, filters };
  const auditScopeKey = JSON.stringify(auditScope);
  const [selectedTiming, setSelectedTiming] = useState<{ scopeKey: string; stage: SpeedData['timingStages'][number] } | null>(null);

  const primaryStage = data?.timingStages?.find((stage) => stage.stage === 'Delivery → First Dial');
  const auditContent = (title: string, value: InspectorContent['value'], meaning: string): InspectorContent => ({
    type: 'custom', title, value, scope: auditScope,
    definition: { meaning, calculation: 'The returned result is displayed without recalculation. No independent eligible sample size is supplied.', nullMeaning: 'Unavailable means a measurement was not supplied; measured zero remains zero.', limitations: data?.methodology ? [data.methodology] : undefined },
    detailLimitation: 'No affected-record filter is supplied for this measurement. Use the existing detailed reports for further investigation.',
  });
  const timingContent = (stage: SpeedData['timingStages'][number] | undefined, measure: 'median' | 'p75' | 'p90', title: string): InspectorContent => ({
    ...auditContent(title, stage?.[measure] ?? null, stage?.description || 'No timing-stage definition was returned.'),
    subtitle: stage?.stage,
    definition: { meaning: stage?.description || 'No timing-stage definition was returned.', dateBasis: 'Lead capture / fetched cohort', calculation: `The returned ${measure === 'median' ? 'median' : measure.toUpperCase()} duration is shown as formatted by the response${stage ? ` for ${stage.stage}` : ''}. The eligible sample size is not supplied.`, nullMeaning: 'Missing event timestamps cannot supply a duration; unavailable is not zero.', limitations: ['Lifecycle durations have different start and end events. They must not be treated as interchangeable latency measures.', ...(data?.methodology ? [data.methodology] : [])] },
    details: stage && <dl><div><dt>Average</dt><dd>{stage.avg || 'Unavailable'}</dd></div><div><dt>Median</dt><dd>{stage.median || 'Unavailable'}</dd></div><div><dt>Median seconds (supplied)</dt><dd>{stage.medianSec ?? 'Unavailable'}</dd></div><div><dt>P75</dt><dd>{stage.p75 || 'Unavailable'}</dd></div><div><dt>P90</dt><dd>{stage.p90 || 'Unavailable'}</dd></div><div><dt>P95</dt><dd>{stage.p95 || 'Unavailable'}</dd></div></dl>,
  });
  const chartStage = selectedTiming?.scopeKey === auditScopeKey && data?.timingStages.includes(selectedTiming.stage) ? selectedTiming.stage : null;

  return (
    <AnalyticsPageLayout className="cx-speed-page" title="Response speed" description={<>Understand how quickly leads are contacted and how downstream outcomes change as first-dial age increases.</>} actions={<ReportActions>
          <Link
            to={scoped('/contact-strategy')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle transition-colors text-xs font-medium text-text-sec hover:text-text-main shadow-xs"
            title="Inspect call-count attempt distributions"
          >
            <PhoneCall size={13} />
            <span>Contact effort</span>
          </Link>

          <Link
            to={scoped('/contact-strategy?tab=vendor_dispositions')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle transition-colors text-xs font-medium text-text-sec hover:text-text-main shadow-xs"
            title="Inspect vendor outcome dispositions"
          >
            <BarChart3 size={13} />
            <span>Vendor outcomes</span>
          </Link>

          <Link
            to={scoped('/exceptions')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle transition-colors text-xs font-medium text-text-sec hover:text-text-main shadow-xs"
            title="Investigate overdue first-dial populations"
          >
            <AlertTriangle size={13} />
            <span>SLA exceptions</span>
          </Link>
        </ReportActions>} scope={<ReportingScopeBar
        onRefresh={refreshAll}
        onExportCsv={data ? handleExportCsv : undefined}
      />}>

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
      {loading && !data && (
        <ReportSkeleton label="Calculating latency distributions and first-dial SLA compliance" metricCount={4} />
      )}

      {data && (
        <React.Fragment key={auditScopeKey}>
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <UnifiedMetricCard
              label="Median First Dial"
              icon={Clock3}
              auditContent={timingContent(primaryStage, 'median', 'Median First Dial')}
              value={primaryStage?.median || '—'}
              note={primaryStage?.stage || 'Delivery → First Dial'}
              to={scoped('/contact-strategy')}
              inspectLabel="Review contact"
            />

            <UnifiedMetricCard
              label="P90 First Dial"
              icon={Timer}
              auditContent={timingContent(primaryStage, 'p90', 'P90 First Dial')}
              value={primaryStage?.p90 || '—'}
              note="Tail latency threshold"
              to={scoped('/contact-strategy')}
              inspectLabel="Review contact"
            />

            <UnifiedMetricCard
              label="Awaiting First Dial"
              icon={lifecyclePresentation.dialled.Icon}
              auditContent={{ ...auditContent('Awaiting First Dial', data.backlog?.awaitingFirstDial, 'Delivered leads in the selected cohort without a recorded first dial.'), recordDrill: { drill: 'awaiting-first-dial' }, detailLimitation: 'The existing awaiting-first-dial drill opens this backlog for authorized administrators.' }}
              value={data.backlog?.awaitingFirstDial !== undefined
                ? formatTableNumber(data.backlog.awaitingFirstDial)
                : '—'}
              note="Undialled backlog"
              to={scoped('/lead-explorer?drill=awaiting-first-dial')}
              inspectLabel="Inspect backlog"
            />

            <UnifiedMetricCard
              label="Current 15m Breaches"
              icon={AlertTriangle}
              auditContent={{ ...auditContent('Current 15m Breaches', data.backlog?.currentSlaBreaches, 'Delivered, undialled leads waiting more than 15 minutes in the selected cohort.'), reportPath: '/exceptions' }}
              value={data.backlog?.currentSlaBreaches !== undefined
                ? formatTableNumber(data.backlog.currentSlaBreaches)
                : '—'}
              note="15-minute SLA · awaiting first dial"
              isPositiveGood={false}
              to={scoped('/exceptions')}
              inspectLabel="Review SLA queues"
            />

          </div>

          <section className="cx-contact-hero cx-speed-story" aria-label="First-dial response story">
            <LatencyDistribution rows={data.cohorts} />
            <PercentileRail title="Delivery to first dial" description="Returned timing percentiles for the delivered cohort with measured first-dial latency."
              unitLabel="s"
              points={[
                { key: 'median', label: 'Median', value: primaryStage?.medianSec, displayValue: primaryStage?.median },
                { key: 'p75', label: 'P75', value: primaryStage?.p75Sec, displayValue: primaryStage?.p75 },
                { key: 'p90', label: 'P90', value: primaryStage?.p90Sec, displayValue: primaryStage?.p90 },
              ]} />
          </section>

          <details className="cx-contact-evidence-disclosure">
            <summary>Compare latency and downstream outcomes</summary>
            <div className="p-5">
            <VolumeRateComboChart
              title="Lead age vs downstream outcomes"
              subtitle="Lead volume is shown as bars; RPC, sale and activation rates remain descriptive associations."
              data={data.cohorts}
              xKey="cohort"
              volumeKey="leads"
              volumeLabel="Leads"
              rateSeries={[
                { key: 'contactRate', label: 'RPC rate' },
                { key: 'saleRate', label: 'Sale rate' },
                { key: 'activationRate', label: 'Activation rate' },
              ]}
            />
            </div>
          </details>

          <section className="cx-speed-latency-visual bg-surface rounded-xl border border-border-subtle">
            <EvidenceBars title="Median latency by stage" description="Existing numeric timing evidence; exact reported durations remain in the table."
              items={data.timingStages.map((stage, index) => ({ key: `${stage.stage}-${index}`, label: stage.stage, value: stage.medianSec, displayValue: stage.median, detail: `P90 ${stage.p90 ?? 'Unavailable'}` }))}
              onSelect={key => { const stage = data.timingStages.find((item, index) => `${item.stage}-${index}` === key); if (stage) setSelectedTiming({ scopeKey: auditScopeKey, stage }); }}
              scaleNote="Longer bars mean a longer measured median duration. Missing numeric duration is unavailable; formatted durations are not parsed into new precision." />
          </section>

          <details className="cx-contact-evidence-disclosure">
            <summary>View exact lifecycle timing evidence</summary>
            <div className="p-4 border-b border-border-subtle bg-surface-sec flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-text-mute uppercase tracking-wider">
                  Measured Lifecycle Stages
                </h3>
                <p className="text-xs text-text-sec mt-0.5">
                  Durations run from each stated start event to its end event. Missing timestamps remain unavailable; SLA percentages are shown separately.
                </p>
              </div>
              <Clock3 size={16} className="text-text-mute" />
            </div>

            <div className="cx-performance-table-wrap overflow-x-auto" role="region" aria-label="Lifecycle timing evidence" tabIndex={0}>
              <table className="cx-performance-table w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-subtle/40 text-text-mute font-semibold">
                    <th scope="col" className="px-4 py-2.5">Stage</th>
                    <th scope="col" className="px-4 py-2.5">Definition</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Average</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Median</th>
                    <th scope="col" className="px-4 py-2.5 text-right">P75</th>
                    <th scope="col" className="px-4 py-2.5 text-right">P90</th>
                    <th scope="col" className="px-4 py-2.5 text-right">P95</th>
                    <th scope="col" className="px-4 py-2.5">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-text-main">
                  {data.timingStages.map((stage, idx) => (
                    <tr key={`${stage.stage}-${idx}`} className="hover:bg-surface-subtle/50 transition-colors">
                      <td className="px-4 py-3 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Clock3 size={13} className="text-text-mute" aria-hidden="true" />
                          <span>{stage.stage}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-sec">{stage.description}</td>
                      <td className="px-4 py-3 text-right cx-tabular">{stage.avg}</td>
                      <td className="px-4 py-3 text-right cx-tabular font-bold text-text-main">{stage.median}</td>
                      <td className="px-4 py-3 text-right cx-tabular text-text-sec">{stage.p75}</td>
                      <td className="px-4 py-3 text-right cx-tabular text-text-sec">{stage.p90}</td>
                      <td className="px-4 py-3 text-right cx-tabular text-text-mute">{stage.p95 || '—'}</td>
                      <td className="px-4 py-3"><AuditEvidenceButton content={timingContent(stage, 'median', stage.stage)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <details className="cx-contact-evidence-disclosure">
            <summary>View exact latency cohort evidence</summary>
            <div className="cx-performance-table-wrap" role="region" aria-label="Latency cohort evidence" tabIndex={0}>
              <table className="cx-performance-table">
                <caption className="sr-only">Returned counts and outcome rates for every first-dial latency cohort, including undialled and invalid timing.</caption>
                <thead><tr><th scope="col">Cohort</th><th scope="col">Leads</th><th scope="col">RPC</th><th scope="col">RPC rate</th><th scope="col">Sales</th><th scope="col">Sale rate</th><th scope="col">Activations</th><th scope="col">Activation rate</th><th scope="col">Audit</th></tr></thead>
                <tbody>{data.cohorts.map((row, idx) => <tr key={`${row.cohort}-${idx}`}>
                  <th scope="row">{row.cohort}</th><td>{formatTableNumber(row.leads)}</td><td>{formatTableNumber(row.contacted)}</td><td>{formatPercent(row.contactRate)}</td><td>{formatTableNumber(row.sales)}</td><td>{formatPercent(row.saleRate, 2)}</td><td>{formatTableNumber(row.activations)}</td><td>{formatPercent(row.activationRate)}</td>
                  <td><AuditEvidenceButton content={{ ...auditContent(row.cohort, row.leads, data.methodology || 'Returned lead population and outcomes for this first-dial timing group.'), unit: 'leads', definition: { meaning: data.methodology || 'Returned outcome associations for this first-dial timing group.', grain: 'Leads in the returned timing group.', calculation: 'Counts and rates are supplied by the response. The dialled population used for RPC rate is not separately supplied in this cohort object.', nullMeaning: 'An unavailable rate is not zero. A zero population is retained as returned.', limitations: ['Timing groups describe association with outcomes; they do not establish causation.'] }, details: <dl><div><dt>RPC count / returned RPC rate</dt><dd>{formatTableNumber(row.contacted)} / {formatPercent(row.contactRate)}</dd></div><div><dt>Sale count / returned sale rate</dt><dd>{formatTableNumber(row.sales)} / {formatPercent(row.saleRate, 2)}</dd></div><div><dt>Activation count / returned activation rate</dt><dd>{formatTableNumber(row.activations)} / {formatPercent(row.activationRate)}</dd></div></dl> }} /></td>
                </tr>)}</tbody>
              </table>
            </div>
          </details>
          <details className="cx-contact-evidence-disclosure">
            <summary>Methodology and queue context</summary>
            <div className="p-4 space-y-2 text-xs text-text-sec">
              <p>Oldest undialled: <strong>{data.backlog?.oldestUndialled || 'Unavailable'}</strong> since delivery.</p>
              <p>{data.methodology || 'Timing statistics and cohort outcomes are presented as returned.'}</p>
            </div>
          </details>

          {/* Operating Controls */}
          <details
              className="group bg-surface rounded-xl border border-border-subtle overflow-hidden transition-colors"
              open={controlsExpanded}
              onToggle={(e) => setControlsExpanded(e.currentTarget.open)}
            >
              <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-subtle transition-colors list-none select-none">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-xs font-bold text-text-main uppercase tracking-wider">
                    Operating Controls & SLA Performance
                  </span>
                  <span className="text-text-muted" aria-hidden="true">·</span>
                  <span className="text-[11px] text-text-mute font-medium">
                    Response turnaround & operating window adherence
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className="text-text-mute transition-transform duration-200 group-open:rotate-180"
                />
              </summary>

              <div className="p-5 border-t border-border-subtle bg-surface-subtle/30 space-y-4">
                {controls.isFetching && <p role="status">Loading operating controls…</p>}
                {controls.error && <OperationalError message={controls.error.message} onRetry={() => void controls.refetch()} />}
                {controls.data && <><CaptureTurnaroundPanel data={controls.data} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SlaBandsPanel data={controls.data} />
                  <OperatingWindowPanel data={controls.data} />
                </div></>}
              </div>
            </details>

          {/* Contextual navigation shortcuts */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <Link
              to={scoped('/contact-strategy')}
              className="p-3.5 bg-surface hover:bg-surface-subtle border border-border-subtle rounded-xl flex items-center justify-between group transition-colors shadow-2xs"
            >
              <div>
                <span className="text-xs font-bold text-text-main block">Contact effort</span>
                <span className="text-[11px] text-text-sec block mt-0.5">Call counts & attempt saturation</span>
              </div>
              <ArrowRight size={14} className="text-text-mute group-hover:text-brand-primary transition-colors" />
            </Link>

            <Link
              to={scoped('/contact-strategy?tab=vendor_dispositions')}
              className="p-3.5 bg-surface hover:bg-surface-subtle border border-border-subtle rounded-xl flex items-center justify-between group transition-colors shadow-2xs"
            >
              <div>
                <span className="text-xs font-bold text-text-main block">Vendor outcomes</span>
                <span className="text-[11px] text-text-sec block mt-0.5">Disposition mix & raw code mapping</span>
              </div>
              <ArrowRight size={14} className="text-text-mute group-hover:text-brand-primary transition-colors" />
            </Link>

            <Link
              to={scoped('/exceptions')}
              className="p-3.5 bg-surface hover:bg-surface-subtle border border-border-subtle rounded-xl flex items-center justify-between group transition-colors shadow-2xs"
            >
              <div>
                <span className="text-xs font-bold text-text-main block">SLA exceptions</span>
                <span className="text-[11px] text-text-sec block mt-0.5">Investigate overdue undialled leads</span>
              </div>
              <ArrowRight size={14} className="text-text-mute group-hover:text-brand-primary transition-colors" />
            </Link>

            <Link
              to={scoped('/temporal')}
              className="p-3.5 bg-surface hover:bg-surface-subtle border border-border-subtle rounded-xl flex items-center justify-between group transition-colors shadow-2xs"
            >
              <div>
                <span className="text-xs font-bold text-text-main block">Time & day</span>
                <span className="text-[11px] text-text-sec block mt-0.5">Dialling window patterns & timing heatmaps</span>
              </div>
              <ArrowRight size={14} className="text-text-mute group-hover:text-brand-primary transition-colors" />
            </Link>
          </section>
        </React.Fragment>
      )}

      <InspectorHost open={Boolean(chartStage)} onClose={() => setSelectedTiming(null)} content={chartStage ? timingContent(chartStage, 'median', chartStage.stage) : null} />
    </AnalyticsPageLayout>
  );
}
