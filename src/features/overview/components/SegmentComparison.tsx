import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Filter } from 'lucide-react';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import { useScopedNavigationTarget } from '../../../hooks/useScopedNavigationTarget';
import { useFilters } from '../../../lib/FilterContext';

interface SegmentItem {
  id: string;
  name: string;
  volume: number;
  deliveryRate?: number | null;
  contactRate?: number | null;
  saleRate?: number | null;
}

interface SegmentComparisonProps {
  data?: {
    byVendor?: Array<{ vendor: string; count?: number; leads?: number; sales?: number; deliveryRate?: number; contactRate?: number; saleRate?: number }>;
    bySource?: Array<{ source: string; count?: number; leads?: number; sales?: number; deliveryRate?: number; contactRate?: number; saleRate?: number }>;
    byGrade?: Array<{ grade: string; count?: number; leads?: number; sales?: number; deliveryRate?: number; contactRate?: number; saleRate?: number }>;
    [key: string]: any;
  };
}

export default function SegmentComparison({ data }: SegmentComparisonProps) {
  const [activeSegment, setActiveSegment] = useState<'vendor' | 'source' | 'grade'>('vendor');
  const [searchQuery, setSearchQuery] = useState('');
  const scoped = useScopedNavigationTarget();
  const { setFilter } = useFilters();

  const segmentItems: SegmentItem[] = useMemo(() => {
    if (!data) return [];
    if (activeSegment === 'vendor') {
      const list = data.byVendor || (data as any)?.vendors || [];
      return list.map((item: any) => ({
        id: item.vendor || item.name || 'Unknown',
        name: item.vendor || item.name || 'Unknown',
        volume: item.leads ?? item.count ?? 0,
        deliveryRate: item.deliveryRate,
        contactRate: item.contactRate,
        saleRate: item.saleRate,
      }));
    }
    if (activeSegment === 'source') {
      const list = data.bySource || (data as any)?.sources || [];
      return list.map((item: any) => ({
        id: item.source || item.name || 'Unknown',
        name: item.source || item.name || 'Unknown',
        volume: item.leads ?? item.count ?? 0,
        deliveryRate: item.deliveryRate,
        contactRate: item.contactRate,
        saleRate: item.saleRate,
      }));
    }
    if (activeSegment === 'grade') {
      const list = data.byGrade || (data as any)?.grades || [];
      return list.map((item: any) => ({
        id: item.grade || item.name || 'Unknown',
        name: item.grade || item.name || 'Unknown',
        volume: item.leads ?? item.count ?? 0,
        deliveryRate: item.deliveryRate,
        contactRate: item.contactRate,
        saleRate: item.saleRate,
      }));
    }
    return [];
  }, [data, activeSegment]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return segmentItems.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return segmentItems.filter(item => item.name.toLowerCase().includes(q)).slice(0, 8);
  }, [segmentItems, searchQuery]);

  const applySegmentFilter = (name: string) => {
    setFilter(activeSegment, { operator: 'in', values: [name] });
  };

  return (
    <section className="cx-card p-5" aria-label="Segment performance comparison">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-text-main">Segment comparison</h2>
          <p className="text-xs text-text-sec mt-0.5">
            Compare outcome rates across vendors, acquisition sources, and lead grades.
          </p>
        </div>

        {/* Dimension Switcher Tabs */}
        <div className="flex items-center gap-1 bg-surface-subtle p-1 rounded-lg border border-border-subtle text-xs">
          <button
            type="button"
            onClick={() => setActiveSegment('vendor')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              activeSegment === 'vendor'
                ? 'bg-surface text-text-main shadow-xs font-semibold'
                : 'text-text-mute hover:text-text-main'
            }`}
          >
            Vendors
          </button>
          <button
            type="button"
            onClick={() => setActiveSegment('source')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              activeSegment === 'source'
                ? 'bg-surface text-text-main shadow-xs font-semibold'
                : 'text-text-mute hover:text-text-main'
            }`}
          >
            Sources
          </button>
          <button
            type="button"
            onClick={() => setActiveSegment('grade')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              activeSegment === 'grade'
                ? 'bg-surface text-text-main shadow-xs font-semibold'
                : 'text-text-mute hover:text-text-main'
            }`}
          >
            Lead grades
          </button>
        </div>
      </div>

      {/* Segment Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-text-main">
          <thead>
            <tr className="border-b border-border-subtle text-text-mute font-semibold">
              <th className="py-2.5 px-3">
                {activeSegment.charAt(0).toUpperCase() + activeSegment.slice(1)}
              </th>
              <th className="py-2.5 px-3 text-right">Volume</th>
              <th className="py-2.5 px-3 text-right">Delivery %</th>
              <th className="py-2.5 px-3 text-right">Right-party contact %</th>
              <th className="py-2.5 px-3 text-right">Lead-to-sale %</th>
              <th className="py-2.5 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {filteredItems.length > 0 ? (
              filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-surface-subtle transition-colors">
                  <td className="py-2.5 px-3 font-medium text-text-main">
                    {item.name}
                  </td>
                  <td className="py-2.5 px-3 text-right cx-tabular font-semibold">
                    {formatTableNumber(item.volume)}
                  </td>
                  <td className="py-2.5 px-3 text-right cx-tabular text-text-sec">
                    {formatPercent(item.deliveryRate)}
                  </td>
                  <td className="py-2.5 px-3 text-right cx-tabular text-text-sec">
                    {formatPercent(item.contactRate)}
                  </td>
                  <td className="py-2.5 px-3 text-right cx-tabular text-text-sec">
                    {formatPercent(item.saleRate)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => applySegmentFilter(item.name)}
                      className="inline-flex items-center gap-1 text-[11px] text-brand-primary hover:underline font-medium cursor-pointer"
                      title={`Filter workspace to ${item.name}`}
                    >
                      <Filter size={11} />
                      <span>Filter</span>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-text-mute">
                  No {activeSegment} breakdown available in this scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Link */}
      <div className="pt-3 mt-3 border-t border-border-subtle flex items-center justify-between text-xs text-text-mute">
        <span>Showing top {filteredItems.length} {activeSegment}s by volume.</span>
        <Link
          to={scoped('/vendor-quality')}
          className="font-medium text-brand-primary hover:underline inline-flex items-center gap-1"
        >
          <span>Complete vendor & quality breakdown</span>
          <ArrowRight size={12} />
        </Link>
      </div>
    </section>
  );
}
