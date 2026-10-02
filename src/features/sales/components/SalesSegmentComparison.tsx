import React, { useMemo, useState } from 'react';
import ChartFrame from '../../../shared/visuals/ChartFrame';
import ReportingScopeSummary from '../../../shared/reporting/ReportingScopeSummary';
import EvidenceBars from '../../../shared/visuals/EvidenceBars';
import { lifecyclePresentation } from '../../../shared/visuals/lifecyclePresentation';
import {
  Search,
  Download,
  ExternalLink,
} from 'lucide-react';
import type {
  AdaptedSalesActivation,
  SegmentDimension,
  AdaptedSegmentRow,
} from '../model/salesActivationAdapter';
import { formatWorkspaceCurrency } from '../model/salesActivationAdapter';
import {
  formatTableNumber,
  formatPercent,
} from '../../../lib/formatters';

interface SalesSegmentComparisonProps {
  model: AdaptedSalesActivation;
  activeDimension: SegmentDimension;
  onSelectDimension: (dimension: SegmentDimension) => void;
  search: string;
  onSearchChange: (search: string) => void;
  showAllInChart: boolean;
  onToggleShowAllInChart: () => void;
  onInspectRow: (row: AdaptedSegmentRow) => void;
  onExportSegment: () => void;
}

export default function SalesSegmentComparison({
  model,
  activeDimension,
  onSelectDimension,
  search,
  onSearchChange,
  showAllInChart,
  onToggleShowAllInChart,
  onInspectRow,
  onExportSegment,
}: SalesSegmentComparisonProps) {
  const [measure, setMeasure] = useState<'sales' | 'activations' | 'activationRatio' | 'revenuePerSale'>('sales');
  const measureLabels = { sales: 'Recorded sales', activations: 'Recorded activations', activationRatio: 'Activation / sale ratio', revenuePerSale: 'Recorded revenue / sale' };
  const [selection, setSelection] = useState<{ dimension: SegmentDimension; name: string } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const selectedKey = selection?.dimension === activeDimension && model.segments[activeDimension]?.some(row => row.name === selection.name) ? selection.name : null;
  const highlightedKey = hovered ?? selectedKey;
  const select = (name: string) => setSelection({ dimension: activeDimension, name });
  const rowState = (name: string) => ({
    className: selectedKey === name ? 'cx-selected-state' : undefined,
    'data-selected': selectedKey === name || undefined,
    'data-highlighted': highlightedKey === name || undefined,
    'data-dimmed': Boolean(highlightedKey && highlightedKey !== name) || undefined,
    onMouseEnter: () => setHovered(name), onMouseLeave: () => setHovered(null),
  });
  const currency = model.summary.currency;
  const allRows: AdaptedSegmentRow[] = model.segments[activeDimension] || [];

  // Filter table rows by search string
  const filteredRows = useMemo(() => {
    if (!search.trim()) return allRows;
    const term = search.toLowerCase().trim();
    return allRows.filter((r) => r.name.toLowerCase().includes(term));
  }, [allRows, search]);

  // Presentation ranking uses only the selected returned measure.
  const chartRows = useMemo(() => {
    const sorted = [...filteredRows].sort((a, b) => {
      const av = a[measure], bv = b[measure];
      if (av == null || bv == null) return av == null ? (bv == null ? 0 : 1) : -1;
      return bv - av;
    });
    return showAllInChart ? sorted : sorted.slice(0, 8);
  }, [filteredRows, showAllInChart, measure]);

  // Table summary totals (sum over all active dimension rows, never mixing dimensions!)
  const totals = useMemo(() => {
    let sales = 0;
    let activations = 0;
    let revenue = 0;
    let hasRevenue = false;
    let missingRev = 0;

    for (const r of allRows) {
      sales += r.sales;
      activations += r.activations;
      if (r.revenue !== null) {
        revenue += r.revenue;
        hasRevenue = true;
      }
      missingRev += r.unrecordedRevenueSales;
    }

    return {
      sales,
      activations,
      activationRatio: sales > 0 ? (activations / sales) * 100 : null,
      revenue: hasRevenue ? revenue : null,
      revenuePerSale: hasRevenue && sales > 0 ? revenue / sales : null,
      missingRev,
    };
  }, [allRows]);

  const dimensionTitle =
    activeDimension === 'vendor'
      ? 'Vendor'
      : activeDimension === 'source'
      ? 'Source'
      : 'Lead grade';

  return (
    <ChartFrame title={`${dimensionTitle} outcomes & fulfilment`} className="cx-sales-segment-comparison" scope={<ReportingScopeSummary />}
      header={<div><span className="cx-command-section-kicker">Outcome distribution</span><h2>{dimensionTitle} outcomes & fulfilment</h2><p>Select a segment to compare its evidence.</p></div>}
      actions={<button type="button" className="cx-button-quiet" onClick={onExportSegment}><Download size={13} />Export {activeDimension}s</button>}>
      <div className="cx-viz-toolbar">
        <div className="cx-segmented-control" role="group" aria-label="Sales segment dimension">
          {(['vendor', 'source', 'grade'] as const).map(dim => <button key={dim} type="button" aria-pressed={activeDimension === dim}
            onClick={() => { setHovered(null); onSelectDimension(dim); }}>{dim === 'vendor' ? 'Vendors' : dim === 'source' ? 'Sources' : 'Grades'}</button>)}
        </div>
      </div>
      <div className="p-4 border-b border-border-subtle">
        <div className="cx-viz-toolbar">
          <label>Compare <select aria-label="Sales segment comparison measure" value={measure} onChange={event => setMeasure(event.target.value as typeof measure)}>
            {Object.entries(measureLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          {filteredRows.length > 8 && <button type="button" className="cx-button-secondary" onClick={onToggleShowAllInChart}>{showAllInChart ? 'Show top 8' : `Show all ${filteredRows.length}`}</button>}
        </div>
        <EvidenceBars title={measureLabels[measure]} description={`${showAllInChart ? 'All' : 'Top 8'} matching ${dimensionTitle.toLowerCase()} groups. Selection stays within this view.`}
          items={chartRows.map(row => ({ key: row.name, label: row.name, value: row[measure],
            displayValue: measure === 'activationRatio' ? formatPercent(row.activationRatio) : measure === 'revenuePerSale' ? formatWorkspaceCurrency(row.revenuePerSale, currency) : formatTableNumber(row[measure]),
            detail: `${formatTableNumber(row.sales)} sales · ${formatTableNumber(row.activations)} activations`,
            color: measure === 'sales' ? lifecyclePresentation.sales.color : measure === 'activations' || measure === 'activationRatio' ? lifecyclePresentation.activated.color : 'var(--cx-text-secondary)',
          }))}
          onSelect={select} selectedKey={selectedKey} highlightedKey={hovered} onHighlight={setHovered} selectionLabel="Select"
          scaleNote={measure === 'activationRatio' ? 'Independent-count ratios may exceed 100%. Bar length shares the largest displayed value; no nesting or conversion is assumed.' : 'Bars share the largest displayed value. Unavailable values remain separate from observed zero.'} />
      </div>

      {selectedKey && (() => { const row = allRows.find(item => item.name === selectedKey); return row && <div className="cx-selected-state cx-outcome-selection" role="status">
        <div><span>Selected · {dimensionTitle}</span><strong>{row.name}</strong><small>{formatTableNumber(row.sales)} sales · {formatTableNumber(row.activations)} activations · {formatWorkspaceCurrency(row.revenue, currency)} source revenue</small></div>
        <button type="button" className="cx-button-secondary" onClick={() => onInspectRow(row)}>Inspect selected segment</button>
        <button type="button" className="cx-button-quiet" onClick={() => setSelection(null)}>Clear selection</button>
      </div>; })()}
      {/* Table Toolbar / Search */}
      <div className="p-3 border-b border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-2.5 text-text-muted" />
          <input
            type="text"
            aria-label={`Filter ${dimensionTitle.toLowerCase()}s`}
            placeholder={`Filter ${dimensionTitle.toLowerCase()}s…`}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-surface text-text-main w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border focus:outline-hidden focus:ring-1 focus:ring-action focus:border-action"
          />
        </div>
        <div className="text-xs text-text-sec self-end sm:self-auto">
          Showing {filteredRows.length} of {allRows.length} {dimensionTitle.toLowerCase()}s
        </div>
      </div>

      <details className="cx-evidence-disclosure"><summary>View exact segment evidence</summary>
      {/* Exact Supporting Table */}
      <div role="region" aria-label="Sales segment evidence table" tabIndex={0} className="cx-sales-segment-scroll cx-performance-table-wrap">
        <table className="cx-performance-table cx-sales-segment-table w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="py-2.5 px-3 text-xs font-semibold text-text-sec">{dimensionTitle}</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-text-sec text-right">Recorded sales</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-text-sec text-right">Recorded activations</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-text-sec text-right">Activation / sale</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-text-sec text-right">Source revenue</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-text-sec text-right">Revenue / sale</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-text-sec text-right">Missing revenue</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-text-sec text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr
                key={row.name}
                {...rowState(row.name)}
              >
                <th className="py-2.5 px-3 text-xs font-semibold text-text-main"><button type="button" className="cx-admin-text-button" aria-pressed={selectedKey === row.name} aria-label={`Select ${row.name} segment`} onClick={() => select(row.name)} onFocus={() => setHovered(row.name)} onBlur={() => setHovered(null)}>{row.name}</button></th>
                <td className="py-2.5 px-3 text-xs text-text-main text-right">
                  {formatTableNumber(row.sales)}
                </td>
                <td className="py-2.5 px-3 text-xs text-text-main text-right">
                  {formatTableNumber(row.activations)}
                </td>
                <td className="py-2.5 px-3 text-xs text-text-sec text-right">
                  {row.activationRatio !== null ? formatPercent(row.activationRatio) : '—'}
                </td>
                <td className="py-2.5 px-3 text-xs text-text-main text-right">
                  {formatWorkspaceCurrency(row.revenue, currency)}
                </td>
                <td className="py-2.5 px-3 text-xs text-text-sec text-right">
                  {row.revenuePerSale !== null ? formatWorkspaceCurrency(row.revenuePerSale, currency) : '—'}
                </td>
                <td className="py-2.5 px-3 text-xs text-text-sec text-right">
                  {row.unrecordedRevenueSales > 0 ? (
                    <span className="text-semantic-warn font-medium">{formatTableNumber(row.unrecordedRevenueSales)}</span>
                  ) : (
                    '0'
                  )}
                </td>
                <td className="py-2.5 px-3 text-xs text-right">
                  <button type="button" className="cx-admin-text-button" onClick={event => { event.stopPropagation(); onInspectRow(row); }} aria-label={`Inspect ${row.name} sales evidence`}>Inspect <ExternalLink size={10} /></button>
                </td>
              </tr>
            ))}

            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-xs text-text-sec">
                  No {dimensionTitle.toLowerCase()}s match the search query "{search}".
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-surface-subtle font-bold text-text-main">
              <th className="py-2.5 px-3 text-xs">Total ({dimensionTitle} dimension)</th>
              <td className="py-2.5 px-3 text-xs text-right">{formatTableNumber(totals.sales)}</td>
              <td className="py-2.5 px-3 text-xs text-right">{formatTableNumber(totals.activations)}</td>
              <td className="py-2.5 px-3 text-xs text-right">
                {totals.activationRatio !== null ? formatPercent(totals.activationRatio) : '—'}
              </td>
              <td className="py-2.5 px-3 text-xs text-right">{formatWorkspaceCurrency(totals.revenue, currency)}</td>
              <td className="py-2.5 px-3 text-xs text-right">{formatWorkspaceCurrency(totals.revenuePerSale, currency)}</td>
              <td className="py-2.5 px-3 text-xs text-right text-text-sec">{formatTableNumber(totals.missingRev)}</td>
              <td className="py-2.5 px-3 text-xs text-right text-text-sec">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
      </details>
    </ChartFrame>
  );
}
