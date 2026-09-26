import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useClient } from '../lib/ClientContext';
import { useFilters, defaultDateRange } from '../lib/FilterContext';
import { fetchAnalyticsJson } from '../lib/useAnalyticsData';
export function cn(...inputs: any[]) { return twMerge(clsx(inputs)); }
interface Props { onOpenMobileMenu?: () => void; onOpenCommandPalette?: () => void; }
export default function GlobalFilter({ onOpenMobileMenu, onOpenCommandPalette }: Props) {
  const { selectedClient } = useClient();
  const { startDate, endDate, setDateRange, filters, setFilter, clearFilters, filterError } = useFilters();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const options = useQuery({
    queryKey: ['filter-options', selectedClient, startDate, endDate],
    queryFn: ({ signal }) => fetchAnalyticsJson('/api/analytics/filter-options?' + new URLSearchParams({ clientId: selectedClient || 'default_tenant', startDate, endDate }), signal),
    staleTime: 120000, retry: false,
  });
  const data = options.data?.data || {};
  const reload = async () => {
    setRefreshing(true);
    try { await Promise.all([queryClient.invalidateQueries({ queryKey: ['analytics'] }), options.refetch()]); }
    finally { setRefreshing(false); }
  };
  const select = (key: string, label: string, values: any[]) => <label className="text-xs space-y-1 block" key={key}>
    <span>{label}</span><select aria-label={label} className="border rounded p-2 bg-white w-full" value={String(filters[key]?.values?.[0] ?? '')}
      onChange={e => setFilter(key, e.target.value ? { operator: 'in', values: [e.target.value] } : null)}>
      <option value="">All</option>{values.map((v: any) => <option key={String(v.value ?? v)} value={String(v.value ?? v)}>{String(v.label ?? v)}</option>)}
    </select></label>;
  const booleanSelect = (key: string, label: string) => <label className="text-xs space-y-1 block" key={key}><span>{label}</span>
    <select aria-label={label} className="border rounded p-2 bg-white w-full" value={filters[key]?.value === undefined ? '' : String(filters[key].value)}
      onChange={e => setFilter(key, e.target.value === '' ? null : { operator: 'equals', value: e.target.value === 'true' })}>
      <option value="">All / unknown included</option><option value="true">Recorded yes</option><option value="false">Recorded no</option>
    </select></label>;
  return <header className="bg-white border-b p-4 space-y-3">
    <div className="flex flex-wrap items-end gap-3">
      {onOpenMobileMenu && <button className="lg:hidden border rounded px-3 py-2" onClick={onOpenMobileMenu}>Menu</button>}
      <label className="text-xs">Capture date from<input aria-label="Capture date from" type="date" className="block border rounded p-2" value={startDate} onChange={e => setDateRange(e.target.value, endDate)} /></label>
      <label className="text-xs">Capture date to<input aria-label="Capture date to" type="date" className="block border rounded p-2" value={endDate} onChange={e => setDateRange(startDate, e.target.value)} /></label>
      <button className="border rounded px-3 py-2 text-xs" onClick={() => { const d = defaultDateRange(); setDateRange(d.start, d.end); }}>Last 30 days</button>
      <button className="border rounded px-3 py-2 text-xs" disabled={refreshing} onClick={reload}>{refreshing ? 'Reloading…' : 'Reload results'}</button>
      <button className="border rounded px-3 py-2 text-xs" onClick={clearFilters}>Clear filters</button>
      {onOpenCommandPalette && <button className="border rounded px-3 py-2 text-xs" onClick={onOpenCommandPalette}>Find a page</button>}
    </div>
    <div className="grid sm:grid-cols-3 gap-3">{select('vendor', 'Attributed vendor', data.vendors || [])}{select('source', 'Lead source', data.sources || [])}{select('medium', 'Traffic medium', data.mediums || [])}</div>
    <details className="text-xs"><summary className="cursor-pointer">More filters ({Object.keys(filters).length} active)</summary><div className="grid sm:grid-cols-3 gap-3 mt-3">
      {select('grade', 'Lead grade', data.grades || [])}{select('vetting', 'Vetting classification', data.vettings || [])}
      {booleanSelect('rpc', 'Right-party contact')}{booleanSelect('sale', 'Sale recorded')}{booleanSelect('activated', 'Activation recorded')}
      {booleanSelect('valid_lead', 'Lead validity')}{booleanSelect('valid_idno', 'ID validity')}{booleanSelect('phone_valid', 'Phone validity')}
      <label className="text-xs">Observed call count<select aria-label="Observed call count" className="block border rounded p-2 bg-white w-full"
        value={filters.calls?.operator === 'equals' ? String(filters.calls.value) : filters.calls?.operator === 'between' ? `${filters.calls.min}-${filters.calls.max}` : ''}
        onChange={e => { const v = e.target.value; if (!v) setFilter('calls', null); else if (v.includes('-')) { const [min, max] = v.split('-').map(Number); setFilter('calls', { operator: 'between', min, max }); } else setFilter('calls', { operator: 'equals', value: Number(v) }); }}>
        <option value="">All counts</option>{['0', '1', '2', '3-5', '6-10'].map(v => <option key={v} value={v}>{v}</option>)}
      </select></label>
    </div></details>
    <p className="text-xs text-slate-600">Dates select lead-capture cohorts. Vendor filters restrict attributed transactions. Reload may use the server cache; it does not refresh warehouse ingestion.</p>
    {(filterError || options.error) && <p role="alert" className="text-sm">{filterError || (options.error instanceof Error ? options.error.message : 'Filter options could not be loaded.')}</p>}
  </header>;
}
