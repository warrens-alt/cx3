import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Search, ShieldCheck } from 'lucide-react';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import MarketingRootCauseDrawer from '../components/MarketingRootCauseDrawer';
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

const money = (value: number | null) => value == null ? '—' : `R ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const num = (value: number) => value.toLocaleString();
type MediaMetric = NonNullable<MarketingRootCauseData['metric']>['id'];

function Delta({ value, unit = '%' }: { value: number | null | undefined; unit?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className="cx-command-change muted">No comparison</span>;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`cx-command-change ${value > 0 ? 'positive' : value < 0 ? 'negative' : 'muted'}`}><Icon size={12}/>{value > 0 ? '+' : ''}{value}{unit}</span>;
}

function MediaMetricCard({
  label,
  value,
  note,
  delta,
  metric,
  onInvestigate,
}: {
  label: string;
  value: string;
  note: string;
  delta?: number | null;
  metric: MediaMetric;
  onInvestigate: (metric: MediaMetric) => void;
}) {
  return (
    <article className="cx-command-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <div><small>{note}</small><Delta value={delta}/></div>
      <button type="button" className="cx-command-why" onClick={() => onInvestigate(metric)}>
        Why changed? <Search size={11}/>
      </button>
    </article>
  );
}

export default function CampaignIntelligence() {
  const { selectedClient } = useClient();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<CampaignData | null>(null);
  const [discovery, setDiscovery] = useState<MarketingDiscoveryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rootMetric, setRootMetric] = useState<MediaMetric | null>(null);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCampaigns({
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...extractOffernetFilters(filters),
      }, forceRefresh);
      setData(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load campaign evidence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient) loadData();
  }, [selectedClient, startDate, endDate, filters]);

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

  const summary = data?.summary;
  const canCompare = Boolean(startDate && endDate && data?.comparison);

  return (
    <div className="cx-command-page">
      <OffernetFilterBar
        onRefresh={() => loadData(true)}
        showVendorFilter={false}
        showSourceFilter={false}
        showGradeFilter={false}
      />

      <div className="cx-command-content">
        <header className="cx-command-hero">
          <div>
            <span className="cx-command-eyebrow">Media performance</span>
            <h1>Campaigns & spend</h1>
            <p>Observed platform delivery and spend from the approved marketing API-table contract for the selected tenant.</p>
          </div>
        </header>

        {error && <div className="cx-command-error"><AlertTriangle size={17}/>{error}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner"/>Loading media performance…</div>}

        {data && (
          <>
            <section className="cx-command-panel cx-spend-status">
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

            {summary && (
              <section className="cx-command-metrics cx-media-metrics" aria-label="Media performance summary">
                <MediaMetricCard label="Recorded media spend" value={money(summary.spend)} note="Approved API-table spend" delta={data.comparison?.spendDeltaPct} metric="spend" onInvestigate={metric => canCompare && setRootMetric(metric)} />
                <MediaMetricCard label="Platform CPL" value={money(summary.cpl)} note="Spend / recorded leads" delta={data.comparison?.cplDeltaPct} metric="cpl" onInvestigate={metric => canCompare && setRootMetric(metric)} />
                <MediaMetricCard label="CPC" value={money(summary.cpc)} note="Spend / clicks" delta={data.comparison?.cpcDeltaPct} metric="cpc" onInvestigate={metric => canCompare && setRootMetric(metric)} />
                <MediaMetricCard label="CPM" value={money(summary.cpm)} note="Spend / 1,000 impressions" delta={data.comparison?.cpmDeltaPct} metric="cpm" onInvestigate={metric => canCompare && setRootMetric(metric)} />
                <MediaMetricCard label="Recorded leads" value={num(summary.leads)} note={`${summary.ctr}% CTR · ${num(summary.clicks)} clicks`} delta={data.comparison?.leadsDeltaPct} metric="leads" onInvestigate={metric => canCompare && setRootMetric(metric)} />
              </section>
            )}

            {data.comparison ? (
              <p className="cx-media-comparison-note">
                Compared with {data.comparison.previousStartDate} → {data.comparison.previousEndDate}. CTR changed {data.comparison.ctrDeltaPp > 0 ? '+' : ''}{data.comparison.ctrDeltaPp}pp.
              </p>
            ) : data.comparisonReason ? (
              <div className="cx-command-error"><AlertTriangle size={15}/>{data.comparisonReason}</div>
            ) : null}

            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Campaign detail</span>
                  <h2>Spend & delivery efficiency</h2>
                  <p>Budget remains a separate planning field and is never substituted for observed spend.</p>
                </div>
              </header>
              <div className="cx-performance-table-wrap">
                <table className="cx-performance-table cx-campaign-table">
                  <thead>
                    <tr>
                      <th>Channel</th>
                      <th>Campaign</th>
                      <th>Adset</th>
                      <th>Spend</th>
                      <th>Latest budget</th>
                      <th>Impressions</th>
                      <th>Clicks</th>
                      <th>CTR</th>
                      <th>Leads</th>
                      <th>CPC</th>
                      <th>CPM</th>
                      <th>CPL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((campaign, index) => (
                      <tr key={`${campaign.channel}-${campaign.campaign}-${campaign.adset}-${index}`}>
                        <th>{campaign.channel}</th>
                        <td>{campaign.campaign}</td>
                        <td>{campaign.adset}</td>
                        <td>{money(campaign.spend)}</td>
                        <td>{money(campaign.latestBudget)}</td>
                        <td>{num(campaign.impressions)}</td>
                        <td>{num(campaign.clicks)}</td>
                        <td>{campaign.ctr}%</td>
                        <td>{num(campaign.leads)}</td>
                        <td>{money(campaign.cpc)}</td>
                        <td>{money(campaign.cpm)}</td>
                        <td>{money(campaign.cpl)}</td>
                      </tr>
                    ))}
                    {!data.campaigns.length && (
                      <tr><td colSpan={12}><div className="cx-command-empty">No campaign rows are available for this approved tenant scope.</div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      <MarketingRootCauseDrawer open={rootMetric !== null} metric={rootMetric} onClose={() => setRootMetric(null)} />
    </div>
  );
}
