import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Database, Palette, RefreshCw, Sun, Moon, Monitor, Cpu, ShieldCheck, BookOpen } from 'lucide-react';
import { PageShell } from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import { useClient } from '../lib/ClientContext';
import { useAuth } from '../lib/AuthContext';
import { useOperationalData } from '../lib/useOperationalData';
import { fetchAnalyticsJson } from '../lib/analyticsRequest';
import type { GoogleApiStatusData } from '../lib/offernetClient';
import { navigationTarget } from '../lib/presentation';
import { useTableDensity } from '../lib/useTableDensity';
import { useTheme } from '../lib/ThemeContext';
import { diagnosticLatency, servicePresentation } from '../lib/workspaceReadiness';
import '../styles/settings.css';
import '../styles/analyticsReadiness.css';

export async function fetchWorkspaceDiagnostics(params: Record<string, unknown>, _force = false, signal?: AbortSignal): Promise<GoogleApiStatusData> {
  const clientId = typeof params.clientId === 'string' ? params.clientId : '';
  if (!clientId) throw new Error('Select an authorised workspace first.');
  const result = await fetchAnalyticsJson<GoogleApiStatusData>(`/api/analytics/google/status?${new URLSearchParams({ clientId })}`, signal);
  const data = result.data;
  if (result.success !== true || data?.clientId !== clientId || !data.bigquery || !data.gemini || !data.identity ||
      typeof data.timestamp !== 'string' || !Number.isFinite(Date.parse(data.timestamp))) {
    throw new Error('Service diagnostics could not be validated for this workspace.');
  }
  return data;
}

