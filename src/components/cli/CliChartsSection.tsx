import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import type { CliPerformanceResponse } from '../../../contracts/cliPerformance';
import { exactNumber } from '../../../contracts/format';

interface RankingItem {
  cli: string;
  campaign: string;
  value: number;
  calls: number;
  sales: number;
  rpcRate: number;
}

interface FunnelStage {
  stage: string;
  count: number;
  pct: number;
  color: string;
}

interface CliChartsSectionProps {
  data: CliPerformanceResponse;
  rankingChartData: RankingItem[];
  rankMetric: string;
  setRankMetric: (m: string) => void;
  trendMetric: string;
  setTrendMetric: (m: string) => void;
  funnelData: FunnelStage[];
  summary: CliPerformanceResponse['summary'];
}

export const CliChartsSection: React.FC<CliChartsSectionProps> = ({
  data,
  rankingChartData,
  rankMetric,
  setRankMetric,
  trendMetric,
  setTrendMetric,
  funnelData,
  summary,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Chart 1: CLI Performance Ranking (7 cols) */}
      <div className="lg:col-span-7 bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">CLI Performance Ranking</h3>
            <p className="text-xs text-slate-500">Compare top outbound caller-IDs by key operational metric</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Metric:</span>
            <select
              value={rankMetric}
              onChange={e => setRankMetric(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2 py-1 bg-white font-medium text-slate-700"
            >
              <option value="totalCalls">Total Calls</option>
              <option value="contactRate">Right Party Contact (RPC %)</option>
              <option value="salePerCallRate">Sale / Call Rate (%)</option>
              <option value="saleCount">Total Sales</option>
              <option value="durationGe5mPct">Talk &gt;= 5m Share (%)</option>
              <option value="answeredRate">Answer Rate (%)</option>
            </select>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rankingChartData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis type="category" dataKey="cli" tick={{ fontSize: 11, fill: '#334155' }} width={80} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-slate-900 text-white p-2.5 rounded shadow-lg text-xs space-y-1">
                      <p className="font-semibold text-blue-300">{d.cli}</p>
                      <p className="text-slate-300">{d.campaign}</p>
                      <hr className="border-slate-700 my-1" />
                      <p>Total Calls: <span className="font-bold">{d.calls.toLocaleString()}</span></p>
                      <p>RPC Rate: <span className="font-bold">{d.rpcRate}%</span></p>
                      <p>Sales: <span className="font-bold">{d.sales}</span></p>
                      <p>Selected Metric Value: <span className="font-bold text-amber-400">{d.value}</span></p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" fill="#3562B3" radius={[0, 4, 4, 0]}>
                {rankingChartData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#1E3A8A' : index < 3 ? '#2563EB' : '#3B82F6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Telephony Conversion Funnel (5 cols) */}
      <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">CLI Dialler Conversion Funnel</h3>
          <p className="text-xs text-slate-500">Observed drop-off from call attempt to commercial activation</p>
        </div>

        <div className="space-y-2 pt-1">
          {funnelData.map((stage, idx) => (
            <div key={stage.stage} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">{stage.stage}</span>
                <span className="font-bold text-slate-900">
                  {stage.count.toLocaleString()}{' '}
                  <span className="font-normal text-slate-500">({stage.pct}%)</span>
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(3, stage.pct)}%`,
                    backgroundColor: stage.color,
                  }}
                />
              </div>
              {idx < funnelData.length - 1 && (
                <div className="text-[10px] text-slate-400 text-right pr-1">
                  Conversion: {stage.count > 0 ? ((funnelData[idx + 1].count / stage.count) * 100).toFixed(1) : 0}%
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chart 3: Conversation Quality (Duration Bands) (6 cols) */}
      <div className="lg:col-span-6 bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Conversation Quality & Duration Bands</h3>
            <p className="text-xs text-slate-500">Shown only when duration counts are supplied by the source.</p>
          </div>
          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            Avg: {data.durationBands.avgDurationSeconds ? `${data.durationBands.avgDurationSeconds}s` : 'Unavailable'}
          </span>
        </div>

        {data.durationBands.under1mCount !== null ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {[
                ['< 1 minute', data.durationBands.under1mCount, data.durationBands.under1mPct],
                ['1 – 5 minutes', data.durationBands.oneTo5mCount, data.durationBands.oneTo5mPct],
                ['5 – 15 minutes', data.durationBands.fiveTo15mCount, data.durationBands.fiveTo15mPct],
                ['15+ minutes', data.durationBands.over15mCount, data.durationBands.over15mPct],
              ].map(([label, count, share]) => (
                <div key={label as string} className="bg-slate-50 p-2.5 rounded border border-slate-200 text-center">
                  <span className="text-[11px] text-slate-500 block">{label}</span>
                  <span className="text-sm font-bold text-slate-800">{exactNumber(count as string | null)}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{share ?? '—'}{share !== null ? '%' : ''}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2">
              <span>Total recorded talk time: {data.durationBands.totalDurationSeconds ? (parseInt(data.durationBands.totalDurationSeconds, 10) / 3600).toFixed(1) + ' hrs' : 'Unavailable'}</span>
              <span>Calls ≥5m: {summary?.durationGe5mRate ? `${summary.durationGe5mRate}%` : 'Unavailable'}</span>
            </div>
          </>
        ) : (
          <div className="cx-command-empty">Duration bands are unavailable because the source report did not supply the required duration counts.</div>
        )}
      </div>

      {/* Chart 4: Lead Age evidence (6 cols) */}
      <div className="lg:col-span-6 bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Lead Age at Dial</h3>
            <p className="text-xs text-slate-500">CX3 shows only source-observed latency evidence and does not infer a distribution from aggregate averages.</p>
          </div>
          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            Avg Age: {data.leadAgeBands.avgLeadAgeDays ? `${data.leadAgeBands.avgLeadAgeDays}d` : 'Unavailable'}
          </span>
        </div>
        {data.leadAgeBands.bands.some(band => Number(band.callCount) > 0) ? (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.leadAgeBands.bands} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="band" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip />
                <Bar dataKey="contactRatePct" name="RPC Rate %" fill="#3562B3" radius={[4, 4, 0, 0]} />
                <Bar dataKey="salePerCallRatePct" name="Sale / Call Rate %" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="cx-command-empty">{data.leadAgeBands.disclaimer}</div>
        )}
      </div>

      {/* Chart 5: Daily Performance Trend (12 cols) */}
      {data.trend && data.trend.length > 0 && (
        <div className="lg:col-span-12 bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">CLI Dialler Trend Timeline</h3>
              <p className="text-xs text-slate-500">Daily trajectory of volume, contact efficiency, and conversions</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Trend Focus:</span>
              <select
                value={trendMetric}
                onChange={e => setTrendMetric(e.target.value)}
                className="text-xs border border-slate-300 rounded px-2 py-1 bg-white font-medium text-slate-700"
              >
                <option value="saleRate">Sale / Call Rate (%)</option>
                <option value="contactRate">Right Party Contact (RPC %)</option>
                <option value="totalCalls">Daily Call Volume</option>
                {data.trend.some(point => point.durationGe5mRate !== null) && <option value="durationGe5mRate">Talk &gt;= 5m Share (%)</option>}
              </select>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="cliTrendColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3562B3" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3562B3" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-2.5 rounded shadow-lg text-xs space-y-1">
                        <p className="font-semibold text-blue-300">{d.date}</p>
                        <p>Total Calls: <span className="font-bold">{d.totalCalls.toLocaleString()}</span></p>
                        <p>Contact Rate: <span className="font-bold text-blue-400">{d.contactRate}%</span></p>
                        <p>Sale Rate: <span className="font-bold text-emerald-400">{d.saleRate}%</span></p>
                        <p>Talk &gt;= 5m: <span className="font-bold">{d.durationGe5mRate == null ? 'Unavailable' : `${d.durationGe5mRate}%`}</span></p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={trendMetric}
                  stroke="#3562B3"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#cliTrendColor)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
