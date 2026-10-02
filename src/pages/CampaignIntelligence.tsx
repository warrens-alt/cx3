import AcquisitionFlow from '../features/campaigns/AcquisitionFlow';
import '../styles/acquisitionEvidenceVisuals.css';
import AnalyticsPageLayout from '../components/AnalyticsPageLayout';
import { ReportSkeleton } from '../components/OperationalState';
import TablePreview from '../shared/reporting/TablePreview';
import { ReportActions } from '../shared/reporting/ReportPresentation';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import SpendReconciliationPanel from '../components/SpendReconciliationPanel';
import { useOperationalData } from '../lib/useOperationalData';
import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import MarketingRootCauseDrawer from '../components/MarketingRootCauseDrawer';
import { RankedMetricChart, VolumeRateComboChart } from '../components/charts/OperationalVisuals';
import { useClient } from '../lib/ClientContext';
import { useAuth } from '../lib/AuthContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import {
  fetchCampaigns,
  fetchMarketingDiscovery,
  type CampaignData,
  type MarketingDiscoveryData,
  type MarketingRootCauseData,
} from '../lib/offernetClient';

import { formatPercent } from '../lib/formatters';
import MediaMetricCard from '../features/evidenceWorkspace/MediaMetricCard';
import EvidenceBars from '../shared/visuals/EvidenceBars';
import InspectorHost, { type InspectorContent } from '../shared/evidence/InspectorHost';
import { AuditMetadata } from '../shared/evidence/AuditMode';
import { campaignAudit, suppliedProvenance } from '../features/evidenceWorkspace/secondaryAudit';

