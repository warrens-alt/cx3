import EvidenceBars, { evidenceBarWidth } from '../../../shared/visuals/EvidenceBars';
import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, ExternalLink, Filter } from 'lucide-react';
import type { LifecycleSegment } from '../../../../contracts/lifecycleAnalytics';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';

export type JourneyDimension = 'vendor' | 'source' | 'grade';
export type JourneySegmentSort = 'fetched' | 'saleRate' | 'rpcRate' | 'activationRate' | 'deliveryRate';

interface JourneySegmentsProps {
  segments?: Record<string, LifecycleSegment[]> | null;
  totalPopulation?: number | null;
  unsupportedDimensions?: string[];
  onInspectSegment?: (segment: LifecycleSegment, dimension: JourneyDimension) => void;
}

const SORT_LABELS: Record<JourneySegmentSort, string> = {
  fetched: 'Volume (Fetched leads)',
  saleRate: 'Lead-to-sale rate (%)',
  rpcRate: 'RPC / dialled rate (%)',
  activationRate: 'Sale-to-activation rate (%)',
  deliveryRate: 'Delivery rate (%)',
};

export default function JourneySegments({
  segments,
  totalPopulation,
  unsupportedDimensions = [],
  onInspectSegment,
}: JourneySegmentsProps) {
  const [activeDimension, setActiveDimension] = useState<JourneyDimension>('vendor');
  const [activeSort, setActiveSort] = useState<JourneySegmentSort>('fetched');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const dimensionList = useMemo(() => {
    if (!segments) return [];
    return (segments[activeDimension] || []).filter((s) => Boolean(s.key));
  }, [segments, activeDimension]);

  // Overall volume in this dimension
  const dimensionTotal = useMemo(() => {
    if (totalPopulation && totalPopulation > 0) return totalPopulation;
    return dimensionList.reduce((acc, curr) => acc + Number(curr.fetched || 0), 0);
  }, [dimensionList, totalPopulation]);

  // Filter & Sort
  const filteredAndSorted = useMemo(() => {
    let list = [...dimensionList];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => item.key.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      const valA = Number(a[activeSort] ?? -1);
      const valB = Number(b[activeSort] ?? -1);
      if (valB !== valA) return valB - valA;
      return a.key.localeCompare(b.key);
    });

    return list;
  }, [dimensionList, searchQuery, activeSort]);

  // Top-N vs All
  const displayedRows = showAll ? filteredAndSorted : filteredAndSorted.slice(0, 8);
  const displayedVolume = displayedRows.reduce((sum, item) => sum + Number(item.fetched || 0), 0);
  const coveragePct = dimensionTotal > 0 ? (displayedVolume / dimensionTotal) * 100 : null;

  // Max value for visual bar length
  const maxBarValue = useMemo(() => {
    if (activeSort === 'fetched') {
      return Math.max(1, ...displayedRows.map((r) => Number(r.fetched || 0)));
    }
    return 100;
  }, [displayedRows, activeSort]);

  return (
    <div className="cx-journey-segments bg-surface rounded-md border border-border-subtle overflow-hidden space-y-4">
      {/* Header and Controls */}
      <div className="p-5 border-b border-border-subtle bg-surface-sec flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-semibold text-text-mute uppercase tracking-wider">
            Segment Decomposition
          </h3>
          <p className="text-xs text-text-sec mt-0.5">
            Compare acquisition and delivery performance across verified lifecycle dimensions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Dimension Selector */}
          <div className="inline-flex rounded-md border border-border-subtle p-0.5 bg-surface text-xs font-medium">
            {(['vendor', 'source', 'grade'] as JourneyDimension[]).map((dim) => (
              <button
                key={dim}
                type="button"
                aria-pressed={activeDimension === dim}
                onClick={() => {
                  setActiveDimension(dim);
                  setShowAll(false);
                }}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer capitalize ${
                  activeDimension === dim
                    ? 'bg-brand-primary text-[var(--cx-action-contrast)]  font-semibold'
                    : 'text-text-sec hover:text-text-main'
                }`}
              >
                {dim}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <select
            value={activeSort}
            onChange={(e) => setActiveSort(e.target.value as JourneySegmentSort)}
            aria-label="Sort lifecycle segments"
            className="text-xs bg-surface border border-border-subtle rounded-md px-2.5 py-1.5 text-text-main focus:outline-hidden focus:ring-1 focus:ring-brand-primary cursor-pointer"
          >
            {(Object.keys(SORT_LABELS) as JourneySegmentSort[]).map((sKey) => (
              <option key={sKey} value={sKey}>
                Sort: {SORT_LABELS[sKey]}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-text-mute" />
            <input
              type="search"
              placeholder={`Search ${activeDimension}s…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={`Search ${activeDimension} segments`}
              className="text-xs pl-8 pr-3 py-1.5 bg-surface border border-border-subtle rounded-md w-36 sm:w-44 focus:w-56 transition-all focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
            />
          </div>
        </div>
      </div>

      <div className="px-5">
        <EvidenceBars title={`Compare ${activeDimension} segments`} description={SORT_LABELS[activeSort]}
          maximum={maxBarValue}
          items={displayedRows.map(row => ({ key: row.key, label: row.key, value: row[activeSort],
            displayValue: activeSort === 'fetched' ? formatTableNumber(row.fetched) : formatPercent(row[activeSort]),
            color: ({ fetched: 'var(--cx-data-fetched)', deliveryRate: 'var(--cx-data-delivered)', rpcRate: 'var(--cx-data-rpc)', saleRate: 'var(--cx-data-sales)', activationRate: 'var(--cx-data-activation)' })[activeSort] }))}
          onSelect={onInspectSegment ? key => { const row = displayedRows.find(row => row.key === key); if (row) onInspectSegment(row, activeDimension); } : undefined}
          scaleNote={activeSort === 'fetched' ? 'Ranked returned populations on a shared count scale.' : 'Bars use a 0–100% display scale; exact returned ratios are retained even when above 100%.'}
        />
      </div>

      {/* Segment Evidence Table */}
      <details className="cx-report-disclosure mx-5"><summary>View exact segment evidence</summary>
      <div className="cx-viz-table-scroll overflow-x-auto" role="region" aria-label="Segment comparison table" tabIndex={0}>
        <table className="cx-viz-table w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-y border-border-subtle bg-surface-subtle/40 text-text-mute font-semibold">
              <th scope="col" className="px-4 py-2.5">Segment ({activeDimension})</th>
              <th scope="col" className="px-4 py-2.5 text-right">Fetched</th>
              <th scope="col" className="px-4 py-2.5 text-right">Delivered</th>
              <th scope="col" className="px-4 py-2.5 text-right">Delivery %</th>
              <th scope="col" className="px-4 py-2.5 text-right">Dialled</th>
              <th scope="col" className="px-4 py-2.5 text-right">Dial / Deliv</th>
              <th scope="col" className="px-4 py-2.5 text-right">RPC</th>
              <th scope="col" className="px-4 py-2.5 text-right">RPC / Dial</th>
              <th scope="col" className="px-4 py-2.5 text-right">Sales</th>
              <th scope="col" className="px-4 py-2.5 text-right">Sale / Fetch</th>
              <th scope="col" className="px-4 py-2.5 text-right">Activations</th>
              <th scope="col" className="px-4 py-2.5 text-right">Activ / Sale</th>
              <th scope="col" className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle text-text-main">
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-text-sec">
                  No {activeDimension} segments found matching your search.
                </td>
              </tr>
            ) : (
              displayedRows.map((row) => (
                <tr key={row.key} className="hover:bg-surface-subtle/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-text-main max-w-xs truncate" title={row.key}>
                    {row.key}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular font-medium text-text-main">
                    {formatTableNumber(row.fetched)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular text-text-sec">
                    {formatTableNumber(row.delivered)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular text-text-sec">
                    {formatPercent(row.deliveryRate)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular text-text-sec">
                    {formatTableNumber(row.dialled)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular text-text-sec">
                    {formatPercent(row.dialRate)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular text-text-sec">
                    {formatTableNumber(row.rpc)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular font-medium text-text-main">
                    {formatPercent(row.rpcRate)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular font-bold text-text-main">
                    {formatTableNumber(row.sales)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular font-semibold text-brand-primary">
                    {formatPercent(row.saleRate)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular font-medium text-text-main">
                    {formatTableNumber(row.activations)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular text-text-sec">
                    {formatPercent(row.activationRate)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {onInspectSegment && (
                      <button
                        type="button"
                        onClick={() => onInspectSegment(row, activeDimension)}
                        className="px-2.5 py-1 text-[11px] font-medium text-brand-primary hover:bg-brand-soft rounded transition-colors cursor-pointer"
                      >
                        Inspect
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      </details>

      {/* Footer & Disclosure Controls */}
      <div className="p-4 border-t border-border-subtle bg-surface-sec flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-sec">
        <div>
          Showing top {displayedRows.length} of {filteredAndSorted.length} {activeDimension} segments
          {coveragePct !== null && ` (${coveragePct.toFixed(1)}% of total demand)`}.
        </div>

        {filteredAndSorted.length > 8 && (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border-subtle rounded-md text-text-main hover:bg-surface-subtle font-medium transition-colors cursor-pointer"
          >
            {showAll ? (
              <>
                <span>Show top 8 only</span>
                <ChevronUp size={13} />
              </>
            ) : (
              <>
                <span>Show all {filteredAndSorted.length} segments</span>
                <ChevronDown size={13} />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