export default function Settings() {
  const { selectedClient, clientConfig, ready } = useClient();
  const { isAdmin } = useAuth();
  const { density, setDensity } = useTableDensity();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  // One identity-scoped query, instead of two independent BigQuery health reads.
  // The shared query layer aborts obsolete requests and hides failed cached results.
  const query = useOperationalData('workspace-service-diagnostics', { clientId: selectedClient }, fetchWorkspaceDiagnostics);
  const data = !query.loading && !query.error && query.data?.clientId === selectedClient ? query.data : null;
  const bq = servicePresentation(data?.bigquery.status);
  const ai = servicePresentation(data?.gemini.status);
  const refresh = () => { void query.loadData(true); };
  const latest = data?.bigquery.latestData;
  const latestLabel = typeof latest === 'string' && Number.isFinite(Date.parse(latest))
    ? `${new Date(latest).toISOString()} (UTC)` : 'No valid timestamp reported';

  return <PageShell className="cx-settings-page">
    <PageHeader title="Settings & System Diagnostics" description="Display preferences and measured service checks for the selected workspace." />
    <div className="cx-settings-sections">
      <section className="cx-settings-card" aria-labelledby="settings-appearance-title">
        <header className="cx-settings-card-header">
          <div className="cx-settings-heading"><Palette size={20} aria-hidden="true" /><div><h2 id="settings-appearance-title">Appearance & Theme</h2><p>Display preferences are saved in this browser.</p></div></div>
        </header>
        <div className="cx-settings-appearance">
          <div className="cx-settings-theme"><h3>Workspace theme</h3><div className="cx-settings-theme-cards">
            {([
              { id: 'light', name: 'Offernet light', detail: 'Light surfaces and clear analytics.', Icon: Sun },
              { id: 'dark', name: 'Midnight slate', detail: 'Dark surfaces for reduced glare.', Icon: Moon },
              { id: 'system', name: 'System auto', detail: `Matches your device (${resolvedTheme}).`, Icon: Monitor },
            ] as const).map(({ id, name, detail, Icon }) => <button key={id} type="button" className={`cx-settings-theme-card ${theme === id ? 'is-active' : ''}`} onClick={() => setTheme(id)} aria-pressed={theme === id}>
              <div className={`cx-settings-theme-preview is-${id}`} aria-hidden="true"><i /><div><b /><span /><span /></div></div>
              <div className="cx-settings-theme-caption"><div><strong><Icon size={14} aria-hidden="true" /> {name}</strong><p>{detail}</p></div>{theme === id && <span className="cx-theme-badge-active">Active</span>}</div>
            </button>)}
          </div></div>
          <fieldset className="cx-settings-density"><legend>Table spacing</legend><p>Choose how much room each data row uses.</p><div className="cx-settings-density-options">
            {(['comfortable', 'compact'] as const).map(value => <label key={value} className={`cx-settings-density-option ${density === value ? 'is-selected' : ''}`}>
              <input type="radio" name="table-density" value={value} checked={density === value} onChange={() => setDensity(value)} />
              <span className="cx-settings-density-copy"><strong>{value === 'comfortable' ? 'Comfortable' : 'Compact'}</strong><span>{value === 'comfortable' ? 'More breathing room.' : 'More rows at a glance.'}</span></span>
              <span className={`cx-settings-density-preview is-${value}`} aria-hidden="true"><i /><i /><i /></span>
            </label>)}
          </div><p className="cx-settings-preference-status" role="status">{density === 'comfortable' ? 'Comfortable' : 'Compact'} spacing is applied across the workspace.</p></fieldset>
        </div>
      </section>

      <section className="cx-settings-card" aria-labelledby="settings-google-api-title">
        <header className="cx-settings-card-header">
          <div className="cx-settings-heading"><Database size={20} aria-hidden="true" /><div><h2 id="settings-google-api-title">Google Cloud & AI Platform</h2><p>Measured checks for {clientConfig?.name || selectedClient}. Key presence is not proof that a service works.</p></div></div>
          <button type="button" className="cx-button-secondary cx-settings-check" disabled={query.loading || !ready} onClick={refresh}><RefreshCw size={15} aria-hidden="true" />{query.loading ? 'Checking…' : 'Run Google Diagnostics'}</button>
        </header>
        <div className="cx-settings-connection-body">
          {query.loading && <p role="status">Checking services… Previous results are hidden until this check completes.</p>}
          {query.error && <div role="alert" className="cx-settings-status is-error"><div><strong>Service check failed</strong><p>No previous success is being presented as current. Review access and retry.</p><button type="button" className="cx-button-secondary" onClick={refresh}>Retry connection check</button></div></div>}
          {!ready && !query.loading && !query.error && <p role="status">Select an authorised workspace to run service checks.</p>}
          <div className="cx-readiness-grid">
            <article className="cx-readiness-card" aria-label="Google BigQuery diagnostics">
              <header><h3><Database size={15} aria-hidden="true" /> Google BigQuery</h3><span className="cx-readiness-badge" data-tone={bq.tone}>{query.loading ? 'Checking' : bq.label}</span></header>
              <dl><div><dt>Query latency</dt><dd>{diagnosticLatency(data?.bigquery.latencyMs)}</dd></div><div><dt>Project</dt><dd>{data?.bigquery.projectId || 'Not reported'}</dd></div><div className="cx-readiness-wide"><dt>Latest reported timestamp</dt><dd>{latestLabel}</dd></div></dl>
              <p>{bq.explanation} Event freshness and ingestion completeness are not independently verified.</p>
            </article>
            <article className="cx-readiness-card" aria-label="Google Gemini diagnostics">
              <header><h3><Cpu size={15} aria-hidden="true" /> Google Gemini AI</h3><span className="cx-readiness-badge" data-tone={ai.tone}>{query.loading ? 'Checking' : ai.label}</span></header>
              <dl><div><dt>Model checked</dt><dd>{data?.gemini.model || 'Not reported'}</dd></div><div><dt>Check latency</dt><dd>{diagnosticLatency(data?.gemini.latencyMs)}</dd></div></dl>
              <p>{ai.explanation} Optional AI availability does not determine whether measured dashboard analytics can load.</p>
            </article>
            <article className="cx-readiness-card" aria-label="Identity diagnostics">
              <header><h3><ShieldCheck size={15} aria-hidden="true" /> Identity & access</h3><span className="cx-readiness-badge" data-tone={data ? 'observed' : 'neutral'}>{query.loading ? 'Checking' : data ? 'Authenticated request' : 'Not checked'}</span></header>
              <dl><div><dt>Authentication mode</dt><dd>{data?.identity.authMode || 'Not reported'}</dd></div><div><dt>Workspace</dt><dd>{clientConfig?.name || selectedClient}</dd></div></dl>
              <p>This result covers the authenticated request only. Workspace and record-level permissions remain enforced by the server.</p>
            </article>
            <article className="cx-readiness-card" aria-label="Other storage diagnostics">
              <header><h3>Other storage services</h3><span className="cx-readiness-badge">Not checked</span></header>
              <p>This endpoint does not verify Cloud SQL provisioning, R2 bucket privacy or successful CLI imports. Use the relevant authorised storage/import workflow to verify those separately.</p>
            </article>
          </div>
          {data && <p className="cx-readiness-note">Service check generated at <time dateTime={data.timestamp}>{new Date(data.timestamp).toISOString()} (UTC)</time>. This is a check timestamp, not the source ingestion time.</p>}
          <details className="cx-settings-technical"><summary>Technical source details</summary><p>Credentials and source mappings are server-managed. This screen cannot change cloud permissions, enable integrations or edit source records. No credential values are displayed.</p></details>
        </div>
        {isAdmin && <footer className="cx-settings-ledger"><div><BookOpen size={18} aria-hidden="true" /><div><strong>Inspect the lead ledger</strong><p>Open bounded records using the current reporting scope.</p></div></div><Link to={navigationTarget('/lead-ledger', location.pathname, location.search)} className="cx-button-secondary">Open scoped ledger</Link></footer>}
      </section>
    </div>
  </PageShell>;
}
