import React, { useEffect, useState } from 'react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchAiInsights, type AiInsightsData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { downloadCsv } from '../lib/formatters';
import { Sparkles, AlertTriangle, CheckCircle, ArrowRight, Zap, RefreshCw } from 'lucide-react';

export default function AiOperationalInsights() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<AiInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (isManual = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const activeFilters = extractOffernetFilters(filters);
      const res = await fetchAiInsights({
        clientId: selectedClient,
        startDate,
        endDate,
        ...activeFilters
      }, isManual);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate operational AI insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedClient, startDate, endDate, filters]);

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ['Category', 'Severity', 'Finding', 'Recommended Directive', 'Metric Anchor'],
      ...data.insights.map(i => [
        i.category, i.severity, i.finding, i.directive, i.metricReference
      ])
    ];
    downloadCsv(`ai_insights_${selectedClient}_${startDate || 'total'}_${endDate || 'all'}`, rows);
  };

  const getSeverityBadge = (sev: 'HIGH' | 'MEDIUM' | 'LOW') => {
    switch (sev) {
      case 'HIGH':
        return (
          <span className="text-[11px] font-semibold text-red-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            CRITICAL PRIORITY
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            MODERATE IMPACT
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-semibold text-blue-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            OPTIMISATION TIP
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 transition-all duration-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">AI Operational Insights Engine</h1>
              <span className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5 ml-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500" />
                Grounded Intelligence
              </span>
              {!startDate && !endDate && Object.keys(extractOffernetFilters(filters)).length === 0 && (
                <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full ml-1">
                  Total (Unfiltered)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Contextual, data-driven operational directives generated from real warehouse metrics across the active reporting window.
            </p>
          </div>

          <button
            onClick={() => loadData(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Regenerate Insights</span>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-xs flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading && !data && (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500 text-sm">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-3"></div>
            <p>Evaluating warehouse telemetry and synthesizing operational insights…</p>
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-4 py-2 shadow-2xs">
              <span className="font-semibold text-slate-700">Inference Engine: {data.source}</span>
              <span>All directives are grounded in verified BigQuery event timestamps</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {data.insights.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`bg-white border rounded-lg p-5 shadow-2xs transition-all ${
                    item.severity === 'HIGH' ? 'border-red-200' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {item.category}
                      </span>
                      {getSeverityBadge(item.severity)}
                    </div>
                    <span className="text-xs font-mono font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      Metric Anchor: {item.metricReference}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mt-2">
                    {item.finding}
                  </h3>

                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs flex items-start gap-2 text-slate-800">
                    <ArrowRight size={14} className="text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-blue-900">Recommended Operational Directive:</strong> {item.directive}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
