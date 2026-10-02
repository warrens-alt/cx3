import React from 'react';
import {
  Clock3,
  ArrowRight,
  PackageCheck,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type { AdaptedSalesActivation } from '../model/salesActivationAdapter';
import { ActivationAgeingPanel } from '../../../components/OfferNetControlPanels';

interface SalesTimingAndCoverageProps {
  model: AdaptedSalesActivation;
  operatingControlsExpanded: boolean;
  onToggleOperatingControls: () => void;
  controlsData: any;
  controlsLoading: boolean;
  controlsError?: string | null;
}

export default function SalesTimingAndCoverage({
  model,
  operatingControlsExpanded,
  onToggleOperatingControls,
  controlsData,
  controlsLoading,
  controlsError,
}: SalesTimingAndCoverageProps) {
  const { timing, maturation, methodology } = model;

  return (
    <div className="space-y-4" aria-label="Timing and methodology">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Fulfilment Timing Panel */}
        <section className="enterprise-card cx-analytics-card p-4">
          <header className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div>
              <span className="cx-command-section-kicker">Fulfilment velocity</span>
              <h2 className="text-sm font-semibold text-text-main">Outcome latency</h2>
              <p className="text-xs text-text-sec">
                Elapsed duration between intake, sale event, and activation.
              </p>
            </div>
            <Clock3 size={16} className="text-text-muted" />
          </header>

          <div className="grid grid-cols-2 gap-3 pt-3">
            {/* Capture to Sale */}
            <div className="bg-surface-subtle p-2.5 rounded-md border border-border-subtle">
              <span className="text-[11px] font-semibold text-text-sec block">
                Capture → Sale
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-bold text-text-main">{timing.avgTimeToSale}</span>
                <span className="text-[11px] text-text-muted">avg</span>
              </div>
              <div className="text-[11px] text-text-sec mt-1 flex items-center justify-between">
                <span>Median: <strong>{timing.medianTimeToSale}</strong></span>
              </div>
              <div className="text-[11px] text-text-muted mt-1">
                Start: Lead intake • End: Sale timestamp
              </div>
            </div>

            {/* Sale to Activation */}
            <div className="bg-surface-subtle p-2.5 rounded-md border border-border-subtle">
              <span className="text-[11px] font-semibold text-text-sec block">
                Sale → Activation
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-bold text-text-main">{timing.avgTimeToActivation}</span>
                <span className="text-[11px] text-text-muted">avg</span>
              </div>
              <div className="text-[11px] text-text-sec mt-1 flex items-center justify-between">
                <span>Median: <strong>{timing.medianTimeToActivation}</strong></span>
              </div>
              <div className="text-[11px] text-text-muted mt-1">
                Start: Sale timestamp • End: Activation timestamp
              </div>
            </div>
          </div>
        </section>

        {/* 2. Maturation Policy & Limitation Panel */}
        <section className="enterprise-card cx-analytics-card p-4">
          <header className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div>
              <span className="cx-command-section-kicker">Cohort maturation</span>
              <h2 className="text-sm font-semibold text-text-main">Maturation status & disclosure</h2>
              <p className="text-xs text-text-sec">
                Independent activation event join verification.
              </p>
            </div>
            <PackageCheck size={16} className="text-text-muted" />
          </header>

          <div className="pt-3 space-y-2">
            <div className="flex items-start gap-2.5 p-3 rounded-md bg-semantic-warn-bg/60 border border-semantic-warn/60 text-xs">
              <AlertCircle size={16} className="text-semantic-warn shrink-0 mt-0.5" />
              <div>
                <strong className="text-semantic-warn font-semibold block">
                  Maturation model: {maturation.status}
                </strong>
                <p className="text-semantic-warn text-[11px] mt-0.5 leading-relaxed">
                  {maturation.reason}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-text-sec leading-relaxed">
              Recent sales cohorts cannot be judged against historical benchmarks until event-level joins are proven. No synthetic extrapolation or fabricated D7/D14 curve is displayed.
            </p>
          </div>
        </section>
      </div>

      {/* 3. Optional On-Demand Operating Controls Panel */}
      <section className="enterprise-card cx-analytics-card">
        <header
          className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-surface-subtle transition-colors"
          onClick={onToggleOperatingControls}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggleOperatingControls(); }}
          aria-expanded={operatingControlsExpanded}
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal size={15} className="text-action" />
            <div>
              <h3 className="text-xs font-semibold text-text-main">
                Operating controls & SLA threshold configuration
              </h3>
              <p className="text-[11px] text-text-sec">
                {operatingControlsExpanded
                  ? 'Showing active SLA limits and ageing thresholds for this client workspace.'
                  : 'Load client SLA threshold configuration and operating rules (loaded on demand).'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs font-medium text-action">
            <span>{operatingControlsExpanded ? 'Collapse' : 'Expand operating controls'}</span>
            {operatingControlsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </header>

        {operatingControlsExpanded && (
          <div className="p-4 border-t border-border-subtle bg-surface-subtle">
            {controlsLoading && (
              <div className="py-6 text-center text-xs text-text-sec flex items-center justify-center gap-2">
                <div className="cx-command-spinner" /> Loading operating controls…
              </div>
            )}
            {controlsError && (
              <div className="p-3 bg-semantic-neg-bg text-semantic-neg text-xs rounded-md border border-semantic-neg">
                Failed to load operating controls: {controlsError}
              </div>
            )}
            {controlsData && (
              <div className="space-y-3">
                <ActivationAgeingPanel data={controlsData} />
              </div>
            )}
            {!controlsLoading && !controlsError && !controlsData && (
              <div className="py-4 text-center text-xs text-text-muted">
                No active operating control limits configured for this tenant.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
