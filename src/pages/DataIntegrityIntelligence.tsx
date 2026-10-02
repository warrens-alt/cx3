import AnalyticsPageLayout from '../components/AnalyticsPageLayout';
import InvestigationContextBar from '../features/investigation/InvestigationContextBar';
import { ReportSkeleton } from '../components/OperationalState';
import { ReportActions } from '../shared/reporting/ReportPresentation';
import { useOperationalData } from '../lib/useOperationalData';
import React, { useState } from 'react';
import ReportSections from '../shared/reporting/ReportSections';
import { groupIntegrityChecks } from '../features/trust/integrityAuditPresentation';
import { AlertTriangle, Clock3, Database, ShieldCheck, GitFork } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
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
import SourceEvidenceMatrix, { EvidenceStatus } from '../features/trust/components/SourceEvidenceMatrix';
import IntegrityCheckComparison from '../features/trust/components/IntegrityCheckComparison';
import IntegrityAuditChecks from '../features/trust/components/IntegrityAuditChecks';
import { warehouseSchemaPath } from '../features/evidenceWorkspace/warehouseAuditNavigation';
import { scopedViewPath } from '../shared/evidence/auditPresentation';
import '../styles/journeyContactVisuals.css';
import '../styles/trustQualityVisuals.css';
import '../styles/evidenceWorkspaces.css';
import '../styles/evidenceMatrix.css';

