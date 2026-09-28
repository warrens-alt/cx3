import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, FileText, CheckCircle2, Clock, Database, AlertCircle, RefreshCw } from 'lucide-react';
import { useClient } from '../lib/ClientContext';
import { fetchReportingCatalogue } from '../lib/reportingClient';
import { getAnalyticalSessionKey } from '../lib/analyticalSession';
import PageHeader from '../components/PageHeader';
import { PageSkeleton } from '../components/Skeleton';
import EvidenceScopeBar from '../components/operations/EvidenceScopeBar';

export default function VersionedReports() {
  const { clientId } = useClient();
  const [selectedRelease, setSelectedRelease] = useState<string | null>(null);
  const sessionKey = getAnalyticalSessionKey();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['versioned-reports', sessionKey, clientId],
    queryFn: ({ signal }) => fetchReportingCatalogue(clientId, signal),
    staleTime: 30000,
  });

  const release = data?.release;
  const isAvailable = data?.status === 'AVAILABLE' && !!release;

  return (
    <div className="cx-page space-y-6 p-6">
      <PageHeader
        title="Versioned Reporting Releases"
        subtitle="Immutable snapshot release registry for evidence reporting. Full report execution and replay remain a separate milestone; executor queries return explicit 501 unavailable responses."
        badges={[
          { label: isAvailable ? 'Release Active' : 'No Active Release', variant: isAvailable ? 'success' : 'neutral' },
          { label: `Tenant: ${clientId}`, variant: 'neutral' },
          { label: 'Executor: Deferred (501)', variant: 'neutral' },
        ]}
      />

      <EvidenceScopeBar releaseId={release?.releaseId} cutoff={release?.cutoff} busy={isLoading} />

      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <div className="enterprise-card p-6 bg-red-50 border-red-200 text-red-900 space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3>Error Loading Release Registry</h3>
          </div>
          <p className="text-sm">{(error as any)?.message || 'Failed to connect to reporting dataset'}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="cx-button-primary text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : !isAvailable ? (
        <div className="enterprise-card p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="font-semibold text-slate-800 text-base">No Published Releases for This Tenant</h3>
            <p className="text-xs text-slate-500">
              Reporting releases are published after automated snapshot verification and QA checks. Live operational telemetry remains available across all analytics tabs.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="enterprise-card p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Release Manifest</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Release ID</span>
                  <span className="font-mono font-medium text-slate-800 truncate max-w-[150px]">{release.releaseId}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Model Version</span>
                  <span className="font-mono font-medium text-slate-800">{release.modelVersion}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Metric Version</span>
                  <span className="font-mono font-medium text-slate-800">{release.metricVersion}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Approved By</span>
                  <span className="text-slate-800">{release.approvedBy || 'System Auditor'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Built At</span>
                  <span className="font-mono text-slate-700">{new Date(release.builtAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="enterprise-card p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Audit Proofs</h3>
              <div className="space-y-2">
                {(release.checks || []).map((check: any) => (
                  <div key={check.id} className="flex items-center justify-between p-2 rounded bg-slate-50 text-xs">
                    <span className="font-medium text-slate-700">{check.id}</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="enterprise-card p-5 space-y-4">
              <h3 className="font-semibold text-slate-800 text-sm">Verified Source Snapshots</h3>
              <p className="text-xs text-slate-500">
                These snapshots are frozen in time and read-only. Analytical queries reference these tables exclusively to prevent retrospective variance.
              </p>

              <div className="space-y-2">
                {Object.entries(release.snapshots || {}).map(([fact, snap]: [string, any]) => (
                  <div key={fact} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 capitalize">{fact}</span>
                      <p className="font-mono text-[11px] text-slate-500 mt-0.5">{snap.table}</p>
                    </div>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {new Date(snap.snapshotTime).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
