import React, { useMemo, useState } from 'react';
import EvidenceBars from '../../../shared/visuals/EvidenceBars';
import { lifecyclePresentation } from '../../../shared/visuals/lifecyclePresentation';
import {
  Layers,
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
    <section className="enterprise-card cx-analytics-card" aria-label="Segment comparison">
      {/* Header and Dimension Selector */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <span className="cx-command-section-kicker">Outcome distribution</span>
            <Layers size={15} className="text-text-sec" />
          </div>
          <h2 className="text-base font-semibold text-text-main">
            {dimensionTitle} outcomes & fulfilment
          </h2>
          <p className="text-xs text-text-sec">
            Compare recorded sales, activations, activation / sale ratio, and source-recorded revenue across {activeDimension}s.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Dimension Selector Tabs */}
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface-subtle" role="group" aria-label="Sales segment dimension">
            {(['vendor', 'source', 'grade'] as const).map((dim) => {
              const label = dim === 'vendor' ? 'Vendors' : dim === 'source' ? 'Sources' : 'Grades';
              const active = activeDimension === dim;
              return (
                <button
                  key={dim}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectDimension(dim)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    active
                      ? 'bg-surface text-text-main shadow-xs'
                      : 'text-text-sec hover:text-text-main'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Export Action */}
          <button
            type="button"
            className="cx-button-secondary text-xs flex items-center gap-1.5 py-1 px-2.5"
            onClick={onExportSegment}
            title={`Export all ${activeDimension} outcomes (CSV)`}
          >
            <Download size={13} />
            <span>Export {activeDimension}s</span>
          </button>
        </div>
      </header>

      <div className="p-4 border-b border-border-subtle">
        <div className="cx-viz-toolbar">
          <label>Compare <select aria-label="Sales segment comparison measure" value={measure} onChange={event => setMeasure(event.target.value as typeof measure)}>
            {Object.entries(measureLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          {filteredRows.length > 8 && <button type="button" className="cx-button-secondary" onClick={onToggleShowAllInChart}>{showAllInChart ? 'Show top 8' : `Show all ${filteredRows.length}`}</button>}
        </div>
        <EvidenceBars title={measureLabels[measure]} description={`${showAllInChart ? 'All' : 'Top 8'} matching ${dimensionTitle.toLowerCase()} groups by the selected returned measure. Select a row to inspect.`}
          items={chartRows.map(row => ({ key: row.name, label: row.name, value: row[measure],
            displayValue: measure === 'activationRatio' ? formatPercent(row.activationRatio) : measure === 'revenuePerSale' ? formatWorkspaceCurrency(row.revenuePerSale, currency) : formatTableNumber(row[measure]),
            detail: `${formatTableNumber(row.sales)} sales · ${formatTableNumber(row.activations)} activations`,
            color: measure === 'sales' ? lifecyclePresentation.sales.color : measure === 'activations' || measure === 'activationRatio' ? lifecyclePresentation.activated.color : 'var(--cx-text-secondary)',
          }))}
          onSelect={key => { const row = chartRows.find(item => item.name === key); if (row) onInspectRow(row); }}
          scaleNote={measure === 'activationRatio' ? 'Independent-count ratios may exceed 100%. Bar length shares the largest displayed value; no nesting or conversion is assumed.' : 'Bars share the largest displayed value. Unavailable values remain separate from observed zero.'} />
      </div>

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
                onClick={() => onInspectRow(row)}
                className="cursor-pointer transition-colors hover:bg-surface-subtle"
              >
                <th className="py-2.5 px-3 text-xs font-semibold text-text-main">{row.name}</th>
                <td className="py-2.5 px-3 text-xs font-mono text-text-main text-right">
                  {formatTableNumber(row.sales)}
                </td>
                <td className="py-2.5 px-3 text-xs font-mono text-text-main text-right">
                  {formatTableNumber(row.activations)}
                </td>
                <td className="py-2.5 px-3 text-xs text-text-sec text-right">
                  {row.activationRatio !== null ? formatPercent(row.activationRatio) : '—'}
                </td>
                <td className="py-2.5 px-3 text-xs font-mono text-text-main text-right">
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
              <td className="py-2.5 px-3 text-xs font-mono text-right">{formatTableNumber(totals.sales)}</td>
              <td className="py-2.5 px-3 text-xs font-mono text-right">{formatTableNumber(totals.activations)}</td>
              <td className="py-2.5 px-3 text-xs text-right">
                {totals.activationRatio !== null ? formatPercent(totals.activationRatio) : '—'}
              </td>
              <td className="py-2.5 px-3 text-xs font-mono text-right">{formatWorkspaceCurrency(totals.revenue, currency)}</td>
              <td className="py-2.5 px-3 text-xs text-right">{formatWorkspaceCurrency(totals.revenuePerSale, currency)}</td>
              <td className="py-2.5 px-3 text-xs text-right text-text-sec">{formatTableNumber(totals.missingRev)}</td>
              <td className="py-2.5 px-3 text-xs text-right text-text-sec">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
      </details>
    </section>
  );
}
