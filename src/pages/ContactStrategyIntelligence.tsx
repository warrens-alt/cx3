import React, { useEffect, useState } from 'react';
import { AlertTriangle, PhoneCall, ShieldCheck } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchContactStrategy, type ContactStrategyData } from '../lib/offernetClient';

export default function ContactStrategyIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<ContactStrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchContactStrategy({
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...extractOffernetFilters(filters),
      }, forceRefresh));
    } catch (err: any) {
      setError(err?.message || 'Failed to load contact strategy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (selectedClient) loadData(); }, [selectedClient, startDate, endDate, filters]);

  return (
    <div className="cx-command-page">
      <OffernetFilterBar onRefresh={() => loadData(true)} />
      <div className="cx-command-content">
        <header className="cx-command-hero">
          <div>
            <span className="cx-command-eyebrow">Contact</span>
            <h1>Call-count outcomes</h1>
            <p>Observe how RPC, sales and activation outcomes differ by the total number of recorded calls on a lead.</p>
          </div>
        </header>
        {error && <div className="cx-command-error"><AlertTriangle size={17}/>{error}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner"/>Loading call outcomes…</div>}
        {data && <>
          {data.summary && (
            <section className="cx-command-metrics cx-contact-metrics" aria-label="Contact governance summary">
              <article className="cx-command-metric"><span>Zero-call leads</span><strong>{Number(data.summary.zeroCallLeads || 0).toLocaleString()}</strong><div><small>No recorded call count</small></div></article>
              <article className="cx-command-metric"><span>One-call share</span><strong>{data.summary.singleAttemptSharePct ?? 0}%</strong><div><small>{Number(data.summary.oneCallLeads || 0).toLocaleString()} leads</small></div></article>
              <article className="cx-command-metric"><span>Multi-call share</span><strong>{data.summary.multiAttemptSharePct ?? 0}%</strong><div><small>{Number(data.summary.multiAttemptLeads || 0).toLocaleString()} leads</small></div></article>
              <article className="cx-command-metric"><span>5+ calls, no RPC</span><strong>{Number(data.summary.fivePlusNoRpcLeads || 0).toLocaleString()}</strong><div><small>High effort without contact</small></div></article>
            </section>
          )}
          <section className="cx-command-panel">
            <header><div><span className="cx-command-section-kicker">Distribution</span><h2>Outcomes by total recorded calls</h2><p>This is descriptive, not a recommended stop-threshold model.</p></div></header>
            <div className="cx-command-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.attemptPerformance}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EDF3"/>
                  <XAxis dataKey="bucket" tick={{fontSize:10,fill:'#64748B'}}/>
                  <YAxis tick={{fontSize:10,fill:'#64748B'}}/>
                  <Tooltip contentStyle={{borderRadius:8,border:'1px solid #DDE4ED',fontSize:12}}/>
                  <Bar dataKey="leads" name="Leads" fill="#94A3B8"/>
                  <Bar dataKey="contacted" name="RPC" fill="#3562B3"/>
                  <Bar dataKey="sales" name="Sales" fill="#0F766E"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="cx-command-panel">
            <header><div><span className="cx-command-section-kicker">Observed rates</span><h2>Contact and sale yield</h2><p>Use these rates to investigate patterns before changing dial policy.</p></div></header>
            <div className="cx-performance-table-wrap">
              <table className="cx-performance-table">
                <thead><tr><th>Call-count bucket</th><th>Leads</th><th>Share</th><th>RPC</th><th>RPC rate</th><th>Sales</th><th>Sale rate</th><th>Activations</th></tr></thead>
                <tbody>{(data.attemptPerformance || []).map(row=><tr key={row.bucket}><th>{row.bucket}</th><td>{Number(row.leads || 0).toLocaleString()}</td><td>{row.sharePct}%</td><td>{Number(row.contacted || 0).toLocaleString()}</td><td>{row.contactRate}%</td><td>{Number(row.sales || 0).toLocaleString()}</td><td>{row.saleRate}%</td><td>{Number(row.activations || 0).toLocaleString()}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
          <section className="cx-command-panel">
            <header><div><span className="cx-command-section-kicker">Guardrail</span><h2>Recommendation status</h2></div></header>
            <div className="cx-command-empty"><ShieldCheck size={18}/><span>{data.noAnswerAnalysis.reason}{data.methodology ? ` ${data.methodology}` : ''}</span></div>
          </section>
        </>}
      </div>
    </div>
  );
}
