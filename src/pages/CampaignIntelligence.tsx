import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Megaphone, ShieldCheck } from 'lucide-react';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchCampaigns, type CampaignData } from '../lib/offernetClient';

const money = (value: number | null) => value == null ? '—' : `R ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const num = (value: number) => value.toLocaleString();

function Delta({ value, unit = '%' }: { value: number | null | undefined; unit?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className="cx-command-change muted">No comparison</span>;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`cx-command-change ${value > 0 ? 'positive' : value < 0 ? 'negative' : 'muted'}`}><Icon size={12}/>{value > 0 ? '+' : ''}{value}{unit}</span>;
}

export default function CampaignIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<CampaignData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCampaigns({
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        campaign: extractOffernetFilters(filters).campaign,
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

  const summary = data?.summary;

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
            <p>Observed platform delivery and incurred media spend when the marketing source exposes a recognised spend/cost field.</p>
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
                <div><span>Marketing table</span><strong>{data.spendSource?.table || 'Unavailable'}</strong></div>
                <div><span>Budget field</span><strong>{data.budgetSource?.column || 'Unavailable'}</strong><small>Planning field only</small></div>
              </div>
            </section>

            {summary && (
              <section className="cx-command-metrics cx-media-metrics" aria-label="Media performance summary">
                <article className="cx-command-metric">
                  <span>Recorded media spend</span>
                  <strong>{money(summary.spend)}</strong>
                  <div><small>Actual source field only</small><Delta value={data.comparison?.spendDeltaPct}/></div>
                </article>
                <article className="cx-command-metric">
                  <span>Platform CPL</span>
                  <strong>{money(summary.cpl)}</strong>
                  <div><small>Spend / recorded leads</small><Delta value={data.comparison?.cplDeltaPct}/></div>
                </article>
                <article className="cx-command-metric">
                  <span>CPC</span>
                  <strong>{money(summary.cpc)}</strong>
                  <div><small>Spend / clicks</small><Delta value={data.comparison?.cpcDeltaPct}/></div>
                </article>
                <article className="cx-command-metric">
                  <span>CPM</span>
                  <strong>{money(summary.cpm)}</strong>
                  <div><small>Spend / 1,000 impressions</small><Delta value={data.comparison?.cpmDeltaPct}/></div>
                </article>
                <article className="cx-command-metric">
                  <span>Recorded leads</span>
                  <strong>{num(summary.leads)}</strong>
                  <div><small>{summary.ctr}% CTR · {num(summary.clicks)} clicks</small><Delta value={data.comparison?.leadsDeltaPct}/></div>
                </article>
              </section>
            )}

            {data.comparison && (
              <p className="cx-media-comparison-note">
                Compared with {data.comparison.previousStartDate} → {data.comparison.previousEndDate}. CTR changed {data.comparison.ctrDeltaPp > 0 ? '+' : ''}{data.comparison.ctrDeltaPp}pp.
              </p>
            )}

            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Campaign detail</span>
                  <h2>Spend & delivery efficiency</h2>
                  <p>Budget is shown separately as the latest recorded planning value and is never substituted for spend.</p>
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
                      <tr><td colSpan={12}><div className="cx-command-empty">No campaign rows are available for the selected approved scope.</div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
