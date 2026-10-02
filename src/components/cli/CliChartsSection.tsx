import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts';
import type { CliPerformanceResponse } from '../../../contracts/cliPerformance';
import { exactNumber } from '../../../contracts/format';
import ChartFrame from '../../shared/visuals/ChartFrame';
import ChartTooltip from '../../shared/visuals/ChartTooltip';
import ReportingScopeSummary from '../../shared/reporting/ReportingScopeSummary';
import { lifecyclePresentation } from '../../shared/visuals/lifecyclePresentation';

interface RankingItem { cli: string; campaign: string; value: number; calls: number; sales: number; rpcRate: number; }
interface FunnelStage { stage: string; count: number; pct: number; color: string; }
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
const tick = { fontSize: 11, fill: 'var(--cx-text-secondary)' };
const selectClass = 'text-xs border border-border rounded px-2 py-1 bg-surface font-medium text-text-main max-w-full';

export const CliChartsSection: React.FC<CliChartsSectionProps> = ({ data, rankingChartData, rankMetric, setRankMetric, trendMetric, setTrendMetric, funnelData, summary }) => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
    <ChartFrame className="lg:col-span-7" title="CLI Performance Ranking" subtitle="Outbound caller IDs by selected measure." scope={<ReportingScopeSummary />}
      controls={<label className="flex items-center gap-1.5 text-xs text-text-sec">Metric
        <select aria-label="CLI ranking metric" value={rankMetric} onChange={e => setRankMetric(e.target.value)} className={selectClass}>
          <option value="totalCalls">Total Calls</option><option value="contactRate">Right Party Contact (RPC %)</option>
          <option value="salePerCallRate">Sale / Call Rate (%)</option><option value="saleCount">Total Sales</option>
          <option value="durationGe5mPct">Talk &gt;= 5m Share (%)</option><option value="answeredRate">Answer Rate (%)</option>
        </select>
      </label>}>
      <div className="h-64 min-h-[256px] w-full">
        {!rankingChartData || !rankingChartData.length ? <div className="cx-command-empty">No CLI ranking observations recorded. Select a wider date range or check campaign filters.</div> : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
            <BarChart data={rankingChartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--cx-border-subtle)" />
              <XAxis type="number" tick={tick} /><YAxis type="category" dataKey="cli" tick={tick} width={95} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return <ChartTooltip title={<>{d.cli} · {d.campaign}</>} rows={[
                  { label: 'Total Calls', value: d.calls.toLocaleString() },
                  { label: 'RPC Rate', value: `${d.rpcRate}%`, color: lifecyclePresentation.rpc.color },
                  { label: 'Sales', value: d.sales, color: lifecyclePresentation.sales.color },
                  { label: 'Selected Value', value: d.value },
                ]} />;
              }} />
              <Bar dataKey="value" fill="var(--cx-neutral)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartFrame>

    <ChartFrame className="lg:col-span-5" title="CLI Dialler Conversion Funnel" subtitle="Recorded call and downstream outcomes." scope={<ReportingScopeSummary />}>
      <div className="space-y-2 pt-1">
        {funnelData.map((stage, idx) => <div key={stage.stage} className="space-y-1">
          <div className="flex items-center justify-between text-xs"><span className="font-medium text-text-sec">{stage.stage}</span>
            <span className="font-bold text-text-main">{stage.count.toLocaleString()} <span className="font-normal text-text-sec">({stage.pct}%)</span></span>
          </div>
          <div className="w-full bg-surface-subtle rounded-full h-3 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, stage.pct))}%`, backgroundColor: stage.color }} /></div>
          {idx < funnelData.length - 1 && <div className="text-[10px] text-text-mute text-right pr-1">Conversion: {stage.count > 0 && funnelData[idx + 1] ? ((funnelData[idx + 1].count / stage.count) * 100).toFixed(1) + '%' : '—'}</div>}
        </div>)}
      </div>
    </ChartFrame>

    <ChartFrame className="lg:col-span-6" title="Conversation Quality & Duration Bands" subtitle="Source-supplied duration counts." scope={<ReportingScopeSummary />}
      actions={<span className="text-xs text-text-sec">Avg: {data.durationBands.avgDurationSeconds ? `${data.durationBands.avgDurationSeconds}s` : 'Unavailable'}</span>}>
      {data.durationBands.under1mCount !== null ? <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          {[
            ['< 1 minute', data.durationBands.under1mCount, data.durationBands.under1mPct],
            ['1 – 5 minutes', data.durationBands.oneTo5mCount, data.durationBands.oneTo5mPct],
            ['5 – 15 minutes', data.durationBands.fiveTo15mCount, data.durationBands.fiveTo15mPct],
            ['15+ minutes', data.durationBands.over15mCount, data.durationBands.over15mPct],
          ].map(([label, count, share]) => <div key={label as string} className="p-2.5 border-r border-border-subtle text-center">
            <span className="text-[11px] text-text-sec block">{label}</span><span className="text-sm font-bold text-text-main">{exactNumber(count as string | null)}</span>
            <span className="text-[10px] text-text-mute block mt-0.5">{share ?? '—'}{share !== null ? '%' : ''}</span>
          </div>)}
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-text-sec pt-2">
          <span>Total recorded talk time: {data.durationBands.totalDurationSeconds ? (parseInt(data.durationBands.totalDurationSeconds, 10) / 3600).toFixed(1) + ' hrs' : 'Unavailable'}</span>
          <span>Calls ≥5m: {summary?.durationGe5mRate ? `${summary.durationGe5mRate}%` : 'Unavailable'}</span>
        </div>
      </> : <div className="cx-command-empty">Duration bands are unavailable because the source report did not supply the required duration counts.</div>}
    </ChartFrame>

    <ChartFrame className="lg:col-span-6" title="Lead Age at Dial" subtitle="Source-observed latency evidence." scope={<ReportingScopeSummary />}
      footer="No distribution is inferred from aggregate averages."
      actions={<span className="text-xs text-text-sec">Avg Age: {data.leadAgeBands.avgLeadAgeDays ? `${data.leadAgeBands.avgLeadAgeDays}d` : 'Unavailable'}</span>}>
      {data.leadAgeBands.bands.some(band => Number(band.callCount) > 0) ? <div className="h-48 min-h-[192px] w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
          <BarChart data={data.leadAgeBands.bands} margin={{ top: 8, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border-subtle)" />
            <XAxis dataKey="band" tick={tick} axisLine={false} tickLine={false} /><YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const b = payload[0]?.payload;
              return <ChartTooltip title={`Age Cohort: ${label}`} rows={[
                { label: 'Calls in Band', value: Number(b.callCount || 0).toLocaleString() },
                { label: 'RPC Rate', value: `${b.contactRatePct}%`, color: lifecyclePresentation.rpc.color },
                { label: 'Sale / Call Rate', value: `${b.salePerCallRatePct}%`, color: lifecyclePresentation.sales.color },
              ]} />;
            }} />
            <Bar dataKey="contactRatePct" name="RPC Rate %" fill={lifecyclePresentation.rpc.color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="salePerCallRatePct" name="Sale / Call Rate %" fill={lifecyclePresentation.sales.color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div> : <div className="cx-command-empty">{data.leadAgeBands.disclaimer}</div>}
    </ChartFrame>

    {data.trend && data.trend.length > 0 && <ChartFrame className="lg:col-span-12" title="CLI Dialler Trend Timeline" subtitle="Daily volume, contact and recorded outcomes." scope={<ReportingScopeSummary />}
      controls={<label className="flex items-center gap-1.5 text-xs text-text-sec">Trend Focus
        <select aria-label="CLI trend metric" value={trendMetric} onChange={e => setTrendMetric(e.target.value)} className={selectClass}>
          <option value="saleRate">Sale / Call Rate (%)</option><option value="contactRate">Right Party Contact (RPC %)</option><option value="totalCalls">Daily Call Volume</option>
          {data.trend.some(point => point.durationGe5mRate !== null) && <option value="durationGe5mRate">Talk &gt;= 5m Share (%)</option>}
        </select>
      </label>}>
      <div className="h-56 min-h-[224px] w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
          <AreaChart data={data.trend} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border-subtle)" />
            <XAxis dataKey="date" tick={tick} axisLine={false} tickLine={false} /><YAxis tick={tick} axisLine={false} tickLine={false} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return <ChartTooltip title={d.date} rows={[
                { label: 'Total Calls', value: d.totalCalls.toLocaleString() },
                { label: 'Contact Rate', value: `${d.contactRate}%`, color: lifecyclePresentation.rpc.color },
                { label: 'Sale Rate', value: `${d.saleRate}%`, color: lifecyclePresentation.sales.color },
                { label: 'Talk ≥ 5m', value: d.durationGe5mRate == null ? 'Unavailable' : `${d.durationGe5mRate}%` },
              ]} />;
            }} />
            <Area type="monotone" dataKey={trendMetric} stroke="var(--cx-neutral)" strokeWidth={2} fillOpacity={0.12} fill="var(--cx-neutral)" connectNulls={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>}
  </div>
);
