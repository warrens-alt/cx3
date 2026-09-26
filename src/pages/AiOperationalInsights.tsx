import { useOperationalData } from '../lib/useOperationalData';
import React from 'react';
import { AlertTriangle, Sparkles, ShieldCheck } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} />
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-purple-600" />
            <h1 className="text-xl font-bold text-slate-900">AI Operational Insights</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Measured operational changes and investigation populations, with explicit metric citations. Source validation remains visible.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading && !data ? (
          <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Checking insight availability…
          </div>
        ) : data ? (<>
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center gap-2"><ShieldCheck size={18} /><strong>{data.status} · Measured summaries</strong></div>
            <p className="text-sm text-slate-600">{data.reason}</p>
            <ExportAnalysisButton filename="measured_insights" rows={[
              ['Category', 'Finding', 'Metric citation', 'Investigation'],
              ...data.insights.map(item => [item.category, item.finding, item.metricReference, item.directive]),
            ]} definitions={data.reason} validationStatus="NOT_VERIFIED" />
          </div>
          {data.insights.map((item, index) => <article key={`${item.category}-${index}`} className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">{item.category}</h2>
            <p className="text-sm text-slate-800">{item.finding}</p>
            <p className="text-xs text-slate-600">{item.directive}</p>
            <details className="text-xs text-slate-500"><summary>Metric evidence</summary><p className="mt-2 break-words font-mono">{item.metricReference}</p></details>
          </article>)}
          {!data.insights.length && <p className="rounded-lg border bg-white p-6 text-sm text-slate-600">No positive exception populations or comparable sale-rate evidence were observed in this scope.</p>}
        </>) : error ? null : (
          <div className="rounded-lg border border-amber-200 bg-white p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-amber-700">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">AI summaries are currently disabled</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {data?.reason || 'AI output will remain unavailable until upstream metrics and their source contracts are independently validated.'}
                </p>
                <p className="mt-3 text-xs text-slate-500">
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
