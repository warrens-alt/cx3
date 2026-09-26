import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchAgentPerformance, type AgentPerformanceData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import OperationalPageHeader from '../components/OperationalPageHeader';
import { downloadCsv } from '../lib/formatters';

export default function AgentPerformanceIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<AgentPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadData = async (forceRefresh = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      setData(await fetchAgentPerformance({
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...extractOffernetFilters(filters),
      }, forceRefresh));
    } catch (err: any) {
      setError(err?.message || 'Failed to load agent activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient) loadData();
  }, [selectedClient, startDate, endDate, filters]);

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ['Agent', 'Vendor', 'Calls', 'Unique leads', 'RPC', 'RPC rate', 'Sales', 'Sale / RPC', 'Talk time', 'Avg handle', 'Callbacks'],
      ...data.agents.map(row => [
        row.agentId, row.vendor, row.totalCalls, row.uniqueLeads, row.contactCount, row.contactRate,
        row.salesCount, row.saleRate, row.totalTalkTime, row.avgHandleTime, row.callbacksBooked,
      ]),
    ];
    downloadCsv(`agent_activity_${selectedClient}_${startDate || 'all'}_${endDate || 'all'}`, rows);
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
      calls: agents.reduce((sum, row) => sum + row.totalCalls, 0),
      contacts: agents.reduce((sum, row) => sum + row.contactCount, 0),
      sales: agents.reduce((sum, row) => sum + row.salesCount, 0),
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
          description="Observed dialler activity and outcomes by agent. CX3 does not assign performance scores or tiers."
          status={data?.rankingStatus || 'NOT_VERIFIED'}
          statusLabel="Ranking status"
        />

        {error && <div className="cx-command-error"><AlertTriangle size={17}/>{error}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner"/>Aggregating agent call activity…</div>}

        {data && (
          <>
            <section className="cx-command-metrics cx-agent-metrics">
              <article className="cx-command-metric"><span>Agents observed</span><strong>{totals.agents.toLocaleString()}</strong><div><small>Distinct agent/vendor rows</small></div></article>
              <article className="cx-command-metric"><span>Total calls</span><strong>{totals.calls.toLocaleString()}</strong><div><small>Recorded dialler attempts</small></div></article>
              <article className="cx-command-metric"><span>RPC</span><strong>{totals.contacts.toLocaleString()}</strong><div><small>{totals.calls > 0 ? ((totals.contacts / totals.calls) * 100).toFixed(1) : '0.0'}% of calls</small></div></article>
              <article className="cx-command-metric"><span>Sales</span><strong>{totals.sales.toLocaleString()}</strong><div><small>{totals.contacts > 0 ? ((totals.sales / totals.contacts) * 100).toFixed(1) : '0.0'}% of RPC</small></div></article>
            </section>

            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Roster</span>
                  <h2>Agent activity & outcomes</h2>
                  <p>{data.rankingReason}</p>
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

              <div className="cx-performance-table-wrap">
                <table className="cx-performance-table cx-agent-table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Vendor</th>
                      <th>Calls</th>
                      <th>Unique leads</th>
                      <th>RPC</th>
                      <th>RPC / calls</th>
                      <th>Sales</th>
                      <th>Sale / RPC</th>
                      <th>Talk time</th>
                      <th>Avg handle</th>
                      <th>Callbacks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, index) => (
                      <tr key={`${row.agentId}-${row.vendor}-${index}`}>
                        <th>{row.agentId}</th>
                        <td>{row.vendor}</td>
                        <td>{row.totalCalls.toLocaleString()}</td>
                        <td>{row.uniqueLeads.toLocaleString()}</td>
                        <td>{row.contactCount.toLocaleString()}</td>
                        <td>{row.contactRate}%</td>
                        <td>{row.salesCount.toLocaleString()}</td>
                        <td>{row.saleRate}%</td>
                        <td>{row.totalTalkTime}</td>
                        <td>{row.avgHandleTime}</td>
                        <td>{row.callbacksBooked.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="cx-command-shortcuts">
              <button type="button" onClick={handleExportCsv}><Download size={16}/><span><strong>Export agent activity</strong><small>Download the scoped roster</small></span></button>
              <Link to="/cli-performance"><Users size={16}/><span><strong>CLI performance</strong><small>Inspect outbound caller-ID outcomes</small></span></Link>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
