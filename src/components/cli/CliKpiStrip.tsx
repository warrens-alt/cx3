import React from 'react';
import '../../styles/cliVisuals.css';
import TelemetryRail from '../../shared/visuals/TelemetryRail';
import { Layers, Info, X, Clock, Search, ArrowRight } from 'lucide-react';
import type { CliPerformanceResponse } from '../../../contracts/cliPerformance';
import { CLI_METRIC_DEFINITIONS } from '../../../contracts/cliPerformance';
import { exactNumber } from '../../../contracts/format';

interface CliKpiStripProps {
  summary: NonNullable<CliPerformanceResponse['summary']>;
  comparison?: CliPerformanceResponse['periodComparison'];
  showPeriodComparison: boolean;
  setShowPeriodComparison: (show: boolean) => void;
  activeInfoMetric: string | null;
  setActiveInfoMetric: (metric: string | null) => void;
  currency: string;
  onWhyChanged?: (metric: string, label?: string) => void;
  onInspect?: (metric: string) => void;
}

export const CliKpiStrip: React.FC<CliKpiStripProps> = ({
  summary,
  comparison,
  showPeriodComparison,
  setShowPeriodComparison,
  activeInfoMetric,
  setActiveInfoMetric,
  currency,
  onWhyChanged,
  onInspect,
}) => {
  const renderCardFooter = (metricKey: string, metricLabel: string, inspectId: string) => {
    if (!onWhyChanged && !onInspect) return null;
    return (
      <div className="flex items-center justify-between text-[11px] pt-2 mt-2 border-t border-border-subtle">
        {onWhyChanged && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-brand-primary hover:text-brand-primary font-medium cursor-pointer"
            onClick={() => onWhyChanged(metricKey, metricLabel)}
            title={`Investigate why ${metricLabel.toLowerCase()} changed`}
          >
            <span>Why changed?</span>
            <Search size={10} aria-hidden="true" />
          </button>
        )}
        {onInspect && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-text-sec hover:text-brand-primary font-medium cursor-pointer ml-auto"
            onClick={() => onInspect(inspectId)}
            title={`Inspect ${metricLabel}`}
          >
            <span>Inspect</span>
            <ArrowRight size={10} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  };
  return (
    <section aria-label="Executive CLI Summary" className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xs font-semibold text-text-sec flex items-center gap-1.5">
          <Layers size={14} />
          <span>Caller ID telemetry</span>
        </h2>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer text-text-sec select-none">
            <input
              type="checkbox"
              checked={Boolean(comparison) && showPeriodComparison}
              disabled={!comparison}
              onChange={e => setShowPeriodComparison(e.target.checked)}
              className="rounded text-brand-primary focus:ring-brand-primary"
            />
            <span>Period comparison</span>
          </label>
        </div>
      </div>

      <TelemetryRail label="Caller ID telemetry" className="cx-cli-telemetry">
        {/* 1. Total Calls */}
        <div className="cx-cli-metric relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-sec mb-1">
              <span>Total Calls</span>
              <button
                type="button"
                onClick={() => setActiveInfoMetric(activeInfoMetric === 'totalCalls' ? null : 'totalCalls')}
                className="text-text-mute hover:text-text-sec"
                aria-label="About Total Calls"
              >
                <Info size={13} />
              </button>
            </div>
            <div className="text-xl font-bold text-text-main tracking-tight">
              {exactNumber(summary.totalCalls)}
            </div>
            <div className="text-[11px] text-text-sec mt-1 flex items-center justify-between">
              <span>{summary.activeClis} active CLIs</span>
              {showPeriodComparison && comparison?.metrics.calls.pctChange && (
                <span className={`font-medium ${parseFloat(comparison.metrics.calls.pctChange) >= 0 ? 'text-text-main' : 'text-text-sec'}`}>
                  {parseFloat(comparison.metrics.calls.pctChange) >= 0 ? '+' : ''}{comparison.metrics.calls.pctChange}%
                </span>
              )}
            </div>
          </div>
          {renderCardFooter('dialRate', 'Total Calls', 'totalCalls')}
        </div>

        {/* 2. Distinct Leads & Calls/Lead */}
        <div className="cx-cli-metric relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-sec mb-1">
              <span>Leads Dialled</span>
              <button
                type="button"
                onClick={() => setActiveInfoMetric(activeInfoMetric === 'distinctLeads' ? null : 'distinctLeads')}
                className="text-text-mute hover:text-text-sec"
                aria-label="About Leads Dialled"
              >
                <Info size={13} />
              </button>
            </div>
            <div className="text-xl font-bold text-text-main tracking-tight">
              {summary.distinctLeads !== null ? exactNumber(summary.distinctLeads) : <span className="text-xs text-text-mute font-normal">Unavailable</span>}
            </div>
            <div className="text-[11px] text-text-sec mt-1 flex items-center justify-between">
              <span>{summary.callsPerLead ? `${summary.callsPerLead} calls/lead` : 'Distinct lead count unavailable'}</span>
              <span className="text-text-mute">Dial density</span>
            </div>
          </div>
          {renderCardFooter('dialRate', 'Leads Dialled', 'distinctLeads')}
        </div>

        {/* 3. ASR Rate (Answer Seizure Ratio) */}
        <div className="cx-cli-metric relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-sec mb-1">
              <span>Carrier ASR Rate</span>
              <button
                type="button"
                onClick={() => setActiveInfoMetric(activeInfoMetric === 'asrRate' ? null : 'asrRate')}
                className="text-text-mute hover:text-text-sec"
                aria-label="About Carrier ASR Rate"
              >
                <Info size={13} />
              </button>
            </div>
            <div className="text-xl font-bold text-text-main tracking-tight">
              {summary.asrRate ? `${summary.asrRate}%` : <span className="text-xs text-text-mute font-normal">Not Provided</span>}
            </div>
            <div className="text-[11px] text-text-sec mt-1 flex items-center justify-between">
              <span>Carrier seizure</span>
              <span className="text-text-mute">Switch telemetry</span>
            </div>
          </div>
          {renderCardFooter('dialRate', 'Carrier ASR Rate', 'asrRate')}
        </div>

        {/* 4. Answer Rate */}
        <div className="cx-cli-metric relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-sec mb-1">
              <span>Answer Rate</span>
              <button
                type="button"
                onClick={() => setActiveInfoMetric(activeInfoMetric === 'answeredRate' ? null : 'answeredRate')}
                className="text-text-mute hover:text-text-sec"
                aria-label="About Answer Rate"
              >
                <Info size={13} />
              </button>
            </div>
            <div className="text-xl font-bold text-text-main tracking-tight">
              {summary.answeredRate ? `${summary.answeredRate}%` : <span className="text-xs text-text-mute font-normal">N/A</span>}
            </div>
            <div className="text-[11px] text-text-sec mt-1 flex items-center justify-between">
              <span>Human + Machine</span>
              <span className="text-text-mute">Talk &gt; 0s</span>
            </div>
          </div>
          {renderCardFooter('dialRate', 'Answer Rate', 'answeredRate')}
        </div>

        {/* 5. Right Party Contact (RPC) */}
        <div className="cx-cli-metric relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-sec font-medium mb-1">
              <span>RPC / Contact Rate</span>
              <button
                type="button"
                onClick={() => setActiveInfoMetric(activeInfoMetric === 'contactRate' ? null : 'contactRate')}
                className="text-brand-primary hover:text-brand-primary"
                aria-label="About RPC / Contact Rate"
              >
                <Info size={13} />
              </button>
            </div>
            <div className="text-xl font-bold text-text-main tracking-tight">
              {summary.contactRate === null ? 'Unavailable' : `${summary.contactRate}%`}
            </div>
            <div className="text-[11px] text-text-sec mt-1 flex items-center justify-between">
              <span>{exactNumber(summary.contactCount)} contacts</span>
              {showPeriodComparison && comparison?.metrics.contactRate.delta && (
                <span className={`font-semibold ${parseFloat(comparison.metrics.contactRate.delta) >= 0 ? 'text-text-main' : 'text-text-sec'}`}>
                  {parseFloat(comparison.metrics.contactRate.delta) >= 0 ? '+' : ''}{comparison.metrics.contactRate.delta} pp
                </span>
              )}
            </div>
          </div>
          {renderCardFooter('contactRate', 'Contact Rate', 'contactRate')}
        </div>

        {/* 6. Sale / Call Rate */}
        <div className="cx-cli-metric relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-main font-medium mb-1">
              <span>Sale / Call Rate</span>
              <button
                type="button"
                onClick={() => setActiveInfoMetric(activeInfoMetric === 'salePerCallRate' ? null : 'salePerCallRate')}
                className="text-text-main hover:text-text-main"
                aria-label="About Sale / Call Rate"
              >
                <Info size={13} />
              </button>
            </div>
            <div className="text-xl font-bold text-text-main tracking-tight">
              {summary.salePerCallRate === null ? 'Unavailable' : `${summary.salePerCallRate}%`}
            </div>
            <div className="text-[11px] text-text-main mt-1 flex items-center justify-between">
              <span>{exactNumber(summary.saleCount)} sales</span>
              {showPeriodComparison && comparison?.metrics.saleRate.delta && (
                <span className={`font-semibold ${parseFloat(comparison.metrics.saleRate.delta) >= 0 ? 'text-text-main' : 'text-text-sec'}`}>
                  {parseFloat(comparison.metrics.saleRate.delta) >= 0 ? '+' : ''}{comparison.metrics.saleRate.delta} pp
                </span>
              )}
            </div>
          </div>
          {renderCardFooter('leadToSaleRate', 'Sale / Call Rate', 'salePerCallRate')}
        </div>

        {/* 7. Sale / Contact Rate */}
        <div className="cx-cli-metric relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-sec mb-1">
              <span>Sale / Contact Rate</span>
              <button
                type="button"
                onClick={() => setActiveInfoMetric(activeInfoMetric === 'salePerContactRate' ? null : 'salePerContactRate')}
                className="text-text-mute hover:text-text-sec"
                aria-label="About Sale / Contact Rate"
              >
                <Info size={13} />
              </button>
            </div>
            <div className="text-xl font-bold text-text-main tracking-tight">
              {summary.salePerContactRate ? `${summary.salePerContactRate}%` : <span className="text-xs text-text-mute">N/A</span>}
            </div>
            <div className="text-[11px] text-text-sec mt-1 flex items-center justify-between">
              <span>Pitch-to-close</span>
              <span className="text-text-mute">RPC denominator</span>
            </div>
          </div>
          {renderCardFooter('leadToSaleRate', 'Sale / Contact Rate', 'salePerContactRate')}
        </div>

        {/* 8. Conversation >= 5m Share */}
        <div className="cx-cli-metric relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-sec mb-1">
              <span>Talk &gt;= 5m Share</span>
              <button
                type="button"
                onClick={() => setActiveInfoMetric(activeInfoMetric === 'durationGe5mPct' ? null : 'durationGe5mPct')}
                className="text-text-mute hover:text-text-sec"
                aria-label="About Talk ≥ 5m Share"
              >
                <Info size={13} />
              </button>
            </div>
            <div className="text-xl font-bold text-text-main tracking-tight">
              {summary.durationGe5mRate !== null ? `${summary.durationGe5mRate}%` : <span className="text-xs text-text-mute font-normal">Unavailable</span>}
            </div>
            <div className="text-[11px] text-text-sec mt-1 flex items-center justify-between">
              <span>{summary.avgDurationSeconds !== null ? `Avg: ${summary.avgDurationSeconds}s` : 'Duration not supplied'}</span>
              <span className="text-text-mute">Engagement</span>
            </div>
          </div>
          {renderCardFooter('contactRate', 'Talk Duration Share', 'durationGe5mPct')}
        </div>

        {/* 9. Average Lead Age */}
        <div className="cx-cli-metric relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-sec mb-1">
              <span>Avg Lead Age</span>
              <button
                type="button"
                onClick={() => setActiveInfoMetric(activeInfoMetric === 'avgLeadAgeDays' ? null : 'avgLeadAgeDays')}
                className="text-text-mute hover:text-text-sec"
                aria-label="About Average Lead Age"
              >
                <Info size={13} />
              </button>
            </div>
            <div className="text-xl font-bold text-text-main tracking-tight">
              {summary.avgLeadAgeDays ? `${summary.avgLeadAgeDays}d` : <span className="text-xs text-text-mute">N/A</span>}
            </div>
            <div className="text-[11px] text-text-sec mt-1 flex items-center justify-between">
              <span>Capture-to-dial</span>
              <span className="text-text-mute">Latency</span>
            </div>
          </div>
          {renderCardFooter('dialRate', 'Avg Lead Age', 'avgLeadAgeDays')}
        </div>

        {/* 10. Commercial Outcomes */}
        <div className="cx-cli-metric relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-sec mb-1">
              <span>Recorded Value</span>
              <span className="text-[11px] text-text-mute">{currency}</span>
            </div>
            <div className="text-xl font-bold text-text-main tracking-tight">
              {summary.recordedValue ? `${currency} ${exactNumber(summary.recordedValue.split('.')[0])}` : <span className="text-xs text-text-mute">Unmatched</span>}
            </div>
            <div className="text-[11px] text-text-sec mt-1 flex items-center justify-between">
              <span>{summary.activations ? `${summary.activations} activations` : 'Downstream'}</span>
              <span className="text-text-mute">Ledger</span>
            </div>
          </div>
          {renderCardFooter('leadToSaleRate', 'Recorded Commercial Value', 'recordedValue')}
        </div>
      </TelemetryRail>

      {/* Metric Details Explanation Drawer */}
      {activeInfoMetric && CLI_METRIC_DEFINITIONS[activeInfoMetric] && (
        <div className="bg-surface-subtle border border-border-subtle rounded-lg p-3 text-xs text-text-sec flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="font-semibold text-text-main flex items-center gap-1.5">
              <Info size={13} className="text-brand-primary" />
              <span>{CLI_METRIC_DEFINITIONS[activeInfoMetric].label}</span>
              <span className="font-mono text-[11px] bg-surface-sec text-text-main px-1.5 py-0.2 rounded">
                Formula: {CLI_METRIC_DEFINITIONS[activeInfoMetric].formula}
              </span>
            </div>
            <p>
              <strong>Numerator:</strong> {CLI_METRIC_DEFINITIONS[activeInfoMetric].numerator} &bull;{' '}
              <strong>Denominator:</strong> {CLI_METRIC_DEFINITIONS[activeInfoMetric].denominator}
            </p>
            <p className="text-text-sec italic">{CLI_METRIC_DEFINITIONS[activeInfoMetric].note}</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveInfoMetric(null)}
            className="text-text-mute hover:text-text-sec p-1"
            aria-label="Close formula details"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Deterministic Period Comparison Observations */}
      {showPeriodComparison && comparison?.observations && comparison.observations.length > 0 && (
        <div className="bg-surface-subtle border border-border-subtle rounded-lg p-3 text-xs text-text-sec space-y-1.5">
          <div className="font-semibold text-text-main flex items-center gap-1.5">
            <Clock size={13} className="text-brand-primary" />
            <span>Observed Movement vs Prior Period:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1 text-text-sec">
            {comparison.observations.map((obs, idx) => (
              <li key={idx}>{obs}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
