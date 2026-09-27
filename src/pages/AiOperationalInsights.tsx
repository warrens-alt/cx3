import { useOperationalData } from '../lib/useOperationalData';
import React from 'react';
import { AlertTriangle, Activity, ShieldCheck, RefreshCw } from 'lucide-react';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchAiInsights, type AiInsightsData } from '../lib/offernetClient';

export default function AiOperationalInsights() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();

  const { data, loading, error, loadData } = useOperationalData<AiInsightsData>('AiOperationalInsights', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, fetchAiInsights);

  return (
    <div className="cx-command-page">
      <OffernetFilterBar onRefresh={() => loadData(true)} />
      <div className="cx-command-content">
        <header className="cx-command-hero">
          <div>
            <span className="cx-command-eyebrow">Operational Intelligence</span>
            <h1>Deterministic Operational Insights</h1>
            <p>
              Measured operational changes and investigation populations, with explicit metric citations. Source validation remains visible.
            </p>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center justify-between gap-2" role="alert">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => loadData(true)}
              className="text-red-900 underline font-semibold hover:text-red-700 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !data ? (
          <div className="cx-command-loading" role="status">
            <div className="cx-command-spinner" />
            <span>Checking insight availability…</span>
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="enterprise-card p-5 space-y-3">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                <ShieldCheck size={18} className="text-blue-600" />
                <span>{data.status} · Measured summaries</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{data.reason}</p>
              <ExportAnalysisButton
                filename="measured_insights"
                rows={[
                  ['Category', 'Finding', 'Metric citation', 'Investigation'],
                  ...data.insights.map(item => [item.category, item.finding, item.metricReference, item.directive]),
                ]}
                definitions={data.reason}
                validationStatus="NOT_VERIFIED"
              />
            </div>
            {data.insights.map((item, index) => (
              <article key={`${item.category}-${index}`} className="enterprise-card p-5 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">{item.category}</h2>
                <p className="text-sm text-slate-800 leading-relaxed">{item.finding}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{item.directive}</p>
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer font-medium hover:text-slate-800">Metric evidence</summary>
                  <p className="mt-2 break-words font-mono text-[11px] bg-slate-50 p-2.5 rounded border border-slate-200">{item.metricReference}</p>
                </details>
              </article>
            ))}
            {!data.insights.length && (
              <div className="enterprise-card p-8 text-center text-sm text-slate-600">
                No positive exception populations or comparable sale-rate evidence were observed in this scope.
              </div>
            )}
          </div>
        ) : error ? null : (
          <div className="enterprise-card p-6 border-amber-200 bg-amber-50/40">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-amber-700 shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-sm">AI summaries are currently disabled</h2>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                  {data?.reason || 'AI output will remain unavailable until upstream metrics and their source contracts are independently validated.'}
                </p>
                <p className="mt-3 text-xs text-slate-500 font-mono">
                  No fallback benchmarks, invented conversion rates, or synthetic recommendations are shown in live mode.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
