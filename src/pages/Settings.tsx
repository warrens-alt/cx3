import { useClient } from '../lib/ClientContext';
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PageShell } from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import { Database, AlertCircle, Check, CheckCircle2, BookOpen, Palette, RefreshCw, ArrowUpRight, ChevronDown } from 'lucide-react';
import { fetchAnalyticsJson } from '../lib/analyticsRequest';
import { connectionHealth, type ConnectionHealth } from '../lib/connectionHealth';
import { navigationTarget } from '../lib/presentation';
import { useTableDensity } from '../lib/useTableDensity';
import '../styles/settings.css';

export default function Settings() {
  const { selectedClient, clientConfig, ready, reportAuthenticationFailure } = useClient();
  const { density, setDensity } = useTableDensity();
  const location = useLocation();
  const [result, setStatus] = useState<{ workspace: string; health?: ConnectionHealth; error?: string } | null>(null);
  const status = result?.workspace === selectedClient ? result : null;
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const timezone = clientConfig?.timezone || 'UTC';
  const latestDate = status?.health?.latestData ? new Date(status.health.latestData) : null;
  const latestSource = latestDate && Number.isFinite(latestDate.getTime())
    ? latestDate.toLocaleString(undefined, { timeZone: timezone })
    : 'No valid timestamp reported';

  useEffect(() => {
    if (!selectedClient || !ready) return;
    const controller = new AbortController();
    setLoading(true);
    setStatus(null);
    fetchAnalyticsJson<unknown>(`/api/analytics/health?${new URLSearchParams({ clientId: selectedClient })}`, controller.signal)
      .then(payload => {
        if (controller.signal.aborted) return;
        setStatus({ workspace: selectedClient, health: connectionHealth(payload.data) });
        setLoading(false);
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Could not reach server.';
        if ((error as { status?: number })?.status === 401) reportAuthenticationFailure(message);
        setStatus({ workspace: selectedClient, error: message });
        setLoading(false);
      });
    return () => controller.abort();
  }, [selectedClient, ready, attempt, reportAuthenticationFailure]);

  return (
    <PageShell className="cx-settings-page">
      <PageHeader
        title="Settings"
        description="Make the workspace comfortable to use and check its data connection."
      />

      <div className="cx-settings-sections">
        <section className="cx-settings-card" aria-labelledby="settings-appearance-title">
          <header className="cx-settings-card-header">
            <div className="cx-settings-heading"><Palette size={20} aria-hidden="true" /><div><h2 id="settings-appearance-title">Appearance</h2><p>A clear, consistent view of your workspace.</p></div></div>
            <span className="cx-settings-local-note">Saved in this browser</span>
          </header>
          <div className="cx-settings-appearance">
            <div className="cx-settings-theme">
              <h3>Workspace theme</h3>
              <div className="cx-settings-theme-card">
                <div className="cx-settings-theme-preview" aria-hidden="true"><i /><div><b /><span /><span /><span /></div></div>
                <div className="cx-settings-theme-caption"><div><strong>Offernet light</strong><p>Soft canvas, clear surfaces and blue accents.</p></div><span><Check size={14} aria-hidden="true" />Active</span></div>
              </div>
            </div>
            <fieldset className="cx-settings-density">
              <legend>Table spacing</legend>
              <p>Choose how much room each data row uses.</p>
              <div className="cx-settings-density-options">
                {(['comfortable', 'compact'] as const).map(value => (
                  <label key={value} className={`cx-settings-density-option ${density === value ? 'is-selected' : ''}`}>
                    <input type="radio" name="table-density" value={value} checked={density === value} onChange={() => setDensity(value)} />
                    <span className="cx-settings-density-copy"><strong>{value === 'comfortable' ? 'Comfortable' : 'Compact'}</strong><span>{value === 'comfortable' ? 'More breathing room between rows.' : 'More rows visible at a glance.'}</span></span>
                    <span className={`cx-settings-density-preview is-${value}`} aria-hidden="true"><i /><i /><i /></span>
                  </label>
                ))}
              </div>
              <p className="cx-settings-preference-status" role="status">{density === 'comfortable' ? 'Comfortable' : 'Compact'} table spacing is applied across the workspace.</p>
            </fieldset>
          </div>
        </section>

        <section className="cx-settings-card" aria-labelledby="settings-connection-title">
          <header className="cx-settings-card-header">
            <div className="cx-settings-heading"><Database size={20} aria-hidden="true" /><div><h2 id="settings-connection-title">Workspace connection</h2><p>Connection and source information for {clientConfig?.name || selectedClient}.</p></div></div>
            <button type="button" className="cx-button-secondary cx-settings-check" disabled={loading || !ready} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />{loading ? 'Checking…' : 'Check connection'}</button>
          </header>
          <div className="cx-settings-connection-body">
            {loading || !status ? (
              <div className="cx-settings-status is-loading" role="status"><RefreshCw size={18} className="animate-spin" aria-hidden="true" /><span>Checking connection…</span></div>
            ) : status.health ? (
              <>
                <div className="cx-settings-status is-connected" role="status"><CheckCircle2 size={18} aria-hidden="true" /><div><strong>Connection check succeeded</strong><span>{status.health.status} · {clientConfig?.name || selectedClient}</span></div></div>
                <dl className="cx-settings-facts">
                  <div><dt>Workspace</dt><dd>{clientConfig?.name || selectedClient}</dd></div>
                  <div><dt>Latest reported source timestamp</dt><dd>{latestSource}</dd><small>{timezone} · Freshness not independently verified</small></div>
                </dl>
                <p className="cx-settings-connection-note">This checks connectivity. It does not confirm reconciliation or ingestion completeness.</p>
              </>
            ) : (
              <div role="alert" className="cx-settings-status is-error"><AlertCircle size={18} aria-hidden="true" /><div><strong>Connection check failed</strong><span>{status.error || 'Could not reach the data source.'}</span><button type="button" className="cx-button-secondary" onClick={() => setAttempt(value => value + 1)}>Retry connection check</button></div></div>
            )}

            <details className="cx-settings-technical">
              <summary>Technical source details<ChevronDown size={16} aria-hidden="true" /></summary>
              <dl className="cx-settings-facts"><div><dt>Authentication</dt><dd>Server-managed Google credentials</dd></div><div><dt>Client ID</dt><dd>{selectedClient}</dd></div></dl>
              <p>Read-only data access. Database credentials and source mappings are managed in the server configuration. This screen cannot change cloud permissions, tables or source records.</p>
            </details>
          </div>
          <footer className="cx-settings-ledger"><div><BookOpen size={18} aria-hidden="true" /><div><strong>Inspect the lead ledger</strong><p>Open bounded lead records for the current reporting scope.</p></div></div><Link to={navigationTarget('/lead-ledger', location.pathname, location.search)} className="cx-button-secondary">Open scoped ledger<ArrowUpRight size={15} aria-hidden="true" /></Link></footer>
        </section>
      </div>
    </PageShell>
  );
}
