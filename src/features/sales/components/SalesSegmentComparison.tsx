import React, { useMemo } from 'react';
import { CategoryAxisTick, CategoryChartFrame, categoryPlotWidth, chartTooltipWrapperStyle } from '../../../components/charts/CategoryChartFrame';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Layers,
  Search,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
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
  formatRatioPercent,
  formatChartAxis,
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
  const currency = model.summary.currency;
  const allRows: AdaptedSegmentRow[] = model.segments[activeDimension] || [];

  // Filter table rows by search string
  const filteredRows = useMemo(() => {
    if (!search.trim()) return allRows;
    const term = search.toLowerCase().trim();
    return allRows.filter((r) => r.name.toLowerCase().includes(term));
  }, [allRows, search]);

  // Chart data: sort by sales descending and slice top N unless showAllInChart is true
  const chartRows = useMemo(() => {
    const sorted = [...allRows].sort((a, b) => b.sales - a.sales);
    return showAllInChart ? sorted : sorted.slice(0, 8);
  }, [allRows, showAllInChart]);

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
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="cx-command-section-kicker">Outcome distribution</span>
            <Layers size={15} className="text-slate-400" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">
            {dimensionTitle} outcomes & fulfilment
          </h2>
          <p className="text-xs text-slate-500">
            Compare recorded sales, activations, activation / sale ratio, and source-recorded revenue across {activeDimension}s.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {/* Dimension Selector Tabs */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50" role="tablist">
            {(['vendor', 'source', 'grade'] as const).map((dim) => {
              const label = dim === 'vendor' ? 'Vendors' : dim === 'source' ? 'Sources' : 'Grades';
              const active = activeDimension === dim;
              return (
                <button
                  key={dim}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSelectDimension(dim)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
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

      {/* Comparison Chart */}
      <div className="p-4 bg-slate-50/50 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-text-main">
            Volume & activation ratio ({showAllInChart ? `All ${allRows.length}` : `Top ${chartRows.length} by sales`})
          </span>
          {allRows.length > 8 && (
            <button
              type="button"
              onClick={onToggleShowAllInChart}
              className="text-xs text-action hover:text-action-hover font-medium flex items-center gap-1 cursor-pointer"
            >
              {showAllInChart ? (
                <>Show top 8 <ChevronUp size={13} /></>
              ) : (
                <>Show all {allRows.length} in chart <ChevronDown size={13} /></>
              )}
            </button>
          )}
        </div>

        {chartRows.length > 0 ? (
          <CategoryChartFrame title="Sales and activation by segment" height={320} minWidth={categoryPlotWidth(chartRows.length, 144)} legend={[
            { label: 'Recorded sales', color: 'var(--cx-data-sales)' },
            { label: 'Recorded activations', color: 'var(--cx-data-activation)' },
            { label: 'Activation / sale ratio (%)', color: 'var(--cx-action)' },
          ]}>{portal => (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
              <ComposedChart
                data={chartRows}
                margin={{ top: 12, right: 24, left: -10, bottom: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={<CategoryAxisTick />} axisLine={false} tickLine={false} interval={0} height={38} />
                <YAxis
                  yAxisId="volume"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatChartAxis}
                />
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip portal={portal ?? undefined} wrapperStyle={chartTooltipWrapperStyle} isAnimationActive={false}
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    const r: AdaptedSegmentRow = payload[0]?.payload;
                    return (
                      <div className="cx-analytics-tooltip space-y-1.5">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1 font-mono">{label}</div>
                        <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                          <span>Recorded sales:</span>
                          <b className="font-mono tabular-nums">{formatTableNumber(r.sales)}</b>
                        </div>
                        <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                          <span>Recorded activations:</span>
                          <b className="font-mono tabular-nums">{formatTableNumber(r.activations)}</b>
                        </div>
                        <div className="flex items-center justify-between text-[#315BCB] dark:text-blue-400">
                          <span>Activation / sale:</span>
                          <b className="font-mono tabular-nums">{r.activationRatio !== null ? formatPercent(r.activationRatio) : '—'}</b>
                        </div>
                        <div className="flex items-center justify-between text-purple-700 dark:text-purple-400 border-t border-slate-100 dark:border-slate-800 pt-1">
                          <span>Source revenue:</span>
                          <b className="font-mono tabular-nums">{formatWorkspaceCurrency(r.revenue, currency)}</b>
                        </div>
                        <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium pt-1 font-sans">
                          Click row below to inspect segment evidence
                        </div>
                      </div>
                    );
                  }}
                />

                <Bar
                  yAxisId="volume"
                  dataKey="sales"
                  name="Recorded sales"
                  fill="var(--cx-data-sales)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="volume"
                  dataKey="activations"
                  name="Recorded activations"
                  fill="var(--cx-data-activation)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="activationRatio"
                  name="Activation / sale ratio (%)"
                  stroke="var(--cx-action)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                  connectNulls={true}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}</CategoryChartFrame>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            No segment records observed for {dimensionTitle.toLowerCase()}s in this reporting period.
          </div>
        )}
      </div>

      {/* Table Toolbar / Search */}
      <div className="p-3 border-b border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-2.5 text-text-muted" />
          <input
            type="text"
            placeholder={`Filter ${dimensionTitle.toLowerCase()}s…`}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border focus:outline-hidden focus:ring-1 focus:ring-action focus:border-action"
          />
        </div>
        <div className="text-xs text-text-sec self-end sm:self-auto">
          Showing {filteredRows.length} of {allRows.length} {dimensionTitle.toLowerCase()}s
        </div>
      </div>

      {/* Exact Supporting Table */}
      <div role="region" aria-label="Sales segment evidence table" tabIndex={0} className="cx-sales-segment-scroll cx-performance-table-wrap">
        <table className="cx-performance-table cx-sales-segment-table w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="py-2.5 px-3 text-xs font-semibold text-slate-700">{dimensionTitle}</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-slate-700 text-right">Recorded sales</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-slate-700 text-right">Recorded activations</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-slate-700 text-right">Activation / sale</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-slate-700 text-right">Source revenue</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-slate-700 text-right">Revenue / sale</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-slate-700 text-right">Missing revenue</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-slate-700 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr
                key={row.name}
                onClick={() => onInspectRow(row)}
                className="cursor-pointer transition-colors hover:bg-slate-50"
              >
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-900">{row.name}</th>
                <td className="py-2.5 px-3 text-xs font-mono text-slate-900 text-right">
                  {formatTableNumber(row.sales)}
                </td>
                <td className="py-2.5 px-3 text-xs font-mono text-slate-900 text-right">
                  {formatTableNumber(row.activations)}
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-700 text-right">
                  {row.activationRatio !== null ? formatPercent(row.activationRatio) : '—'}
                </td>
                <td className="py-2.5 px-3 text-xs font-mono text-slate-900 text-right">
                  {formatWorkspaceCurrency(row.revenue, currency)}
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-600 text-right">
                  {row.revenuePerSale !== null ? formatWorkspaceCurrency(row.revenuePerSale, currency) : '—'}
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-500 text-right">
                  {row.unrecordedRevenueSales > 0 ? (
                    <span className="text-amber-600 font-medium">{formatTableNumber(row.unrecordedRevenueSales)}</span>
                  ) : (
                    '0'
                  )}
                </td>
                <td className="py-2.5 px-3 text-xs text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-action hover:text-action-hover">
                    Inspect <ExternalLink size={10} />
                  </span>
                </td>
              </tr>
            ))}

            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-xs text-slate-400">
                  No {dimensionTitle.toLowerCase()}s match the search query "{search}".
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-bold text-slate-900">
              <th className="py-2.5 px-3 text-xs">Total ({dimensionTitle} dimension)</th>
              <td className="py-2.5 px-3 text-xs font-mono text-right">{formatTableNumber(totals.sales)}</td>
              <td className="py-2.5 px-3 text-xs font-mono text-right">{formatTableNumber(totals.activations)}</td>
              <td className="py-2.5 px-3 text-xs text-right">
                {totals.activationRatio !== null ? formatPercent(totals.activationRatio) : '—'}
              </td>
              <td className="py-2.5 px-3 text-xs font-mono text-right">{formatWorkspaceCurrency(totals.revenue, currency)}</td>
              <td className="py-2.5 px-3 text-xs text-right">{formatWorkspaceCurrency(totals.revenuePerSale, currency)}</td>
              <td className="py-2.5 px-3 text-xs text-right text-slate-500">{formatTableNumber(totals.missingRev)}</td>
              <td className="py-2.5 px-3 text-xs text-right text-slate-400">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
