import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock3, Database, ShieldCheck } from 'lucide-react';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchDataIntegrity, type DataIntegrityData } from '../lib/offernetClient';
import { useOperatingControls } from '../hooks/useOperatingControls';
import { DataCompletenessPanel } from '../components/OfferNetControlPanels';
import { formatTableNumber } from '../lib/formatters';

export default function DataIntegrityIntelligence() {
  const { selectedClient } = useClient();
  const controls = useOperatingControls();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<DataIntegrityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchDataIntegrity({
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...extractOffernetFilters(filters),
      }, forceRefresh));
    } catch (err: any) {
      setError(err?.message || 'Failed to load data-integrity evidence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient) loadData();
  }, [selectedClient, startDate, endDate, filters]);

  const badge = (status: string) => {
    const healthy = ['HEALTHY', 'OBSERVED'].includes(status);
    const warning = ['WARNING', 'MAPPING_REQUIRED', 'TIMESTAMP_CONTRACT_REQUIRED'].includes(status);
    const cls = healthy
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : warning
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';
    return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{status}</span>;
  };

  return (
    <div className="cx-command-page">
      <OffernetFilterBar onRefresh={async () => { await Promise.all([loadData(true), controls.refetch()]); }} />
      <div className="cx-command-content">
        <header className="cx-command-hero">
          <div>
            <span className="cx-command-eyebrow">Data trust</span>
            <h1>Source observability & integrity</h1>
            <p>Freshness, mapping readiness and observed warehouse discrepancies without a synthetic health score.</p>
          </div>
        </header>

        {error && <div className="cx-command-error"><AlertTriangle size={16}/>{error}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner"/>Auditing source state…</div>}

        {data && (
          <>
            <section className="cx-command-panel">
              <header>
                <div><span className="cx-command-section-kicker">Sources</span><h2>Data source observability</h2><p>Freshness is observed from source timestamps. Missing contracts are surfaced explicitly.</p></div>
                <Clock3 size={16} className="text-slate-400"/>
              </header>
              <div className="cx-source-grid">
                {(data.sources || []).map(source => (
                  <article key={source.key}>
                    <div>
                      <span>{source.label}</span>
                      <strong>{source.latestRecordAt ? new Date(source.latestRecordAt).toLocaleString() : 'No freshness timestamp'}</strong>
                    </div>
                    {badge(source.status)}
                    <dl>
                      <div><dt>Age</dt><dd>{source.ageHours == null ? '—' : `${source.ageHours}h`}</dd></div>
                      <div><dt>Rows</dt><dd>{source.rowCount == null ? '—' : Number(source.rowCount).toLocaleString()}</dd></div>
                    </dl>
                    <p>{source.detail}</p>
                    <small>{source.table || 'No table configured'}</small>
                  </article>
                ))}
              </div>
            </section>

            {controls.data && <DataCompletenessPanel data={controls.data} />}

            <section className="cx-exception-summary">
              <article><span>Distinct leads audited</span><strong>{formatTableNumber(data.totalRecordsAudited)}</strong><small>Selected operational scope</small></article>
              <article><span>Validation status</span><strong className="text-base">{data.validationStatus || data.healthGrade}</strong><small>No synthetic score is assigned</small></article>
              <article><span>Observed checks</span><strong>{data.checks.length}</strong><small>Concrete discrepancy populations</small></article>
            </section>

            <section className="cx-command-panel">
              <header><div><span className="cx-command-section-kicker">Integrity</span><h2>Observed discrepancy checks</h2><p>{data.reason}</p></div><Database size={16} className="text-slate-400"/></header>
              <div className="cx-performance-table-wrap">
                <table className="cx-performance-table">
                  <thead><tr><th>Check</th><th>Category</th><th>Status</th><th>Observed gaps</th><th>Evidence</th></tr></thead>
                  <tbody>
                    {data.checks.map(check => (
                      <tr key={check.checkName}>
                        <th>{check.checkName}</th>
                        <td>{check.category}</td>
                        <td>{badge(check.status)}</td>
                        <td>{formatTableNumber(check.discrepancyCount)}</td>
                        <td><strong className="font-mono text-[10px]">{check.evidence}</strong><br/><span>{check.detail}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="cx-command-panel">
              <header><div><span className="cx-command-section-kicker">Trust boundary</span><h2>Current validation state</h2><p>Source freshness and discrepancy counts are operational observations, not financial or evidence-release certification.</p></div><ShieldCheck size={16} className="text-slate-400"/></header>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
