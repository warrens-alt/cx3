import React, { useMemo } from 'react';
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
import { OperationalError } from '../../components/OperationalState';
import { formatPercent, formatTableNumber } from '../../lib/formatters';
import { VolumeRateComboChart } from '../../components/charts/OperationalVisuals';
import {
  CaptureTurnaroundPanel,
  SlaBandsPanel,
  OperatingWindowPanel,
} from '../../components/OfferNetControlPanels';
import { useSpeedModel } from './model/useSpeedModel';

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
  } = useSpeedModel();

  const cohortMax = useMemo(
    () => Math.max(1, ...(data?.cohorts || []).map((row) => row.leads)),
    [data?.cohorts]
  );
  const primaryStage = data?.timingStages?.find((stage) => stage.stage === 'Delivery → First Dial');

  return (
    <div className="space-y-6">
      {/* 1. Scope Bar */}
      <ReportingScopeBar
        onRefresh={refreshAll}
        onExportCsv={data ? handleExportCsv : undefined}
      />

      {/* 2. Page Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-1 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-text-mute uppercase tracking-wider">
            <Timer size={13} className="text-brand-primary" />
            <span>Contact Centre</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text-main mt-0.5">
            Response Speed & Latency
          </h1>
          <p className="text-sm text-text-sec mt-1">
            Understand how quickly leads are contacted and how downstream outcomes change as first-dial age increases.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </header>

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
        <div className="p-12 text-center text-sm text-text-sec bg-surface rounded-xl border border-border-subtle animate-pulse">
          Calculating latency distributions and first-dial SLA compliance…
        </div>
      )}

      {data && (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
              <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
                Median First Dial
              </span>
              <span className="text-2xl font-extrabold text-text-main cx-tabular mt-1 block">
                {primaryStage?.median || '—'}
              </span>
              <span className="text-[11px] text-text-sec mt-1 block">
                {primaryStage?.stage || 'Delivery → First Dial'}
              </span>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
              <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
                P75 First Dial
              </span>
              <span className="text-2xl font-extrabold text-text-main cx-tabular mt-1 block">
                {primaryStage?.p75 || '—'}
              </span>
              <span className="text-[11px] text-text-sec mt-1 block">
                75% within this latency
              </span>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
              <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
                P90 First Dial
              </span>
              <span className="text-2xl font-extrabold text-text-main cx-tabular mt-1 block">
                {primaryStage?.p90 || '—'}
              </span>
              <span className="text-[11px] text-text-sec mt-1 block">Tail latency</span>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
              <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
                Awaiting First Dial
              </span>
              <span className="text-2xl font-extrabold text-text-main cx-tabular mt-1 block">
                {data.backlog?.awaitingFirstDial !== undefined
                  ? formatTableNumber(data.backlog.awaitingFirstDial)
                  : '—'}
              </span>
              <span className="text-[11px] text-text-sec mt-1 block">Undialled backlog</span>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
              <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
                Current 15m Breaches
              </span>
              <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 cx-tabular mt-1 block">
                {data.backlog?.currentSlaBreaches !== undefined
                  ? formatTableNumber(data.backlog.currentSlaBreaches)
                  : '—'}
              </span>
              <span className="text-[11px] text-text-sec mt-1 block">Waiting &gt; 15 min</span>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
              <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
                Oldest Undialled
              </span>
              <span className="text-2xl font-extrabold text-text-main cx-tabular mt-1 block truncate">
                {data.backlog?.oldestUndialled || '—'}
              </span>
              <span className="text-[11px] text-text-sec mt-1 block">Age since delivery</span>
            </div>
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

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-subtle/40 text-text-mute font-semibold">
                    <th className="px-4 py-2.5">Stage</th>
                    <th className="px-4 py-2.5">Definition</th>
                    <th className="px-4 py-2.5 text-right">Average</th>
                    <th className="px-4 py-2.5 text-right">Median</th>
                    <th className="px-4 py-2.5 text-right">P75</th>
                    <th className="px-4 py-2.5 text-right">P90</th>
                    <th className="px-4 py-2.5 text-right">P95</th>
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
                        style={{ width: `${Math.max(2, (row.leads / cohortMax) * 100)}%` }}
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
                </div>
              ))}
            </div>
          </div>

          {/* Operating Controls */}
          {controls.data && (
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
                <CaptureTurnaroundPanel data={controls.data} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SlaBandsPanel data={controls.data} />
                  <OperatingWindowPanel data={controls.data} />
                </div>
              </div>
            </details>
          )}

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
        </>
      )}
    </div>
  );
}
