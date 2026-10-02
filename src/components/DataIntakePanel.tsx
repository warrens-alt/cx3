import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
import { formatTableNumber } from '../lib/formatters';
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
    setInventory(null);
    setMappings(null);
    setReadiness(null);
    setOntact(null);
    setOnvest(null);
    setProfileResult(null);
    setProbeResults({});
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
    <section className="cx-command-panel cx-data-intake p-5 mt-6 space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border-subtle gap-3">
        <div>
          <span className="cx-command-section-kicker">Data intake &amp; reconciliation</span>
          <h2 className="text-base font-bold text-text-main flex items-center gap-2">
            <Database size={18} className="text-action" />
            <span>Warehouse Source Intake &amp; Raw Profiling</span>
          </h2>
          <p className="text-xs text-text-sec mt-0.5">
            Bounded profiling, schema discovery, dependency health, and typed mappings for 65 warehouse objects.
          </p>
          <div className="mt-2">
            <Link
              to="/warehouse"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-action/30 bg-selected-bg text-action text-[11px] font-medium hover:bg-selected-bg transition-colors"
            >
              <Play size={10} />
              <span>Open Cloud Warehouse &amp; Live Data Puller →</span>
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap rounded-lg border border-border-subtle bg-surface-sec p-0.5 text-xs">
          <button
            type="button"
            onClick={() => handleTabChange('readiness')}
            className={`px-3 py-1 font-medium rounded transition-colors ${activeTab === 'readiness' ? 'bg-surface text-action  font-semibold' : 'text-text-sec hover:text-text-main'}`}
          >
            Readiness &amp; Health
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('profiler')}
            className={`px-3 py-1 font-medium rounded transition-colors ${activeTab === 'profiler' ? 'bg-surface text-action  font-semibold' : 'text-text-sec hover:text-text-main'}`}
          >
            Raw Profiler
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('ontact')}
            className={`px-3 py-1 font-medium rounded transition-colors ${activeTab === 'ontact' ? 'bg-surface text-action  font-semibold' : 'text-text-sec hover:text-text-main'}`}
          >
            ONtact Dialler
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('onvest')}
            className={`px-3 py-1 font-medium rounded transition-colors ${activeTab === 'onvest' ? 'bg-surface text-action  font-semibold' : 'text-text-sec hover:text-text-main'}`}
          >
            ONvest Stages
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('inventory')}
            className={`px-3 py-1 font-medium rounded transition-colors ${activeTab === 'inventory' ? 'bg-surface text-action  font-semibold' : 'text-text-sec hover:text-text-main'}`}
          >
            Inventory ({formatTableNumber(inventory?.totalObjects)})
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('mappings')}
            className={`px-3 py-1 font-medium rounded transition-colors ${activeTab === 'mappings' ? 'bg-surface text-action  font-semibold' : 'text-text-sec hover:text-text-main'}`}
          >
            Mappings &amp; Spend
          </button>
        </div>
      </header>

      {error && (
        <div className="cx-command-error flex items-center gap-2 p-3 bg-semantic-neg-bg text-semantic-neg rounded border border-semantic-neg/30 text-xs">
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
                <div className="p-3 bg-surface-sec rounded border border-border-subtle">
                  <span className="text-text-mute text-[11px] block">Total Sources</span>
                  <strong className="text-base font-bold text-text-main">{readiness.totalSources}</strong>
                  <span className="text-[10px] text-text-mute block mt-0.5">2 Projects, 4 Datasets</span>
                </div>
                <div className="p-3 bg-semantic-pos-bg rounded border border-semantic-pos/30">
                  <span className="text-semantic-pos text-[11px] block">Sample Export Success</span>
                  <strong className="text-base font-bold text-semantic-pos">{readiness.successfulSources}</strong>
                  <span className="text-[10px] text-semantic-pos block mt-0.5">Tables &amp; direct views</span>
                </div>
                <div className="p-3 bg-semantic-neg-bg rounded border border-semantic-neg/30">
                  <span className="text-semantic-neg text-[11px] block">Dependency Restricted</span>
                  <strong className="text-base font-bold text-semantic-neg">{readiness.restrictedSources}</strong>
                  <span className="text-[10px] text-semantic-neg block mt-0.5">External upstream ACLs</span>
                </div>
                <div className="p-3 bg-surface-sec rounded border border-border-subtle">
                  <span className="text-text-mute text-[11px] block">Execution Identity</span>
                  <strong className="text-xs font-mono font-semibold text-text-main truncate block mt-1">
                    {readiness.jobExecutionIdentity}
                  </strong>
                  <span className="text-[10px] text-text-mute block mt-0.5">Target BigQuery Job</span>
                </div>
                <div className="p-3 bg-surface-sec rounded border border-border-subtle">
                  <span className="text-text-mute text-[11px] block">Snapshot Date</span>
                  <strong className="text-xs font-mono font-semibold text-text-main block mt-1">
                    {readiness.manifest.exportedAt.slice(0, 10)}
                  </strong>
                  <span className="text-[10px] text-text-mute block mt-0.5">Bulk export handover</span>
                </div>
              </div>

              <div className="p-3 bg-selected-bg rounded border border-action/30 text-text-sec flex items-start gap-2">
                <Shield size={16} className="text-action mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">Historical Export Notice &amp; Dependency Governance</p>
                  <p className="text-[11px] text-text-sec leading-relaxed">
                    {readiness.manifest.note} All 8 dedicated tenant views in <code>lead_ledger</code> failed during the 2026-09-27 bulk export due to missing query permissions on external datasets (<code>offernet-dmp:external_data_echos</code> and <code>offernet-dmp:hot_lead_connect</code>). Data owners must configure authorized views or grant <code>roles/bigquery.dataViewer</code> to resolve.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="inline-flex rounded-lg border border-border-subtle bg-surface-sec p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setReadinessFilter('ALL')}
                    className={`px-2.5 py-1 rounded transition-colors ${readinessFilter === 'ALL' ? 'bg-surface text-action  font-semibold' : 'text-text-sec'}`}
                  >
                    All ({readiness.totalSources})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReadinessFilter('SUCCESS')}
                    className={`px-2.5 py-1 rounded transition-colors ${readinessFilter === 'SUCCESS' ? 'bg-surface text-semantic-pos  font-semibold' : 'text-text-sec'}`}
                  >
                    Export Success ({readiness.successfulSources})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReadinessFilter('RESTRICTED')}
                    className={`px-2.5 py-1 rounded transition-colors ${readinessFilter === 'RESTRICTED' ? 'bg-surface text-semantic-neg  font-semibold' : 'text-text-sec'}`}
                  >
                    Restricted ({readiness.restrictedSources})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={loadingReadiness}
                    onClick={loadReadiness}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-border-subtle rounded hover:bg-surface-sec text-text-sec"
                  >
                    <RefreshCw size={13} className={loadingReadiness ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-border-subtle rounded max-h-96">
                <table className="w-full text-left text-xs divide-y divide-border-subtle">
                  <thead className="bg-surface-sec sticky top-0 font-semibold text-text-sec">
                    <tr>
                      <th className="p-2.5">Source Key</th>
                      <th className="p-2.5">Type &amp; Grain</th>
                      <th className="p-2.5">Historical Export</th>
                      <th className="p-2.5">Upstream Dependency / Action</th>
                      <th className="p-2.5 text-right">Application Probe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-[11px]">
                    {filteredSources.map((item, idx) => {
                      const probe = probeResults[item.key];
                      const isProbing = probingKey === item.key;
                      return (
                        <tr key={idx} className="hover:bg-surface-sec">
                          <td className="p-2.5 font-mono">
                            <span className="font-semibold text-text-main block truncate max-w-xs">{item.tableName}</span>
                            <span className="text-[10px] text-text-mute">{item.project}.{item.dataset}</span>
                          </td>
                          <td className="p-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono mr-1.5 ${item.tableType === 'TABLE' ? 'bg-selected-bg text-action border border-action/30' : 'bg-surface-sec text-text-sec'}`}>
                              {item.tableType}
                            </span>
                            <span className="text-text-sec text-[10px]">{item.analyticalGrain}</span>
                          </td>
                          <td className="p-2.5">
                            {item.historicalExport.status === 'SUCCESS' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-semantic-pos-bg text-semantic-pos border border-semantic-pos/30 font-semibold">
                                <CheckCircle size={12} className="text-semantic-pos" />
                                <span>Exported ({item.historicalExport.rowsExported} rows)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-semantic-neg-bg text-semantic-neg border border-semantic-neg/30 font-semibold">
                                <XCircle size={12} className="text-semantic-neg" />
                                <span>Export Restricted</span>
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 max-w-xs">
                            {item.historicalExport.failingDependency ? (
                              <div className="space-y-0.5">
                                <span className="font-mono text-[10px] text-semantic-neg truncate block">
                                  {item.historicalExport.failingDependency}
                                </span>
                                <span className="text-[10px] text-text-sec block">
                                  {item.historicalExport.ownerActionRequired}
                                </span>
                              </div>
                            ) : (
                              <span className="text-text-mute text-[10px]">No upstream dependency failure</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right whitespace-nowrap">
                            {probe ? (
                              <div className="inline-flex flex-col items-end">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${probe.status === 'ACCESSIBLE' ? 'bg-semantic-pos-bg text-semantic-pos' : 'bg-semantic-neg-bg text-semantic-neg'}`}>
                                  {probe.status} ({probe.probeDurationMs}ms)
                                </span>
                                {probe.error && (
                                  <span className="text-[10px] text-semantic-neg truncate max-w-[180px] block" title={probe.error}>
                                    {probe.error}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={!isAdmin || isProbing}
                                onClick={() => handleProbeSource(item.key)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-surface-sec hover:bg-surface-sec text-text-sec rounded text-[10px] font-medium disabled:opacity-50"
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
            <div className="p-6 text-center text-text-mute">
              {loadingReadiness ? 'Loading source readiness snapshot…' : 'No readiness data loaded.'}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RAW PROFILER */}
      {activeTab === 'profiler' && (
        <div className="space-y-4">
          <div className="bg-surface-sec p-4 rounded-lg border border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="cx-intake-source-field space-y-1">
              <label htmlFor="source-select" className="text-xs font-semibold text-text-sec block">
                Select Raw Warehouse Source:
              </label>
              <select
                id="source-select"
                value={selectedSource}
                onChange={e => setSelectedSource(e.target.value)}
                className="text-xs font-mono bg-surface border border-control-border rounded px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-action"
              >
                <option value="vibe-code-warren-stear.analytics_warehouse.ontact_raw_data">
                  vibe-code-warren-stear.analytics_warehouse.ontact_raw_data (JSON - 39k)
                </option>
                <option value="vibe-code-warren-stear.analytics_warehouse.onvest_raw_data">
                  vibe-code-warren-stear.analytics_warehouse.onvest_raw_data (JSON - 1.5k)
                </option>
                <option value="dashboards-422710.vibe_coding_data.tbl_vibe_code_warren_stear_ontact_analytics_api">
                  dashboards-422710.vibe_coding_data.tbl_vibe_code_warren_stear_ontact_analytics_api (TABLE - 71k)
                </option>
                <option value="dashboards-422710.vibe_coding_data.tbl_offershop_lead_ledger">
                  dashboards-422710.vibe_coding_data.tbl_offershop_lead_ledger (TABLE - 62k)
                </option>
                <option value="dashboards-422710.vibe_coding_data.tbl_vibe_code_warren_stear_ontact_ofline_data">
                  dashboards-422710.vibe_coding_data.tbl_vibe_code_warren_stear_ontact_ofline_data (TABLE - 3.9k)
                </option>
              </select>
            </div>
            <button
              type="button"
              disabled={profiling || !isAdmin}
              onClick={handleRunProfile}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 cx-button-primary rounded font-medium text-xs disabled:opacity-50 transition-colors"
            >
              {profiling ? <div className="cx-command-spinner mr-1" /> : <Play size={14} />}
              <span>{profiling ? 'Profiling bounded sample…' : 'Run Bounded Profile'}</span>
            </button>
          </div>

          {!isAdmin && (
            <div className="cx-command-panel p-3 bg-semantic-warn-bg border-semantic-warn/30 text-xs text-semantic-warn flex items-center gap-2">
              <Lock size={15} />
              <span>Administrative privileges are required to initiate raw warehouse profiling jobs.</span>
            </div>
          )}

          {profileResult && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-surface-sec p-3 rounded border border-border-subtle">
                  <span className="text-text-mute block text-[11px]">Source Status</span>
                  <strong className={`font-semibold ${profileResult.status === 'PROFILED' ? 'text-semantic-pos' : 'text-semantic-neg'}`}>
                    {profileResult.status}
                  </strong>
                </div>
                <div className="bg-surface-sec p-3 rounded border border-border-subtle">
                  <span className="text-text-mute block text-[11px]">Timestamp Semantics</span>
                  <strong className="font-semibold text-text-main">
                    {profileResult.outerTimestampSemantics}
                  </strong>
                </div>
                <div className="bg-surface-sec p-3 rounded border border-border-subtle">
                  <span className="text-text-mute block text-[11px]">Top-level Shape</span>
                  <strong className="font-semibold text-text-main">
                    {profileResult.jsonStructureFindings.topLevelShape}
                  </strong>
                </div>
                <div className="bg-surface-sec p-3 rounded border border-border-subtle">
                  <span className="text-text-mute block text-[11px]">Envelope Hypothesis</span>
                  <strong className="font-semibold text-text-main">
                    {profileResult.jsonStructureFindings.envelopeType}
                  </strong>
                </div>
              </div>

              {profileResult.dependencies.length > 0 && (
                <div className="p-3 bg-surface-sec rounded border border-border-subtle text-xs space-y-1">
                  <span className="font-semibold text-text-sec flex items-center gap-1.5">
                    <Shield size={14} className="text-semantic-warn" />
                    <span>Access &amp; Deployment Dependencies:</span>
                  </span>
                  <ul className="list-disc list-inside text-text-sec pl-1">
                    {profileResult.dependencies.map((dep, idx) => (
                      <li key={idx}>{dep}</li>
                    ))}
                  </ul>
                </div>
              )}

              {profileResult.topLevelKeys.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-text-main">Detected Payload Keys (Redacted)</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {profileResult.topLevelKeys.map((item, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-sec text-text-main border border-border-subtle">
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
                <div className="p-3 bg-surface-sec rounded border border-border-subtle">
                  <span className="text-text-mute text-[11px] block">Total Observations</span>
                  <strong className="text-base font-bold text-text-main">{ontact.totalObservations}</strong>
                  <span className="text-[10px] text-text-mute block mt-0.5 font-mono">{ontact.evidenceMode}</span>
                </div>
                <div className="p-3 bg-surface-sec rounded border border-border-subtle">
                  <span className="text-text-mute text-[11px] block">Avg Duration</span>
                  <strong className="text-base font-bold text-text-main">{ontact.averageDurationSec}s</strong>
                  <span className="text-[10px] text-text-mute block mt-0.5">Recorded length_in_sec</span>
                </div>
                <div className="p-3 bg-semantic-pos-bg rounded border border-semantic-pos/30">
                  <span className="text-semantic-pos text-[11px] block">Duration Verified</span>
                  <strong className="text-base font-bold text-semantic-pos">
                    {ontact.timingValidation.durationVerificationRatePct}%
                  </strong>
                  <span className="text-[10px] text-semantic-pos block mt-0.5">
                    {ontact.timingValidation.durationVerifiedCount} / {ontact.totalObservations} rows
                  </span>
                </div>
                <div className="p-3 bg-semantic-warn-bg rounded border border-semantic-warn/30">
                  <span className="text-semantic-warn text-[11px] block">Status Disagreements</span>
                  <strong className="text-base font-bold text-semantic-warn">
                    {ontact.timingValidation.statusDisagreementRatePct}%
                  </strong>
                  <span className="text-[10px] text-semantic-warn block mt-0.5">
                    status ≠ call_result ({ontact.timingValidation.statusDisagreementCount} rows)
                  </span>
                </div>
              </div>

              <div className="p-3 bg-surface-sec rounded border border-border-subtle text-text-sec flex items-start gap-2">
                <Clock size={16} className="text-action mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">Timing &amp; Identity Constraints</p>
                  <p className="text-[11px] text-text-sec leading-relaxed">
                    {ontact.timingValidation.note} {ontact.countingBasis}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-surface-sec rounded border border-border-subtle space-y-2">
                  <h4 className="font-bold text-text-main">Status Code Breakdown</h4>
                  <ul className="divide-y divide-border-subtle font-mono text-[11px]">
                    {ontact.statusBreakdown.map((item, idx) => (
                      <li key={idx} className="py-1.5 flex justify-between">
                        <span className="text-text-sec">{item.status}</span>
                        <span className="font-semibold text-text-main">{item.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-surface-sec rounded border border-border-subtle space-y-2">
                  <h4 className="font-bold text-text-main">Call Result Breakdown</h4>
                  <ul className="divide-y divide-border-subtle font-mono text-[11px]">
                    {ontact.callResultBreakdown.map((item, idx) => (
                      <li key={idx} className="py-1.5 flex justify-between">
                        <span className="text-text-sec">{item.result}</span>
                        <span className="font-semibold text-text-main">{item.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-3 bg-surface-sec rounded border border-border-subtle space-y-2">
                <h4 className="font-bold text-text-main">Campaign &amp; List Partitions</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-mono">
                  <div>
                    <span className="text-text-mute block text-[10px] mb-1 font-sans">Campaign IDs:</span>
                    {ontact.campaignBreakdown.map((c, i) => (
                      <div key={i} className="flex justify-between py-0.5">
                        <span>{c.campaignId}</span>
                        <span className="font-semibold">{c.count}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <span className="text-text-mute block text-[10px] mb-1 font-sans">List IDs:</span>
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
            <div className="p-6 text-center text-text-mute">
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
                <div className="p-3 bg-surface-sec rounded border border-border-subtle">
                  <span className="text-text-mute text-[11px] block">Reports Processed</span>
                  <strong className="text-base font-bold text-text-main">{onvest.totalReportsCount}</strong>
                  <span className="text-[10px] text-text-mute block mt-0.5">{onvest.datesCoveredCount} distinct dates</span>
                </div>
                <div className="p-3 bg-surface-sec rounded border border-border-subtle">
                  <span className="text-text-mute text-[11px] block">Client-Scoped Tenant</span>
                  <strong className="text-base font-mono font-bold text-text-main truncate block mt-0.5">
                    {onvest.clientScopedTenant}
                  </strong>
                  <span className="text-[10px] text-text-mute block mt-0.5">Tenant boundary enforced</span>
                </div>
                <div className="p-3 bg-semantic-warn-bg rounded border border-semantic-warn/30">
                  <span className="text-semantic-warn text-[11px] block">Reported Amount Spent</span>
                  <strong className="text-base font-mono font-bold text-semantic-warn">
                    {onvest.spendDiagnostics.rawAmountSpentSum}
                  </strong>
                  <span className="text-[10px] text-semantic-warn block mt-0.5">
                    Currency: {onvest.spendDiagnostics.currencyStatus}
                  </span>
                </div>
                <div className="p-3 bg-surface-sec rounded border border-border-subtle">
                  <span className="text-text-mute text-[11px] block">Reach Policy</span>
                  <strong className="text-xs font-semibold text-text-main block mt-1">Non-Additive</strong>
                  <span className="text-[10px] text-text-mute block mt-0.5">Audience overlap prevented</span>
                </div>
              </div>

              {/* Aligned independent stage comparison */}
              <div className="p-4 bg-surface-sec rounded-lg border border-border-subtle space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h4 className="font-bold text-text-main flex items-center gap-1.5">
                    <BarChart2 size={15} className="text-action" />
                    <span>Independent Stage Comparison (No Funnel Clamp)</span>
                  </h4>
                  <span className="text-[10px] text-text-mute">Source: offershop aggregate pipeline</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 bg-surface rounded border border-border-subtle">
                    <span className="text-text-mute text-[11px] block">Fetched Leads</span>
                    <strong className="text-sm font-bold text-text-main">{onvest.stageComparison.fetchedLeads}</strong>
                  </div>
                  <div className="p-2.5 bg-surface rounded border border-border-subtle">
                    <span className="text-text-mute text-[11px] block">Qualified Leads</span>
                    <strong className="text-sm font-bold text-text-main">{onvest.stageComparison.qualifiedLeads}</strong>
                  </div>
                  <div className="p-2.5 bg-surface rounded border border-border-subtle">
                    <span className="text-text-mute text-[11px] block">Accepted Leads</span>
                    <strong className="text-sm font-bold text-text-main">{onvest.stageComparison.acceptedLeads}</strong>
                  </div>
                  <div className="p-2.5 bg-surface rounded border border-border-subtle">
                    <span className="text-text-mute text-[11px] block">Valid Phone IDs</span>
                    <strong className="text-sm font-bold text-text-main">{onvest.stageComparison.validPhoneId}</strong>
                  </div>
                </div>

                <div className="p-2.5 bg-semantic-warn-bg rounded border border-semantic-warn/30 text-semantic-warn text-[11px] flex items-start gap-1.5">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-semantic-warn" />
                  <span>{onvest.stageComparison.note}</span>
                </div>
              </div>

              <div className="p-3 bg-surface-sec rounded border border-border-subtle space-y-2">
                <h4 className="font-bold text-text-main">Offershop Sources Breakdown</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-border-subtle">
                    <thead className="bg-surface-sec font-semibold text-text-sec">
                      <tr>
                        <th className="p-2">Source Domain</th>
                        <th className="p-2">Reports</th>
                        <th className="p-2">Sample Dates</th>
                        <th className="p-2 text-right">Fetched</th>
                        <th className="p-2 text-right">Qualified</th>
                        <th className="p-2 text-right">Accepted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle font-mono text-[11px]">
                      {onvest.sourcesBreakdown.map((s, idx) => (
                        <tr key={idx} className="hover:bg-surface-sec">
                          <td className="p-2 font-semibold text-text-main">{s.source}</td>
                          <td className="p-2 text-text-sec">{s.reportsCount}</td>
                          <td className="p-2 text-text-mute text-[10px]">{s.sampleReportDates.join(', ')}</td>
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
            <div className="p-6 text-center text-text-mute">
              {loadingOnvest ? 'Loading ONvest touchpoint stages…' : 'No ONvest touchpoint data loaded.'}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SOURCE INVENTORY */}
      {activeTab === 'inventory' && inventory && (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-surface-sec rounded border border-border-subtle">
              <span className="text-text-mute text-[11px] block">Total Declared Objects</span>
              <strong className="text-sm font-bold text-text-main">{inventory.totalObjects}</strong>
            </div>
            <div className="p-3 bg-surface-sec rounded border border-border-subtle">
              <span className="text-text-mute text-[11px] block">Physical Tables</span>
              <strong className="text-sm font-bold text-text-main">{formatTableNumber(inventory.tableTypeCounts.TABLE)}</strong>
            </div>
            <div className="p-3 bg-surface-sec rounded border border-border-subtle">
              <span className="text-text-mute text-[11px] block">Views / Pipelines</span>
              <strong className="text-sm font-bold text-text-main">{formatTableNumber(inventory.tableTypeCounts.VIEW)}</strong>
            </div>
            <div className="p-3 bg-surface-sec rounded border border-border-subtle">
              <span className="text-text-mute text-[11px] block">Raw JSON Sources</span>
              <strong className="text-sm font-bold text-text-main">{inventory.rawJsonSources.length}</strong>
            </div>
          </div>

          <div className="overflow-x-auto max-h-72 border border-border-subtle rounded">
            <table className="w-full text-left text-xs divide-y divide-border-subtle">
              <thead className="bg-surface-sec sticky top-0 font-semibold text-text-sec">
                <tr>
                  <th className="p-2">Dataset</th>
                  <th className="p-2">Object Name</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Family</th>
                  <th className="p-2">Disposition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle font-mono text-[11px]">
                {inventory.objects.map((obj, i) => (
                  <tr key={i} className="hover:bg-surface-sec">
                    <td className="p-2 text-text-sec">{obj.dataset}</td>
                    <td className="p-2 font-semibold text-text-main">{obj.tableName}</td>
                    <td className="p-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${obj.tableType === 'TABLE' ? 'bg-selected-bg text-action' : 'bg-surface-sec text-text-sec'}`}>
                        {obj.tableType}
                      </span>
                    </td>
                    <td className="p-2 text-text-sec">{obj.family}</td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-sec text-text-sec">
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
            <h4 className="font-bold text-text-main">Approved Versioned Mappings</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mappings.activeMappings.map((m, idx) => (
                <div key={idx} className="p-3 bg-surface-sec rounded border border-border-subtle space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="font-semibold text-text-main">{m.mappingVersion}</strong>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-semantic-pos-bg text-semantic-pos font-bold">
                      {m.status}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-text-sec truncate">{m.sourceId}</p>
                  <p className="text-text-sec text-[11px]">
                    Record Boundary: <code className="text-text-main">{m.recordBoundary}</code> · Ownership: <code className="text-text-main">{m.tenantOwnership.strategy}</code>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border-subtle">
            <h4 className="font-bold text-text-main">Candidate Spend Streams (Double-Count Prevention)</h4>
            <p className="text-text-sec text-[11px]">
              8 tables contain Amount_Spent; exactly one authoritative spend source is approved per tenant/date window:
            </p>
            <ul className="divide-y divide-border-subtle border border-border-subtle rounded font-mono text-[11px] max-h-48 overflow-y-auto">
              {mappings.candidateSpendSources.map((source, idx) => (
                <li key={idx} className="p-2 hover:bg-surface-sec flex items-center justify-between">
                  <span className="text-text-main truncate">{source}</span>
                  <span className="text-[10px] text-text-mute font-sans">Evaluated &amp; Isolated</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
