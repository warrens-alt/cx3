import { useOperationalData } from '../lib/useOperationalData';
import React, { useMemo } from 'react';
import { AlertCircle, BookOpen, ShieldCheck } from 'lucide-react';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchRawLeads, type RawLeadsData } from '../lib/offernetClient';

export default function LeadLedger() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();

  const { data, loading, error, loadData } = useOperationalData<RawLeadsData>('LeadLedger', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
    limit: 50,
    offset: 0,
  }, fetchRawLeads);

  const columns = useMemo(() => {
    const set = new Set<string>();
    for (const row of data?.rows || []) Object.keys(row).forEach(key => set.add(key));
    return Array.from(set);
  }, [data]);

  const renderValue = (value: unknown) => {
    if (value === null || value === undefined) return <span className="text-slate-400">—</span>;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">Lead Ledger</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tenant-scoped analytical records only. Arbitrary Google Cloud project, dataset and table browsing is disabled.
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 flex items-start gap-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Protected warehouse access</div>
            <p className="text-xs mt-1">
              Rows are returned through the validated analytics API for the authorised tenant and active report scope. This page cannot issue SELECT * against arbitrary relations.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading && !data ? (
          <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Loading scoped lead records…
          </div>
        ) : data && (
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Scoped record sample</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Maximum 50 rows for the current authorised scope.</p>
              </div>
              <span className="font-mono text-xs text-slate-500">{data.rows.length} rows</span>
            </div>

            <div className="overflow-auto max-h-[620px]">
              <table className="text-xs min-w-full whitespace-nowrap">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    {columns.map(column => (
                      <th key={column} className="px-3 py-2.5 text-left">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {data.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-slate-50">
                      {columns.map(column => (
                        <td key={column} className="px-3 py-2.5 max-w-[320px] overflow-hidden text-ellipsis">
                          {renderValue(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={Math.max(columns.length, 1)} className="px-4 py-8 text-center text-slate-500">
                        No records are available for the selected scope.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
