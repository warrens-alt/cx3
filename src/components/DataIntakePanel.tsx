import React, { useState, useEffect } from 'react';
import {
  Database, Play, AlertCircle, CheckCircle, Shield, Lock, Activity,
  XCircle, Clock, RefreshCw, BarChart2, Check, AlertTriangle, Layers
} from 'lucide-react';
import {
  fetchSourceInventory, fetchSourceMappings, profileRawSource,
  fetchSourceReadiness, checkSourceReadiness, fetchOntactSummary, fetchOnvestTouchpoints,
  type SourceInventoryData, type SourceMappingsData, type SourceReadinessData,
  type SourceReadinessCheckResult, type OntactSummaryData, type OnvestTouchpointsData
} from '../lib/dataIntakeClient';
import type { RawSourceProfileResult } from '../../server/bigquery/warehouseRegistry';

interface DataIntakePanelProps {
  clientId: string;
  isAdmin: boolean;
}

type TabType = 'readiness' | 'profiler' | 'ontact' | 'onvest' | 'inventory' | 'mappings';

export const DataIntakePanel: React.FC<DataIntakePanelProps> = ({ clientId, isAdmin }) => {
  const [inventory, setInventory] = useState<SourceInventoryData | null>(null);
  const [mappings, setMappings] = useState<SourceMappingsData | null>(null);
  const [readiness, setReadiness] = useState<SourceReadinessData | null>(null);
  const [ontact, setOntact] = useState<OntactSummaryData | null>(null);
  const [onvest, setOnvest] = useState<OnvestTouchpointsData | null>(null);

  const [loadingReadiness, setLoadingReadiness] = useState<boolean>(false);
  const [loadingOntact, setLoadingOntact] = useState<boolean>(false);
  const [loadingOnvest, setLoadingOnvest] = useState<boolean>(false);

  const [selectedSource, setSelectedSource] = useState<string>('vibe-code-warren-stear.analytics_warehouse.ontact_raw_data');
  const [profileResult, setProfileResult] = useState<RawSourceProfileResult | null>(null);
  const [profiling, setProfiling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [probingKey, setProbingKey] = useState<string | null>(null);
  const [probeResults, setProbeResults] = useState<Record<string, SourceReadinessCheckResult>>({});
  const [readinessFilter, setReadinessFilter] = useState<'ALL' | 'SUCCESS' | 'RESTRICTED'>('ALL');

  const [activeTab, setActiveTab] = useState<TabType>('readiness');

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetchSourceInventory(clientId).catch(() => null),
      fetchSourceMappings(clientId).catch(() => null),
      fetchSourceReadiness(clientId).catch(() => null),
    ]).then(([inv, map, read]) => {
      if (mounted) {
        if (inv) setInventory(inv);
        if (map) setMappings(map);
        if (read) setReadiness(read);
      }
    });
    return () => { mounted = false; };
  }, [clientId]);

  const loadReadiness = async () => {
    setLoadingReadiness(true);
    try {
      const data = await fetchSourceReadiness(clientId);
      setReadiness(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load source readiness');
    } finally {
      setLoadingReadiness(false);
    }
  };

  const loadOntact = async () => {
    setLoadingOntact(true);
    try {
      const data = await fetchOntactSummary(clientId);
      setOntact(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load ONtact dialler summary');
    } finally {
      setLoadingOntact(false);
    }
  };

  const loadOnvest = async () => {
    setLoadingOnvest(true);
    try {
      const data = await fetchOnvestTouchpoints(clientId);
      setOnvest(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load ONvest touchpoint stages');
    } finally {
      setLoadingOnvest(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setError(null);
    if (tab === 'readiness' && !readiness) loadReadiness();
    if (tab === 'ontact' && !ontact) loadOntact();
    if (tab === 'onvest' && !onvest) loadOnvest();
  };

  const handleRunProfile = async () => {
    if (!isAdmin) return;
    setProfiling(true);
    setError(null);
    try {
      const res = await profileRawSource(clientId, selectedSource);
      setProfileResult(res);
    } catch (err: any) {
      setError(err?.message || 'Profiling request failed');
    } finally {
      setProfiling(false);
    }
  };

  const handleProbeSource = async (sourceKey: string) => {
    if (!isAdmin) return;
    setProbingKey(sourceKey);
    try {
      const result = await checkSourceReadiness(clientId, sourceKey);
      setProbeResults(prev => ({ ...prev, [sourceKey]: result }));
    } catch (err: any) {
      setProbeResults(prev => ({
        ...prev,
        [sourceKey]: {
          sourceKey,
          status: 'QUERY_ERROR',
          probeDurationMs: 0,
          checkedAt: new Date().toISOString(),
          jobIdentity: 'unknown',
          error: err?.message || 'Probe request failed',
          ownerActionRequired: 'Inspect permissions and network path',
        },
      }));
    } finally {
      setProbingKey(null);
    }
  };

  const filteredSources = readiness?.sources.filter(s => {
    if (readinessFilter === 'SUCCESS') return s.historicalExport.status === 'SUCCESS';
    if (readinessFilter === 'RESTRICTED') return s.historicalExport.status === 'RESTRICTED';
    return true;
  }) || [];

  return (
    <section className="cx-command-panel p-5 mt-6 space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
        <div>
          <span className="cx-command-section-kicker">Data intake &amp; reconciliation</span>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database size={18} className="text-[#315BCB]" />
            <span>Warehouse Source Intake &amp; Raw Profiling</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Bounded profiling, schema discovery, dependency health, and typed mappings for 65 warehouse objects.
          </p>
        </div>
        <div className="flex flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => handleTabChange('readiness')}
            className={`px-3 py-1 font-medium rounded transition-colors ${activeTab === 'readiness' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Readiness &amp; Health
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('profiler')}
            className={`px-3 py-1 font-medium rounded transition-colors ${activeTab === 'profiler' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Raw Profiler
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('ontact')}
            className={`px-3 py-1 font-medium rounded transition-colors ${activeTab === 'ontact' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            ONtact Dialler
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('onvest')}
            className={`px-3 py-1 font-medium rounded transition-colors ${activeTab === 'onvest' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            ONvest Stages
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('inventory')}
            className={`px-3 py-1 font-medium rounded transition-colors ${activeTab === 'inventory' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Inventory ({inventory?.totalObjects || 65})
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('mappings')}
            className={`px-3 py-1 font-medium rounded transition-colors ${activeTab === 'mappings' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Mappings &amp; Spend
          </button>
        </div>
      </header>

      {error && (
        <div className="cx-command-error flex items-center gap-2 p-3 bg-rose-50 text-rose-800 rounded border border-rose-200 text-xs">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: READINESS & DEPENDENCY HEALTH */}
      {activeTab === 'readiness' && (
        <div className="space-y-4 text-xs">
          {readiness ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 text-[11px] block">Total Sources</span>
                  <strong className="text-base font-bold text-slate-900">{readiness.totalSources}</strong>
                  <span className="text-[10px] text-slate-500 block mt-0.5">2 Projects, 4 Datasets</span>
                </div>
                <div className="p-3 bg-emerald-50/60 rounded border border-emerald-200">
                  <span className="text-emerald-800 text-[11px] block">Sample Export Success</span>
                  <strong className="text-base font-bold text-emerald-900">{readiness.successfulSources}</strong>
                  <span className="text-[10px] text-emerald-700 block mt-0.5">Tables &amp; direct views</span>
                </div>
                <div className="p-3 bg-rose-50/60 rounded border border-rose-200">
                  <span className="text-rose-800 text-[11px] block">Dependency Restricted</span>
                  <strong className="text-base font-bold text-rose-900">{readiness.restrictedSources}</strong>
                  <span className="text-[10px] text-rose-700 block mt-0.5">External upstream ACLs</span>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 text-[11px] block">Execution Identity</span>
                  <strong className="text-xs font-mono font-semibold text-slate-800 truncate block mt-1">
                    {readiness.jobExecutionIdentity}
                  </strong>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Target BigQuery Job</span>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 text-[11px] block">Snapshot Date</span>
                  <strong className="text-xs font-mono font-semibold text-slate-800 block mt-1">
                    {readiness.manifest.exportedAt.slice(0, 10)}
                  </strong>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Bulk export handover</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/50 rounded border border-blue-200 text-slate-700 flex items-start gap-2">
                <Shield size={16} className="text-blue-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-blue-900">Historical Export Notice &amp; Dependency Governance</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {readiness.manifest.note} All 8 dedicated tenant views in <code>lead_ledger</code> failed during the 2026-09-27 bulk export due to missing query permissions on external datasets (<code>offernet-dmp:external_data_echos</code> and <code>offernet-dmp:hot_lead_connect</code>). Data owners must configure authorized views or grant <code>roles/bigquery.dataViewer</code> to resolve.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setReadinessFilter('ALL')}
                    className={`px-2.5 py-1 rounded transition-colors ${readinessFilter === 'ALL' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600'}`}
                  >
                    All ({readiness.totalSources})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReadinessFilter('SUCCESS')}
                    className={`px-2.5 py-1 rounded transition-colors ${readinessFilter === 'SUCCESS' ? 'bg-white text-emerald-700 shadow-2xs font-semibold' : 'text-slate-600'}`}
                  >
                    Export Success ({readiness.successfulSources})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReadinessFilter('RESTRICTED')}
                    className={`px-2.5 py-1 rounded transition-colors ${readinessFilter === 'RESTRICTED' ? 'bg-white text-rose-700 shadow-2xs font-semibold' : 'text-slate-600'}`}
                  >
                    Restricted ({readiness.restrictedSources})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={loadingReadiness}
                    onClick={loadReadiness}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 text-slate-700"
                  >
                    <RefreshCw size={13} className={loadingReadiness ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded max-h-96">
                <table className="w-full text-left text-xs divide-y divide-slate-100">
                  <thead className="bg-slate-50 sticky top-0 font-semibold text-slate-700">
                    <tr>
                      <th className="p-2.5">Source Key</th>
                      <th className="p-2.5">Type &amp; Grain</th>
                      <th className="p-2.5">Historical Export</th>
                      <th className="p-2.5">Upstream Dependency / Action</th>
                      <th className="p-2.5 text-right">Application Probe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {filteredSources.map((item, idx) => {
                      const probe = probeResults[item.key];
                      const isProbing = probingKey === item.key;
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono">
                            <span className="font-semibold text-slate-900 block truncate max-w-xs">{item.tableName}</span>
                            <span className="text-[10px] text-slate-500">{item.project}.{item.dataset}</span>
                          </td>
                          <td className="p-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono mr-1.5 ${item.tableType === 'TABLE' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-700'}`}>
                              {item.tableType}
                            </span>
                            <span className="text-slate-600 text-[10px]">{item.analyticalGrain}</span>
                          </td>
                          <td className="p-2.5">
                            {item.historicalExport.status === 'SUCCESS' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                                <CheckCircle size={12} className="text-emerald-600" />
                                <span>Exported ({item.historicalExport.rowsExported} rows)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-rose-50 text-rose-800 border border-rose-200 font-semibold">
                                <XCircle size={12} className="text-rose-600" />
                                <span>Export Restricted</span>
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 max-w-xs">
                            {item.historicalExport.failingDependency ? (
                              <div className="space-y-0.5">
                                <span className="font-mono text-[10px] text-rose-700 truncate block">
                                  {item.historicalExport.failingDependency}
                                </span>
                                <span className="text-[10px] text-slate-600 block">
                                  {item.historicalExport.ownerActionRequired}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[10px]">No upstream dependency failure</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right whitespace-nowrap">
                            {probe ? (
                              <div className="inline-flex flex-col items-end">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${probe.status === 'ACCESSIBLE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                  {probe.status} ({probe.probeDurationMs}ms)
                                </span>
                                {probe.error && (
                                  <span className="text-[10px] text-rose-700 truncate max-w-[180px] block" title={probe.error}>
                                    {probe.error}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={!isAdmin || isProbing}
                                onClick={() => handleProbeSource(item.key)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-medium disabled:opacity-50"
                                title={isAdmin ? 'Probe BigQuery access now' : 'Admin role required'}
                              >
                                {isProbing ? <RefreshCw size={11} className="animate-spin" /> : <Play size={11} />}
                                <span>{isProbing ? 'Probing…' : 'Probe Path'}</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-slate-500">
              {loadingReadiness ? 'Loading source readiness snapshot…' : 'No readiness data loaded.'}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RAW PROFILER */}
      {activeTab === 'profiler' && (
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <label htmlFor="source-select" className="text-xs font-semibold text-slate-700 block">
                Select Raw Warehouse Source:
              </label>
              <select
                id="source-select"
                value={selectedSource}
                onChange={e => setSelectedSource(e.target.value)}
                className="text-xs font-mono bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="vibe-code-warren-stear.analytics_warehouse.ontact_raw_data">
                  vibe-code-warren-stear.analytics_warehouse.ontact_raw_data (JSON)
                </option>
                <option value="vibe-code-warren-stear.analytics_warehouse.onvest_raw_data">
                  vibe-code-warren-stear.analytics_warehouse.onvest_raw_data (JSON)
                </option>
              </select>
            </div>
            <button
              type="button"
              disabled={profiling || !isAdmin}
              onClick={handleRunProfile}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#315BCB] text-white rounded font-medium text-xs hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-2xs"
            >
              {profiling ? <div className="cx-command-spinner mr-1" /> : <Play size={14} />}
              <span>{profiling ? 'Profiling bounded sample…' : 'Run Bounded Profile'}</span>
            </button>
          </div>

          {!isAdmin && (
            <div className="cx-command-panel p-3 bg-amber-50/60 border-amber-200 text-xs text-amber-800 flex items-center gap-2">
              <Lock size={15} />
              <span>Administrative privileges are required to initiate raw warehouse profiling jobs.</span>
            </div>
          )}

          {profileResult && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Source Status</span>
                  <strong className={`font-semibold ${profileResult.status === 'PROFILED' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {profileResult.status}
                  </strong>
                </div>
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Timestamp Semantics</span>
                  <strong className="font-semibold text-slate-800">
                    {profileResult.outerTimestampSemantics}
                  </strong>
                </div>
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Top-level Shape</span>
                  <strong className="font-semibold text-slate-800">
                    {profileResult.jsonStructureFindings.topLevelShape}
                  </strong>
                </div>
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Envelope Hypothesis</span>
                  <strong className="font-semibold text-slate-800">
                    {profileResult.jsonStructureFindings.envelopeType}
                  </strong>
                </div>
              </div>

              {profileResult.dependencies.length > 0 && (
                <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Shield size={14} className="text-amber-600" />
                    <span>Access &amp; Deployment Dependencies:</span>
                  </span>
                  <ul className="list-disc list-inside text-slate-600 pl-1">
                    {profileResult.dependencies.map((dep, idx) => (
                      <li key={idx}>{dep}</li>
                    ))}
                  </ul>
                </div>
              )}

              {profileResult.topLevelKeys.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800">Detected Payload Keys (Redacted)</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {profileResult.topLevelKeys.map((item, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-800 border border-slate-200">
                        {item.key}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ONTACT DIALLER OBSERVATIONS */}
      {activeTab === 'ontact' && (
        <div className="space-y-4 text-xs">
          {ontact ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 text-[11px] block">Total Observations</span>
                  <strong className="text-base font-bold text-slate-900">{ontact.totalObservations}</strong>
                  <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">{ontact.evidenceMode}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 text-[11px] block">Avg Duration</span>
                  <strong className="text-base font-bold text-slate-900">{ontact.averageDurationSec}s</strong>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Recorded length_in_sec</span>
                </div>
                <div className="p-3 bg-emerald-50/60 rounded border border-emerald-200">
                  <span className="text-emerald-800 text-[11px] block">Duration Verified</span>
                  <strong className="text-base font-bold text-emerald-900">
                    {ontact.timingValidation.durationVerificationRatePct}%
                  </strong>
                  <span className="text-[10px] text-emerald-700 block mt-0.5">
                    {ontact.timingValidation.durationVerifiedCount} / {ontact.totalObservations} rows
                  </span>
                </div>
                <div className="p-3 bg-amber-50/60 rounded border border-amber-200">
                  <span className="text-amber-800 text-[11px] block">Status Disagreements</span>
                  <strong className="text-base font-bold text-amber-900">
                    {ontact.timingValidation.statusDisagreementRatePct}%
                  </strong>
                  <span className="text-[10px] text-amber-700 block mt-0.5">
                    status ≠ call_result ({ontact.timingValidation.statusDisagreementCount} rows)
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700 flex items-start gap-2">
                <Clock size={16} className="text-blue-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">Timing &amp; Identity Constraints</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {ontact.timingValidation.note} {ontact.countingBasis}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-800">Status Code Breakdown</h4>
                  <ul className="divide-y divide-slate-200/60 font-mono text-[11px]">
                    {ontact.statusBreakdown.map((item, idx) => (
                      <li key={idx} className="py-1.5 flex justify-between">
                        <span className="text-slate-700">{item.status}</span>
                        <span className="font-semibold text-slate-900">{item.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-800">Call Result Breakdown</h4>
                  <ul className="divide-y divide-slate-200/60 font-mono text-[11px]">
                    {ontact.callResultBreakdown.map((item, idx) => (
                      <li key={idx} className="py-1.5 flex justify-between">
                        <span className="text-slate-700">{item.result}</span>
                        <span className="font-semibold text-slate-900">{item.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800">Campaign &amp; List Partitions</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px] mb-1 font-sans">Campaign IDs:</span>
                    {ontact.campaignBreakdown.map((c, i) => (
                      <div key={i} className="flex justify-between py-0.5">
                        <span>{c.campaignId}</span>
                        <span className="font-semibold">{c.count}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] mb-1 font-sans">List IDs:</span>
                    {ontact.listBreakdown.map((l, i) => (
                      <div key={i} className="flex justify-between py-0.5">
                        <span>{l.listId}</span>
                        <span className="font-semibold">{l.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-slate-500">
              {loadingOntact ? 'Loading ONtact dialler analytics…' : 'No ONtact dialler data loaded.'}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ONVEST TOUCHPOINTS */}
      {activeTab === 'onvest' && (
        <div className="space-y-4 text-xs">
          {onvest ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 text-[11px] block">Reports Processed</span>
                  <strong className="text-base font-bold text-slate-900">{onvest.totalReportsCount}</strong>
                  <span className="text-[10px] text-slate-500 block mt-0.5">{onvest.datesCoveredCount} distinct dates</span>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 text-[11px] block">Client-Scoped Tenant</span>
                  <strong className="text-base font-mono font-bold text-blue-900 truncate block mt-0.5">
                    {onvest.clientScopedTenant}
                  </strong>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Tenant boundary enforced</span>
                </div>
                <div className="p-3 bg-amber-50/60 rounded border border-amber-200">
                  <span className="text-amber-800 text-[11px] block">Reported Amount Spent</span>
                  <strong className="text-base font-mono font-bold text-amber-900">
                    {onvest.spendDiagnostics.rawAmountSpentSum}
                  </strong>
                  <span className="text-[10px] text-amber-700 block mt-0.5">
                    Currency: {onvest.spendDiagnostics.currencyStatus}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 text-[11px] block">Reach Policy</span>
                  <strong className="text-xs font-semibold text-slate-800 block mt-1">Non-Additive</strong>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Audience overlap prevented</span>
                </div>
              </div>

              {/* Aligned independent stage comparison */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <BarChart2 size={15} className="text-[#315BCB]" />
                    <span>Independent Stage Comparison (No Funnel Clamp)</span>
                  </h4>
                  <span className="text-[10px] text-slate-500">Source: offershop aggregate pipeline</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 bg-white rounded border border-slate-200">
                    <span className="text-slate-500 text-[11px] block">Fetched Leads</span>
                    <strong className="text-sm font-bold text-slate-900">{onvest.stageComparison.fetchedLeads}</strong>
                  </div>
                  <div className="p-2.5 bg-white rounded border border-slate-200">
                    <span className="text-slate-500 text-[11px] block">Qualified Leads</span>
                    <strong className="text-sm font-bold text-slate-900">{onvest.stageComparison.qualifiedLeads}</strong>
                  </div>
                  <div className="p-2.5 bg-white rounded border border-slate-200">
                    <span className="text-slate-500 text-[11px] block">Accepted Leads</span>
                    <strong className="text-sm font-bold text-slate-900">{onvest.stageComparison.acceptedLeads}</strong>
                  </div>
                  <div className="p-2.5 bg-white rounded border border-slate-200">
                    <span className="text-slate-500 text-[11px] block">Valid Phone IDs</span>
                    <strong className="text-sm font-bold text-slate-900">{onvest.stageComparison.validPhoneId}</strong>
                  </div>
                </div>

                <div className="p-2.5 bg-amber-50 rounded border border-amber-200 text-amber-800 text-[11px] flex items-start gap-1.5">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                  <span>{onvest.stageComparison.note}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800">Offershop Sources Breakdown</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-200">
                    <thead className="bg-slate-100 font-semibold text-slate-700">
                      <tr>
                        <th className="p-2">Source Domain</th>
                        <th className="p-2">Reports</th>
                        <th className="p-2">Sample Dates</th>
                        <th className="p-2 text-right">Fetched</th>
                        <th className="p-2 text-right">Qualified</th>
                        <th className="p-2 text-right">Accepted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {onvest.sourcesBreakdown.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-semibold text-slate-900">{s.source}</td>
                          <td className="p-2 text-slate-600">{s.reportsCount}</td>
                          <td className="p-2 text-slate-500 text-[10px]">{s.sampleReportDates.join(', ')}</td>
                          <td className="p-2 text-right">{s.totalFetched}</td>
                          <td className="p-2 text-right">{s.totalQualified}</td>
                          <td className="p-2 text-right">{s.totalAccepted}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-slate-500">
              {loadingOnvest ? 'Loading ONvest touchpoint stages…' : 'No ONvest touchpoint data loaded.'}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SOURCE INVENTORY */}
      {activeTab === 'inventory' && inventory && (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 text-[11px] block">Total Declared Objects</span>
              <strong className="text-sm font-bold text-slate-900">{inventory.totalObjects}</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 text-[11px] block">Physical Tables</span>
              <strong className="text-sm font-bold text-slate-900">{inventory.tableTypeCounts.TABLE || 18}</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 text-[11px] block">Views / Pipelines</span>
              <strong className="text-sm font-bold text-slate-900">{inventory.tableTypeCounts.VIEW || 47}</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 text-[11px] block">Raw JSON Sources</span>
              <strong className="text-sm font-bold text-slate-900">{inventory.rawJsonSources.length}</strong>
            </div>
          </div>

          <div className="overflow-x-auto max-h-72 border border-slate-200 rounded">
            <table className="w-full text-left text-xs divide-y divide-slate-100">
              <thead className="bg-slate-50 sticky top-0 font-semibold text-slate-700">
                <tr>
                  <th className="p-2">Dataset</th>
                  <th className="p-2">Object Name</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Family</th>
                  <th className="p-2">Disposition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {inventory.objects.map((obj, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-2 text-slate-600">{obj.dataset}</td>
                    <td className="p-2 font-semibold text-slate-900">{obj.tableName}</td>
                    <td className="p-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${obj.tableType === 'TABLE' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>
                        {obj.tableType}
                      </span>
                    </td>
                    <td className="p-2 text-slate-600">{obj.family}</td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">
                        {obj.disposition}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: MAPPINGS & SPEND SAFETY */}
      {activeTab === 'mappings' && mappings && (
        <div className="space-y-4 text-xs">
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800">Approved Versioned Mappings</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mappings.activeMappings.map((m, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="font-semibold text-slate-900">{m.mappingVersion}</strong>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                      {m.status}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-slate-600 truncate">{m.sourceId}</p>
                  <p className="text-slate-600 text-[11px]">
                    Record Boundary: <code className="text-slate-800">{m.recordBoundary}</code> · Ownership: <code className="text-slate-800">{m.tenantOwnership.strategy}</code>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h4 className="font-bold text-slate-800">Candidate Spend Streams (Double-Count Prevention)</h4>
            <p className="text-slate-600 text-[11px]">
              8 tables contain Amount_Spent; exactly one authoritative spend source is approved per tenant/date window:
            </p>
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded font-mono text-[11px] max-h-48 overflow-y-auto">
              {mappings.candidateSpendSources.map((source, idx) => (
                <li key={idx} className="p-2 hover:bg-slate-50 flex items-center justify-between">
                  <span className="text-slate-800 truncate">{source}</span>
                  <span className="text-[10px] text-slate-500 font-sans">Evaluated &amp; Isolated</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
