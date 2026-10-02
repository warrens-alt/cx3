import AnalyticsPageLayout from '../components/AnalyticsPageLayout';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, FileText, Database, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { useClient } from '../lib/ClientContext';
import { fetchReportingCatalogue } from '../lib/reportingClient';
import { getAnalyticalSessionKey } from '../lib/analyticalSession';
import PageHeader from '../components/PageHeader';
import { PageSkeleton } from '../components/Skeleton';
import EvidenceScopeBar from '../components/operations/EvidenceScopeBar';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import ReleaseEvidence from '../features/evidenceWorkspace/ReleaseEvidence';
import ReportExecutionWorkspace from '../features/evidenceWorkspace/ReportExecutionWorkspace';
import ReportReplay from '../features/evidenceWorkspace/ReportReplay';
import '../styles/evidenceWorkspaces.css';

export default function VersionedReports({ embedded = false }: { embedded?: boolean } = {}) {
  const { clientId } = useClient();
  const scoped = useScopedNavigationTarget();
  const sessionKey = getAnalyticalSessionKey();
  const location = useLocation();
  const releases = new URLSearchParams(location.search).getAll('release');
  const requestedRelease = releases[0];
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['versioned-reports', sessionKey, clientId, requestedRelease, releases.length],
    queryFn: ({ signal }) => releases.length > 1 ? Promise.reject(new Error('Choose one explicit reporting release.')) : fetchReportingCatalogue(clientId, signal, requestedRelease),
    staleTime: 30000,
  });
  const release = !error && !isLoading ? data?.release : undefined;
  const isAvailable = data?.status === 'AVAILABLE' && !!release;
  return <AnalyticsPageLayout className="cx-reports-evidence-page" title="Evidence reports" header={embedded ? <div className="cx-workspace-panel-intro"><h2>Releases and replay</h2><p>Immutable execution, source snapshots and signed reproduction evidence.</p><p>{isLoading ? 'Checking registry' : error ? 'Registry unavailable' : isAvailable ? release.status : 'No published release'} · Tenant: {clientId}</p></div> : <PageHeader title="Evidence reports" subtitle="Immutable published release evidence: follow its audit checks, frozen source snapshots and technical manifest. Operational analytics remain separate." badges={[
      { label: isLoading ? 'Checking registry' : error ? 'Registry unavailable' : isAvailable ? release.status : 'No published release', variant: 'neutral' },
      { label: `Tenant: ${clientId}`, variant: 'neutral' },
    ]} />}>
    <EvidenceScopeBar releaseId={release?.releaseId || 'No release reported'} cutoff={release?.cutoff} busy={isLoading} />
    {requestedRelease && <p>Selected immutable release: <strong>{requestedRelease}</strong></p>}
    <div className="cx-admin-boundary" role="note"><FileText size={20} aria-hidden="true" /><div><strong>Release publication, execution and verification are separate</strong><p>Execution requires an approved immutable aggregate snapshot and an exact published scope. Replaying a result checks reproducibility; it does not independently reconcile sources or approve business meaning.</p></div></div>
    {isLoading ? <PageSkeleton /> : error ? <div className="cx-admin-panel cx-admin-error" role="alert"><h2><AlertCircle size={18} aria-hidden="true" />Error loading release registry</h2><p>{error instanceof Error ? error.message : 'Failed to connect to reporting dataset'}</p><button type="button" onClick={() => refetch()} className="cx-button-secondary"><RefreshCw size={14} aria-hidden="true" />Retry</button></div> : !isAvailable ? <section className="cx-admin-panel cx-admin-empty" aria-label="No published releases"><ShieldCheck size={28} aria-hidden="true" /><h2>No published releases for this tenant</h2><p>{data?.reason || data?.message || 'No published release was returned. This does not establish the availability or accuracy of live operational analytics.'}</p><Link className="cx-button-secondary" to={scoped('/data-integrity')}><Database size={14} aria-hidden="true" />Review source evidence<ArrowRight size={13} aria-hidden="true" /></Link></section> : <><ReportExecutionWorkspace key={JSON.stringify([sessionKey, clientId, release, location.search])} release={release} /><ReleaseEvidence key={release.releaseId} release={release} /></>}
    {!isLoading && !isAvailable && <ReportReplay key={JSON.stringify([sessionKey, clientId])} tenantId={clientId} report={null} />}
  </AnalyticsPageLayout>;
}