export default function DataIntegrityIntelligence() {
  const [section, setSection] = useState('overview');
  const scoped = useScopedNavigationTarget();
  const location = useLocation();
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

  const auditScope = { clientId: selectedClient, startDate, endDate, filters };
  const analysisPath = scopedViewPath(location.pathname, location.search, auditScope);

  const groups = groupIntegrityChecks(data?.checks || []);
  const gaps = groups.measured.filter(check => check.discrepancyCount != null && check.discrepancyCount > 0);

  return (
    <AnalyticsPageLayout className="cx-trust-workspace" ariaLabel="Data integrity workspace" title="Data confidence" description={<>See which measured discrepancies and source limitations need investigation.</>} actions={<ReportActions />} scope={<OffernetFilterBar onRefresh={async () => { await Promise.all([loadData(true), controls.refetch()]); }} />}>

        {error && <div role="alert" className="cx-command-error"><AlertTriangle size={16}/>{error}</div>}
        {loading && !data && <ReportSkeleton label="Loading data integrity" metricCount={3} />}

        <ReportSections label="Data integrity sections" value={section} onChange={setSection} sections={[
          { id: 'overview', label: 'Overview', content: data && <><section className="cx-integrity-summary" aria-label="Data integrity overview metrics">
              <UnifiedMetricCard label="Checks with measured gaps" value={gaps.length} note="Returned checks with a positive gap count" onInspect={() => setSection('issues')} inspectLabel="Inspect issues" />
              <UnifiedMetricCard label="Evidence limitations" value={groups.limitations.length} note="Checks with unavailable or unverified evidence" onInspect={() => setSection('issues')} inspectLabel="Inspect limitations" />
              <UnifiedMetricCard label="Observed Data Sources" value={data.sources?.length ?? 'Unavailable'} note="Returned source entries; observation does not establish health" onInspect={() => setSection('sources')} inspectLabel="Inspect sources" />
            </section>
            <SourceEvidenceMatrix sources={data.sources} summaryOnly />
            <IntegrityCheckComparison key={JSON.stringify([selectedClient, startDate, endDate, filters])} checks={data.checks} onViewDetails={() => setSection('issues')} />
            <section className="cx-integrity-attention" aria-label="Integrity needs attention">
              <h2>Evidence limitations</h2>
              <p>{data.reason}</p>
              {groups.limitations.length ? <ul>
                {groups.limitations.slice(0, 3).map((check, index) => <li key={`limit-${index}`}><div><strong>{check.checkName}</strong><p>{check.detail}</p></div><button type="button" className="cx-admin-text-button" onClick={() => setSection('issues')}>Evidence limited · Inspect</button></li>)}
              </ul> : <p>{data.checks.length ? 'No unavailable or unverified checks were returned. This does not certify the report.' : 'No discrepancy checks were returned. There is no measured conclusion to display.'}</p>}
              <button type="button" className="cx-admin-text-button" onClick={() => setSection('issues')}>View all {data.checks.length} checks</button>
            </section></> },
          { id: 'issues', label: 'Issues', content: data && <>            <IntegrityCheckComparison key={JSON.stringify([selectedClient, startDate, endDate, filters])} checks={data.checks} />

            <section className="cx-command-panel" id="integrity-checks">
              <div className="p-4"><ExportAnalysisButton filename="data_integrity_checks" rows={[
                ['Check', 'Category', 'Status', 'Discrepancy count', 'Definition'],
                ...data.checks.map(check => [check.checkName, check.category, check.status, check.discrepancyCount, check.detail]),
              ]} validationStatus={data.validationStatus} definitions={data.reason} /></div>
              <header><div><span className="cx-command-section-kicker">Integrity</span><h2>Observed discrepancy checks</h2><p>{data.reason}</p></div><Database size={16} className="text-slate-400"/></header>
              <IntegrityAuditChecks key={JSON.stringify([selectedClient, startDate, endDate, filters])} data={data} scope={auditScope} />
            </section>

            <aside className="cx-integrity-boundary" aria-label="Trust boundary">
              <ShieldCheck size={16} aria-hidden="true"/><div><h2>Current validation state</h2><p>Source freshness and discrepancy counts are operational observations, not financial or evidence-release certification.</p></div>
            </aside>
</> },
          { id: 'sources', label: 'Sources', content: data && <>            <SourceEvidenceMatrix sources={data.sources} renderSourceAction={source => {
              const target = warehouseSchemaPath(source.table, selectedClient, analysisPath);
              return target ? <Link className="cx-admin-text-button" to={target}>Inspect source schema</Link> : <small className="cx-trust-source-path">An exact source schema link is unavailable.</small>;
            }} />
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
                    <EvidenceStatus status={source.status} />
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
</> },
          { id: 'diagnostics', label: 'Diagnostics', content: <>
            {data && <><details className="cx-report-disclosure"><summary>Audit context</summary>            <section key={JSON.stringify(auditScope)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6" aria-label="Data integrity summary metrics">
              <UnifiedMetricCard
                label="Audited Lead Population"
                value={formatTableNumber(data.totalRecordsAudited)}
                note="Selected operational scope"
                auditContent={{ type: 'custom', title: 'Audited Lead Population', value: data.totalRecordsAudited, scope: auditScope, provenance: { validationStatus: data.validationStatus }, definition: { meaning: 'The lead population returned by the integrity checks for the selected operational scope.', calculation: 'The integrity response supplies totalRecordsAudited. This display does not recalculate or substitute the funnel population.', limitations: [data.reason] }, detailLimitation: 'The response supplies no affected-record filter for this population and no supported comparison for Why changed.', reportPath: '/funnel' }}
                to={scoped('/funnel')}
                inspectLabel="Inspect funnel"
              />

              <UnifiedMetricCard
                label="Observed Data Sources"
                value={data.sources?.length ?? 'Unavailable'}
                note="Returned source statuses; observation alone does not establish freshness or health"
                auditContent={{ type: 'custom', title: 'Observed Data Sources', value: data.sources?.length ?? null, scope: { clientId: selectedClient }, provenance: { validationStatus: data.validationStatus }, definition: { meaning: 'The number of source observation entries supplied in this response, including unavailable sources.', grain: 'Returned source observation entries.', dateBasis: 'All tenant-owned records, independent of the selected capture cohort.', calculation: 'Count of returned source entries; source row counts are not added together.', nullMeaning: 'Unavailable means the sources field was not supplied. An empty returned list is measured zero.' }, detailLimitation: 'This inventory count has no supporting lead-record drill. Exact supplied source identifiers can be opened in the source observations section.' }}
                onInspect={() => {
                  setSection('sources');
                  const el = document.getElementById('source-evidence');
                  el?.scrollIntoView({ behavior: 'auto' });
                }}
                inspectLabel="Inspect sources"
              />

              <UnifiedMetricCard
                label="Discrepancy Checks"
                value={data.checks.length}
                note={`${data.checks.filter(c => (c.discrepancyCount || 0) > 0).length} with measured gaps`}
                auditContent={{ type: 'custom', title: 'Discrepancy Checks', value: data.checks.length, scope: auditScope, provenance: { validationStatus: data.validationStatus }, definition: { meaning: 'The number of returned integrity checks, including checks whose measurements are unavailable.', grain: 'Returned check entries.', calculation: 'Count of returned checks. This is not a sum of affected records; checks can overlap.' }, detailLimitation: 'Inspect an individual check for its exact count and definition. No affected-record filter is supplied for these checks.' }}
                onInspect={() => {
                  setSection('issues');
                  const el = document.querySelector('.cx-integrity-table');
                  el?.scrollIntoView({ behavior: 'auto' });
                }}
                inspectLabel="Inspect checks"
              />

              <UnifiedMetricCard
                label="Validation Status"
                value={data.validationStatus || data.healthGrade || 'Not reported'}
                note="Operational rules status"
                auditContent={{ type: 'custom', title: 'Validation Status', value: data.validationStatus || data.healthGrade || null, scope: auditScope, provenance: { validationStatus: data.validationStatus || data.healthGrade }, definition: { meaning: data.reason || 'The operational validation state returned with this response.', calculation: 'The supplied status is displayed directly; no health score or certification is calculated.' }, detailLimitation: 'An operational status has no affected-record drill.' }}
                to={scoped('/reports')}
                inspectLabel="Evidence reports"
              />
            </section>

</details>            {controls.data && <DataCompletenessPanel data={controls.data} />}

</>}
            <DataIntakePanel clientId={selectedClient} isAdmin={isAdmin} />
          </> },
        ]} />

    </AnalyticsPageLayout>
  );
}
