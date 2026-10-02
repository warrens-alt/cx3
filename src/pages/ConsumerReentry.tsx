import ChartFrame from '../shared/visuals/ChartFrame';
import ChartTooltip from '../shared/visuals/ChartTooltip';
import TelemetryRail from '../shared/visuals/TelemetryRail';
import ReportingScopeSummary from '../shared/reporting/ReportingScopeSummary';
import { ReportActions } from '../shared/reporting/ReportPresentation';
import { AuditMetadata } from '../shared/evidence/AuditMode';
import { VisualTable } from '../components/visuals/DataVisual';
import { formatTableNumber, formatPercent } from '../lib/formatters';
import React, { useState } from 'react';
import AnalyticsPageLayout from '../components/AnalyticsPageLayout';
import ReportingScopeBar from '../shared/reporting/ReportingScopeBar';
import KpiCard from '../components/KpiCard';
import { TableSkeleton } from '../components/Skeleton';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { useAuth } from '../lib/AuthContext';
import { useClient } from '../lib/ClientContext';
import { DataState } from '../components/DataState';
import { Repeat, TrendingDown, Layers, CheckCircle2, AlertCircle, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const fixed = (value: number | string | null | undefined, digits: number) => value == null || value === '' || !Number.isFinite(Number(value)) ? 'Unavailable' : Number(value).toFixed(digits);

export default function ConsumerReentry() {
  const { clientConfig } = useClient();
  const { isAdmin } = useAuth();
  const currencyPrefix = clientConfig?.currency === 'ZAR' ? 'R ' : clientConfig?.currency === 'GBP' ? '£' : '$';
  const { data, loading, error, refetch } = useAnalyticsData('consumers');
  const [activeTab, setActiveTab] = useState<'tiers' | 'sequence' | 'sample'>('tiers');
  const [tiersView, setTiersView] = useState<'table' | 'graph'>('table');
  const [sequenceView, setSequenceView] = useState<'table' | 'graph'>('table');
  const [sampleView, setSampleView] = useState<'table' | 'graph'>('table');

  const scope = <ReportingScopeBar deferOptionsUntilExpanded onRefresh={refetch} />;
  const title = 'Consumer re-entry';
  const description = 'Consumer re-entry frequency, sequential outcomes and recorded value.';

  if (error) return <AnalyticsPageLayout title={title} description={description} scope={scope}><DataState error={error} retry={refetch}/></AnalyticsPageLayout>;

  if (loading) {
    return (
      <AnalyticsPageLayout title={title} description={description} scope={scope}>
        <TableSkeleton />
      </AnalyticsPageLayout>
    );
  }

  if (error || !data || !data.overview) {
    return (
      <AnalyticsPageLayout title={title} description={description} scope={scope}>
        <div className="bg-surface rounded-lg border border-border p-8 text-center max-w-xl mx-auto my-12">
          <AlertCircle className="w-12 h-12 text-semantic-warn mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-text-main mb-2">Unable to Load Consumer Re-entry Data</h2>
          <p className="text-text-sec text-sm mb-4">
            {error || 'The response did not include a consumer overview. Population size is unavailable.'}
          </p>
        </div>
      </AnalyticsPageLayout>
    );
  }

  const { overview, tiers, sequenceEconomics, repeatConsumersSample } = data;

  return (
    <AnalyticsPageLayout title={title} description={description} scope={scope} actions={<ReportActions />}>
      <AuditMetadata source="vw_consumers" grain="consumer_id" />

      {/* KPI Cards */}
      <TelemetryRail label="Consumer summary">
        <KpiCard
          title="Total Consumers"
          value={overview.total_consumers ?? null}
          subtitle={`${fixed(overview.avg_leads_per_consumer, 2)} leads / consumer`}
          onAnalyse={() => setActiveTab('tiers')}
        />
        <KpiCard
          title="Repeat Consumers"
          value={overview.repeat_consumers ?? null}
          subtitle={`${formatPercent(overview.repeat_consumer_share_pct)} re-entry rate`}
          onAnalyse={() => setActiveTab('tiers')}
        />
        <KpiCard
          title="Revenue-Matched Sale Share (Single-Lead Consumers)"
          value={`${formatPercent(overview.single_billable_sale_rate_pct)}`}
          subtitle="Consumers with a revenue-matched sale / single-lead consumers"
          onAnalyse={() => setActiveTab('sequence')}
        />
        <KpiCard
          title="Revenue-Matched Sale Share (Repeat Consumers)"
          value={`${formatPercent(overview.repeat_billable_sale_rate_pct)}`}
          subtitle="Consumers with a revenue-matched sale / repeat consumers"
          onAnalyse={() => setActiveTab('sequence')}
        />
        <KpiCard
          title="Recorded Revenue (Single-Lead Consumers)"
          value={overview.single_consumer_revenue ?? null}
          prefix={currencyPrefix}
          subtitle={`${currencyPrefix}${fixed(overview.rev_per_single_consumer, 2)} / consumer`}
          onAnalyse={() => setActiveTab('sequence')}
        />
        <KpiCard
          title="Recorded Revenue (Repeat Consumers)"
          value={overview.repeat_consumer_revenue ?? null}
          prefix={currencyPrefix}
          subtitle={`${currencyPrefix}${fixed(overview.rev_per_repeat_consumer, 2)} / consumer`}
          onAnalyse={() => setActiveTab('sequence')}
        />
        <KpiCard
          title="Recorded Revenue (All Consumers)"
          value={overview.total_revenue ?? null}
          prefix={currencyPrefix}
          subtitle="Revenue summed by recorded consumer ID; not verified lifetime value"
          onAnalyse={() => setActiveTab('sequence')}
        />
      </TelemetryRail>

      {/* Sub Navigation */}
      <nav aria-label="Consumer reentry sub sections" className="cx-tabs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('tiers')}
          aria-pressed={activeTab === 'tiers'} data-active={activeTab === 'tiers'}
          className="cx-tab-item"
        >
          <Layers className="w-4 h-4" />
          <span>Volume Tiers Distribution</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sequence')}
          aria-pressed={activeTab === 'sequence'} data-active={activeTab === 'sequence'}
          className="cx-tab-item"
        >
          <TrendingDown className="w-4 h-4" />
          <span>Sequential Entry Economics</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sample')}
          disabled={!isAdmin} title={!isAdmin ? 'Individual consumer records require administrator access' : undefined}
          aria-pressed={activeTab === 'sample'} data-active={activeTab === 'sample'}
          className="cx-tab-item"
        >
          <Repeat className="w-4 h-4" />
          <span>High-Frequency Repeat Consumers</span>
        </button>
      </nav>

      {activeTab === 'tiers' && (
        <ChartFrame title="Consumer Volume Tier Distribution" subtitle="Consumer counts and recorded value by lead volume tier." scope={<ReportingScopeSummary />} controls={<ConsumerViewControls view={tiersView} onChange={setTiersView} />} footer={<details className="cx-evidence-disclosure"><summary>Methodology</summary><p className="cx-tech-label">Count(DISTINCT consumer_id)</p></details>}>
          {tiersView === 'table' ? (
            <div className="overflow-x-auto">
              <VisualTable visual={{id:'consumers.tiers',data:(tiers)}} className="w-full text-left text-sm text-text-sec">
                <thead className="bg-surface-subtle text-xs font-semibold text-text-sec uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Lead Tier</th>
                    <th className="py-3 px-4 text-right">Consumers</th>
                    <th className="py-3 px-4 text-right">Consumer Share</th>
                    <th className="py-3 px-4 text-right">Total Leads</th>
                    <th className="py-3 px-4 text-right">Consumers w/ Sale</th>
                    <th className="py-3 px-4 text-right">Consumers with Sales / Consumers (%)</th>
                    <th className="py-3 px-4 text-right">Revenue-Matched Consumers with Sales / Consumers (%)</th>
                    <th className="py-3 px-4 text-right">Recorded Revenue</th>
                    <th className="py-3 px-4 text-right">Recorded Revenue / Consumer</th>
                    <th className="py-3 px-4 text-right">Recorded Revenue / Lead</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-sans tabular-nums text-xs">
                  {tiers.map((tier: any, idx: number) => (
                    <tr key={idx} className="hover:bg-surface-subtle">
                      <td className="py-3 px-4 font-sans font-medium text-text-main">
                        {tier.lead_tier}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-text-main">{formatTableNumber(tier.consumer_count)}</td>
                      <td className="py-3 px-4 text-right text-text-sec">{formatPercent(tier.consumer_share_pct)}</td>
                      <td className="py-3 px-4 text-right font-medium text-text-main">{formatTableNumber(tier.total_leads)}</td>
                      <td className="py-3 px-4 text-right text-text-sec">{formatTableNumber(tier.consumers_with_sale)}</td>
                      <td className="py-3 px-4 text-right text-text-sec">{formatPercent(tier.sale_rate_pct)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-text-main">{formatPercent(tier.billable_sale_rate_pct)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-text-main">{currencyPrefix}{formatTableNumber(tier.total_revenue)}</td>
                      <td className="py-3 px-4 text-right font-bold text-action">{currencyPrefix}{fixed(tier.rev_per_consumer, 2)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-text-sec bg-surface-subtle">{currencyPrefix}{fixed(tier.rev_per_lead, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </VisualTable>
            </div>
          ) : (
            <div className="p-5 h-72 min-h-[288px] w-full">
              {!tiers.length ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-xs text-text-muted bg-surface-subtle rounded-lg border border-dashed border-border p-4">
                  <span className="font-medium text-text-sec mb-1">No consumer tier observations recorded.</span>
                  <span className="text-[11px] text-text-muted">Try adjusting your filters or date range.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
                  <BarChart data={tiers} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border-subtle)" />
                    <XAxis dataKey="lead_tier" tick={{ fontSize: 10, fill: 'var(--cx-text-secondary)' }} stroke="var(--cx-border)" axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--cx-text-secondary)' }} stroke="var(--cx-border)" axisLine={false} tickLine={false} tickFormatter={v => Number(v).toLocaleString()} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return <ChartTooltip title={`Tier: ${label}`} rows={payload.map((entry: any) => ({ label: String(entry.name), value: formatTableNumber(entry.value), color: String(entry.stroke || entry.color || entry.fill || 'var(--cx-text-secondary)') }))} />;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="consumer_count" name="Consumers" fill="var(--cx-action)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="total_leads" name="Total Leads" fill="var(--cx-data-fetched)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="consumers_with_sale" name="Consumers with Sale" fill="var(--cx-data-sales)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </ChartFrame>
      )}

      {activeTab === 'sequence' && (
        <ChartFrame title="Sequential Entry Conversion & Economics" subtitle="Returned contact, sales and revenue by submission order." scope={<ReportingScopeSummary />} controls={<ConsumerViewControls view={sequenceView} onChange={setSequenceView} />} footer={<details className="cx-evidence-disclosure"><summary>Methodology</summary><p className="cx-tech-label">ROW_NUMBER() OVER(PARTITION BY consumer_id ORDER BY capture_timestamp ASC)</p></details>}>
          {sequenceView === 'table' ? (
            <div className="overflow-x-auto">
              <VisualTable visual={{id:'consumers.sequence',data:(sequenceEconomics)}} className="w-full text-left text-sm text-text-sec">
                <thead className="bg-surface-subtle text-xs font-semibold text-text-sec uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Sequential Stage</th>
                    <th className="py-3 px-4 text-right">Lead Count</th>
                    <th className="py-3 px-4 text-right">Delivered / Fetched Leads (%)</th>
                    <th className="py-3 px-4 text-right">Dialled / Fetched Leads (%)</th>
                    <th className="py-3 px-4 text-right">RPC / Fetched Leads (%)</th>
                    <th className="py-3 px-4 text-right">Sales / Fetched Leads (%)</th>
                    <th className="py-3 px-4 text-right">Revenue-Matched Sales / Fetched Leads (%)</th>
                    <th className="py-3 px-4 text-right">Recorded Revenue</th>
                    <th className="py-3 px-4 text-right">Recorded Revenue / Lead</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-sans tabular-nums text-xs">
                  {sequenceEconomics.map((seq: any, idx: number) => {
                    const isFirst = seq.entry_stage === '1st Entry';
                    return (
                      <tr key={idx} className={isFirst ? 'bg-selected-bg font-medium' : 'hover:bg-surface-subtle'}>
                        <td className="py-3.5 px-4 font-sans font-semibold text-text-main">
                          {seq.entry_stage}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-text-main">{formatTableNumber(seq.leads)}</td>
                        <td className="py-3.5 px-4 text-right text-text-sec">{formatPercent(seq.delivery_rate_pct)}</td>
                        <td className="py-3.5 px-4 text-right text-text-sec">{formatPercent(seq.call_rate_pct)}</td>
                        <td className="py-3.5 px-4 text-right text-text-sec">{formatPercent(seq.rpc_rate_pct)}</td>
                        <td className="py-3.5 px-4 text-right text-text-sec">{formatPercent(seq.sale_rate_pct)}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-text-main">{formatPercent(seq.billable_sale_rate_pct)}</td>
                        <td className="py-3.5 px-4 text-right font-semibold text-text-main">{currencyPrefix}{formatTableNumber(seq.total_revenue)}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-action bg-selected">{currencyPrefix}{fixed(seq.rev_per_lead, 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </VisualTable>
            </div>
          ) : (
            <div className="p-5 h-72 min-h-[288px] w-full">
              {!sequenceEconomics.length ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-xs text-text-muted bg-surface-subtle rounded-lg border border-dashed border-border p-4">
                  <span className="font-medium text-text-sec mb-1">No sequential entry observations recorded.</span>
                  <span className="text-[11px] text-text-muted">Try adjusting your filters or date range.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
                  <AreaChart data={sequenceEconomics} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorSeqRpc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--cx-data-rpc)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--cx-data-rpc)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSeqSale" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--cx-data-sales)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--cx-data-sales)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border-subtle)" />
                    <XAxis dataKey="entry_stage" tick={{ fontSize: 10, fill: 'var(--cx-text-secondary)' }} stroke="var(--cx-border)" axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--cx-text-secondary)' }} stroke="var(--cx-border)" unit="%" axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return <ChartTooltip title={`Entry: ${label}`} rows={payload.map((entry: any) => ({ label: String(entry.name), value: formatPercent(entry.value), color: String(entry.stroke || entry.color || entry.fill || 'var(--cx-text-secondary)') }))} />;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="rpc_rate_pct" name="RPC Rate %" stroke="var(--cx-data-rpc)" strokeWidth={2} fillOpacity={1} fill="url(#colorSeqRpc)" connectNulls={true} isAnimationActive={false} />
                    <Area type="monotone" dataKey="billable_sale_rate_pct" name="Sale Rate %" stroke="var(--cx-data-sales)" strokeWidth={2} fillOpacity={1} fill="url(#colorSeqSale)" connectNulls={true} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </ChartFrame>
      )}

      {isAdmin && activeTab === 'sample' && (
        <ChartFrame title="Highest-Value Multi-Lead Consumers" subtitle="Repeat consumers ranked by recorded revenue across retained entries." scope={<ReportingScopeSummary />} controls={<ConsumerViewControls view={sampleView} onChange={setSampleView} />}>
          {sampleView === 'table' ? (
            <div className="overflow-x-auto">
              <VisualTable visual={{id:'consumers.sample',data:(repeatConsumersSample)}} className="w-full text-left text-sm text-text-sec">
                <thead className="bg-surface-subtle text-xs font-semibold text-text-sec uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Consumer ID</th>
                    <th className="py-3 px-4 text-center">Recorded Leads</th>
                    <th className="py-3 px-4 text-center">Unique Sources</th>
                    <th className="py-3 px-4 text-center">Unique Vendors</th>
                    <th className="py-3 px-4 text-center">Transactions</th>
                    <th className="py-3 px-4">First Lead Date</th>
                    <th className="py-3 px-4">Latest Lead Date</th>
                    <th className="py-3 px-4 text-center">Sale Flag with Recorded Revenue</th>
                    <th className="py-3 px-4 text-right">Recorded Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-sans tabular-nums text-xs">
                  {repeatConsumersSample.map((c: any, idx: number) => (
                    <tr key={idx} className="hover:bg-surface-subtle">
                      <td className="py-3 px-4 font-sans font-medium text-text-main">{c.consumer_id}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded bg-selected-bg text-action font-semibold">{c.lead_count}</span>
                      </td>
                      <td className="py-3 px-4 text-center text-text-sec">{c.unique_source_count}</td>
                      <td className="py-3 px-4 text-center text-text-sec">{c.unique_vendor_count}</td>
                      <td className="py-3 px-4 text-center text-text-sec">{c.transaction_count}</td>
                      <td className="py-3 px-4 text-text-sec">{c.first_lead_date?.value || c.first_lead_date || 'N/A'}</td>
                      <td className="py-3 px-4 text-text-sec">{c.latest_lead_date?.value || c.latest_lead_date || 'N/A'}</td>
                      <td className="py-3 px-4 text-center">
                        {c.has_billable_sale ? (
                          <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-selected-bg text-text-main">Yes</span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded text-xs text-text-muted">No</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-text-main">{currencyPrefix}{formatTableNumber(c.total_revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </VisualTable>
            </div>
          ) : (
            <div className="p-5 h-72 w-full">
              {!repeatConsumersSample.length ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-xs text-text-muted bg-surface-subtle rounded-lg border border-dashed border-border p-4">
                  <span className="font-medium text-text-sec mb-1">No repeat consumer sample observations recorded.</span>
                  <span className="text-[11px] text-text-muted">Try adjusting your filters or date range.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
                  <BarChart data={repeatConsumersSample} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cx-border-subtle)" />
                    <XAxis dataKey="consumer_id" tick={{ fontSize: 9, fill: 'var(--cx-text-secondary)' }} stroke="var(--cx-border)" interval={0} angle={-25} textAnchor="end" height={45} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--cx-text-secondary)' }} stroke="var(--cx-border)" axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return <ChartTooltip title={`Consumer: ${label}`} rows={payload.map((entry: any) => ({ label: entry.dataKey === 'total_revenue' ? 'Recorded Revenue' : 'Recorded Leads', value: entry.dataKey === 'total_revenue' ? `${currencyPrefix}${formatTableNumber(entry.value)}` : formatTableNumber(entry.value), color: String(entry.stroke || entry.color || entry.fill || 'var(--cx-text-secondary)') }))} />;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="total_revenue" name="Recorded Revenue" fill="var(--cx-text-secondary)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="lead_count" name="Recorded Leads" fill="var(--cx-data-fetched)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </ChartFrame>
      )}
    </AnalyticsPageLayout>
  );
}

function ConsumerViewControls({ view, onChange }: { view: 'table' | 'graph'; onChange: (view: 'table' | 'graph') => void }) {
  return <div className="cx-segmented-control" role="group" aria-label="Consumer evidence view">
    <button type="button" aria-pressed={view === 'table'} onClick={() => onChange('table')}><TableIcon size={12} aria-hidden="true" />Table</button>
    <button type="button" aria-pressed={view === 'graph'} onClick={() => onChange('graph')}><BarChart2 size={12} aria-hidden="true" />Graph</button>
  </div>;
}
