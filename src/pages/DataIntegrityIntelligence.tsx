import { useOperationalData } from '../lib/useOperationalData';
import React, { useState } from 'react';
import { AlertTriangle, Clock3, Database, ShieldCheck, GitFork } from 'lucide-react';
import { Link } from 'react-router-dom';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchDataIntegrity, type DataIntegrityData } from '../lib/offernetClient';
import { useOperatingControls } from '../hooks/useOperatingControls';
import { DataCompletenessPanel } from '../components/OfferNetControlPanels';
import { formatTableNumber } from '../lib/formatters';
import '../styles/tableReadability.css';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import { DataIntakePanel } from '../components/DataIntakePanel';
import { useAuth } from '../lib/AuthContext';
import BlcLifecycleCard from '../components/BlcLifecycleCard';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import UnifiedMetricCard from '../components/UnifiedMetricCard';
import RootCauseDrawer from '../components/RootCauseDrawer';
import SourceEvidenceMatrix from '../features/trust/components/SourceEvidenceMatrix';
import IntegrityCheckComparison from '../features/trust/components/IntegrityCheckComparison';
import '../styles/journeyContactVisuals.css';
import '../styles/trustQualityVisuals.css';

export default function DataIntegrityIntelligence() {
  const scoped = useScopedNavigationTarget();
  const { selectedClient } = useClient();
  const { isAdmin } = useAuth();
  const controls = useOperatingControls();
  const { startDate, endDate, filters } = useFilters();
  const [rootMetric, setRootMetric] = useState<string | null>(null);
  const [rootMetricLabel, setRootMetricLabel] = useState<string | undefined>(undefined);

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
    <div className="cx-command-page cx-trust-workspace" aria-label="Data integrity workspace">
      <OffernetFilterBar onRefresh={async () => { await Promise.all([loadData(true), controls.refetch()]); }} />
      <div className="cx-command-content">
        <header className="cx-command-hero flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="cx-command-eyebrow">Data trust</span>
            <h1>Source observability & integrity</h1>
            <p>Freshness, mapping readiness and observed warehouse discrepancies without a synthetic health score.</p>
          </div>
          <div>
            <Link to="/offershop-flow" className="cx-button-secondary">
              Offershop Deal Flow <GitFork size={13} />
            </Link>
          </div>
        </header>

        <nav className="cx-viz-jump-nav" aria-label="Data integrity sections"><a href="#source-evidence">Source evidence</a><a href="#integrity-comparison">Compare checks</a><a href="#integrity-checks">Checks & export</a></nav>

        {error && <div role="alert" className="cx-command-error"><AlertTriangle size={16}/>{error}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner"/>Auditing source state…</div>}

        {data && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6" aria-label="Data integrity summary metrics">
              <UnifiedMetricCard
                label="Audited Lead Population"
                value={formatTableNumber(data.totalRecordsAudited)}
                note="Selected operational scope"
                onWhyChanged={() => {
                  setRootMetric('fetchedLeads');
                  setRootMetricLabel('Audited Lead Population');
                }}
                to={scoped('/funnel')}
                inspectLabel="Inspect funnel"
              />

              <UnifiedMetricCard
                label="Observed Data Sources"
                value={data.sources?.length || 0}
                note={`${data.sources?.filter(s => ['OK', 'HEALTHY', 'OBSERVED'].includes(s.status)).length || 0} healthy sources`}
                onWhyChanged={() => {
                  setRootMetric('deliveryRate');
                  setRootMetricLabel('Data Sources Health');
                }}
                onInspect={() => {
                  const el = document.getElementById('source-evidence');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                inspectLabel="Inspect sources"
              />

              <UnifiedMetricCard
                label="Discrepancy Checks"
                value={data.checks.length}
                note={`${data.checks.filter(c => (c.discrepancyCount || 0) > 0).length} with measured gaps`}
                onWhyChanged={() => {
                  setRootMetric('deliveryRate');
                  setRootMetricLabel('Discrepancy Checks');
                }}
                onInspect={() => {
                  const el = document.querySelector('.cx-integrity-table');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                inspectLabel="Inspect checks"
              />

              <UnifiedMetricCard
                label="Validation Status"
                value={data.validationStatus || data.healthGrade || 'OBSERVED'}
                note="Operational rules status"
                onWhyChanged={() => {
                  setRootMetric('deliveryRate');
                  setRootMetricLabel('Validation Rules');
                }}
                to={scoped('/reports')}
                inspectLabel="Evidence reports"
              />
            </section>

            <SourceEvidenceMatrix sources={data.sources} />
            <details className="cx-trust-disclosure"><summary>Detailed source observations and lifecycle diagnostics</summary>
            <section className="cx-command-panel">
              <header>
                <div><span className="cx-command-section-kicker">Sources</span><h2>Data source observability</h2><p>Source cards cover all tenant-owned records, independent of the selected capture cohort. Freshness is observed from timestamps; a freshness SLA is not inferred. Missing contracts are surfaced explicitly.</p></div>
                <Clock3 size={16} className="text-slate-400"/>
              </header>
              <div className="cx-source-grid">
                {(data.sources || []).map(source => source.key === 'activationLifecycle' ? (
                  <BlcLifecycleCard key={source.key} source={source} reportHref={scoped('/sales-activation')} />
                ) : (
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

            </details>
            <IntegrityCheckComparison key={JSON.stringify([selectedClient, startDate, endDate, filters])} checks={data.checks} />

            {controls.data && <DataCompletenessPanel data={controls.data} />}

            <section className="cx-command-panel" id="integrity-checks">
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
          </>
        )}

        {/* Source Intake & Diagnostic Recovery Console - always accessible to authorized workspace users */}
        <DataIntakePanel clientId={selectedClient} isAdmin={isAdmin} />
      </div>

      <RootCauseDrawer
        open={Boolean(rootMetric)}
        metric={rootMetric}
        metricLabel={rootMetricLabel}
        onClose={() => {
          setRootMetric(null);
          setRootMetricLabel(undefined);
        }}
      />
    </div>
  );
}
