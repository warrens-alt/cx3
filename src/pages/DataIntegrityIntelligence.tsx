import { useOperationalData } from '../lib/useOperationalData';
import React from 'react';
import { AlertTriangle, Clock3, Database, ShieldCheck } from 'lucide-react';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchDataIntegrity, type DataIntegrityData } from '../lib/offernetClient';
import { useOperatingControls } from '../hooks/useOperatingControls';
import { DataCompletenessPanel } from '../components/OfferNetControlPanels';
import { formatTableNumber } from '../lib/formatters';
import '../styles/tableReadability.css';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import { RankedMetricChart } from '../components/charts/OperationalVisuals';
import { DataIntakePanel } from '../components/DataIntakePanel';
import { useAuth } from '../lib/AuthContext';

export default function DataIntegrityIntelligence() {
  const { selectedClient } = useClient();
  const { isAdmin } = useAuth();
  const controls = useOperatingControls();
  const { startDate, endDate, filters } = useFilters();

  const { data, loading, error, loadData } = useOperationalData<DataIntegrityData>('DataIntegrityIntelligence', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, fetchDataIntegrity);

  const badge = (status: string) => {
    const healthy = ['HEALTHY', 'OBSERVED'].includes(status);
    const warning = ['WARNING', 'MAPPING_REQUIRED', 'TIMESTAMP_CONTRACT_REQUIRED'].includes(status);
    const cls = healthy
      ? 'text-emerald-700'
      : warning
        ? 'text-amber-800'
        : 'text-slate-700';
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold font-mono ${cls}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${healthy ? 'bg-emerald-600' : warning ? 'bg-amber-600' : 'bg-slate-400'}`} aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
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
                <div><span className="cx-command-section-kicker">Sources</span><h2>Data source observability</h2><p>Source cards cover all tenant-owned records, independent of the selected capture cohort. Freshness is observed from timestamps; a freshness SLA is not inferred. Missing contracts are surfaced explicitly.</p></div>
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

            <div className="cx-analytics-visual-grid">
              <RankedMetricChart
                title="Observed discrepancy populations"
                subtitle="Largest measured data-quality gaps in the selected operational scope."
                data={data.checks.filter(check => check.discrepancyCount != null).map(check => ({ check: check.checkName, gaps: check.discrepancyCount }))}
                categoryKey="check"
                valueKey="gaps"
                valueLabel="Observed gaps"
              />
              <RankedMetricChart
                title="Source freshness age"
                subtitle="Hours since the latest observed source record; no freshness SLA is inferred."
                data={(data.sources || []).filter(source => source.ageHours != null).map(source => ({ source: source.label, hours: source.ageHours }))}
                categoryKey="source"
                valueKey="hours"
                valueLabel="Age"
                valueSuffix="h"
                decimals={1}
              />
            </div>

            {controls.data && <DataCompletenessPanel data={controls.data} />}

            <section className="cx-exception-summary">
              <article><span>Distinct leads audited</span><strong>{formatTableNumber(data.totalRecordsAudited)}</strong><small>Selected operational scope</small></article>
              <article><span>Validation status</span><strong className="text-base">{data.validationStatus || data.healthGrade}</strong><small>No synthetic score is assigned</small></article>
              <article><span>Observed checks</span><strong>{data.checks.length}</strong><small>Concrete discrepancy populations</small></article>
            </section>

            <section className="cx-command-panel">
              <div className="p-4"><ExportAnalysisButton filename="data_integrity_checks" rows={[
                ['Check', 'Category', 'Status', 'Discrepancy count', 'Definition'],
                ...data.checks.map(check => [check.checkName, check.category, check.status, check.discrepancyCount, check.detail]),
              ]} validationStatus={data.validationStatus} definitions={data.reason} /></div>
              <header><div><span className="cx-command-section-kicker">Integrity</span><h2>Observed discrepancy checks</h2><p>{data.reason}</p></div><Database size={16} className="text-slate-400"/></header>
              <div className="cx-performance-table-wrap" role="region" aria-label="Observed discrepancy checks" tabIndex={0}>
                <table className="cx-performance-table cx-integrity-table">
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

            <DataIntakePanel clientId={selectedClient} isAdmin={isAdmin} />
          </>
        )}
      </div>
    </div>
  );
}
