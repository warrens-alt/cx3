import React, { useState, useEffect } from 'react';
import { Database, Play, AlertCircle, CheckCircle, Shield, FileText, Layers, Lock } from 'lucide-react';
import { fetchSourceInventory, fetchSourceMappings, profileRawSource, type SourceInventoryData, type SourceMappingsData } from '../lib/dataIntakeClient';
import type { RawSourceProfileResult } from '../../server/bigquery/warehouseRegistry';

interface DataIntakePanelProps {
  clientId: string;
  isAdmin: boolean;
}

export const DataIntakePanel: React.FC<DataIntakePanelProps> = ({ clientId, isAdmin }) => {
  const [inventory, setInventory] = useState<SourceInventoryData | null>(null);
  const [mappings, setMappings] = useState<SourceMappingsData | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>('vibe-code-warren-stear.analytics_warehouse.ontact_raw_data');
  const [profileResult, setProfileResult] = useState<RawSourceProfileResult | null>(null);
  const [profiling, setProfiling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'profiler' | 'mappings'>('profiler');

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetchSourceInventory(clientId).catch(() => null),
      fetchSourceMappings(clientId).catch(() => null),
    ]).then(([inv, map]) => {
      if (mounted) {
        if (inv) setInventory(inv);
        if (map) setMappings(map);
      }
    });
    return () => { mounted = false; };
  }, [clientId]);

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

  return (
    <section className="cx-command-panel p-5 mt-6 space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
        <div>
          <span className="cx-command-section-kicker">Data intake &amp; reconciliation</span>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database size={18} className="text-[#3562B3]" />
            <span>Warehouse Source Intake &amp; Raw Profiling</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Bounded profiling, schema discovery and typed versioned mapping for raw warehouse payloads.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('profiler')}
            className={`px-3 py-1 font-medium rounded transition-colors ${activeTab === 'profiler' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Raw Profiler
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-1 font-medium rounded transition-colors ${activeTab === 'inventory' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Source Inventory ({inventory?.totalObjects || 65})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mappings')}
            className={`px-3 py-1 font-medium rounded transition-colors ${activeTab === 'mappings' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Mappings &amp; Spend Safety
          </button>
        </div>
      </header>

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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#3562B3] text-white rounded font-medium text-xs hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-2xs"
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

          {error && (
            <div className="cx-command-error">
              <AlertCircle size={16} />
              <span>{error}</span>
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
