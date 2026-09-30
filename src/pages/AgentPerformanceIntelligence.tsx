import TablePreview from '../shared/reporting/TablePreview';
import { useOperationalData } from '../lib/useOperationalData';
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchAgentPerformance, type AgentPerformanceData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import OperationalPageHeader from '../components/OperationalPageHeader';
import { VolumeRateComboChart } from '../components/charts/OperationalVisuals';
import UnifiedMetricCard from '../components/UnifiedMetricCard';
import { downloadCsv, formatPercent, formatRatioPercent, formatTableNumber } from '../lib/formatters';
import { downloadAnalysisCsv } from '../lib/analysisExport';
import { sumRecordedValues } from '../lib/metricPresentation';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import EvidenceBars from '../shared/visuals/EvidenceBars';

import InspectorHost, { type InspectorContent } from '../shared/evidence/InspectorHost';
import { AuditMetadata } from '../shared/evidence/AuditMode';
import { agentAudit, suppliedProvenance } from '../features/evidenceWorkspace/secondaryAudit';

type AgentMetric = 'calls' | 'contactRate' | 'saleRate';
type AgentActivityData = AgentPerformanceData & {
  breakdowns?: { day: Array<AgentPerformanceData['agents'][number] & { bucket: string }>; hour: Array<AgentPerformanceData['agents'][number] & { bucket: string }> };
  scope?: { timezone: string; truncated: boolean; campaignReason: string };
};

