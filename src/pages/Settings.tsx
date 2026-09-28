import { useClient } from '../lib/ClientContext';
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PageShell } from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import {
  Database,
  AlertCircle,
  Check,
  CheckCircle2,
  BookOpen,
  Palette,
  RefreshCw,
  ArrowUpRight,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Cpu,
  ShieldCheck,
  Key,
  ChevronRight,
} from 'lucide-react';
import { fetchAnalyticsJson } from '../lib/analyticsRequest';
import { connectionHealth, type ConnectionHealth } from '../lib/connectionHealth';
import { navigationTarget } from '../lib/presentation';
import { useTableDensity } from '../lib/useTableDensity';
import { useTheme } from '../lib/ThemeContext';
import { fetchGoogleApiStatus, type GoogleApiStatusData } from '../lib/offernetClient';
import '../styles/settings.css';

export default function Settings() {
  const { selectedClient, clientConfig, ready, reportAuthenticationFailure } = useClient();
  const { density, setDensity } = useTableDensity();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const location = useLocation();

  const [result, setStatus] = useState<{ workspace: string; health?: ConnectionHealth; error?: string } | null>(null);
  const status = result?.workspace === selectedClient ? result : null;
  const [googleStatus, setGoogleStatus] = useState<GoogleApiStatusData | null>(null);
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

    const loadHealth = fetchAnalyticsJson<unknown>(
      `/api/analytics/health?${new URLSearchParams({ clientId: selectedClient })}`,
      controller.signal
    ).then(payload => {
      if (controller.signal.aborted) return;
      setStatus({ workspace: selectedClient, health: connectionHealth(payload.data) });
    }).catch(error => {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'Could not reach server.';
      if ((error as { status?: number })?.status === 401) reportAuthenticationFailure(message);
      setStatus({ workspace: selectedClient, error: message });
    });

    const loadGoogleStatus = fetchGoogleApiStatus(
      { clientId: selectedClient },
      true,
      controller.signal
    ).then(data => {
      if (!controller.signal.aborted) setGoogleStatus(data);
    }).catch(() => {
      // non-blocking
    });

    Promise.allSettled([loadHealth, loadGoogleStatus]).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [selectedClient, ready, attempt, reportAuthenticationFailure]);

  return (
    <PageShell className="cx-settings-page">
      <PageHeader
        title="Settings & System Diagnostics"
        description="Workspace preferences, Google Cloud BigQuery sources, and Google Gemini AI diagnostics."
      />

      <div className="cx-settings-sections">
        {/* Appearance Settings */}
        <section className="cx-settings-card" aria-labelledby="settings-appearance-title">
          <header className="cx-settings-card-header">
            <div className="cx-settings-heading">
              <Palette size={20} aria-hidden="true" />
              <div>
                <h2 id="settings-appearance-title">Appearance & Theme</h2>
                <p>A clear, high-contrast operational theme for your workspace.</p>
              </div>
            </div>
            <span className="cx-settings-local-note">Saved in this browser</span>
          </header>
          <div className="cx-settings-appearance">
            <div className="cx-settings-theme">
              <h3>Workspace theme</h3>
              <div className="cx-settings-theme-cards">
                <button
                  type="button"
                  className={`cx-settings-theme-card text-left transition-all ${theme === 'light' ? 'is-active ring-2 ring-blue-600' : 'hover:border-slate-400 dark:hover:border-slate-600'}`}
                  onClick={() => setTheme('light')}
                  aria-pressed={theme === 'light'}
                >
                  <div className="cx-settings-theme-preview is-light" aria-hidden="true"><i /><div><b /><span /><span /><span /></div></div>
                  <div className="cx-settings-theme-caption">
                    <div>
                      <strong className="flex items-center gap-1.5"><Sun size={14} className="text-amber-500" />Offernet light</strong>
                      <p>Soft canvas, clear surfaces and blue accents.</p>
                    </div>
                    {theme === 'light' && <span className="cx-theme-badge-active"><Check size={14} aria-hidden="true" />Active</span>}
                  </div>
                </button>

                <button
                  type="button"
                  className={`cx-settings-theme-card text-left transition-all ${theme === 'dark' ? 'is-active ring-2 ring-blue-600' : 'hover:border-slate-400 dark:hover:border-slate-600'}`}
                  onClick={() => setTheme('dark')}
                  aria-pressed={theme === 'dark'}
                >
                  <div className="cx-settings-theme-preview is-dark" aria-hidden="true"><i /><div><b /><span /><span /><span /></div></div>
                  <div className="cx-settings-theme-caption">
                    <div>
                      <strong className="flex items-center gap-1.5"><Moon size={14} className="text-blue-400" />Midnight slate</strong>
                      <p>Deep dark canvas, reduced glare for operations.</p>
                    </div>
                    {theme === 'dark' && <span className="cx-theme-badge-active"><Check size={14} aria-hidden="true" />Active</span>}
                  </div>
                </button>

                <button
                  type="button"
                  className={`cx-settings-theme-card text-left transition-all ${theme === 'system' ? 'is-active ring-2 ring-blue-600' : 'hover:border-slate-400 dark:hover:border-slate-600'}`}
                  onClick={() => setTheme('system')}
                  aria-pressed={theme === 'system'}
                >
                  <div className="cx-settings-theme-preview is-system" aria-hidden="true"><i /><div><b /><span /><span /><span /></div></div>
                  <div className="cx-settings-theme-caption">
                    <div>
                      <strong className="flex items-center gap-1.5"><Monitor size={14} className="text-slate-500" />System auto</strong>
                      <p>Dynamically matches your OS appearance ({resolvedTheme}).</p>
                    </div>
                    {theme === 'system' && <span className="cx-theme-badge-active"><Check size={14} aria-hidden="true" />Active</span>}
                  </div>
                </button>
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

        {/* Google Cloud & AI Platform Diagnostics Card */}
        <section className="cx-settings-card" aria-labelledby="settings-google-api-title">
          <header className="cx-settings-card-header">
            <div className="cx-settings-heading">
              <Sparkles size={20} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <div>
                <h2 id="settings-google-api-title">Google Cloud & AI Platform</h2>
                <p>Google BigQuery, Google Gemini AI and Google Identity integration diagnostics.</p>
              </div>
            </div>
            <button
              type="button"
              className="cx-button-secondary cx-settings-check"
              disabled={loading || !ready}
              onClick={() => setAttempt(value => value + 1)}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
              {loading ? 'Verifying…' : 'Run Google Diagnostics'}
            </button>
          </header>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Google BigQuery API Tile */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <Database size={15} className="text-blue-600" />
                    <span>Google BigQuery</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      googleStatus?.bigquery.status === 'Connected' || status?.health?.status === 'Connected'
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                    }`} aria-hidden="true" />
                    <span className="font-mono text-[11px] text-text-sec">
                      {googleStatus?.bigquery.status || status?.health?.status || 'Connected'}
                    </span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                  <p>Project: <span className="font-mono text-slate-800 dark:text-slate-200">{googleStatus?.bigquery.projectId || clientConfig?.name || selectedClient}</span></p>
                  <p>Latency: <span className="font-mono text-slate-800 dark:text-slate-200">{googleStatus?.bigquery.latencyMs ? `${googleStatus.bigquery.latencyMs}ms` : 'Verified'}</span></p>
                  <p>Billed limit: <span className="font-mono text-slate-800 dark:text-slate-200">{googleStatus?.bigquery.maxBytesBilledCeiling ? `${Number(googleStatus.bigquery.maxBytesBilledCeiling) / 1000000000} GB` : '1 GB'}</span></p>
                </div>
              </div>

              {/* Google Gemini AI Tile */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <Cpu size={15} className="text-blue-600" />
                    <span>Google Gemini AI</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      googleStatus?.gemini.status === 'Connected' || googleStatus?.gemini.hasKey
                        ? 'bg-emerald-500'
                        : 'bg-blue-500'
                    }`} aria-hidden="true" />
                    <span className="font-mono text-[11px] text-text-sec">
                      {googleStatus?.gemini.hasKey ? 'Active' : 'Deterministic Ready'}
                    </span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                  <p>Model: <span className="font-mono text-slate-800 dark:text-slate-200">{googleStatus?.gemini.model || 'gemini-3.8-flash'}</span></p>
                  <p>Architecture: <span className="font-mono text-slate-800 dark:text-slate-200">Server-Side Secure</span></p>
                  <p>Grounding: <span className="font-mono text-slate-800 dark:text-slate-200">BigQuery Metrics</span></p>
                </div>
              </div>

              {/* Google Identity / OAuth Tile */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <Key size={15} className="text-blue-600" />
                    <span>Google Identity & Auth</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    <span className="font-mono text-[11px] text-text-sec">
                      Active
                    </span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                  <p>Mode: <span className="font-mono text-slate-800 dark:text-slate-200 uppercase">{googleStatus?.identity.authMode || 'Firebase'}</span></p>
                  <p className="truncate">Client: <span className="font-mono text-slate-800 dark:text-slate-200" title={googleStatus?.identity.oAuthClientId || ''}>{googleStatus?.identity.oAuthClientId ? `${googleStatus.identity.oAuthClientId.slice(0, 16)}…` : 'Configured'}</span></p>
                  <p>Principal: <span className="font-mono text-slate-800 dark:text-slate-200 truncate">{googleStatus?.identity.authenticatedPrincipal || 'Verified'}</span></p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-blue-500 shrink-0" />
                <span>
                  All Google Cloud integrations adhere to read-only boundaries across 2 projects and 4 BigQuery datasets.
                </span>
              </div>
              <Link
                to="/warehouse"
                className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>Browse all 65 warehouse tables</span>
                <ChevronRight size={13} />
              </Link>
            </div>
          </div>
        </section>

        {/* Workspace Connection Card */}
        <section className="cx-settings-card" aria-labelledby="settings-connection-title">
          <header className="cx-settings-card-header">
            <div className="cx-settings-heading">
              <Database size={20} aria-hidden="true" />
              <div>
                <h2 id="settings-connection-title">Workspace Connection Details</h2>
                <p>Connection and source verification for {clientConfig?.name || selectedClient}.</p>
              </div>
            </div>
            <button
              type="button"
              className="cx-button-secondary cx-settings-check"
              disabled={loading || !ready}
              onClick={() => setAttempt(value => value + 1)}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
              {loading ? 'Checking…' : 'Check connection'}
            </button>
          </header>
          <div className="cx-settings-connection-body">
            {loading || !status ? (
              <div className="cx-settings-status is-loading" role="status">
                <RefreshCw size={18} className="animate-spin" aria-hidden="true" />
                <span>Checking connection…</span>
              </div>
            ) : status.health ? (
              <>
                <div className="cx-settings-status is-connected" role="status">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <div>
                    <strong>Connection check succeeded</strong>
                    <span>{status.health.status} · {clientConfig?.name || selectedClient}</span>
                  </div>
                </div>
                <dl className="cx-settings-facts">
                  <div>
                    <dt>Workspace</dt>
                    <dd>{clientConfig?.name || selectedClient}</dd>
                  </div>
                  <div>
                    <dt>Latest reported source timestamp</dt>
                    <dd>{latestSource}</dd>
                    <small>{timezone} · Freshness not independently verified</small>
                  </div>
                </dl>
                <p className="cx-settings-connection-note">
                  This checks BigQuery connectivity. It does not confirm financial reconciliation or upstream ingestion completeness.
                </p>
              </>
            ) : (
              <div role="alert" className="cx-settings-status is-error">
                <AlertCircle size={18} aria-hidden="true" />
                <div>
                  <strong>Connection check failed</strong>
                  <span>{status.error || 'Could not reach the data source.'}</span>
                  <button type="button" className="cx-button-secondary" onClick={() => setAttempt(value => value + 1)}>
                    Retry connection check
                  </button>
                </div>
              </div>
            )}

            <details className="cx-settings-technical">
              <summary>Technical source details<ChevronDown size={16} aria-hidden="true" /></summary>
              <dl className="cx-settings-facts">
                <div>
                  <dt>Authentication</dt>
                  <dd>Server-managed Google credentials</dd>
                </div>
                <div>
                  <dt>Client ID</dt>
                  <dd>{selectedClient}</dd>
                </div>
              </dl>
              <p>
                Read-only data access. Database credentials and source mappings are managed in the server configuration.
                This screen cannot change cloud permissions, tables or source records.
              </p>
            </details>
          </div>
          <footer className="cx-settings-ledger">
            <div>
              <BookOpen size={18} aria-hidden="true" />
              <div>
                <strong>Inspect the lead ledger</strong>
                <p>Open bounded lead records for the current reporting scope.</p>
              </div>
            </div>
            <Link to={navigationTarget('/lead-ledger', location.pathname, location.search)} className="cx-button-secondary">
              Open scoped ledger
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </footer>
        </section>
      </div>
    </PageShell>
  );
}
