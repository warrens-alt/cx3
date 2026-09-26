import React, { useEffect, useState } from 'react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchCampaigns, fetchClientOperationalConfig, type CampaignData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { downloadCsv } from '../lib/formatters';
import { Megaphone, AlertTriangle, Settings, DollarSign, Clock, ShieldCheck, Tag, Table as TableIcon, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function CampaignIntelligence() {
  const { selectedClient, clients } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<CampaignData | null>(null);
  const [clientConfig, setClientConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');
  const [graphMetric, setGraphMetric] = useState<'cpl' | 'volume' | 'spend'>('cpl');

  const loadData = async (isManual = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const activeFilters = extractOffernetFilters(filters);
      const [campaignRes, configRes] = await Promise.all([
        fetchCampaigns({
          clientId: selectedClient,
          startDate,
          endDate,
          ...activeFilters
        }, isManual),
        fetchClientOperationalConfig()
      ]);
      setData(campaignRes);
      setClientConfig(configRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load campaign intelligence');
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
      ['Channel', 'Campaign Name', 'Adset / Targeting', 'Spend (ZAR)', 'Impressions', 'Clicks', 'CTR %', 'Leads', 'CPL (ZAR)'],
      ...data.campaigns.map(c => [
        c.channel, c.campaign, c.adset, c.spend, c.impressions, c.clicks, `${c.ctr}%`, c.leads, c.cpl
      ])
    ];
    downloadCsv(`campaign_intelligence_${selectedClient}_${startDate}_${endDate}`, rows);
  };

  const currentClient = clients.find(c => c.id === selectedClient);
  const operational = clientConfig?.operationalConfig;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 transition-all duration-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Client & Campaign Intelligence</h1>
            <span className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5 ml-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500" />
              Multi-Client Architecture & Media Attribution
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Operational client configurations (operating hours, sales definitions, revenue rules) and media acquisition performance across advertising platforms.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-xs flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* CLIENT OPERATIONAL RULES & SETTINGS CARD */}
        {operational && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
            <div className="flex items-center gap-2 mb-4">
              <Settings size={16} className="text-blue-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Client Operational Profile: {currentClient?.name || selectedClient}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Operating Hours</span>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  {operational.operatingHours?.start} – {operational.operatingHours?.end}
                </div>
                <span className="text-[10px] text-slate-500">Mon–Fri (Workdays 1–5)</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Sales Definition</span>
                <div className="text-xs font-semibold text-emerald-800 mt-1 truncate" title={operational.salesDefinition}>
                  {operational.salesDefinition}
                </div>
                <span className="text-[10px] text-slate-500">Contract Verification Standard</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Activation Rule</span>
                <div className="text-xs font-semibold text-purple-800 mt-1 truncate" title={operational.activationDefinition}>
                  {operational.activationDefinition}
                </div>
                <span className="text-[10px] text-slate-500">First Debit / Carrier Active</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Lead Rate Card</span>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  R {operational.revenueRules?.leadCost} / lead
                </div>
                <span className="text-[10px] text-slate-500">R {operational.revenueRules?.callMinuteCost} / min dialler</span>
              </div>
            </div>
          </div>
        )}

        {/* CAMPAIGN MEDIA ATTRIBUTION TABLE & GRAPH */}
        {data && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Megaphone size={16} className="text-blue-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Media Acquisition Campaigns (Platform Insights)
                </h3>
              </div>

              <div className="flex items-center gap-3">
                {viewMode === 'graph' && (
                  <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
                    <button
                      onClick={() => setGraphMetric('cpl')}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        graphMetric === 'cpl' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Cost Per Lead (CPL)
                    </button>
                    <button
                      onClick={() => setGraphMetric('volume')}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        graphMetric === 'volume' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Leads Volume
                    </button>
                    <button
                      onClick={() => setGraphMetric('spend')}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        graphMetric === 'spend' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Ad Spend (ZAR)
                    </button>
                  </div>
                )}

                <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="View as detailed tabular ledger"
                  >
                    <TableIcon size={13} />
                    <span>Table</span>
                  </button>
                  <button
                    onClick={() => setViewMode('graph')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      viewMode === 'graph' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="View as interactive graph"
                  >
                    <BarChart3 size={13} />
                    <span>Graph</span>
                  </button>
                </div>
              </div>
            </div>

            {viewMode === 'table' ? (
              <div className="overflow-x-auto">
                <div role="table" className="w-full text-xs text-left min-w-[850px]">
                  <div role="rowgroup" className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <div role="row" className="grid grid-cols-12 items-center py-2.5">
                      <div role="columnheader" className="col-span-1 px-3">Channel</div>
                      <div role="columnheader" className="col-span-2 px-3">Campaign Name</div>
                      <div role="columnheader" className="col-span-2 px-3">Adset / Targeting</div>
                      <div role="columnheader" className="col-span-1 px-3 text-right font-mono">Spend (ZAR)</div>
                      <div role="columnheader" className="col-span-1 px-3 text-right font-mono">Impressions</div>
                      <div role="columnheader" className="col-span-1 px-3 text-right font-mono">Clicks</div>
                      <div role="columnheader" className="col-span-1 px-3 text-right font-mono text-slate-700">CPC</div>
                      <div role="columnheader" className="col-span-1 px-3 text-right font-mono">Fetched Leads</div>
                      <div role="columnheader" className="col-span-2 px-3 text-right font-mono text-emerald-700">CPL.Fetched</div>
                    </div>
                  </div>
                  <div role="rowgroup" className="divide-y divide-slate-100 font-mono">
                    {data.campaigns.map((c, idx) => (
                      <div role="row" key={`${c.campaign || 'camp'}-${idx}`} className="grid grid-cols-12 items-center py-3 hover:bg-slate-50/70">
                        <div role="cell" className="col-span-1 px-3 font-sans font-bold text-slate-900">{c.channel}</div>
                        <div role="cell" className="col-span-2 px-3 font-sans text-slate-800 truncate">{c.campaign}</div>
                        <div role="cell" className="col-span-2 px-3 font-sans text-slate-500 text-[11px] truncate">{c.adset}</div>
                        <div role="cell" className="col-span-1 px-3 text-right text-slate-800">R {c.spend.toLocaleString()}</div>
                        <div role="cell" className="col-span-1 px-3 text-right text-slate-600">{c.impressions.toLocaleString()}</div>
                        <div role="cell" className="col-span-1 px-3 text-right text-slate-600">{c.clicks.toLocaleString()}</div>
                        <div role="cell" className="col-span-1 px-3 text-right text-slate-700">R {c.cpc ?? (c.clicks > 0 ? (c.spend / c.clicks).toFixed(2) : '0.00')}</div>
                        <div role="cell" className="col-span-1 px-3 text-right font-bold text-blue-700">{c.leads.toLocaleString()}</div>
                        <div role="cell" className="col-span-2 px-3 text-right font-bold text-emerald-700">R {c.cpl}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.campaigns} margin={{ top: 10, right: 30, left: 10, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="campaign" tick={{ fontSize: 10 }} stroke="#64748b" interval={0} angle={-25} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                        formatter={(value: any, name: any) => [
                          name.includes('Spend') || name.includes('CPL') ? `R ${Number(value).toLocaleString()}` : Number(value).toLocaleString(),
                          name
                        ]}
                      />
                      <Legend verticalAlign="top" wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} />
                      {graphMetric === 'cpl' && (
                        <Bar dataKey="cpl" name="Cost per Fetched Lead (CPL.Fetched ZAR)" fill="#059669" radius={[3, 3, 0, 0]} />
                      )}
                      {graphMetric === 'volume' && (
                        <Bar dataKey="leads" name="Fetched Leads" fill="#2563eb" radius={[3, 3, 0, 0]} />
                      )}
                      {graphMetric === 'spend' && (
                        <Bar dataKey="spend" name="Media Spend (ZAR)" fill="#0284c7" radius={[3, 3, 0, 0]} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
