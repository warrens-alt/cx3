import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Filter, Info, ChevronRight } from 'lucide-react';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import { useScopedNavigationTarget } from '../../../hooks/useScopedNavigationTarget';
import { useFilters } from '../../../lib/FilterContext';
import type { LifecycleSegment } from '../../../../contracts/lifecycleAnalytics';

export type SegmentDimension = 'vendor' | 'source' | 'grade';

export interface TypedSegmentItem {
  id: string;
  name: string;
  dimension: SegmentDimension;
  volume: number; // Fetched leads count
  delivered: number;
  dialled: number;
  rpc: number;
  sales: number;
  activations: number;
  unit: string;
  deliveryRate: number | null;
  contactRate: number | null; // RPC / Dialled rate
  saleRate: number | null; // Sales / Fetched rate
  deliveryDenominatorLabel: string;
  contactDenominatorLabel: string;
  saleDenominatorLabel: string;
  coveragePct: number | null;
}

export interface SegmentComparisonProps {
  segments?: Record<string, LifecycleSegment[]> | null;
  totalPopulation?: number | null;
  unsupportedDimensions?: string[];
  onInspectSegment?: (segment: TypedSegmentItem) => void;
}

const DIMENSION_CONFIG: Record<SegmentDimension, { label: string; routePath: string; routeLabel: string }> = {
  vendor: {
    label: 'Vendors',
    routePath: '/vendor-quality',
    routeLabel: 'Complete vendor & quality breakdown',
  },
  source: {
    label: 'Sources',
    routePath: '/vendor-quality',
    routeLabel: 'Complete acquisition source breakdown',
  },
  grade: {
    label: 'Lead grades',
    routePath: '/funnel',
    routeLabel: 'Complete lead grade & funnel breakdown',
  },
};

