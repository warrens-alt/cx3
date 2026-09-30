import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useClient } from '../../lib/ClientContext';
import { useOperationalData } from '../../lib/useOperationalData';
import { fetchAnalyticsJson } from '../../lib/analyticsRequest';
import { parseWorkspaceEvidence } from '../../lib/workspaceReadiness';
import { useScopedNavigationTarget } from '../../hooks/useScopedNavigationTarget';
import { ROUTE_MANIFEST } from '../../app/routeManifest';
import { Info } from 'lucide-react';
import { StatusPresentation, DataStatusDialog } from './ReportPresentation';
import SourceEvidenceCards from './SourceEvidenceCards';
import '../../styles/analyticsReadiness.css';

export async function fetchWorkspaceEvidence(params: Record<string, unknown>, _refresh = false, signal?: AbortSignal) {
  const clientId = typeof params.clientId === 'string' ? params.clientId : '';
  if (!clientId) throw new Error('Select an authorised workspace before checking source evidence.');
  // Source observability intentionally has no cohort dates or optional dimensions.
  const envelope = await fetchAnalyticsJson<unknown>(`/api/analytics/offernet/source-observability?${new URLSearchParams({ clientId })}`, signal);
  return parseWorkspaceEvidence(envelope, clientId);
}

function WorkspaceReadiness() {
  const { selectedClient, clientConfig } = useClient();
  const [expanded, setExpanded] = useState(false);
  const [lastCheckFailed, setLastCheckFailed] = useState(false);
  const scoped = useScopedNavigationTarget();
  const query = useOperationalData('workspace-source-evidence', { clientId: selectedClient }, fetchWorkspaceEvidence, expanded);
  // Never display the last successful check as current while a refresh is running.
  const report = !query.loading && !query.error && query.data?.clientId === selectedClient ? query.data : null;
  useEffect(() => {
    if (query.loading) setLastCheckFailed(false);
    else if (query.error) setLastCheckFailed(true);
    else if (report) setLastCheckFailed(false);
  }, [query.loading, query.error, report]);
  return <StatusPresentation><section className="cx-readiness" aria-label="Analytics source evidence">
    <button type="button" className="cx-button-secondary cx-data-status-trigger" data-tone="unknown" aria-haspopup="dialog" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><Info size={14} aria-hidden="true" />Data status · Not verified</button>
    {lastCheckFailed && !expanded && <p className="cx-readiness-failed" role="alert">Source evidence could not be checked.</p>}
    <DataStatusDialog open={expanded} onClose={() => setExpanded(false)}>
      <p>{clientConfig?.name || selectedClient} · Connection, coverage and unresolved dependencies</p>
      {query.loading && <p role="status">Checking source evidence… Previously checked values are hidden during refresh.</p>}
      {query.error && <p role="alert">Source evidence could not be checked. Existing analytics are unchanged. Review your workspace access and retry.</p>}
      {report && <SourceEvidenceCards report={report} />}
      {!report && !query.loading && !query.error && <p role="status">No current source check is available.</p>}
      <div className="cx-readiness-actions">
        <button type="button" className="cx-button-secondary" disabled={query.loading} onClick={() => { void query.loadData(true); }}>Recheck source evidence</button>
        <Link to={scoped('/data-integrity')} onClick={() => setExpanded(false)} className="cx-button-secondary">Inspect data evidence</Link>
      </div>
      <p className="cx-readiness-note">Credentials remain on the server. This panel cannot enable integrations, change permissions or approve commercial mappings.</p>
    </DataStatusDialog>
  </section></StatusPresentation>;
}

export default function AnalyticsReadinessPanel() {
  const location = useLocation();
  const path = location.pathname === '/' ? '/overview' : location.pathname;
  const route = ROUTE_MANIFEST.find(item => item.path === path);
  const { selectedClient } = useClient();
  // Fixed releases, administration and synthetic demo pages do not trigger source checks.
  if (!selectedClient || route?.scopePolicy !== 'operational' || new URLSearchParams(location.search).get('mode') === 'demo') return null;
  return <WorkspaceReadiness key={selectedClient} />;
}
