import { useClient } from '../lib/ClientContext';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageShell } from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import { Database, AlertCircle, CheckCircle2, Server, Key, Table, BookOpen } from 'lucide-react';
import { fetchAnalyticsJson } from '../lib/analyticsRequest';
import { connectionHealth, type ConnectionHealth } from '../lib/connectionHealth';

export default function Settings() {
  const { selectedClient, clientConfig, ready, reportAuthenticationFailure } = useClient();
  const [result, setStatus] = useState<{ workspace: string; health?: ConnectionHealth; error?: string } | null>(null);
  const status = result?.workspace === selectedClient ? result : null;
  const [loading, setLoading] = useState(true);
  const [attempt,setAttempt] = useState(0);

  useEffect(() => {
    if (!selectedClient || !ready) return;
    const controller=new AbortController();
    setLoading(true);setStatus(null);
    fetchAnalyticsJson<unknown>(`/api/analytics/health?${new URLSearchParams({clientId:selectedClient})}`,controller.signal)
      .then(payload => {
        if(controller.signal.aborted)return;
        setStatus({ workspace: selectedClient, health: connectionHealth(payload.data) });
        setLoading(false);
      })
      .catch(error => {
        if(controller.signal.aborted)return;
        const message=error instanceof Error ? error.message : 'Could not reach server.';
        if ((error as {status?:number})?.status===401) reportAuthenticationFailure(message);
        setStatus({ workspace: selectedClient, error: message });
        setLoading(false);
      });
    return ()=>controller.abort();
  }, [selectedClient,ready,attempt,reportAuthenticationFailure]);

  return (
    <PageShell>
      <PageHeader 
        title="System & Data Pipeline Status" 
        category="Infrastructure Telemetry"
        description="Inspect the selected workspace’s connection check and latest reported source timestamp. This is not a reconciliation or ingestion-completeness check."
      />

      <div className="max-w-3xl space-y-8">
        <div className="rounded-lg border border-slate-200 bg-surface-sec p-4 text-sm text-text-sec" role="note">
          Read-only data access. Connection checks and reports do not create, update, or delete Google Cloud tables or source records.
        </div>
        <div className="enterprise-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#EDF5FC] text-[#315EAD]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text-main">Tenant-Scoped Lead Ledger</h4>
              <p className="text-xs text-text-sec">Inspect bounded lead records through the authorised tenant-scoped analytics API.</p>
            </div>
          </div>
          <Link to="/lead-ledger" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#3562B3] hover:bg-[#2A4E8F] rounded-md transition-colors shrink-0">
            Open Scoped Ledger
          </Link>
        </div>

        <div className="enterprise-card overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-surface-sec/50 flex items-center gap-3">
            <Database className="w-5 h-5 text-[#3562B3]" />
            <h3 className="text-[16px] font-semibold text-text-main">BigQuery Configuration (Server-Side)</h3>
          </div>
          
          <div className="p-6">
            {loading || !status ? (
              <div className="text-sm text-text-sec">Checking connection...</div>
            ) : status.health ? (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-3 rounded-lg border border-emerald-100">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium text-sm">Connection check succeeded: {clientConfig?.name || selectedClient}</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="p-4 bg-surface-sec rounded border border-slate-100">
                    <div className="text-text-sec mb-1 flex items-center gap-2"><Server className="w-4 h-4"/> Authentication</div>
                    <div className="font-medium">Server-managed Google credentials</div>
                  </div>
                  <div className="p-4 bg-surface-sec rounded border border-slate-100">
                    <div className="text-text-sec mb-1 flex items-center gap-2"><Key className="w-4 h-4"/> Client ID</div>
                    <div className="font-medium break-words">{selectedClient}</div>
                  </div>
                  <div className="p-4 bg-surface-sec rounded border border-slate-100">
                    <div className="text-text-sec mb-1 flex items-center gap-2"><Table className="w-4 h-4"/> Latest Reported Source Timestamp</div>
                    <div className="font-medium">{status.health.latestData ? new Date(status.health.latestData).toLocaleString(undefined,{timeZone:clientConfig?.timezone || 'UTC'}) : 'No valid timestamp reported'}</div>
                    <div className="mt-1 text-xs text-text-sec">{clientConfig?.timezone || 'UTC'} · Freshness not independently verified</div>
                  </div>
                  <div className="p-4 bg-surface-sec rounded border border-slate-100">
                    <div className="text-text-sec mb-1 flex items-center gap-2"><Database className="w-4 h-4"/> Connection</div>
                    <div className="font-medium text-emerald-600">{status.health?.status || 'Unknown'}</div>
                  </div>
                </div>

                <div className="text-xs text-text-sec mt-4 border-t border-slate-100 pt-4">
                  Database credentials and source mappings are managed in the app’s server configuration. This screen cannot modify credentials, cloud permissions, tables, or source records.
                </div>
              </div>
            ) : (
              <div role="alert" className="flex items-start gap-3 text-red-700 bg-red-50 p-4 rounded-lg border border-red-100">
                <AlertCircle className="w-5 h-5 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Connection Failed</h4>
                  <p className="text-sm mt-1 opacity-90">{status.error || 'Unknown error'}</p>
                  <button type="button" className="cx-button-secondary mt-3" onClick={()=>setAttempt(value=>value+1)}>Retry connection check</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