export default function AgentPerformanceIntelligence() {
  const scoped = useScopedNavigationTarget();
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [audit, setAudit] = useState<InspectorContent | null>(null);
  const auditScope = { clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined, filters };
  useEffect(() => setAudit(null), [selectedClient, startDate, endDate, filters]);
  const [search, setSearch] = useState('');
  const [agentMetric, setAgentMetric] = useState<AgentMetric>('calls');

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

  const agentComparison = useMemo(() => {
    const rows = [...filtered].sort((a, b) => {
      const av = agentMetric === 'calls' ? a.totalCalls : agentMetric === 'contactRate' ? (a.contactRate ?? -1) : (a.saleRate ?? -1);
      const bv = agentMetric === 'calls' ? b.totalCalls : agentMetric === 'contactRate' ? (b.contactRate ?? -1) : (b.saleRate ?? -1);
      return Number(bv) - Number(av);
    }).slice(0, 12);
    return rows.map((row, index) => {
      const value = agentMetric === 'calls' ? row.totalCalls : agentMetric === 'contactRate' ? row.contactRate : row.saleRate;
      const displayValue = agentMetric === 'calls' ? formatTableNumber(value) : formatPercent(value, 2);
      return {
        key: `${row.agentId}-${row.vendor}-${index}`,
        sourceRow: row,
        label: row.agentId,
        detail: row.vendor || 'Vendor unavailable',
        value,
        displayValue,
      };
    });
  }, [filtered, agentMetric]);

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
    <div className="cx-command-page cx-agent-page">
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
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6" aria-label="Agent performance metrics">
              <UnifiedMetricCard
                label="Agents Observed"
                value={totals.agents.toLocaleString()}
                note="Distinct agent/vendor rows"
                onInspect={() => {
                  setAudit({ type: 'metric', title: 'Agents observed', value: totals.agents, scope: auditScope, definition: { meaning: 'Count of returned agent/vendor groups in the displayed roster; the same agent may occur with more than one vendor.', grain: 'Agent/vendor group', dateBasis: 'Call start date', nullMeaning: 'An empty returned roster is different from an unavailable response.' }, provenance: suppliedProvenance(data), detailLimitation: 'No agent-directory record drill is supplied for this aggregate.' });
                }}
                inspectLabel="Inspect evidence"
              />

              <UnifiedMetricCard
                label="Total Calls"
                value={formatTableNumber(totals.calls)}
                note="Recorded calls in roster"
                onInspect={() => {
                  setAudit({ type: 'metric', title: 'Total calls', value: formatTableNumber(totals.calls), scope: auditScope, definition: { meaning: 'Recorded calls summed across the returned roster, which can be limited to the highest-volume groups.', grain: 'Call event', dateBasis: 'Call start date', nullMeaning: 'Unavailable call counts remain unavailable.' }, provenance: suppliedProvenance(data), detailLimitation: 'No supporting call-event drill is supplied for this roster total.' });
                }}
                inspectLabel="Inspect evidence"
              />

              <UnifiedMetricCard
                label="Contacted (RPC)"
                value={formatTableNumber(totals.contacts)}
                note={`${formatRatioPercent(totals.contacts, totals.calls)} of calls`}
                onInspect={() => setAudit({ type: 'metric', title: 'RPC calls in returned roster', value: formatTableNumber(totals.contacts), scope: auditScope, definition: { meaning: 'Sum of recorded RPC call counts across the displayed agent/vendor roster.', grain: 'Call event', dateBasis: 'Call start date', nullMeaning: 'Missing flags remain unavailable; calls are not distinct lead populations.' }, provenance: suppliedProvenance(data) })}
                inspectLabel="Inspect evidence"
              />

              <UnifiedMetricCard
                label="Sales Recorded"
                value={formatTableNumber(totals.sales)}
                note={`${formatRatioPercent(totals.rpcSales, totals.contacts)} of RPC calls sold`}
                onInspect={() => setAudit({ type: 'metric', title: 'Sale calls in returned roster', value: formatTableNumber(totals.sales), scope: auditScope, definition: { meaning: 'Sum of recorded sale call counts across the displayed agent/vendor roster. The contextual sold-RPC rate uses calls marked both RPC and sale.', grain: 'Call event', dateBasis: 'Call start date', nullMeaning: 'Missing call outcomes remain unavailable.' }, provenance: suppliedProvenance(data) })}
                inspectLabel="Inspect evidence"
              />
            </section>

            <AuditMetadata grain="Call event" dateBasis="Call start date" validationStatus={suppliedProvenance(data).validationStatus} />
            <section className="cx-command-panel cx-agent-comparison" aria-label="Agent comparison">
              <div className="cx-viz-toolbar">
                <div>
                  <span className="cx-command-section-kicker">Compare roster</span>
                  <h2>Agent activity comparison</h2>
                  <p>Rank the displayed roster by one observed measure at a time. This is descriptive evidence, not a performance score.</p>
                </div>
                <div className="cx-segmented-control" role="group" aria-label="Agent comparison metric">
                  <button type="button" aria-pressed={agentMetric === 'calls'} data-active={agentMetric === 'calls'} onClick={() => setAgentMetric('calls')}>Calls</button>
                  <button type="button" aria-pressed={agentMetric === 'contactRate'} data-active={agentMetric === 'contactRate'} onClick={() => setAgentMetric('contactRate')}>RPC rate</button>
                  <button type="button" aria-pressed={agentMetric === 'saleRate'} data-active={agentMetric === 'saleRate'} onClick={() => setAgentMetric('saleRate')}>Sold RPC / RPC</button>
                </div>
              </div>
              <EvidenceBars
                title={agentMetric === 'calls' ? 'Recorded calls by agent' : agentMetric === 'contactRate' ? 'RPC / calls by agent' : 'Sold RPC / RPC by agent'}
                description="Top 12 displayed agent/vendor rows for the selected metric. Select a row to inspect its supplied count or rate evidence."
                items={agentComparison}
                maximum={agentMetric === 'calls' ? undefined : 100}
                scaleNote={agentMetric === 'calls' ? 'Bars share the largest returned call count as their scale.' : 'Rates use a fixed 0–100% scale; unavailable values remain unavailable.'}
                onSelect={key => {
                  const item = agentComparison.find(row => row.key === key);
                  if (item) setAudit(agentAudit(item.sourceRow, agentMetric, auditScope, data));
                }}
              />
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
                  <input aria-label="Search returned agents or vendors" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search agent or vendor…" />
                </label>
                <span>{filtered.length.toLocaleString()} rows</span>
              </div>

              <TablePreview rows={filtered} label="agent rows">{visibleRows => <div className="cx-performance-table-wrap" role="region" aria-label="Agent activity and outcomes" tabIndex={0}>
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
                      <th>Callbacks</th><th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, index) => (
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
                        <td><button type="button" className="cx-button-secondary" onClick={() => setAudit(agentAudit(row, agentMetric, auditScope, data))} aria-label={`Inspect evidence for ${row.agentId}`}>Inspect</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}</TablePreview>
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
      <InspectorHost open={Boolean(audit)} onClose={() => setAudit(null)} content={audit} />
    </div>
  );
}