export default function SegmentComparison({
  segments,
  totalPopulation,
  unsupportedDimensions = [],
  onInspectSegment,
}: SegmentComparisonProps) {
  const [activeSegment, setActiveSegment] = useState<SegmentDimension>('vendor');
  const [searchQuery, setSearchQuery] = useState('');
  const scoped = useScopedNavigationTarget();
  const { setFilter } = useFilters();

  const isDimensionUnsupported = unsupportedDimensions.includes(activeSegment);

  // Map and type segment items directly from the verified lifecycle segment model
  const segmentItems: TypedSegmentItem[] = useMemo(() => {
    if (!segments || isDimensionUnsupported) return [];
    const list = segments[activeSegment] || [];
    const dimensionTotal = totalPopulation ?? (list.length > 0 ? list.reduce((sum, item) => sum + Number(item.fetched || 0), 0) : null);

    return list.map(item => {
      const volume = Number(item.fetched || 0);
      const delivered = Number(item.delivered || 0);
      const dialled = Number(item.dialled || 0);
      const rpc = Number(item.rpc || 0);
      const sales = Number(item.sales || 0);
      const activations = Number(item.activations || 0);
      const name = String(item.key || 'Unrecorded');

      return {
        id: `${activeSegment}-${name}`,
        name,
        dimension: activeSegment,
        volume,
        delivered,
        dialled,
        rpc,
        sales,
        activations,
        unit: 'leads',
        deliveryRate: item.deliveryRate ?? (volume > 0 ? (delivered / volume) * 100 : null),
        contactRate: item.rpcRate ?? (dialled > 0 ? (rpc / dialled) * 100 : null),
        saleRate: item.saleRate ?? (volume > 0 ? (sales / volume) * 100 : null),
        deliveryDenominatorLabel: 'Fetched leads',
        contactDenominatorLabel: 'Dialled leads',
        saleDenominatorLabel: 'Fetched leads',
        coveragePct: dimensionTotal && dimensionTotal > 0 ? Number(((volume / dimensionTotal) * 100).toFixed(1)) : null,
      };
    });
  }, [segments, activeSegment, totalPopulation, isDimensionUnsupported]);

  // Sort by volume descending with stable tie-breaker (alphabetical by name)
  const sortedItems = useMemo(() => {
    return [...segmentItems].sort((a, b) => {
      const diff = b.volume - a.volume;
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  }, [segmentItems]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return sortedItems;
    const q = searchQuery.toLowerCase();
    return sortedItems.filter(item => item.name.toLowerCase().includes(q));
  }, [sortedItems, searchQuery]);

  // Display top 8 subset with disclosed coverage
  const displayedSubset = useMemo(() => filteredItems.slice(0, 8), [filteredItems]);

  const displayedVolume = useMemo(
    () => displayedSubset.reduce((sum, item) => sum + item.volume, 0),
    [displayedSubset]
  );

  const displayedCoveragePct = useMemo(() => {
    const total = totalPopulation ?? (sortedItems.length > 0 ? sortedItems.reduce((sum, item) => sum + item.volume, 0) : null);
    if (!total || total <= 0) return null;
    return Number(((displayedVolume / total) * 100).toFixed(1));
  }, [displayedVolume, totalPopulation, sortedItems]);

  const applySegmentFilter = (name: string) => {
    setFilter(activeSegment, { operator: 'in', values: [name] });
  };

  const currentConfig = DIMENSION_CONFIG[activeSegment];

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
          {(Object.keys(DIMENSION_CONFIG) as SegmentDimension[]).map(dim => (
            <button
              key={dim}
              type="button"
              onClick={() => {
                setActiveSegment(dim);
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeSegment === dim
                  ? 'bg-surface text-text-main shadow-xs font-semibold'
                  : 'text-text-mute hover:text-text-main'
              }`}
            >
              {DIMENSION_CONFIG[dim].label}
            </button>
          ))}
        </div>
      </div>

      {isDimensionUnsupported ? (
        <div className="py-8 px-4 text-center text-xs text-text-mute bg-surface-subtle rounded-lg border border-border-subtle">
          <Info size={16} className="mx-auto mb-1 text-brand-primary" />
          <div className="font-semibold text-text-sec mb-0.5">Dimension configuration required</div>
          <div>
            The {activeSegment} dimension is not configured in the active warehouse schema.
            Inspect available vendor and source populations.
          </div>
        </div>
      ) : (
        <>
          {/* Segment Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-text-main">
              <thead>
                <tr className="border-b border-border-subtle text-text-mute font-semibold">
                  <th scope="col" className="py-2.5 px-3">
                    {activeSegment.charAt(0).toUpperCase() + activeSegment.slice(1)}
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right">
                    Volume ({activeSegment === 'vendor' ? 'fetched' : 'leads'})
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right" title="Delivered / Fetched leads">
                    Delivery %
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right" title="Right-party contact (RPC) / Dialled leads">
                    Right-party contact %
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right" title="Recorded sales / Fetched leads">
                    Lead-to-sale %
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {displayedSubset.length > 0 ? (
                  displayedSubset.map(item => (
                    <tr key={item.id} className="hover:bg-surface-subtle transition-colors group">
                      <td className="py-2.5 px-3 font-medium text-text-main">
                        <div className="flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {item.coveragePct != null && (
                            <span className="text-[10px] text-text-mute font-normal">
                              ({formatPercent(item.coveragePct)})
                            </span>
                          )}
                        </div>
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
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => applySegmentFilter(item.name)}
                            className="inline-flex items-center gap-1 text-[11px] text-brand-primary hover:underline font-medium cursor-pointer"
                            title={`Filter workspace to ${item.name}`}
                          >
                            <Filter size={11} />
                            <span>Filter</span>
                          </button>
                          {onInspectSegment && (
                            <button
                              type="button"
                              onClick={() => onInspectSegment(item)}
                              className="inline-flex items-center gap-0.5 text-[11px] text-text-mute hover:text-text-main font-medium cursor-pointer"
                              title={`Inspect evidence for ${item.name}`}
                            >
                              <span>Inspect</span>
                              <ChevronRight size={12} />
                            </button>
                          )}
                        </div>
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

          {/* Footer with Disclosed Subset and Route to All Matching Segments */}
          <div className="pt-3 mt-3 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-text-mute">
            <span>
              {sortedItems.length > 0 ? (
                <>
                  Showing top {displayedSubset.length} of {sortedItems.length} {currentConfig.label.toLowerCase()} by volume
                  {displayedCoveragePct != null && (
                    <span className="text-text-sec font-medium ml-1">
                      ({formatPercent(displayedCoveragePct)} of observed leads)
                    </span>
                  )}
                  .
                </>
              ) : (
                `No measured ${currentConfig.label.toLowerCase()} in current scope.`
              )}
            </span>
            <Link
              to={scoped(currentConfig.routePath)}
              className="font-medium text-brand-primary hover:underline inline-flex items-center gap-1"
            >
              <span>{currentConfig.routeLabel}</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
