import { useOperationalData } from '../lib/useOperationalData';
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Download, Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchAgentPerformance, type AgentPerformanceData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import OperationalPageHeader from '../components/OperationalPageHeader';
import { VolumeRateComboChart } from '../components/charts/OperationalVisuals';
import { downloadCsv, formatPercent, formatRatioPercent, formatTableNumber } from '../lib/formatters';
import { downloadAnalysisCsv } from '../lib/analysisExport';
import { sumRecordedValues } from '../lib/metricPresentation';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';

type AgentActivityData = AgentPerformanceData & {
  breakdowns?: { day: Array<AgentPerformanceData['agents'][number] & { bucket: string }>; hour: Array<AgentPerformanceData['agents'][number] & { bucket: string }> };
  scope?: { timezone: string; truncated: boolean; campaignReason: string };
};

export default function AgentPerformanceIntelligence() {
  const scoped = useScopedNavigationTarget();
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [search, setSearch] = useState('');

  const { data, loading, error, loadData } = useOperationalData<AgentActivityData>('AgentPerformanceIntelligence', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, fetchAgentPerformance);

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ['Agent', 'Vendor', 'Calls', 'Unique leads', 'RPC', 'RPC rate', 'Sale calls', 'Sold RPC / RPC (%)', 'Recorded call duration', 'Avg call duration', 'Callbacks'],
      ...data.agents.map(row => [
        row.agentId, row.vendor, row.totalCalls, row.uniqueLeads, row.contactCount, row.contactRate,
        row.salesCount, row.saleRate, row.totalTalkTime, row.avgHandleTime, row.callbacksBooked,
      ]),
    ];
    downloadAnalysisCsv(`agent_activity_${selectedClient}_${startDate || 'all'}_${endDate || 'all'}`, rows, { clientId: selectedClient, startDate, endDate, filters, dateBasis: 'call_start_date', definitions: data.metricAvailabilityReason, truncated: data.scope?.truncated });
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data?.agents || [];
    return (data?.agents || []).filter(row =>
      row.agentId.toLowerCase().includes(query) || row.vendor.toLowerCase().includes(query)
    );
  }, [data?.agents, search]);

  const totals = useMemo(() => {
    const agents = data?.agents || [];
    return {
      agents: agents.length,
      calls: sumRecordedValues(agents.map(row => row.totalCalls)),
      contacts: sumRecordedValues(agents.map(row => row.contactCount)),
      sales: sumRecordedValues(agents.map(row => row.salesCount)),
      rpcSales: sumRecordedValues(agents.map(row => row.rpcSalesCount)),
    };
  }, [data?.agents]);

  return (
    <div className="cx-command-page">
      <OffernetFilterBar
        onRefresh={() => loadData(true)}
        onExportCsv={handleExportCsv}
        showSourceFilter={false}
        showGradeFilter={false}
      />
      <div className="cx-command-content">
        <OperationalPageHeader
          eyebrow="Contact"
          title="Agent activity"
          description="Observed dialler calls and call outcomes by agent. CX3 does not assign performance scores or tiers."
          status={data?.rankingStatus || 'NOT_VERIFIED'}
          statusLabel="Ranking status"
        />

        {error && <div className="cx-command-error"><AlertTriangle size={17}/>{error}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner"/>Aggregating agent call activity…</div>}

        {data && (
          <>
            <section className="cx-command-metrics cx-agent-metrics">
              <article className="cx-command-metric"><span>Agents observed</span><strong>{totals.agents.toLocaleString()}</strong><div><small>Distinct agent/vendor rows</small></div></article>
              <article className="cx-command-metric"><span>Total calls</span><strong>{formatTableNumber(totals.calls)}</strong><div><small>Recorded calls in the displayed roster</small></div></article>
              <article className="cx-command-metric"><span>RPC</span><strong>{formatTableNumber(totals.contacts)}</strong><div><small>{formatRatioPercent(totals.contacts, totals.calls)} of calls</small></div></article>
              <article className="cx-command-metric"><span>Sales</span><strong>{formatTableNumber(totals.sales)}</strong><div><small>{formatRatioPercent(totals.rpcSales, totals.contacts)} of RPC calls sold</small></div></article>
            </section>

            <VolumeRateComboChart
              title="Agent call volume and RPC rate"
              subtitle="Top observed agent/vendor groups by call volume. This is descriptive and does not assign performance scores."
              data={[...filtered].sort((a, b) => b.totalCalls - a.totalCalls).slice(0, 12).map(row => ({
                label: row.vendor ? `${row.agentId} · ${row.vendor}` : row.agentId,
                calls: row.totalCalls,
                contactRate: row.contactRate,
              }))}
              xKey="label"
              volumeKey="calls"
              volumeLabel="Calls"
              rateSeries={[{ key: 'contactRate', label: 'RPC / calls' }]}
            />

            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Roster</span>
                  <h2>Agent activity & outcomes</h2>
                  <p>Summary totals cover the displayed roster: up to 100 agent/vendor groups with the most calls in the selected scope. {data.scope?.truncated ? 'Some groups are omitted by the display limit.' : ''}</p>
                  <p>{data.rankingReason} A dash marks unavailable call evidence; recorded zeros remain zero. {data.metricAvailabilityReason}</p>
                </div>
                <Users size={16} className="text-slate-400"/>
              </header>

              <div className="cx-table-toolbar">
                <label>
                  <Search size={14}/>
                  <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search agent or vendor…" />
                </label>
                <span>{filtered.length.toLocaleString()} rows</span>
              </div>

              <div className="cx-performance-table-wrap" role="region" aria-label="Agent activity and outcomes" tabIndex={0}>
                <table className="cx-performance-table cx-agent-table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Vendor</th>
                      <th>Calls</th>
                      <th>Unique leads</th>
                      <th>RPC calls</th>
                      <th>RPC / calls</th>
                      <th>Sale calls</th>
                      <th>Sold RPC / RPC</th>
                      <th>Recorded call duration</th>
                      <th>Avg call duration</th>
                      <th>Callbacks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, index) => (
                      <tr key={`${row.agentId}-${row.vendor}-${index}`}>
                        <th>{row.agentId}</th>
                        <td>{row.vendor}</td>
                        <td>{formatTableNumber(row.totalCalls)}</td>
                        <td>{formatTableNumber(row.uniqueLeads)}</td>
                        <td title={row.fieldCoverage ? `${formatTableNumber(row.fieldCoverage.rpc.observedCalls)} of ${formatTableNumber(row.fieldCoverage.rpc.totalCalls)} calls have recorded RPC flags` : undefined}>{formatTableNumber(row.contactCount)}</td>
                        <td>{formatPercent(row.contactRate)}</td>
                        <td>{formatTableNumber(row.salesCount)}</td>
                        <td title="Call rows marked both RPC and sale / recorded RPC calls">{formatPercent(row.saleRate, 2)}</td>
                        <td>{row.totalTalkTime || 'Unavailable'}</td>
                        <td>{row.avgHandleTime || 'Unavailable'}</td>
                        <td>{formatTableNumber(row.callbacksBooked)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {data.breakdowns && (['day', 'hour'] as const).map(dimension => <section className="cx-command-panel" key={dimension}>
              <header><div><h2>Agent activity by {dimension}</h2><p>Call-start {dimension}, {data.scope?.timezone}. Up to 100 groups per dimension; each table is an alternative view of the same calls. Recorded call duration does not include an approved after-call-work duration.</p></div></header>
              <div className="cx-performance-table-wrap" role="region" aria-label={`Agent activity by ${dimension}`} tabIndex={0}>
                <table className="cx-performance-table"><thead><tr><th>{dimension}</th><th>Agent</th><th>Vendor</th><th>Calls</th><th>Unique leads</th><th>RPC / call</th><th>Sale / RPC</th><th>Avg call duration</th></tr></thead><tbody>
                  {data.breakdowns![dimension].map((row, index) => <tr key={`${row.bucket}-${row.agentId}-${row.vendor}-${index}`}><th>{row.bucket ?? 'Unavailable'}</th><td>{row.agentId}</td><td>{row.vendor}</td><td>{formatTableNumber(row.totalCalls)}</td><td>{formatTableNumber(row.uniqueLeads)}</td><td>{formatPercent(row.contactRate)}</td><td>{formatPercent(row.saleRate)}</td><td>{row.avgHandleTime ?? 'Unavailable'}</td></tr>)}
                  {!data.breakdowns![dimension].length && <tr><td colSpan={8}>No call groups in this scope.</td></tr>}
                </tbody></table>
              </div>
            </section>)}
            {data.scope?.campaignReason && <p className="text-xs text-slate-500">{data.scope.campaignReason}</p>}
            <section className="cx-command-shortcuts">
              <button type="button" onClick={handleExportCsv}><Download size={16}/><span><strong>Export agent activity</strong><small>Download the scoped roster</small></span></button>
              <Link to={scoped('/cli-performance')}><Users size={16}/><span><strong>CLI performance</strong><small>Inspect outbound caller-ID outcomes</small></span></Link>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