const money = (value: number | null) => value == null ? '—' : `R ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const num = (value: number | null) => value == null ? '—' : value.toLocaleString();
type MediaMetric = NonNullable<MarketingRootCauseData['metric']>['id'];
type CampaignMeasure = 'leads' | 'spend' | 'ctr' | 'cpl';

export default function CampaignIntelligence() {
  const { selectedClient } = useClient();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters, setFilter } = useFilters();
  const [audit, setAudit] = useState<InspectorContent | null>(null);
  const auditScope = { clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined, filters };
  useEffect(() => setAudit(null), [selectedClient, startDate, endDate, filters]);
  const [discovery, setDiscovery] = useState<MarketingDiscoveryData | null>(null);
  const [rootMetric, setRootMetric] = useState<MediaMetric | null>(null);
  const [campaignMeasure, setCampaignMeasure] = useState<CampaignMeasure>('leads');

  const { data, loading, error, loadData } = useOperationalData<CampaignData>('CampaignIntelligence', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, fetchCampaigns);

  useEffect(() => {
    if (!isAdmin || !selectedClient) {
      setDiscovery(null);
      return;
    }
    let cancelled = false;
    fetchMarketingDiscovery({ clientId: selectedClient })
      .then(result => { if (!cancelled) setDiscovery(result); })
      .catch(() => { if (!cancelled) setDiscovery(null); });
    return () => { cancelled = true; };
  }, [isAdmin, selectedClient]);

  const campaignComparison = React.useMemo(() => {
    const rows = [...(data?.campaigns || [])].sort((a, b) => {
      const av = campaignMeasure === 'leads' ? a.leads : campaignMeasure === 'spend' ? (a.spend ?? -1) : campaignMeasure === 'ctr' ? (a.ctr ?? -1) : (a.cpl ?? -1);
      const bv = campaignMeasure === 'leads' ? b.leads : campaignMeasure === 'spend' ? (b.spend ?? -1) : campaignMeasure === 'ctr' ? (b.ctr ?? -1) : (b.cpl ?? -1);
      return Number(bv) - Number(av);
    }).slice(0, 12);
    return rows.map((row, index) => {
      const value = campaignMeasure === 'leads' ? row.leads : campaignMeasure === 'spend' ? row.spend : campaignMeasure === 'ctr' ? row.ctr : row.cpl;
      const displayValue = campaignMeasure === 'leads' ? num(row.leads) : campaignMeasure === 'spend' || campaignMeasure === 'cpl' ? money(value) : formatPercent(value);
      return {
        key: `${row.campaign}-${row.adset}-${index}`,
        sourceRow: row,
        label: row.campaign,
        detail: row.adset && row.adset !== row.campaign ? row.adset : row.channel,
        value,
        displayValue,
      };
    });
  }, [data?.campaigns, campaignMeasure]);

  const summary = data?.summary;
  const canCompare = Boolean(startDate && endDate && data?.comparison && !loading && !error);

  return (
    <AnalyticsPageLayout className="cx-campaign-page" title="Acquisition" description={<>Observed platform delivery and spend from the approved marketing API-table contract for the selected tenant.</>} actions={<ReportActions />} scope={<OffernetFilterBar
        onRefresh={() => loadData(true)}
        showVendorFilter={false}
        showSourceFilter={false}
        showGradeFilter={false}
      />}>

        {error && <div className="cx-command-error"><AlertTriangle size={17}/>{error}</div>}
        {loading && !data && <ReportSkeleton label="Loading media performance" metricCount={5} />}

        {data && (
          <>
            {data.denominatorDiagnostics?.some(item => item.missingRows > 0) && <div className="cx-control-note" role="status">Platform metrics with missing or invalid observations are unavailable: {data.denominatorDiagnostics.filter(item => item.missingRows > 0).map(item => `${item.metric}: ${item.missingRows} of ${item.rows} rows`).join('; ')}. Their derived ratios are withheld.</div>}
            {summary && (
              <section className="cx-command-metrics cx-media-metrics" aria-label="Media performance summary">
                <MediaMetricCard label="Recorded media spend" value={money(summary.spend)} note="Approved API-table spend" delta={data.comparison?.spendDeltaPct} metric="spend" canCompare={canCompare} onInspect={() => setAudit(campaignAudit(data, summary, 'spend', auditScope))} onInvestigate={metric => setRootMetric(metric)} />
                <MediaMetricCard label="Platform CPL" value={money(summary.cpl)} note="Spend / platform lead events" delta={data.comparison?.cplDeltaPct} metric="cpl" canCompare={canCompare} onInspect={() => setAudit(campaignAudit(data, summary, 'cpl', auditScope))} onInvestigate={metric => setRootMetric(metric)} />
                <MediaMetricCard label="CPC" value={money(summary.cpc)} note="Spend / clicks" delta={data.comparison?.cpcDeltaPct} metric="cpc" canCompare={canCompare} onInspect={() => setAudit(campaignAudit(data, summary, 'cpc', auditScope))} onInvestigate={metric => setRootMetric(metric)} />
                <MediaMetricCard label="CPM" value={money(summary.cpm)} note="Spend / 1,000 impressions" delta={data.comparison?.cpmDeltaPct} metric="cpm" canCompare={canCompare} onInspect={() => setAudit(campaignAudit(data, summary, 'cpm', auditScope))} onInvestigate={metric => setRootMetric(metric)} />
                <MediaMetricCard label="Platform lead events" value={num(summary.leads)} note={`${formatPercent(summary.ctr)} CTR · ${num(summary.clicks)} clicks`} delta={data.comparison?.leadsDeltaPct} metric="leads" canCompare={canCompare} onInspect={() => setAudit(campaignAudit(data, summary, 'leads', auditScope))} onInvestigate={metric => setRootMetric(metric)} />
              </section>
            )}

            <AcquisitionFlow data={data} />

            <AuditMetadata grain={data.grainDiagnostics?.fields?.join(" × ")} dateBasis="Marketing reporting date" validationStatus={suppliedProvenance(data).validationStatus} />
            <details className="cx-evidence-disclosure"><summary>View reach and engagement evidence</summary>
            {summary && (
              <section className="cx-command-panel">
                <header>
                  <div>
                    <span className="cx-command-section-kicker">Acquisition engagement</span>
                    <h2>Reach, outbound traffic & lead capture</h2>
                    <p>Platform lead events come from the marketing platform. Platform CPL divides incurred media spend by these events. Ledger CPL requires a matched population of distinct captured leads and is unavailable without validated attribution.</p>
                  </div>
                </header>
                <div className="cx-commercial-ratios">
                  <div>
                    <span>Reported reach sum</span>
                    <strong>{summary.reach == null ? '—' : num(summary.reach)}</strong>
                    <div className="flex items-center justify-between gap-1 mt-1">
                      <small>{data.reachDefinition || 'Reported reach'}</small>
                    </div>
                  </div>
                  <div>
                    <span>Frequency</span>
                    <strong>{summary.frequency == null ? '—' : summary.frequency.toFixed(2)}</strong>
                    <div className="flex items-center justify-between gap-1 mt-1">
                      <small>Impressions / reach</small>
                    </div>
                  </div>
                  <div>
                    <span>Outbound clicks</span>
                    <strong>{summary.outboundClicks == null ? '—' : num(summary.outboundClicks)}</strong>
                    <div className="flex items-center justify-between gap-1 mt-1">
                      <small>Clicks leaving platform</small>
                    </div>
                  </div>
                  <div>
                    <span>Outbound CTR</span>
                    <strong>{summary.outboundCtr == null ? '—' : `${summary.outboundCtr.toFixed(2)}%`}</strong>
                    <div className="flex items-center justify-between gap-1 mt-1">
                      <small>Outbound / impressions</small>
                    </div>
                  </div>
                  <div>
                    <span>Click → lead</span>
                    <strong>{summary.clickToLeadRate == null ? '—' : `${summary.clickToLeadRate.toFixed(2)}%`}</strong>
                    <div className="flex items-center justify-between gap-1 mt-1">
                      <small>Events / clicks</small>
                    </div>
                  </div>
                </div>
              </section>
            )}

            </details>
            {data.campaigns.length > 0 && <>
              <section className="cx-command-panel cx-campaign-comparison" id="campaign-comparison" aria-label="Campaign comparison">
                <div className="cx-viz-toolbar">
                  <div>
                    <span className="cx-command-section-kicker">Compare campaigns</span>
                    <h2>Campaign performance comparison</h2>
                    <p>Rank the returned campaign/adset groups by one existing platform measure. Budget remains excluded from performance comparisons.</p>
                  </div>
                  <div className="cx-segmented-control" role="group" aria-label="Campaign comparison metric">
                    <button type="button" aria-pressed={campaignMeasure === 'leads'} data-active={campaignMeasure === 'leads'} onClick={() => setCampaignMeasure('leads')}>Lead events</button>
                    <button type="button" aria-pressed={campaignMeasure === 'spend'} data-active={campaignMeasure === 'spend'} onClick={() => setCampaignMeasure('spend')}>Spend</button>
                    <button type="button" aria-pressed={campaignMeasure === 'ctr'} data-active={campaignMeasure === 'ctr'} onClick={() => setCampaignMeasure('ctr')}>CTR</button>
                    <button type="button" aria-pressed={campaignMeasure === 'cpl'} data-active={campaignMeasure === 'cpl'} onClick={() => setCampaignMeasure('cpl')}>CPL</button>
                  </div>
                </div>
                <EvidenceBars
                  title={campaignMeasure === 'leads' ? 'Platform lead events' : campaignMeasure === 'spend' ? 'Recorded media spend' : campaignMeasure === 'ctr' ? 'CTR' : 'Platform CPL'}
                  description="Top 12 returned campaign/adset groups for the selected measure. Select a row to inspect its exact reported measure."
                  items={campaignComparison}
                  maximum={campaignMeasure === 'ctr' ? 100 : undefined}
                  scaleNote={campaignMeasure === 'ctr' ? 'CTR uses a fixed 0–100% scale. Missing values remain unavailable.' : 'Bars share the largest returned value in this view as their scale.'}
                  onSelect={key => {
                    const item = campaignComparison.find(row => row.key === key);
                    if (item) setAudit(campaignAudit(data, item.sourceRow, campaignMeasure, auditScope));
                  }}
                />
              </section>

              <details className="cx-evidence-disclosure"><summary>View volume, response and planning detail</summary><div className="cx-analytics-visual-grid">
              <VolumeRateComboChart
                title="Campaign lead volume and response rate"
                subtitle="Platform lead events by campaign/adset with CTR and click → lead overlaid. Select a bar to filter to that campaign."
                data={data.campaigns.slice(0, 12).map(row => ({
                  label: row.adset && row.adset !== row.campaign ? `${row.campaign} · ${row.adset}` : row.campaign,
                  campaign: row.campaign,
                  adset: row.adset,
                  leads: row.leads,
                  ctr: row.ctr,
                  clickToLeadRate: row.clickToLeadRate,
                }))}
                xKey="label"
                volumeKey="leads"
                volumeLabel="Platform lead events"
                rateSeries={[
                  { key: 'ctr', label: 'CTR' },
                  { key: 'clickToLeadRate', label: 'Click → lead' },
                ]}
                onSelect={(_, row) => {
                  if (row.campaign) setFilter('campaign', { operator: 'in', values: [String(row.campaign)] });
                }}
              />
              <RankedMetricChart
                title="Planning budget by campaign"
                subtitle="Planning budget only — not observed media spend."
                data={data.campaigns.filter(row => row.latestBudget != null).map(row => ({
                  label: row.adset && row.adset !== row.campaign ? `${row.campaign} · ${row.adset}` : row.campaign,
                  campaign: row.campaign,
                  budget: row.latestBudget,
                }))}
                categoryKey="label"
                valueKey="budget"
                valueLabel="Latest budget"
                valuePrefix="R "
                maxItems={12}
                onSelect={(_, row) => {
                  if (row.campaign) setFilter('campaign', { operator: 'in', values: [String(row.campaign)] });
                }}
              />
            </div></details></>}

            {data.comparison ? (
              <p className="cx-media-comparison-note">
                Spend change: {money(data.comparison.spendDelta ?? null)} · Platform leads change: {data.comparison.leadsDelta == null ? '—' : num(data.comparison.leadsDelta)}. Compared with {data.comparison.previousStartDate} → {data.comparison.previousEndDate}. {data.comparison.ctrDeltaPp == null ? 'CTR comparison unavailable.' : `CTR changed ${data.comparison.ctrDeltaPp > 0 ? '+' : ''}${data.comparison.ctrDeltaPp}pp.`}
              </p>
            ) : null}
            {data.comparisonReason && <div className="cx-control-note" role="note">{data.comparisonReason}</div>}

            <details className="cx-evidence-disclosure"><summary>View exact campaign evidence</summary><section className="cx-command-panel" id="campaigns-table">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Campaign detail</span>
                  <h2>Spend & delivery efficiency</h2>
                  <p>Budget remains a separate planning field and is never substituted for observed spend.</p>
                </div>
              </header>
              <ExportAnalysisButton filename="campaign-performance.csv" validationStatus={data.reconciliation?.status || data.status || 'NOT_VERIFIED'} dateBasis="marketing_reporting_date"
                definitions="Observed spend from the approved field at unique contracted grain. Platform leads are distinct from warehouse fetched leads. Reach is a sum of reported row-level reach, not deduplicated period audience."
                truncated={data.detailScope?.truncated} rows={[
                  ['Client', 'Channel', 'Campaign', 'Adset', 'Spend', 'Latest budget (planning only)', 'Impressions', 'Reported reach sum', 'Clicks', 'Outbound clicks', 'Platform leads', 'CTR %', 'Outbound CTR %', 'CPC', 'CPM', 'Platform CPL'],
                  ...data.campaigns.map(row => [row.client, row.channel, row.campaign, row.adset, row.spend, row.latestBudget, row.impressions, row.reach, row.clicks, row.outboundClicks, row.leads, row.ctr, row.outboundCtr, row.cpc, row.cpm, row.cpl]),
                ]} />
              {data.funnelStatus && <p className="cx-control-note">Warehouse funnel: {data.funnelStatus.status}. {data.funnelStatus.reason}</p>}
              {data.detailScope?.truncated && (
                <div className="cx-control-note" role="status">
                  Showing {num(data.detailScope.displayedCampaignGroups)} of {num(data.detailScope.totalCampaignGroups)} campaign/adset groups, ranked by platform lead events. Summary metrics cover the full selected scope.
                </div>
              )}
              <TablePreview rows={data.campaigns} label="campaign rows">{visibleRows => <div className="cx-performance-table-wrap" role="region" aria-label="Campaign spend and delivery efficiency" tabIndex={0}>
                <table className="cx-performance-table cx-campaign-table">
                  <thead>
                    <tr>
                      <th>Channel</th>
                      <th>Campaign</th>
                      <th>Adset</th>
                      <th>Spend</th>
                      <th>Latest budget</th>
                      <th>Impressions</th>
                      <th>Reported reach sum</th>
                      <th>Frequency</th>
                      <th>Clicks</th>
                      <th>Outbound clicks</th>
                      <th>CTR</th>
                      <th>Outbound CTR</th>
                      <th>Click → lead</th>
                      <th>Platform lead events</th>
                      <th>CPC</th>
                      <th>CPM</th>
                      <th>Platform CPL</th><th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((campaign, index) => (
                      <tr key={`${campaign.channel}-${campaign.campaign}-${campaign.adset}-${index}`}>
                        <th>{campaign.channel}</th>
                        <td>{campaign.campaign}</td>
                        <td>{campaign.adset}</td>
                        <td>{money(campaign.spend)}</td>
                        <td>{money(campaign.latestBudget)}</td>
                        <td>{num(campaign.impressions)}</td>
                        <td>{campaign.reach == null ? '—' : num(campaign.reach)}</td>
                        <td>{campaign.frequency == null ? '—' : campaign.frequency.toFixed(2)}</td>
                        <td>{num(campaign.clicks)}</td>
                        <td>{campaign.outboundClicks == null ? '—' : num(campaign.outboundClicks)}</td>
                        <td>{formatPercent(campaign.ctr)}</td>
                        <td>{campaign.outboundCtr == null ? '—' : `${campaign.outboundCtr}%`}</td>
                        <td title={`Platform lead events / ${campaign.outboundClicks != null && campaign.outboundClicks > 0 ? 'outbound clicks' : 'clicks'}`}>{campaign.clickToLeadRate == null ? '—' : `${campaign.clickToLeadRate}%`}</td>
                        <td>{num(campaign.leads)}</td>
                        <td>{money(campaign.cpc)}</td>
                        <td>{money(campaign.cpm)}</td>
                        <td>{money(campaign.cpl)}</td>
                        <td><button type="button" className="cx-button-secondary" onClick={() => setAudit(campaignAudit(data, campaign, campaignMeasure, auditScope))} aria-label={`Inspect evidence for ${campaign.campaign}`}>Inspect</button></td>
                      </tr>
                    ))}
                    {!data.campaigns.length && (
                      <tr><td colSpan={18}><div className="cx-command-empty">No campaign rows are available for this approved tenant scope.</div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>}</TablePreview>
            </section></details>
            <details className="cx-evidence-disclosure"><summary>View source contracts and reconciliation</summary>
            <section className="cx-command-panel cx-spend-status" id="campaign-evidence">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Data contract</span>
                  <h2>Financial measurement: {data.status || 'PARTIAL'}</h2>
                  <p>{data.reason}</p>
                </div>
                <ShieldCheck size={17} className="text-slate-400"/>
              </header>
              <div className="cx-spend-source">
                <div><span>Spend field</span><strong>{data.spendSource?.column || 'Unavailable'}</strong></div>
                <div><span>Tenant mapping</span><strong>{data.mappingStatus || 'Unavailable'}</strong><small>{data.attribution?.status || 'UNCONFIGURED'} attribution</small></div>
                <div><span>Spend grain</span><strong>{data.grainStatus || 'Unavailable'}</strong><small>{data.grainDiagnostics?.duplicateGrainRows ? `${data.grainDiagnostics.duplicateGrainRows.toLocaleString()} duplicate grain rows` : 'Contracted API-table grain'}</small></div>
              </div>
            </section>

            <SpendReconciliationPanel reconciliation={data.reconciliation} grain={data.grainDiagnostics} />

            {isAdmin && discovery && (
              <section className="cx-command-panel">
                <header>
                  <div>
                    <span className="cx-command-section-kicker">Admin contract discovery</span>
                    <h2>Marketing API-table mapping</h2>
                    <p>{discovery.reason}</p>
                  </div>
                </header>
                <div className="cx-marketing-discovery">
                  <div className="cx-marketing-contract-grid">
                    <div><span>Table</span><strong>{discovery.contract?.table || 'Unavailable'}</strong></div>
                    <div><span>Resolved spend field</span><strong>{discovery.contract?.resolvedSpendField || 'Unavailable'}</strong></div>
                    <div><span>Configured client_name</span><strong>{discovery.contract?.configuredClientNames?.join(', ') || 'Not mapped'}</strong></div>
                  </div>
                  {discovery.availableClientNames.length > 0 && (
                    <>
                      <h3>Observed client_name values</h3>
                      <div className="cx-marketing-clientnames">
                        {discovery.availableClientNames.map(item => (
                          <div key={item.value}>
                            <strong>{item.value}</strong>
                            <span>{item.rows.toLocaleString()} rows</span>
                            <small>{item.earliestDate || '—'} → {item.latestDate || '—'}</small>
                          </div>
                        ))}
                      </div>
                      <p className="cx-contract-note">
                        Approve exact values in <code>CX_MARKETING_CLIENT_MAP_JSON</code>. CX3 does not infer tenant identity from display names.
                      </p>
                    </>
                  )}
                </div>
              </section>
            )}

            </details>
          </>
        )}

      <InspectorHost open={Boolean(audit)} onClose={() => setAudit(null)} content={audit} />
      <MarketingRootCauseDrawer open={rootMetric !== null} metric={rootMetric} onClose={() => setRootMetric(null)} />
    </AnalyticsPageLayout>
  );
}
