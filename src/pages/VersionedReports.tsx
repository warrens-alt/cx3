import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShieldCheck, FileText, Database, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { useClient } from '../lib/ClientContext';
import { fetchReportingCatalogue } from '../lib/reportingClient';
import { getAnalyticalSessionKey } from '../lib/analyticalSession';
import PageHeader from '../components/PageHeader';
import { PageSkeleton } from '../components/Skeleton';
import EvidenceScopeBar from '../components/operations/EvidenceScopeBar';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import ReleaseEvidence from '../features/evidenceWorkspace/ReleaseEvidence';
import '../styles/evidenceWorkspaces.css';

export default function VersionedReports() {
  const { clientId } = useClient();
  const scoped = useScopedNavigationTarget();
  const sessionKey = getAnalyticalSessionKey();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['versioned-reports', sessionKey, clientId],
    queryFn: ({ signal }) => fetchReportingCatalogue(clientId, signal),
    staleTime: 30000,
  });
  const release = !error && !isLoading ? data?.release : undefined;
  const isAvailable = data?.status === 'AVAILABLE' && !!release;
  return <div className="cx-page cx-reports-evidence-page">
    <PageHeader title="Versioned Reporting Releases" subtitle="Immutable published release evidence: follow its audit checks, frozen source snapshots and technical manifest. Operational analytics remain separate." badges={[
      { label: isLoading ? 'Checking registry' : error ? 'Registry unavailable' : isAvailable ? release.status : 'No published release', variant: 'neutral' },
      { label: `Tenant: ${clientId}`, variant: 'neutral' },
    ]} />
    <EvidenceScopeBar releaseId={release?.releaseId || 'No release reported'} cutoff={release?.cutoff} busy={isLoading} />
    <div className="cx-admin-boundary" role="note"><FileText size={20} aria-hidden="true" /><div><strong>Registry available does not mean reports can execute</strong><p>Full report execution and replay remain deferred. Executor queries return an explicit 501 unavailable response; no run or download is simulated here.</p></div></div>
    {isLoading ? <PageSkeleton /> : error ? <div className="cx-admin-panel cx-admin-error" role="alert"><h2><AlertCircle size={18} aria-hidden="true" />Error loading release registry</h2><p>{error instanceof Error ? error.message : 'Failed to connect to reporting dataset'}</p><button type="button" onClick={() => refetch()} className="cx-button-secondary"><RefreshCw size={14} aria-hidden="true" />Retry</button></div> : !isAvailable ? <section className="cx-admin-panel cx-admin-empty" aria-label="No published releases"><ShieldCheck size={28} aria-hidden="true" /><h2>No published releases for this tenant</h2><p>{data?.reason || 'No published release was returned. This does not establish the availability or accuracy of live operational analytics.'}</p><Link className="cx-button-secondary" to={scoped('/data-integrity')}><Database size={14} aria-hidden="true" />Review source evidence<ArrowRight size={13} aria-hidden="true" /></Link></section> : <ReleaseEvidence key={release.releaseId} release={release} />}
  </div>;
}
