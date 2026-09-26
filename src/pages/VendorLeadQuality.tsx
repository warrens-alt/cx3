import React, { useEffect, useState } from 'react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchVendorQuality, type VendorQualityData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { downloadCsv } from '../lib/formatters';
import { ShieldCheck, AlertTriangle, Building2, Share2, Award, CheckCircle, XCircle, Table as TableIcon, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function VendorLeadQuality() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<VendorQualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');
  const [graphMetric, setGraphMetric] = useState<'rates' | 'commercial' | 'volume'>('rates');
  const [vettingViewMode, setVettingViewMode] = useState<'table' | 'graph'>('table');
  const [gradesViewMode, setGradesViewMode] = useState<'table' | 'graph'>('table');

  const loadData = async (isManual = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const activeFilters = extractOffernetFilters(filters);
      const res = await fetchVendorQuality({
        clientId: selectedClient,
        startDate,
        endDate,
        ...activeFilters
      }, isManual);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load vendor quality matrix');
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
      ['Vendor', 'Leads', 'Delivery Rate %', 'Contact Rate %', 'Sale Rate %', 'Activation Rate %', 'Median First Dial', 'Calls/Lead', 'Invalid Rate %', 'Gross Revenue', 'Contribution', 'Margin %'],
      ...data.vendors.map(v => [
        v.vendor, v.leads, `${v.deliveryRate}%`, `${v.contactRate}%`, `${v.saleRate}%`, `${v.activationRate}%`,
        v.medianFirstDial, v.callsPerLead, `${v.invalidRate}%`, v.revenue, v.contribution, `${v.marginPct}%`
      ])
    ];
    downloadCsv(`vendor_quality_${selectedClient}_${startDate}_${endDate}`, rows);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 transition-all duration-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Vendor & Lead Quality Matrix</h1>
            <span className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5 ml-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Commercial Viability by Partner
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reconciliation of lead quality, invalid rates, operational contact efficiency, and net commercial contribution across all delivery partners.
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
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-3"></div>
            <p>Auditing vendor partner metrics and contribution margins…</p>
          </div>
        )}

        {data && (
          <>
            {/* VENDOR MATRIX TABLE & GRAPH */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-blue-600" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Vendor Operational & Commercial Scorecard
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  {viewMode === 'graph' && (
                    <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
                      <button
                        onClick={() => setGraphMetric('rates')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          graphMetric === 'rates' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Conversion Rates %
                      </button>
                      <button
                        onClick={() => setGraphMetric('volume')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          graphMetric === 'volume' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Volume & Yield
                      </button>
                      <button
                        onClick={() => setGraphMetric('commercial')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          graphMetric === 'commercial' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Revenue & Contribution (ZAR)
                      </button>
                    </div>
                  )}

                  {/* Table / Graph View Toggle */}
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
                      title="View as interactive comparison graph"
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
                        <div role="columnheader" className="px-4">Vendor Partner</div>
                        <div role="columnheader" className="px-4 text-right font-mono">Fetched Leads (022.0)</div>
                        <div role="columnheader" className="px-4 text-right font-mono">Delivery Rate %</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-blue-700">RPC Rate % (039.0)</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-emerald-700">Sale Rate % (040.0)</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-purple-700">Activation Rate % (046.0)</div>
                        <div role="columnheader" className="px-4 text-right font-mono">Median First Dial</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-amber-700">Invalid Rate %</div>
                        <div role="columnheader" className="px-4 text-right font-mono text-slate-700">Recorded Revenue (ZAR)</div>
                        <div role="columnheader" className="px-4 text-right font-mono">Contribution</div>
                        <div role="columnheader" className="px-4 text-right font-mono">Margin %</div>
                      </div>
                    </div>
                    <div role="rowgroup" className="divide-y divide-slate-100 font-mono tabular-nums">
                      {data.vendors.map((v, idx) => (
                        <div role="row" key={`${v.vendor || 'vendor'}-${idx}`} className="grid grid-cols-11 items-center py-3 hover:bg-slate-50/70">
                          <div role="cell" className="px-4 font-sans font-bold text-slate-900">{v.vendor}</div>
                          <div role="cell" className="px-4 text-right text-slate-800">{v.leads.toLocaleString()}</div>
                          <div role="cell" className="px-4 text-right text-slate-600">{v.deliveryRate}%</div>
                          <div role="cell" className="px-4 text-right font-bold text-blue-700">{v.contactRate}%</div>
                          <div role="cell" className="px-4 text-right font-bold text-emerald-700">{v.saleRate}%</div>
                          <div role="cell" className="px-4 text-right font-bold text-purple-700">{v.activationRate}%</div>
                          <div role="cell" className="px-4 text-right text-slate-600">{v.medianFirstDial}</div>
                          <div role="cell" className="px-4 text-right font-semibold text-amber-700">{v.invalidRate}%</div>
                          <div role="cell" className="px-4 text-right text-slate-900 font-semibold">R {v.revenue.toLocaleString()}</div>
                          <div role="cell" className={`px-4 text-right font-bold ${v.contribution >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            R {v.contribution.toLocaleString()}
                          </div>
                          <div role="cell" className={`px-4 text-right font-bold ${v.marginPct >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {v.marginPct}%
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
                      <BarChart data={data.vendors} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="vendor" tick={{ fontSize: 11 }} stroke="#64748b" interval={0} />
                        <YAxis tick={{ fontSize: 11 }} stroke="#64748b" unit={graphMetric === 'rates' ? '%' : ''} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                          formatter={(value: any, name: any) => [
                            graphMetric === 'commercial' ? `R ${Number(value).toLocaleString()}` : graphMetric === 'rates' ? `${value}%` : Number(value).toLocaleString(),
                            name
                          ]}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        {graphMetric === 'rates' && (
                          <>
                            <Bar dataKey="contactRate" name="RPC Rate %" fill="#2563eb" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="saleRate" name="Sale Rate %" fill="#059669" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="activationRate" name="Activation Rate %" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="invalidRate" name="Invalid Rate %" fill="#d97706" radius={[3, 3, 0, 0]} />
                          </>
                        )}
                        {graphMetric === 'volume' && (
                          <>
                            <Bar dataKey="leads" name="Fetched Leads" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                          </>
                        )}
                        {graphMetric === 'commercial' && (
                          <>
                            <Bar dataKey="revenue" name="Gross Revenue (ZAR)" fill="#0284c7" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="contribution" name="Net Contribution (ZAR)" fill="#10b981" radius={[3, 3, 0, 0]} />
                          </>
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* VETTING STATUS & LEAD GRADES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lead Vetting Tiers */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-blue-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                      Lead Vetting Classification
                    </h3>
                  </div>

                  <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
                    <button
                      onClick={() => setVettingViewMode('table')}
                      className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                        vettingViewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <TableIcon size={12} />
                      <span>Table</span>
                    </button>
                    <button
                      onClick={() => setVettingViewMode('graph')}
                      className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                        vettingViewMode === 'graph' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <BarChart3 size={12} />
                      <span>Graph</span>
                    </button>
                  </div>
                </div>

                {vettingViewMode === 'table' ? (
                  <div className="space-y-2 text-xs font-mono tabular-nums">
                    {data.vetting.map((vet, idx) => (
                      <div key={`${vet.vetting_color || 'vet'}-${idx}`} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${
                            vet.vetting_color === 'green' ? 'bg-emerald-500' :
                            vet.vetting_color === 'orange' ? 'bg-amber-500' :
                            vet.vetting_color === 'blue' ? 'bg-blue-500' : 'bg-slate-400'
                          }`}></span>
                          <span className="font-sans font-bold text-slate-800 uppercase">{vet.vetting_color || 'Standard'}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-slate-600">{vet.leads.toLocaleString()} leads</span>
                          <span className="text-blue-700 font-bold">{vet.contacted.toLocaleString()} RPCs</span>
                          <span className="text-emerald-700 font-bold">{vet.sales.toLocaleString()} sales</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.vetting} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="vetting_color" tick={{ fontSize: 10 }} stroke="#64748b" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                          formatter={(value: any) => [Number(value).toLocaleString(), 'Volume']}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar dataKey="leads" name="Fetched Leads" fill="#64748b" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="contacted" name="Right Party Contact (RPC)" fill="#2563eb" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="sales" name="Sales" fill="#059669" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Lead Grade Performance */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Award size={16} className="text-purple-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                      Lead Grade Conversion & Value
                    </h3>
                  </div>

                  <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
                    <button
                      onClick={() => setGradesViewMode('table')}
                      className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                        gradesViewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <TableIcon size={12} />
                      <span>Table</span>
                    </button>
                    <button
                      onClick={() => setGradesViewMode('graph')}
                      className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                        gradesViewMode === 'graph' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <BarChart3 size={12} />
                      <span>Graph</span>
                    </button>
                  </div>
                </div>

                {gradesViewMode === 'table' ? (
                  <div className="space-y-2 text-xs font-mono tabular-nums">
                    {data.grades.map((g, idx) => (
                      <div key={`${g.grade || 'grade'}-${idx}`} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                        <span className="font-sans font-bold text-slate-900">{g.grade}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-slate-600">{g.leads.toLocaleString()} leads</span>
                          <span className="text-emerald-700 font-bold">{g.sales.toLocaleString()} sales</span>
                          <span className="text-slate-900 font-bold">R {g.revenue.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.grades} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="grade" tick={{ fontSize: 10 }} stroke="#64748b" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                          formatter={(value: any, name: any) => [
                            name.includes('Revenue') ? `R ${Number(value).toLocaleString()}` : Number(value).toLocaleString(),
                            name
                          ]}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar dataKey="sales" name="Sales" fill="#059669" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="revenue" name="Revenue (ZAR)" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
