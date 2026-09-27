import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Clock3, AlertTriangle, Download, Info, ExternalLink } from 'lucide-react';
import type { AdaptedAgeingBucket, AdaptedSalesActivation } from '../model/salesActivationAdapter';
import { formatTableNumber, formatPercent, formatChartAxis } from '../../../lib/formatters';

interface ActivationAgeingProps {
  model: AdaptedSalesActivation;
  onInspectBucket: (bucket: AdaptedAgeingBucket) => void;
  onExportAgeing: () => void;
}

const BUCKET_COLORS: Record<string, string> = {
  '0–3d': '#0F766E', // Fresh / Green-teal
  '4–7d': '#2563EB', // Blue
  '8–14d': '#D97706', // Amber warning
  '15–30d': '#DC2626', // Red critical delay
  '30d+': '#7F1D1D', // Dark red severe breach
  'Invalid future sale': '#9333EA', // Purple anomaly
};

export default function ActivationAgeing({
  model,
  onInspectBucket,
  onExportAgeing,
}: ActivationAgeingProps) {
  const { ageing } = model;
  const buckets = ageing.buckets;

  const chartData = buckets.map((b) => ({
    name: b.bucket,
    sales: b.sales,
    share: b.shareOfUnactivated,
    raw: b,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const item = payload[0]?.payload;
    const bucket: AdaptedAgeingBucket = item?.raw;
    if (!bucket) return null;

    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xl text-xs space-y-1.5 max-w-xs z-50">
        <div className="font-semibold text-slate-900 flex items-center justify-between">
          <span>{bucket.bucket}</span>
          {bucket.isInvalidFuture && (
            <span className="text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-mono font-bold">
              ANOMALY
            </span>
          )}
        </div>
        <p className="text-slate-500 text-[11px] leading-tight">{bucket.description}</p>
        <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-slate-700">
          <span>Awaiting activation:</span>
          <span className="font-bold text-slate-900">{formatTableNumber(bucket.sales)} sales</span>
        </div>
        <div className="flex items-center justify-between text-slate-500 text-[11px]">
          <span>Share of backlog:</span>
          <span>{bucket.shareOfUnactivated !== null ? formatPercent(bucket.shareOfUnactivated) : '—'}</span>
        </div>
        <div className="text-[10px] text-indigo-600 font-medium pt-1">Click to open aggregate evidence</div>
      </div>
    );
  };

  return (
    <section className="enterprise-card cx-analytics-card" aria-label="Activation ageing queue">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="cx-command-section-kicker">Post-sale queue</span>
            <Clock3 size={15} className="text-slate-400" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Sales awaiting activation by completed age</h2>
          <p className="text-xs text-slate-500">
            Non-overlapping completed-day age cohorts measured from recorded sale timestamp. Total unactivated:{' '}
            <strong className="text-slate-700">{formatTableNumber(ageing.totalUnactivated)}</strong>
            {ageing.hasInvalidFuture && (
              <span className="text-red-600 ml-1.5 font-medium">
                ({formatTableNumber(ageing.invalidFuture)} future timestamp anomaly)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cx-button-secondary text-xs flex items-center gap-1.5 py-1 px-2.5"
            onClick={onExportAgeing}
            title="Download ageing distribution CSV"
          >
            <Download size={13} />
            <span>Export ageing</span>
          </button>
        </div>
      </header>

      {/* Visual Bar Chart: Strictly chronological order */}
      <div className="p-4 bg-slate-50/50">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 12, right: 16, left: -10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatChartAxis}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="sales"
                name="Sales"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
                isAnimationActive={false}
                className="cursor-pointer"
                onClick={(entry: any) => {
                  const b = entry?.raw || entry?.payload?.raw;
                  if (b) onInspectBucket(b);
                }}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={BUCKET_COLORS[entry.name] || '#3562B3'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Precise Supporting Table in Unified Analytical Region */}
      <div className="cx-performance-table-wrap">
        <table className="cx-performance-table w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="py-2.5 px-3 text-xs font-semibold text-slate-700">Completed age cohort</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-slate-700">Cohort definition</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-slate-700 text-right">Sales awaiting activation</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-slate-700 text-right">Share of backlog</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-slate-700 text-right">Status / Evidence</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr
                key={b.bucket}
                onClick={() => onInspectBucket(b)}
                className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                  b.isInvalidFuture ? 'bg-red-50/40 hover:bg-red-50/70' : ''
                }`}
              >
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-900 flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                    style={{ background: BUCKET_COLORS[b.bucket] || '#3562B3' }}
                  />
                  <span>{b.bucket}</span>
                </th>
                <td className="py-2.5 px-3 text-xs text-slate-500">
                  {b.description}
                </td>
                <td className="py-2.5 px-3 text-xs font-mono font-medium text-slate-900 text-right">
                  {formatTableNumber(b.sales)}
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-600 text-right">
                  {b.shareOfUnactivated !== null ? formatPercent(b.shareOfUnactivated) : '—'}
                </td>
                <td className="py-2.5 px-3 text-xs text-right">
                  {b.isInvalidFuture ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-100/80 px-2 py-0.5 rounded">
                      <AlertTriangle size={11} /> Timestamp error
                    </span>
                  ) : b.drillSupported ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 hover:text-indigo-900">
                      Record drill available <ExternalLink size={10} />
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">Aggregate only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-bold text-slate-900">
              <th className="py-2.5 px-3 text-xs">Total observed backlog</th>
              <td className="py-2.5 px-3 text-xs text-slate-500">Complete non-overlapping age queue</td>
              <td className="py-2.5 px-3 text-xs font-mono text-right">{formatTableNumber(ageing.totalUnactivated)}</td>
              <td className="py-2.5 px-3 text-xs text-right">100.0%</td>
              <td className="py-2.5 px-3 text-xs text-right text-slate-500">
                {ageing.hasInvalidFuture ? `${formatTableNumber(ageing.invalidFuture)} anomalies` : 'Queue verified'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
