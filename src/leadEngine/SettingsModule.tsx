import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  FileSpreadsheet,
  Download,
  Key,
  Shield,
  Radio,
  FileCode,
  HardDrive,
  Activity,
  Check,
  Copy,
} from 'lucide-react';

interface CacheItem {
  key: string;
  storedAt: string;
  expiresAt: string;
  remainingSeconds: number;
  hitCount: number;
}

interface CacheStats {
  totalEntries: number;
  activeEntries: number;
  expiredEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
  estimatedMemoryKb: number;
  items: CacheItem[];
}

interface ServiceAccountInfo {
  clientEmail: string;
  projectId: string;
  authType: string;
  keyId: string;
  iamStatus: string;
  apiLatencyMs: number;
  pingStatus: string;
  lastVerifiedAt: string;
}

interface HlcExploderInfo {
  status: string;
  unpackedColumnsCount: number;
  columnsList: string[];
  nestedRecordSource: string;
  deliveryVerification: string;
}

export default function SettingsModule() {
  const [loading, setLoading] = useState(false);
  const [serviceAccount, setServiceAccount] = useState<ServiceAccountInfo | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [hlcExploder, setHlcExploder] = useState<HlcExploderInfo | null>(null);

  const [purging, setPurging] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);
  const [testingPing, setTestingPing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/status');
      const json = await res.json();
      if (json.success) {
        setServiceAccount(json.serviceAccount);
        setCacheStats(json.cache);
        setHlcExploder(json.hlcExploder);
      }
    } catch (err: any) {
      console.warn('Failed to load settings status:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto-refresh cache timer every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePurgeCache = async () => {
    setPurging(true);
    try {
      const res = await fetch('/api/cache/clear', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setPurgeMessage(`Cache purged: ${json.purgedEntries} query entries invalidated.`);
        setTimeout(() => setPurgeMessage(null), 3500);
        fetchStatus();
      }
    } catch (err: any) {
      setPurgeMessage(`Purge failed: ${err.message}`);
    } finally {
      setPurging(false);
    }
  };

  const handlePingTest = async () => {
    setTestingPing(true);
    await fetchStatus();
    setTestingPing(false);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-600 bg-neutral-100 border border-neutral-300 px-2 py-0.5 rounded">
              Module 04
            </span>
            <span className="text-xs text-neutral-500 font-mono">· Warehouse & Query Cache</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 mt-1">
            Settings & Query Cache Manager
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Manage high-speed in-memory query cache, inspect BigQuery Service Account IAM, and export data dictionary
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchStatus}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white border border-neutral-300 text-xs font-medium text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>
      </div>

      {purgeMessage && (
        <div className="p-3.5 rounded-lg bg-neutral-100 border border-neutral-300 text-neutral-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-neutral-700 shrink-0" />
            <span className="font-medium">{purgeMessage}</span>
          </div>
          <span className="text-[11px] font-mono text-neutral-600">Memory freed</span>
        </div>
      )}

      {/* BIGQUERY QUERY CACHE STATUS CARD */}
      <div className="bg-white p-6 rounded-lg border border-neutral-200 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-neutral-100 text-neutral-800 flex items-center justify-center font-bold border border-neutral-200">
              <HardDrive size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 tracking-tight">In-Memory Query Cache</h2>
              <p className="text-xs text-neutral-500">5-minute (300s) sliding TTL caching sub-millisecond query responses</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePurgeCache}
              disabled={purging}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-900 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={13} />
              <span>{purging ? 'Purging…' : 'Purge Query Cache'}</span>
            </button>
          </div>
        </div>

        {/* Cache KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 block font-medium">
              Active Cached Queries
            </span>
            <strong className="text-2xl font-bold font-mono text-neutral-900 block mt-1">
              {cacheStats?.activeEntries ?? 'Not reported'}
            </strong>
            <span className="text-[11px] text-neutral-500">of {cacheStats?.totalEntries ?? 'Not reported'} total entries</span>
          </div>

          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 block font-medium">
              Cache Hit Rate
            </span>
            <strong className="text-2xl font-bold font-mono text-neutral-900 block mt-1">
              {cacheStats?.hitRate == null ? 'Not reported' : `${cacheStats?.hitRate}%`}
            </strong>
            <span className="text-[11px] text-neutral-500">{cacheStats?.hits ?? 'Not reported'} hits · {cacheStats?.misses ?? 'Not reported'} misses</span>
          </div>

          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 block font-medium">
              Default TTL Timer
            </span>
            <strong className="text-2xl font-bold font-mono text-neutral-900 block mt-1">
              300 sec
            </strong>
            <span className="text-[11px] text-neutral-500">5 minutes auto-expiry</span>
          </div>

          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 block font-medium">
              Estimated Memory
            </span>
            <strong className="text-2xl font-bold font-mono text-neutral-900 block mt-1">
              ~{cacheStats?.estimatedMemoryKb ?? 'Not reported'} KB
            </strong>
            <span className="text-[11px] text-neutral-500">In-process heap</span>
          </div>
        </div>

        {/* Live Cached Query Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-600 font-medium">
            <span>Last returned cache diagnostic (not live certification):</span>
            <span className="font-mono text-[11px] text-neutral-400">Refreshes every 5s</span>
          </div>

          <div className="border border-neutral-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-mono text-[10.5px] uppercase">
                <tr>
                  <th className="py-2 px-3">Cache Key Namespace</th>
                  <th className="py-2 px-3">Stored At</th>
                  <th className="py-2 px-3 text-right">Hit Count</th>
                  <th className="py-2 pr-3 text-right">TTL Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-mono text-[11px]">
                {(cacheStats?.items || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-neutral-400 font-sans text-xs">
                      Cache is currently clean. Querying the Lead Ledger will populate cached entries.
                    </td>
                  </tr>
                ) : (
                  (cacheStats?.items || []).slice(0, 6).map(item => (
                    <tr key={item.key} className="hover:bg-neutral-50">
                      <td className="py-2 px-3 text-neutral-900 font-semibold truncate max-w-[280px]">
                        {item.key}
                      </td>
                      <td className="py-2 px-3 text-neutral-500">
                        {item.storedAt.slice(11, 19)} UTC
                      </td>
                      <td className="py-2 px-3 text-right text-neutral-700">
                        {item.hitCount} hits
                      </td>
                      <td className="py-2 pr-3 text-right text-neutral-900 font-bold">
                        {item.remainingSeconds}s remaining
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SERVICE ACCOUNT STATUS CARD */}
      <div className="bg-white p-6 rounded-lg border border-neutral-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-neutral-900 text-white flex items-center justify-center font-bold">
              <Key size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 tracking-tight">Google Cloud Service Account & IAM</h2>
              <p className="text-xs text-neutral-500">Authenticated via GOOGLE_SERVICE_ACCOUNT_JSON with read-only warehouse scope</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePingTest}
              disabled={testingPing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white border border-neutral-300 hover:bg-neutral-100 text-xs font-medium text-neutral-800 transition-colors cursor-pointer"
            >
              <Activity size={13} className={testingPing ? 'animate-spin text-neutral-900' : 'text-neutral-500'} />
              <span>{testingPing ? 'Testing…' : 'Ping BigQuery'}</span>
            </button>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-semibold bg-neutral-100 text-neutral-800 border border-neutral-300">
              <CheckCircle2 size={13} />
              <span>{serviceAccount?.iamStatus ?? 'Not reported'}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-neutral-50 rounded border border-neutral-200">
            <span className="text-[10.5px] font-mono text-neutral-400 block uppercase">Client Email</span>
            <div className="flex items-center gap-1 mt-1">
              <span className="font-mono text-neutral-800 text-[11px] truncate">
                {serviceAccount?.clientEmail ?? 'Not reported'}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(serviceAccount?.clientEmail || '', 'sa-email')}
                className="text-neutral-400 hover:text-neutral-700"
              >
                {copiedKey === 'sa-email' ? <Check size={11} className="text-neutral-900" /> : <Copy size={11} />}
              </button>
            </div>
          </div>

          <div className="p-3 bg-neutral-50 rounded border border-neutral-200">
            <span className="text-[10.5px] font-mono text-neutral-400 block uppercase">Target Project</span>
            <span className="font-mono font-bold text-neutral-900 text-[11.5px] block mt-1">
              {serviceAccount?.projectId ?? 'Not reported'}
            </span>
          </div>

          <div className="p-3 bg-neutral-50 rounded border border-neutral-200">
            <span className="text-[10.5px] font-mono text-neutral-400 block uppercase">BigQuery API Latency</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="font-mono font-bold text-neutral-900 text-sm">
                {serviceAccount?.apiLatencyMs ?? 'Not reported'} ms
              </span>
            </div>
          </div>

          <div className="p-3 bg-neutral-50 rounded border border-neutral-200">
            <span className="text-[10.5px] font-mono text-neutral-400 block uppercase">Auth Mechanism</span>
            <span className="font-mono text-neutral-700 text-[11px] block mt-1">
              {serviceAccount?.authType ?? 'Not reported'}
            </span>
          </div>
        </div>
      </div>

      {/* HLC VARIABLE EXPLODER STATUS */}
      <div className="bg-white p-6 rounded-lg border border-neutral-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-neutral-100 text-neutral-800 flex items-center justify-center font-bold border border-neutral-200">
              <Radio size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 tracking-tight">HLC Variable Exploder Status</h2>
              <p className="text-xs text-neutral-500">Unpacks BigQuery nested RECORD into 18 first-class columns across all queries</p>
            </div>
          </div>

          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-neutral-100 text-neutral-800 border border-neutral-300">
            Registered columns; activation not verified
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
          {(hlcExploder?.columnsList || []).map((col, idx) => (
            <div key={col} className="p-2 rounded bg-neutral-50 border border-neutral-200 text-[11px] truncate">
              <span className="text-neutral-400 mr-1">#{idx + 1}</span>
              <span className="text-neutral-900 font-medium">{col}</span>
            </div>
          ))}
        </div>
      </div>

      {/* BULK DATA & DATA DICTIONARY EXPORT */}
      <div className="bg-white p-6 rounded-lg border border-neutral-200 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-neutral-900 tracking-tight">Bulk Data & Data Dictionary Export</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Download complete 29-column schema definition and lead ledger dataset with exploded HLC variables
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-neutral-200 space-y-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="text-neutral-700" size={18} />
              <strong className="text-xs font-bold text-neutral-900">Data Dictionary</strong>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Complete catalog describing every column ID, display label, BigQuery data type, category, and business description.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <a
                href="/api/export/dictionary?format=csv"
                download="lead_engine_data_dictionary.csv"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white border border-neutral-300 text-xs font-medium text-neutral-800 hover:bg-neutral-100 transition-colors"
              >
                <Download size={13} />
                <span>Download CSV Dictionary</span>
              </a>
              <a
                href="/api/export/dictionary?format=json"
                download="lead_engine_data_dictionary.json"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white border border-neutral-300 text-xs font-medium text-neutral-800 hover:bg-neutral-100 transition-colors"
              >
                <FileCode size={13} />
                <span>JSON Dictionary</span>
              </a>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-neutral-200 space-y-3">
            <div className="flex items-center gap-2">
              <Database className="text-neutral-700" size={18} />
              <strong className="text-xs font-bold text-neutral-900">Lead Ledger Data Export</strong>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Export verified leads with all customer demographics, validation flags, and the 18 unpacked telecom dialler columns.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <a
                href="/api/export/leads?limit=500&format=csv"
                download="lead_ledger_export.csv"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium border border-neutral-900 transition-colors"
              >
                <Download size={13} />
                <span>Download Sample CSV (500 Rows)</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
