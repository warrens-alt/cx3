import React, { useEffect, useState } from 'react';
import { AlertTriangle, Database, ShieldCheck } from 'lucide-react';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchDataIntegrity, type DataIntegrityData } from '../lib/offernetClient';

export default function DataIntegrityIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<DataIntegrityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDataIntegrity({
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...extractOffernetFilters(filters),
      }, forceRefresh);
      setData(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load data-integrity evidence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient) loadData();
  }, [selectedClient, startDate, endDate, filters]);

  const badge = (status: string) => {
    const cls = status === 'HEALTHY'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'WARNING'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';
    return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{status}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">Data Integrity & Health Monitor</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Observed discrepancy counts from the selected warehouse scope. No synthetic health score is assigned.
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
            Auditing selected records…
          </div>
        ) : data && (
          <>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="font-semibold">Validation status: {data.validationStatus || data.healthGrade}</div>
              <p className="text-xs mt-1">{data.reason}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-2 text-blue-700">
                <Database size={18} />
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Distinct leads audited</div>
                <div className="text-xl font-bold font-mono text-slate-900">{data.totalRecordsAudited.toLocaleString()}</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Observed integrity checks</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3 text-left">Check</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Observed gaps</th>
                      <th className="px-4 py-3 text-left">Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.checks.map(check => (
                      <tr key={check.checkName} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{check.checkName}</td>
                        <td className="px-4 py-3 text-slate-600">{check.category}</td>
                        <td className="px-4 py-3">{badge(check.status)}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{check.discrepancyCount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xl">
                          <div className="font-mono text-[10px] text-slate-400">{check.evidence}</div>
                          <div className="mt-1">{check.detail}</div>
                        </td>
                      </tr>
                    ))}
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
