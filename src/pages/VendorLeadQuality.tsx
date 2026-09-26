import React, { useEffect, useState } from 'react';
import { AlertTriangle, Building2 } from 'lucide-react';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchVendorQuality, type VendorQualityData } from '../lib/offernetClient';

export default function VendorLeadQuality() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<VendorQualityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchVendorQuality({
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...extractOffernetFilters(filters),
      }, forceRefresh);
      setData(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load vendor quality evidence');
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
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">Vendor & Lead Quality Matrix</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Observed delivery, contact, sale, activation and quality metrics by vendor. Cost-derived vendor rankings are withheld.
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
            Loading vendor evidence…
          </div>
        ) : data && (
          <>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="font-semibold">Commercial metrics: {data.commercialStatus || 'UNAVAILABLE'}</div>
              <p className="text-xs mt-1">{data.commercialReason || 'Approved cost contracts are required before contribution or margin can be reported.'}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Vendor operational evidence</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[1050px]">
                  <thead className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Vendor</th>
                      <th className="px-4 py-3 text-right">Leads</th>
                      <th className="px-4 py-3 text-right">Delivery</th>
                      <th className="px-4 py-3 text-right">Contact</th>
                      <th className="px-4 py-3 text-right">Sale / Contact</th>
                      <th className="px-4 py-3 text-right">Activation / Sale</th>
                      <th className="px-4 py-3 text-right">Median first dial</th>
                      <th className="px-4 py-3 text-right">Calls / Lead</th>
                      <th className="px-4 py-3 text-right">Invalid rate</th>
                      <th className="px-4 py-3 text-right">Recorded revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.vendors.map((vendor, index) => (
                      <tr key={`${vendor.vendor}-${index}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{vendor.vendor}</td>
                        <td className="px-4 py-3 text-right font-mono">{vendor.leads.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono">{vendor.deliveryRate}%</td>
                        <td className="px-4 py-3 text-right font-mono">{vendor.contactRate}%</td>
                        <td className="px-4 py-3 text-right font-mono">{vendor.saleRate}%</td>
                        <td className="px-4 py-3 text-right font-mono">{vendor.activationRate}%</td>
                        <td className="px-4 py-3 text-right font-mono">{vendor.medianFirstDial}</td>
                        <td className="px-4 py-3 text-right font-mono">{vendor.callsPerLead}</td>
                        <td className="px-4 py-3 text-right font-mono">{vendor.invalidRate}%</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">R {vendor.revenue.toLocaleString()}</td>
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
