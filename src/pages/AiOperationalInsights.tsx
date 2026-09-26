import React, { useEffect, useState } from 'react';
import { AlertTriangle, Sparkles, ShieldCheck } from 'lucide-react';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchAiInsights, type AiInsightsData } from '../lib/offernetClient';

export default function AiOperationalInsights() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<AiInsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAiInsights({
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...extractOffernetFilters(filters),
      }, forceRefresh);
      setData(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load AI insight status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient) loadData();
  }, [selectedClient, startDate, endDate, filters]);

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
            Generative operational recommendations are gated behind validated analytical inputs.
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
        ) : (
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
