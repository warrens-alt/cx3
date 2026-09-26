import React from 'react';
import { Layers, Info, X, Clock } from 'lucide-react';
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
}

export const CliKpiStrip: React.FC<CliKpiStripProps> = ({
  summary,
  comparison,
  showPeriodComparison,
  setShowPeriodComparison,
  activeInfoMetric,
  setActiveInfoMetric,
  currency,
}) => {
  return (
    <section aria-label="Executive CLI Summary" className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Layers size={14} />
          <span>Core Dialler & Outcome KPIs</span>
        </h2>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 select-none">
            <input
              type="checkbox"
              checked={Boolean(comparison) && showPeriodComparison}
              disabled={!comparison}
              onChange={e => setShowPeriodComparison(e.target.checked)}
              className="rounded text-[#3562B3] focus:ring-[#3562B3]"
            />
            <span>Period comparison</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Total Calls */}
        <div className="cx-kpi-card relative">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Total Calls</span>
            <button
              type="button"
              onClick={() => setActiveInfoMetric(activeInfoMetric === 'totalCalls' ? null : 'totalCalls')}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Metric details"
            >
              <Info size={13} />
            </button>
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            {exactNumber(summary.totalCalls)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{summary.activeClis} active CLIs</span>
            {showPeriodComparison && comparison?.metrics.calls.pctChange && (
              <span className={`font-medium ${parseFloat(comparison.metrics.calls.pctChange) >= 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                {parseFloat(comparison.metrics.calls.pctChange) >= 0 ? '+' : ''}{comparison.metrics.calls.pctChange}%
              </span>
            )}
          </div>
        </div>

        {/* 2. Distinct Leads & Calls/Lead */}
        <div className="cx-kpi-card relative">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Leads Dialled</span>
            <button
              type="button"
              onClick={() => setActiveInfoMetric(activeInfoMetric === 'distinctLeads' ? null : 'distinctLeads')}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Metric details"
            >
              <Info size={13} />
            </button>
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            {summary.distinctLeads !== null ? exactNumber(summary.distinctLeads) : <span className="text-xs text-slate-400 font-normal">Unavailable</span>}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{summary.callsPerLead ? `${summary.callsPerLead} calls/lead` : 'Distinct lead count unavailable'}</span>
            <span className="text-slate-400">Dial density</span>
          </div>
        </div>

        {/* 3. ASR Rate (Answer Seizure Ratio) */}
        <div className="cx-kpi-card relative">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Carrier ASR Rate</span>
            <button
              type="button"
              onClick={() => setActiveInfoMetric(activeInfoMetric === 'asrRate' ? null : 'asrRate')}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Metric details"
            >
              <Info size={13} />
            </button>
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            {summary.asrRate ? `${summary.asrRate}%` : <span className="text-xs text-slate-400 font-normal">Not Provided</span>}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Carrier seizure</span>
            <span className="text-slate-400">Switch telemetry</span>
          </div>
        </div>

        {/* 4. Answer Rate */}
        <div className="cx-kpi-card relative">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Answer Rate</span>
            <button
              type="button"
              onClick={() => setActiveInfoMetric(activeInfoMetric === 'answeredRate' ? null : 'answeredRate')}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Metric details"
            >
              <Info size={13} />
            </button>
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            {summary.answeredRate ? `${summary.answeredRate}%` : <span className="text-xs text-slate-400 font-normal">N/A</span>}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Human + Machine</span>
            <span className="text-slate-400">Talk &gt; 0s</span>
          </div>
        </div>

        {/* 5. Right Party Contact (RPC) */}
        <div className="cx-kpi-card relative bg-[#EDF5FC]/40 border-[#BDD7F4]">
          <div className="flex items-center justify-between text-xs text-[#315EAD] font-medium mb-1">
            <span>RPC / Contact Rate</span>
            <button
              type="button"
              onClick={() => setActiveInfoMetric(activeInfoMetric === 'contactRate' ? null : 'contactRate')}
              className="text-[#3562B3] hover:text-[#254A8C]"
              aria-label="Metric details"
            >
              <Info size={13} />
            </button>
          </div>
          <div className="text-xl font-bold text-[#1E3A8A] tracking-tight">
            {summary.contactRate === null ? 'Unavailable' : `${summary.contactRate}%`}
          </div>
          <div className="text-[11px] text-slate-600 mt-1 flex items-center justify-between">
            <span>{exactNumber(summary.contactCount)} contacts</span>
            {showPeriodComparison && comparison?.metrics.contactRate.delta && (
              <span className={`font-semibold ${parseFloat(comparison.metrics.contactRate.delta) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {parseFloat(comparison.metrics.contactRate.delta) >= 0 ? '+' : ''}{comparison.metrics.contactRate.delta} pp
              </span>
            )}
          </div>
        </div>

        {/* 6. Sale / Call Rate */}
        <div className="cx-kpi-card relative bg-emerald-50/40 border-emerald-200">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-medium mb-1">
            <span>Sale / Call Rate</span>
            <button
              type="button"
              onClick={() => setActiveInfoMetric(activeInfoMetric === 'salePerCallRate' ? null : 'salePerCallRate')}
              className="text-emerald-700 hover:text-emerald-900"
              aria-label="Metric details"
            >
              <Info size={13} />
            </button>
          </div>
          <div className="text-xl font-bold text-emerald-900 tracking-tight">
            {summary.salePerCallRate === null ? 'Unavailable' : `${summary.salePerCallRate}%`}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 flex items-center justify-between">
            <span>{exactNumber(summary.saleCount)} sales</span>
            {showPeriodComparison && comparison?.metrics.saleRate.delta && (
              <span className={`font-semibold ${parseFloat(comparison.metrics.saleRate.delta) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {parseFloat(comparison.metrics.saleRate.delta) >= 0 ? '+' : ''}{comparison.metrics.saleRate.delta} pp
              </span>
            )}
          </div>
        </div>

        {/* 7. Sale / Contact Rate */}
        <div className="cx-kpi-card relative">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Sale / Contact Rate</span>
            <button
              type="button"
              onClick={() => setActiveInfoMetric(activeInfoMetric === 'salePerContactRate' ? null : 'salePerContactRate')}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Metric details"
            >
              <Info size={13} />
            </button>
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            {summary.salePerContactRate ? `${summary.salePerContactRate}%` : <span className="text-xs text-slate-400">N/A</span>}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Pitch-to-close</span>
            <span className="text-slate-400">RPC denominator</span>
          </div>
        </div>

        {/* 8. Conversation >= 5m Share */}
        <div className="cx-kpi-card relative">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Talk &gt;= 5m Share</span>
            <button
              type="button"
              onClick={() => setActiveInfoMetric(activeInfoMetric === 'durationGe5mPct' ? null : 'durationGe5mPct')}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Metric details"
            >
              <Info size={13} />
            </button>
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            {summary.durationGe5mRate !== null ? `${summary.durationGe5mRate}%` : <span className="text-xs text-slate-400 font-normal">Unavailable</span>}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{summary.avgDurationSeconds !== null ? `Avg: ${summary.avgDurationSeconds}s` : 'Duration not supplied'}</span>
            <span className="text-slate-400">Engagement</span>
          </div>
        </div>

        {/* 9. Average Lead Age */}
        <div className="cx-kpi-card relative">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Avg Lead Age</span>
            <button
              type="button"
              onClick={() => setActiveInfoMetric(activeInfoMetric === 'avgLeadAgeDays' ? null : 'avgLeadAgeDays')}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Metric details"
            >
              <Info size={13} />
            </button>
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            {summary.avgLeadAgeDays ? `${summary.avgLeadAgeDays}d` : <span className="text-xs text-slate-400">N/A</span>}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Capture-to-dial</span>
            <span className="text-slate-400">Latency</span>
          </div>
        </div>

        {/* 10. Commercial Outcomes */}
        <div className="cx-kpi-card relative">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Recorded Value</span>
            <span className="text-[11px] font-mono text-slate-400">{currency}</span>
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            {summary.recordedValue ? `${currency} ${exactNumber(summary.recordedValue.split('.')[0])}` : <span className="text-xs text-slate-400">Unmatched</span>}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{summary.activations ? `${summary.activations} activations` : 'Downstream'}</span>
            <span className="text-slate-400">Ledger</span>
          </div>
        </div>
      </div>

      {/* Metric Details Explanation Drawer */}
      {activeInfoMetric && CLI_METRIC_DEFINITIONS[activeInfoMetric] && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 flex items-start justify-between gap-3 animate-fadeIn">
          <div className="space-y-1">
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Info size={13} className="text-[#3562B3]" />
              <span>{CLI_METRIC_DEFINITIONS[activeInfoMetric].label}</span>
              <span className="font-mono text-[11px] bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded">
                Formula: {CLI_METRIC_DEFINITIONS[activeInfoMetric].formula}
              </span>
            </div>
            <p>
              <strong>Numerator:</strong> {CLI_METRIC_DEFINITIONS[activeInfoMetric].numerator} &bull;{' '}
              <strong>Denominator:</strong> {CLI_METRIC_DEFINITIONS[activeInfoMetric].denominator}
            </p>
            <p className="text-slate-500 italic">{CLI_METRIC_DEFINITIONS[activeInfoMetric].note}</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveInfoMetric(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
            aria-label="Close formula details"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Deterministic Period Comparison Observations */}
      {showPeriodComparison && comparison?.observations && comparison.observations.length > 0 && (
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1.5">
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Clock size={13} className="text-[#3562B3]" />
            <span>Observed Movement vs Prior Period:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
            {comparison.observations.map((obs, idx) => (
              <li key={idx}>{obs}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
