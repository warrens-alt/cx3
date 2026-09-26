import React, { useEffect, useState } from 'react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchAgentPerformance, type AgentPerformanceData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { downloadCsv } from '../lib/formatters';
import { Users, AlertTriangle, PhoneCall, Award, Clock, Search, Table as TableIcon, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function AgentPerformanceIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<AgentPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');
  const [agentGraphMetric, setAgentGraphMetric] = useState<'sales' | 'rate' | 'volume'>('sales');

  const loadData = async (isManual = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const activeFilters = extractOffernetFilters(filters);
      const res = await fetchAgentPerformance({
        clientId: selectedClient,
        startDate,
        endDate,
        ...activeFilters
      }, isManual);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load agent performance');
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
      ['Agent ID', 'Vendor', 'Total Calls', 'Unique Leads', 'Contacts', 'Contact Rate %', 'Sales', 'Sale Rate %', 'Total Talk Time', 'Avg Handle'],
      ...data.agents.map(a => [
        a.agentId, a.vendor, a.totalCalls, a.uniqueLeads, a.contactCount, `${a.contactRate}%`, a.salesCount, `${a.saleRate}%`, a.totalTalkTime, a.avgHandleTime
      ])
    ];
    downloadCsv(`agent_performance_${selectedClient}_${startDate || 'total'}_${endDate || 'all'}`, rows);
  };

  const filteredAgents = (data?.agents || []).filter(a => 
    a.agentId.toLowerCase().includes(search.toLowerCase()) ||
    a.vendor.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 transition-all duration-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Agent Performance</h1>
            <span className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5 ml-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
              Vicidial Call Records
            </span>
            {!startDate && !endDate && Object.keys(extractOffernetFilters(filters)).length === 0 && (
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full ml-1">
                Total (Unfiltered)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Observed call activity and outcome rates by agent. No performance tier or composite score is assigned.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-xs flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading && !data && (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500 text-sm">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
            <p>Aggregating telephony records and agent talk-time metrics…</p>
          </div>
        )}

        {data && (
          <>
            {/* AGENT LEADERBOARD TABLE & GRAPH */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-blue-600" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Agent Productivity & Conversion Roster
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search agent or vendor…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {viewMode === 'graph' && (
                    <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
                      <button
                        onClick={() => setAgentGraphMetric('sales')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          agentGraphMetric === 'sales' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Sales Count
                      </button>
                      <button
                        onClick={() => setAgentGraphMetric('rate')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          agentGraphMetric === 'rate' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Conversion %
                      </button>
                      <button
                        onClick={() => setAgentGraphMetric('volume')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          agentGraphMetric === 'volume' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Dials & Contacts
                      </button>
                    </div>
                  )}

                  <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
                    <button
                      onClick={() => setViewMode('table')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                        viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="View tabular roster"
                    >
                      <TableIcon size={13} />
                      <span>Table</span>
                    </button>
                    <button
                      onClick={() => setViewMode('graph')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                        viewMode === 'graph' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="View visual agent performance"
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
                      <div role="row" className="grid grid-cols-11 items-center py-2.5">
                        <div role="columnheader" className="px-4">Agent User ID</div>
                        <div role="columnheader" className="px-4">Vendor / Campaign</div>
                        <div role="columnheader" className="px-4 text-right font-mono">Dials</div>
                        <div role="columnheader" className="px-4 text-right font-mono">Dialed Leads (037.0)</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-blue-700">Right Party Contact (039.0)</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-blue-700">RPC Rate %</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-emerald-700">Sales (040.0)</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-emerald-700">Sale Rate %</div>
                        <div role="columnheader" className="px-4 text-right font-mono">Total Talk Time</div>
                        <div role="columnheader" className="px-4 text-right font-mono">Avg Handle</div>
                        <div role="columnheader" className="px-4 text-center">Performance Tier</div>
                      </div>
                    </div>
                    <div role="rowgroup" className="divide-y divide-slate-100 font-mono">
                      {filteredAgents.map((a, idx) => (
                        <div role="row" key={`${a.agentId || 'agent'}-${idx}`} className="grid grid-cols-11 items-center py-3 hover:bg-slate-50/70">
                          <div role="cell" className="px-4 font-sans font-bold text-slate-900">{a.agentId}</div>
                          <div role="cell" className="px-4 font-sans text-slate-600">{a.vendor}</div>
                          <div role="cell" className="px-4 text-right text-slate-800">{a.totalCalls.toLocaleString()}</div>
                          <div role="cell" className="px-4 text-right text-slate-700">{a.uniqueLeads.toLocaleString()}</div>
                          <div role="cell" className="px-4 text-right font-bold text-blue-700">{a.contactCount.toLocaleString()}</div>
                          <div role="cell" className="px-4 text-right font-bold text-blue-700">{a.contactRate}%</div>
                          <div role="cell" className="px-4 text-right font-bold text-emerald-700">{a.salesCount}</div>
                          <div role="cell" className="px-4 text-right font-bold text-emerald-700">{a.saleRate}%</div>
                          <div role="cell" className="px-4 text-right text-slate-600">{a.totalTalkTime}</div>
                          <div role="cell" className="px-4 text-right text-slate-600">{a.avgHandleTime}</div>
                          <div role="cell" className="px-4 text-center font-sans text-xs">
                            <span className={`font-semibold flex items-center justify-center gap-1.5 ${
                              a.performanceTier === 'Top Tier' ? 'text-emerald-700' :
                              a.performanceTier === 'Consistent' ? 'text-blue-700' :
                              'text-amber-700'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                a.performanceTier === 'Top Tier' ? 'bg-emerald-500' :
                                a.performanceTier === 'Consistent' ? 'bg-blue-500' :
                                'bg-amber-500'
                              }`} />
                              {a.performanceTier || 'Not scored'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={filteredAgents.slice(0, 16).map(a => ({
                          agentId: a.agentId,
                          sales: a.salesCount,
                          saleRate: a.saleRate,
                          contactRate: a.contactRate,
                          calls: a.totalCalls,
                          contacts: a.contactCount,
                          tier: a.performanceTier
                        }))} 
                        margin={{ top: 10, right: 30, left: 10, bottom: 40 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="agentId" tick={{ fontSize: 10 }} stroke="#64748b" interval={0} angle={-25} textAnchor="end" height={55} />
                        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" unit={agentGraphMetric === 'rate' ? '%' : ''} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                          formatter={(value: any, name: any) => [
                            agentGraphMetric === 'rate' ? `${value}%` : Number(value).toLocaleString(),
                            name
                          ]}
                        />
                        <Legend verticalAlign="top" wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} />
                        {agentGraphMetric === 'sales' && (
                          <Bar dataKey="sales" name="Sales (040.0)" fill="#059669" radius={[3, 3, 0, 0]} />
                        )}
                        {agentGraphMetric === 'rate' && (
                          <>
                            <Bar dataKey="saleRate" name="Sale Rate % (040.0)" fill="#059669" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="contactRate" name="RPC Rate % (039.0)" fill="#2563eb" radius={[3, 3, 0, 0]} />
                          </>
                        )}
                        {agentGraphMetric === 'volume' && (
                          <>
                            <Bar dataKey="calls" name="Total Calls" fill="#64748b" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="contacts" name="Right Party Contact (039.0)" fill="#2563eb" radius={[3, 3, 0, 0]} />
                          </>
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
