import ExportAnalysisButton from '../components/ExportAnalysisButton';
import { useOperationalData } from '../lib/useOperationalData';
import React from 'react';
import { AlertTriangle, PhoneCall, ShieldCheck } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchContactStrategy, type ContactStrategyData } from '../lib/offernetClient';
import { formatPercent, formatTableNumber } from '../lib/formatters';

export default function ContactStrategyIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();

  const { data, loading, error, loadData } = useOperationalData<Omit<ContactStrategyData, 'summary' | 'attemptPerformance'> & { attemptPerformance: Array<ContactStrategyData['attemptPerformance'][number] & { noRpc?: number; rpcUnrecorded?: number }>; summary?: ContactStrategyData['summary'] & { oneCallNoRpcLeads?: number; zeroCallNoRpcLeads?: number }; effortEvidence?: { reason: string } }>('ContactStrategyIntelligence', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, fetchContactStrategy);

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
              <article className="cx-command-metric"><span>Zero-call leads</span><strong>{formatTableNumber(data.summary.zeroCallLeads)}</strong><div><small>Explicitly recorded zero calls</small></div></article>
              <article className="cx-command-metric"><span>One-call share</span><strong>{formatPercent(data.summary.singleAttemptSharePct)}</strong><div><small>{formatTableNumber(data.summary.oneCallLeads)} leads · share of dialled leads</small></div></article>
              <article className="cx-command-metric"><span>Multi-call share</span><strong>{formatPercent(data.summary.multiAttemptSharePct)}</strong><div><small>{formatTableNumber(data.summary.multiAttemptLeads)} leads · share of dialled leads</small></div></article>
              <article className="cx-command-metric"><span>5+ calls, no RPC</span><strong>{formatTableNumber(data.summary.fivePlusNoRpcLeads)}</strong><div><small>High effort without contact</small></div></article>
            </section>
          )}
          {data.summary && data.summary.unrecordedCallLeads > 0 && <div className="cx-control-note">{formatTableNumber(data.summary.unrecordedCallLeads)} leads have unrecorded call counts and are shown separately from zero-call leads.</div>}
          {data.summary && <p className="cx-control-note">One-call leakage: {formatTableNumber(data.summary.oneCallNoRpcLeads)} leads with explicit no RPC after one recorded call. Zero-call leakage: {formatTableNumber(data.summary.zeroCallNoRpcLeads)} leads with explicit no RPC and zero recorded calls.</p>}
          <ExportAnalysisButton filename="contact_attempt_outcomes" rows={[["Bucket","Leads","Share %","RPC","RPC / dialled %","Sales","Sale / lead %","Activations","Activation / sale %"], ...data.attemptPerformance.map(r => [r.bucket,r.leads,r.sharePct,r.contacted,r.contactRate,r.sales,r.saleRate,r.activations,r.activationRate])]} definitions={[data.methodology || 'Exclusive observed call-count buckets']} />
          {data.effortEvidence && <p className="cx-control-note">{data.effortEvidence.reason}</p>}
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
                <thead><tr><th>Call-count bucket</th><th>Leads</th><th>Share</th><th>RPC</th><th>RPC rate</th><th>Sales</th><th>Sale rate</th><th>Activations</th><th>Activation / sale</th><th>Explicit no RPC</th><th>RPC unrecorded</th></tr></thead>
                <tbody>{(data.attemptPerformance || []).map(row=><tr key={row.bucket}><th>{row.bucket}</th><td>{formatTableNumber(row.leads)}</td><td>{formatPercent(row.sharePct)}</td><td>{formatTableNumber(row.contacted)}</td><td>{formatPercent(row.contactRate)}</td><td>{formatTableNumber(row.sales)}</td><td>{formatPercent(row.saleRate, 2)}</td><td>{formatTableNumber(row.activations)}</td><td>{formatPercent(row.activationRate)}</td><td>{formatTableNumber(row.noRpc)}</td><td>{formatTableNumber(row.rpcUnrecorded)}</td></tr>)}</tbody>
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
