import React, { useEffect, useState } from 'react';
import { AlertTriangle, Megaphone } from 'lucide-react';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchCampaigns, type CampaignData } from '../lib/offernetClient';

export default function CampaignIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<CampaignData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCampaigns({
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...extractOffernetFilters(filters),
      }, forceRefresh);
      setData(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load campaign evidence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient) loadData();
  }, [selectedClient, startDate, endDate, filters]);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} showVendorFilter={false} showGradeFilter={false} />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">Client & Campaign Performance</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Observed delivery metrics from the marketing source. Budget is not treated as incurred spend.
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
            Loading campaign evidence…
          </div>
        ) : data && (
          <>
            <div className={`rounded-lg border p-4 text-sm ${data.status === 'UNAVAILABLE' ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-blue-200 bg-blue-50 text-blue-950'}`}>
              <div className="font-semibold">Financial measurement: {data.status || 'PARTIAL'}</div>
              <p className="text-xs mt-1">{data.reason || 'Spend, CPC and CPL require an approved incurred-cost source.'}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Observed campaign metrics</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Channel</th>
                      <th className="px-4 py-3 text-left">Campaign</th>
                      <th className="px-4 py-3 text-left">Adset</th>
                      <th className="px-4 py-3 text-right">Impressions</th>
                      <th className="px-4 py-3 text-right">Clicks</th>
                      <th className="px-4 py-3 text-right">CTR</th>
                      <th className="px-4 py-3 text-right">Recorded Leads</th>
                      <th className="px-4 py-3 text-right">Spend / CPL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.campaigns.map((campaign, index) => (
                      <tr key={`${campaign.channel}-${campaign.campaign}-${index}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{campaign.channel}</td>
                        <td className="px-4 py-3 text-slate-700">{campaign.campaign}</td>
                        <td className="px-4 py-3 text-slate-500">{campaign.adset}</td>
                        <td className="px-4 py-3 text-right font-mono">{campaign.impressions.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono">{campaign.clicks.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono">{campaign.ctr}%</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">{campaign.leads.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-400">UNAVAILABLE</td>
                      </tr>
                    ))}
                    {data.campaigns.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          No campaign rows are available for the selected, approved scope.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
