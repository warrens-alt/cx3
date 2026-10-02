import AnalyticsPageLayout from '../../components/AnalyticsPageLayout';
import { ReportActions } from '../../shared/reporting/ReportPresentation';
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Timer,
  Zap,
  Clock3,
  AlertTriangle,
  ArrowRight,
  PhoneCall,
  BarChart3,
  CalendarDays,
  ChevronDown,
} from 'lucide-react';
import ReportingScopeBar from '../../shared/reporting/ReportingScopeBar';
import { OperationalError, ReportSkeleton } from '../../components/OperationalState';
import { formatPercent, formatTableNumber } from '../../lib/formatters';
import { VolumeRateComboChart } from '../../components/charts/OperationalVisuals';
import UnifiedMetricCard from '../../components/UnifiedMetricCard';
import EvidenceBars, { evidenceBarWidth } from '../../shared/visuals/EvidenceBars';
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

  const cohortMax = useMemo(
    () => Math.max(1, ...(data?.cohorts || []).map((row) => row.leads)),
    [data?.cohorts]
  );
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
        <ReportSkeleton label="Calculating latency distributions and first-dial SLA compliance" metricCount={6} />
      )}

      {data && (
        <React.Fragment key={auditScopeKey}>
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <UnifiedMetricCard
              label="Median First Dial"
              auditContent={timingContent(primaryStage, 'median', 'Median First Dial')}
              value={primaryStage?.median || '—'}
              note={primaryStage?.stage || 'Delivery → First Dial'}
              to={scoped('/contact-strategy')}
              inspectLabel="Review contact"
            />

            <UnifiedMetricCard
              label="P75 First Dial"
              auditContent={timingContent(primaryStage, 'p75', 'P75 First Dial')}
              value={primaryStage?.p75 || '—'}
              note="75% within this latency"
              to={scoped('/contact-strategy')}
              inspectLabel="Review contact"
            />

            <UnifiedMetricCard
              label="P90 First Dial"
              auditContent={timingContent(primaryStage, 'p90', 'P90 First Dial')}
              value={primaryStage?.p90 || '—'}
              note="Tail latency threshold"
              to={scoped('/contact-strategy')}
              inspectLabel="Review contact"
            />

            <UnifiedMetricCard
              label="Awaiting First Dial"
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
              auditContent={{ ...auditContent('Current 15m Breaches', data.backlog?.currentSlaBreaches, 'Delivered, undialled leads waiting more than 15 minutes in the selected cohort.'), reportPath: '/exceptions' }}
              value={data.backlog?.currentSlaBreaches !== undefined
                ? formatTableNumber(data.backlog.currentSlaBreaches)
                : '—'}
              note="Waiting > 15 minutes"
              isPositiveGood={false}
              to={scoped('/exceptions')}
              inspectLabel="Review SLA queues"
            />

            <UnifiedMetricCard
              label="Oldest Undialled"
              auditContent={{ ...auditContent('Oldest Undialled', data.backlog?.oldestUndialled, 'The returned age since delivery for the oldest undialled lead. This is a duration, not the size of the backlog.'), reportPath: '/exceptions' }}
              value={data.backlog?.oldestUndialled || '—'}
              note="Age since delivery"
              isPositiveGood={false}
              to={scoped('/lead-explorer?drill=awaiting-first-dial')}
              inspectLabel="Inspect backlog"
            />
          </div>

          {data.methodology && (
            <p className="text-xs text-text-sec italic bg-surface-sec p-3 rounded-lg border border-border-subtle">
              {data.methodology}
            </p>
          )}

          {/* Visual Outcome Chart */}
          <div className="bg-surface rounded-xl border border-border-subtle p-5">
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

          <section className="cx-speed-latency-visual bg-surface rounded-xl border border-border-subtle">
            <EvidenceBars title="Median latency by stage" description="Existing numeric timing evidence; exact reported durations remain in the table."
              items={data.timingStages.map((stage, index) => ({ key: `${stage.stage}-${index}`, label: stage.stage, value: stage.medianSec, displayValue: stage.median, detail: `P90 ${stage.p90 ?? 'Unavailable'}` }))}
              onSelect={key => { const stage = data.timingStages.find((item, index) => `${item.stage}-${index}` === key); if (stage) setSelectedTiming({ scopeKey: auditScopeKey, stage }); }}
              scaleNote="Longer bars mean a longer measured median duration. Missing numeric duration is unavailable; formatted durations are not parsed into new precision." />
          </section>

          {/* Timing Stages Table */}
          <div className="bg-surface rounded-xl border border-border-subtle overflow-hidden">
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
                    <th className="px-4 py-2.5">Stage</th>
                    <th className="px-4 py-2.5">Definition</th>
                    <th className="px-4 py-2.5 text-right">Average</th>
                    <th className="px-4 py-2.5 text-right">Median</th>
                    <th className="px-4 py-2.5 text-right">P75</th>
                    <th className="px-4 py-2.5 text-right">P90</th>
                    <th className="px-4 py-2.5 text-right">P95</th>
                    <th className="px-4 py-2.5">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-text-main">
                  {data.timingStages.map((stage, idx) => (
                    <tr key={`${stage.stage}-${idx}`} className="hover:bg-surface-subtle/50 transition-colors">
                      <td className="px-4 py-3 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Zap size={13} className="text-brand-primary" />
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
          </div>

          {/* Outcome by Time to First Dial Rail */}
          <div className="bg-surface rounded-xl border border-border-subtle overflow-hidden">
            <div className="p-4 border-b border-border-subtle bg-surface-sec">
              <h3 className="text-xs font-semibold text-text-mute uppercase tracking-wider">
                Outcome by Time to First Dial
              </h3>
              <p className="text-xs text-text-sec mt-0.5">
                Each cohort combines population size with RPC, sale and activation yield.
              </p>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {data.cohorts.map((row, idx) => (
                <div
                  key={`${row.cohort}-${idx}`}
                  className="p-3.5 bg-surface border border-border-subtle rounded-xl flex flex-col justify-between shadow-2xs"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-main">{row.cohort}</span>
                      <span className="text-xs text-text-sec cx-tabular font-medium">
                        {formatTableNumber(row.leads)} leads
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-surface-subtle rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-brand-primary rounded-full"
                        data-state={row.leads == null ? 'unknown' : row.leads === 0 ? 'zero' : 'observed'}
                        style={{ width: `${evidenceBarWidth(row.leads, cohortMax) ?? 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border-subtle text-center text-xs">
                    <div>
                      <span className="text-[11px] text-text-mute block">RPC</span>
                      <span className="font-semibold text-text-main cx-tabular mt-0.5 block">
                        {formatPercent(row.contactRate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-mute block">Sale</span>
                      <span className="font-semibold text-brand-primary cx-tabular mt-0.5 block">
                        {formatPercent(row.saleRate, 2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-mute block">Activation</span>
                      <span className="font-semibold text-text-sec cx-tabular mt-0.5 block">
                        {formatPercent(row.activationRate)}
                      </span>
                    </div>
                  </div>
                  <AuditEvidenceButton content={{ ...auditContent(row.cohort, row.leads, data.methodology || 'Returned lead population and outcomes for this first-dial timing group.'), unit: 'leads', definition: { meaning: data.methodology || 'Returned outcome associations for this first-dial timing group.', grain: 'Leads in the returned timing group.', calculation: 'Counts and rates below are supplied by the response. The dialled population used for RPC rate is not separately supplied in this cohort object.', nullMeaning: 'An unavailable rate is not zero. A zero population is retained as returned.', limitations: ['Timing groups describe association with outcomes; they do not establish causation.'] }, details: <dl><div><dt>RPC count / returned RPC rate</dt><dd>{formatTableNumber(row.contacted)} / {formatPercent(row.contactRate)}</dd></div><div><dt>Sale count / returned sale rate</dt><dd>{formatTableNumber(row.sales)} / {formatPercent(row.saleRate, 2)}</dd></div><div><dt>Activation count / returned activation rate</dt><dd>{formatTableNumber(row.activations)} / {formatPercent(row.activationRate)}</dd></div></dl> }} />
                </div>
              ))}
            </div>
          </div>

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
