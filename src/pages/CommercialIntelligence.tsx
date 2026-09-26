import React, { useEffect, useState } from 'react';
import { AlertTriangle, DollarSign, Database } from 'lucide-react';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchCommercial, type CommercialData } from '../lib/offernetClient';

export default function CommercialIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<CommercialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCommercial({
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...extractOffernetFilters(filters),
      }, forceRefresh);
      setData(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load commercial evidence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient) loadData();
  }, [selectedClient, startDate, endDate, filters]);

  const baseline = data?.baseline;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">Commercial Intelligence</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Recorded revenue evidence only. Profitability remains unavailable until incurred-cost and rate-card contracts are approved.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading && !data && (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            Loading commercial evidence…
          </div>
        )}

        {data && baseline && (
          <>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="font-semibold">{data.status === 'UNAVAILABLE' ? 'Profitability model withheld' : data.status}</div>
              <p className="text-xs mt-1">{data.reason}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Fetched Leads</div>
                <div className="mt-1 text-2xl font-bold font-mono">{baseline.volume.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Lead-to-Sale Rate</div>
                <div className="mt-1 text-2xl font-bold font-mono">{baseline.conversionRate}%</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Recorded Revenue</div>
                <div className="mt-1 text-2xl font-bold font-mono">R {baseline.revenue.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Recorded Revenue / Sale</div>
                <div className="mt-1 text-2xl font-bold font-mono">
                  {baseline.revenuePerSale == null ? '—' : `R ${baseline.revenuePerSale.toLocaleString()}`}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <Database size={16} className="text-blue-600" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Withheld measures</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {['CPL / media spend', 'Telephony cost', 'Contribution margin', 'Break-even volume'].map(label => (
                  <div key={label} className="rounded-md bg-slate-50 border border-slate-200 p-3">
                    <div className="text-slate-500">{label}</div>
                    <div className="mt-1 font-mono font-semibold text-slate-700">UNAVAILABLE</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
