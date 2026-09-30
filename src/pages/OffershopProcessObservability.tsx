import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  GitFork, ShieldCheck, AlertTriangle, ArrowRight, CheckCircle2, Clock3,
  Search, Sliders, Database, Layers, RefreshCw, Info, ExternalLink,
  ChevronRight, Building2, PhoneCall, HelpCircle, Activity, PlayCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useClient } from '../lib/ClientContext';
import { useAuth } from '../lib/AuthContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import OperationalPageHeader from '../components/OperationalPageHeader';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import UnifiedMetricCard from '../components/UnifiedMetricCard';
import RootCauseDrawer from '../components/RootCauseDrawer';
import { formatTableNumber, formatPercent } from '../lib/formatters';
import { useOperationalData } from '../lib/useOperationalData';
import { fetchOffershopFlow, simulateOffershopRule } from '../lib/offernetClient';
import type { OffershopProcessOverview, StageObservabilityData } from '../../server/analytics/process/offershopProcess';
import { OffershopProcessDiagram } from '../components/offershop/OffershopProcessDiagram';
import {
  OFFERSHOP_PARTNER_CONFIGS,
  CONSUMER_HOSPITAL_TAGS,
  type OffershopPartner,
  type OffershopProcessFamily,
  type ReadOnlyRuleSimulationResult,
} from '../../contracts/offershopProcess';

type TabId = 'flow' | 'partners' | 'hospital' | 'matrix' | 'tedi' | 'simulation';

export default function OffershopProcessObservability() {
  const { selectedClient, clientConfig } = useClient();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters } = useFilters();
  const [rootMetric, setRootMetric] = useState<string | null>(null);
  const [rootMetricLabel, setRootMetricLabel] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<TabId>('flow');
  const [selectedFamily, setSelectedFamily] = useState<OffershopProcessFamily | 'all'>('all');
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixStatusFilter, setMatrixStatusFilter] = useState<string>('all');
  const [selectedStageDetail, setSelectedStageDetail] = useState<OffershopProcessFamily | null>('acquisition');
  const [flowViewMode, setFlowViewMode] = useState<'graph' | 'grid'>('graph');

  // Simulation state
  const [simPartner, setSimPartner] = useState<OffershopPartner>('mondo');
  const [simDuplicateHours, setSimDuplicateHours] = useState<number>(240);
  const [simColourRule, setSimColourRule] = useState<'GreenOnly' | 'GreenAndAmber' | 'All'>('GreenAndAmber');
  const resultScope = JSON.stringify([selectedClient, startDate, endDate, filters, simPartner, simDuplicateHours, simColourRule]);
  const requestVersion = useRef(0);
  const currentResultScope = useRef(resultScope);
  currentResultScope.current = resultScope;
  const [simResultState, setSimResult] = useState<{ scope: string; value: ReadOnlyRuleSimulationResult } | null>(null);
  const simResult = simResultState?.scope === resultScope ? simResultState.value : null;
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  const queryParams = useMemo(() => ({
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }), [selectedClient, startDate, endDate, filters]);

  const { data, loading, error, loadData } = useOperationalData<OffershopProcessOverview>(
    'OffershopProcessObservability',
    queryParams,
    fetchOffershopFlow
  );

  useEffect(() => { requestVersion.current += 1; setSimResult(null); setSimError(null); setSimLoading(false); }, [resultScope]);

  const runSimulation = async () => {
    const requestScope = resultScope;
    const version = ++requestVersion.current;
    setSimResult(null);
    setSimLoading(true);
    setSimError(null);
    try {
      const res = await simulateOffershopRule({
        partner: simPartner,
        hypotheticalDuplicateWindowHours: simDuplicateHours,
        hypotheticalColourRule: simColourRule,
        simulationScope: {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      }, queryParams);
      if (currentResultScope.current === requestScope && requestVersion.current === version) setSimResult({ scope: requestScope, value: res });
    } catch (err: any) {
      if (currentResultScope.current === requestScope && requestVersion.current === version) setSimError(err.message || 'Simulation execution failed');
    } finally {
      if (currentResultScope.current === requestScope && requestVersion.current === version) setSimLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'MAPPED':
        return <span className="text-emerald-700 font-medium">Mapped</span>;
      case 'DEPENDENCY_BLOCKED':
        return <span className="text-amber-800 font-medium">Dependency Blocked</span>;
      case 'MAPPING_REQUIRED':
        return <span className="text-blue-800 font-medium">Mapping Required</span>;
      case 'NOT_INSTRUMENTED':
      default:
        return <span className="text-slate-500 font-medium">Not Instrumented</span>;
    }
  };

  const allNodes = useMemo(() => {
    if (!data?.stages) return [];
    return Object.values(data.stages).flatMap(s => s.nodes);
  }, [data]);

  const filteredMatrixNodes = useMemo(() => {
    return allNodes.filter(node => {
      const matchesSearch = matrixSearch === '' ||
        node.nodeId.toLowerCase().includes(matrixSearch.toLowerCase()) ||
        node.originalLabel.toLowerCase().includes(matrixSearch.toLowerCase()) ||
        node.intendedRule.toLowerCase().includes(matrixSearch.toLowerCase()) ||
        (node.mappedTable && node.mappedTable.toLowerCase().includes(matrixSearch.toLowerCase()));

      const matchesStatus = matrixStatusFilter === 'all' || node.readiness === matrixStatusFilter;
      const matchesFamily = selectedFamily === 'all' || node.family === selectedFamily;

      return matchesSearch && matchesStatus && matchesFamily;
    });
  }, [allNodes, matrixSearch, matrixStatusFilter, selectedFamily]);

  return (
    <div className="cx-command-page cx-process-page">
      <OffernetFilterBar onRefresh={() => loadData(true)} />
      <div className="cx-command-content">
        <OperationalPageHeader
          eyebrow="Deal flow observability"
          title="Offershop Process Intelligence"
          description="End-to-end evidence tracking across Acquisition, Preparation & Validation, Consumer Hospital, Partner ROR, HLC Delivery, Dialler Execution, and TEDI Feedback."
          status="OBSERVED"
          statusLabel="Process Architecture V3"
          actions={
            <div className="flex items-center gap-2">
              <Link to="/vetting" className="cx-button-secondary">
                Vetting scorecards <ArrowRight size={13} />
              </Link>
              <Link to="/routing" className="cx-button-secondary">
                Routing intelligence <ArrowRight size={13} />
              </Link>
            </div>
          }
        />

        {error && <div className="cx-command-error"><AlertTriangle size={17} />{String(error)}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner" />Auditing Offershop deal flow…</div>}

        {data && (
          <>
            {/* Top Readiness Metrics Strip */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" aria-label="Process readiness metrics">
              <UnifiedMetricCard
                label="Total Diagram Nodes"
                value={data.readinessSummary.totalNodes}
                note="From Deal Flow V3 drawing"
                onWhyChanged={() => {
                  setRootMetric('fetchedLeads');
                  setRootMetricLabel('Diagram Architecture Nodes');
                }}
                onInspect={() => setActiveTab('matrix')}
                inspectLabel="Inspect matrix"
              />

              <UnifiedMetricCard
                label="Mapped"
                value={data.readinessSummary.mappedCount}
                note={`${data.readinessSummary.readinessPct}% of diagram branches`}
                onWhyChanged={() => {
                  setRootMetric('deliveryRate');
                  setRootMetricLabel('Mapped Branches');
                }}
                onInspect={() => setActiveTab('flow')}
                inspectLabel="Inspect flow"
              />

              <UnifiedMetricCard
                label="Dependency Blocked"
                value={data.readinessSummary.dependencyBlockedCount}
                note="Upstream table access denied"
                isPositiveGood={false}
                onWhyChanged={() => {
                  setRootMetric('deliveryRate');
                  setRootMetricLabel('Dependency Blocked Nodes');
                }}
                onInspect={() => setActiveTab('matrix')}
                inspectLabel="Inspect matrix"
              />

              <UnifiedMetricCard
                label="Mapping Required"
                value={data.readinessSummary.mappingRequiredCount}
                note="Awaiting schema definition"
                isPositiveGood={false}
                onWhyChanged={() => {
                  setRootMetric('deliveryRate');
                  setRootMetricLabel('Mapping Required Nodes');
                }}
                onInspect={() => setActiveTab('matrix')}
                inspectLabel="Inspect matrix"
              />

              <UnifiedMetricCard
                label="Not Instrumented"
                value={data.readinessSummary.notInstrumentedCount}
                note="Upstream execution only"
                isPositiveGood={false}
                onWhyChanged={() => {
                  setRootMetric('deliveryRate');
                  setRootMetricLabel('Not Instrumented Nodes');
                }}
                onInspect={() => setActiveTab('matrix')}
                inspectLabel="Inspect matrix"
              />
            </section>

            {/* Evidence Boundaries Disclaimer Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 space-y-1">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Info size={14} className="text-slate-500" />
                <span>Evidence Boundaries & Integrity Guardrails</span>
              </div>
              <p>
                The diagram documents intended processes, terminology, branches and example rules. Warehouse schemas show declared structure, not verified completeness.
                Unmapped diagram stages remain clearly flagged as <em>Not instrumented</em> or <em>Mapping required</em>.
                Safe analytics are surfaced for mapped stages without halting the platform.
              </p>
            </div>

            {/* Main Interactive Navigation Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('flow')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === 'flow' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Deal Flow Pipeline
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('partners')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === 'partners' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Partner ROR & Duplicate Rules
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('hospital')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === 'hospital' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Consumer Hospital Recovery
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('matrix')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === 'matrix' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Source-to-Process Matrix ({allNodes.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tedi')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === 'tedi' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                TEDI & Echo Reconciliation
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('simulation')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'simulation' ? 'bg-amber-100 text-amber-950 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders size={13} />
                <span>Read-Only Rule Simulator</span>
              </button>
            </div>

            {/* TAB 1: DEAL FLOW PIPELINE */}
            {activeTab === 'flow' && (
              <div className="space-y-6">
                <section className="cx-command-panel">
                  <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <span className="cx-command-section-kicker">Lifecycle Map</span>
                      <h2>Offershop Deal Flow Connected Process Logic</h2>
                      <p>How submissions move through acquisition, validation, recovery, partner ROR, HLC delivery, dialler calls and commercial activation.</p>
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 self-start sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => setFlowViewMode('graph')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          flowViewMode === 'graph'
                            ? 'bg-white text-slate-900 shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Process Logic Graph
                      </button>
                      <button
                        type="button"
                        onClick={() => setFlowViewMode('grid')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          flowViewMode === 'grid'
                            ? 'bg-white text-slate-900 shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Stage Cards
                      </button>
                    </div>
                  </header>

                  {flowViewMode === 'graph' ? (
                    <OffershopProcessDiagram
                      stages={data.stages}
                      selectedStage={selectedStageDetail}
                      onSelectStage={(family) => setSelectedStageDetail(family)}
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50/50 rounded-lg border border-slate-200">
                      {Object.entries(data.stages).map(([familyKey, stage]) => {
                        const isSelected = selectedStageDetail === familyKey;
                        return (
                          <div
                            key={familyKey}
                            onClick={() => setSelectedStageDetail(familyKey as OffershopProcessFamily)}
                            className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-white border-slate-900 shadow-sm ring-1 ring-slate-900/10'
                                : 'bg-white/80 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                              <span>{stage.nodes.length} nodes</span>
                              <span>{getStatusBadge(stage.readiness)}</span>
                            </div>
                            <h4 className="text-sm font-semibold text-slate-900 mb-1">{stage.title}</h4>
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{stage.description}</p>
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                              <span className="text-slate-500">Inspect stage</span>
                              <ChevronRight size={13} className="text-slate-400" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Selected Stage Detail Panel */}
                {selectedStageDetail && data.stages[selectedStageDetail] && (() => {
                  const currentStage = data.stages[selectedStageDetail];
                  return (
                    <section className="cx-command-panel">
                      <header>
                        <div>
                          <span className="cx-command-section-kicker">Stage Deep Dive</span>
                          <h2>{currentStage.title}</h2>
                          <p>{currentStage.description}</p>
                        </div>
                        <div>{getStatusBadge(currentStage.readiness)}</div>
                      </header>

                      {/* Stage Metrics Grid */}
                      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-50 rounded-lg border border-slate-200 mb-6">
                        {Object.entries(currentStage.observedMetrics).map(([k, v]) => (
                          <div key={k} className="p-3 bg-white rounded border border-slate-200">
                            <span className="text-xs text-slate-500 capitalize block mb-1">
                              {k.replace(/([A-Z])/g, ' $1').toLowerCase()}
                            </span>
                            <strong className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                              {typeof v === 'number' ? formatTableNumber(v) : String(v ?? '—')}
                            </strong>
                          </div>
                        ))}
                      </div>

                      {/* Stage Nodes Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                              <th className="py-2.5 px-3 font-medium">Node ID</th>
                              <th className="py-2.5 px-3 font-medium">Diagram Label</th>
                              <th className="py-2.5 px-3 font-medium">Intended Rule</th>
                              <th className="py-2.5 px-3 font-medium">Mapped Table / Source</th>
                              <th className="py-2.5 px-3 font-medium">Entity Grain</th>
                              <th className="py-2.5 px-3 font-medium">Readiness</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {currentStage.nodes.map(node => (
                              <tr key={node.nodeId} className="hover:bg-slate-50/80">
                                <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">{node.nodeId}</td>
                                <td className="py-2.5 px-3 font-medium text-slate-800">{node.originalLabel}</td>
                                <td className="py-2.5 px-3 text-slate-600 max-w-sm leading-relaxed">{node.intendedRule}</td>
                                <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">{node.mappedTable || 'Not mapped'}</td>
                                <td className="py-2.5 px-3 text-slate-600">{node.entityGrain}</td>
                                <td className="py-2.5 px-3 whitespace-nowrap">{getStatusBadge(node.readiness)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Stage Notes */}
                      {currentStage.notes.length > 0 && (
                        <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 space-y-1">
                          <strong className="text-slate-900 block font-medium">Architectural Invariants & Notes:</strong>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {currentStage.notes.map((note, idx) => (
                              <li key={idx}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </section>
                  );
                })()}
              </div>
            )}

            {/* TAB 2: PARTNER ROR & DUPLICATE RULES */}
            {activeTab === 'partners' && (
              <section className="cx-command-panel">
                <header>
                  <div>
                    <span className="cx-command-section-kicker">Qualification Matrix</span>
                    <h2>Partner ROR & Duplicate Rules</h2>
                    <p>Documented duplicate windows, duplicate actions, qualification criteria and warehouse view readiness per partner.</p>
                  </div>
                </header>

                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 mb-6">
                  <strong>Important Invariant:</strong> Partner paths are not assumed to be mutually exclusive. A lead can be eligible for multiple partner paths without those counts being additive unique leads.
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="py-2.5 px-3 font-medium">Partner</th>
                        <th className="py-2.5 px-3 font-medium">Duplicate Window</th>
                        <th className="py-2.5 px-3 font-medium">Duplicate Action</th>
                        <th className="py-2.5 px-3 font-medium">Dedicated View Status</th>
                        <th className="py-2.5 px-3 font-medium text-right">Eligible Leads</th>
                        <th className="py-2.5 px-3 font-medium text-right">Suppressed Leads</th>
                        <th className="py-2.5 px-3 font-medium text-right">HLC Delivered</th>
                        <th className="py-2.5 px-3 font-medium text-right">Reported Sales</th>
                        <th className="py-2.5 px-3 font-medium">Key Exclusions & Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.values(data.partnerSummary).map(partner => {
                        const cfg = OFFERSHOP_PARTNER_CONFIGS[partner.partnerId];
                        return (
                          <tr key={partner.partnerId} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                              {partner.displayName}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-800 whitespace-nowrap">
                              {partner.duplicateWindowText}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-mono text-slate-700">{partner.duplicateAction}</span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {getStatusBadge(partner.warehouseReadiness)}
                              {partner.failingDependency && (
                                <div className="text-[11px] text-amber-800 font-mono mt-0.5 truncate max-w-xs">
                                  {partner.failingDependency.split('.').pop()}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                              {partner.observedEligibleCount ? formatTableNumber(partner.observedEligibleCount) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                              {partner.observedSuppressedCount ? formatTableNumber(partner.observedSuppressedCount) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                              {partner.deliveredEpisodes ? formatTableNumber(partner.deliveredEpisodes) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                              {partner.reportedSales ? formatTableNumber(partner.reportedSales) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 max-w-xs">
                              {cfg?.specificExclusions.join('; ')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* TAB 3: CONSUMER HOSPITAL RECOVERY */}
            {activeTab === 'hospital' && (
              <div className="space-y-6">
                <section className="cx-command-panel">
                  <header>
                    <div>
                      <span className="cx-command-section-kicker">Consumer Hospital</span>
                      <h2>Identity Recovery & Re-entry Pipeline</h2>
                      <p>Handling invalid IDs, phone discrepancies, and reference matching back into qualification or terminal mortuary.</p>
                    </div>
                  </header>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <article className="p-3 bg-white rounded border border-slate-200">
                      <span className="text-xs text-slate-500 block mb-1">Total Hospital Entries</span>
                      <strong className="text-lg font-mono tabular-nums text-slate-900">
                        {formatTableNumber(data.consumerHospitalSummary.hospitalEntries)}
                      </strong>
                      <div className="text-[11px] text-slate-500 mt-1">Failed initial Luhn/Phone check</div>
                    </article>
                    <article className="p-3 bg-white rounded border border-slate-200">
                      <span className="text-xs text-slate-500 block mb-1">Recovered & Returned</span>
                      <strong className="text-lg font-mono tabular-nums text-emerald-700">
                        {formatTableNumber(data.consumerHospitalSummary.hospitalRecovered)}
                      </strong>
                      <div className="text-[11px] text-slate-500 mt-1">Returned to qualification waterfall</div>
                    </article>
                    <article className="p-3 bg-white rounded border border-slate-200">
                      <span className="text-xs text-slate-500 block mb-1">Recovery Success Rate</span>
                      <strong className="text-lg font-mono tabular-nums text-slate-900">
                        {data.consumerHospitalSummary.hospitalEntries && data.consumerHospitalSummary.hospitalRecovered != null
                          ? formatPercent(((data.consumerHospitalSummary.hospitalRecovered) / data.consumerHospitalSummary.hospitalEntries) * 100)
                          : '—'}
                      </strong>
                      <div className="text-[11px] text-slate-500 mt-1">Pipeline re-entry share</div>
                    </article>
                    <article className="p-3 bg-white rounded border border-slate-200">
                      <span className="text-xs text-slate-500 block mb-1">Terminal Morgue Outcomes</span>
                      <strong className="text-lg font-mono tabular-nums text-slate-600">
                        {formatTableNumber(data.consumerHospitalSummary.terminalMorgueCount)}
                      </strong>
                      <div className="text-[11px] text-slate-500 mt-1">Unresolved after retries</div>
                    </article>
                  </div>

                  {/* Recovery Directions Breakdown */}
                  <div className="mt-6 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900">Documented Recovery Directions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3.5 bg-white rounded-lg border border-slate-200">
                        <h4 className="text-xs font-semibold text-slate-900 mb-1">1. Phone-to-ID Recovery</h4>
                        <p className="text-xs text-slate-600 mb-2">Looks up format-verified national ID from historical verified records matching valid mobile number.</p>
                        <div className="text-[11px] text-slate-500">{data.consumerHospitalSummary.directions.phoneToId.note}</div>
                      </div>
                      <div className="p-3.5 bg-white rounded-lg border border-slate-200">
                        <h4 className="text-xs font-semibold text-slate-900 mb-1">2. ID-to-Phone Recovery</h4>
                        <p className="text-xs text-slate-600 mb-2">Queries active bureau contact history using format-valid national ID when submitted phone is disconnected or invalid.</p>
                        <div className="text-[11px] text-slate-500">{data.consumerHospitalSummary.directions.idToPhone.note}</div>
                      </div>
                      <div className="p-3.5 bg-white rounded-lg border border-slate-200">
                        <h4 className="text-xs font-semibold text-slate-900 mb-1">3. Name/Surname Reference Matching</h4>
                        <p className="text-xs text-slate-600 mb-2">Reconciles typographical transpositions and surname discrepancies against population registers.</p>
                        <div className="text-[11px] text-slate-500">{data.consumerHospitalSummary.directions.nameSurname.note}</div>
                      </div>
                    </div>
                  </div>

                  {/* Hospital Outcome Tags Distribution */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-900">Documented Recovery Outcome Tags</h3>
                      <span className="text-xs text-slate-500">Source outcomes, not confidence probabilities</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {CONSUMER_HOSPITAL_TAGS.map(tag => {
                        const count = data.consumerHospitalSummary.tagsObserved[tag];
                        return (
                          <div key={tag} className="p-3 bg-white rounded border border-slate-200 text-center">
                            <span className="font-mono text-xs font-semibold text-slate-800 block truncate">{tag}</span>
                            <strong className="text-base font-mono tabular-nums text-slate-900 block mt-1">
                              {count !== null && count !== undefined ? formatTableNumber(count) : '—'}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* TAB 4: SOURCE-TO-PROCESS MATRIX */}
            {activeTab === 'matrix' && (
              <section className="cx-command-panel">
                <header>
                  <div>
                    <span className="cx-command-section-kicker">Architecture Catalog</span>
                    <h2>Source-to-Process Evidence Matrix</h2>
                    <p>Every node from the diagram mapped to warehouse objects, entity grains, timestamps, and readiness states.</p>
                  </div>
                </header>

                {/* Filters */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Search size={14} className="text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search node, label, table, rule…"
                      value={matrixSearch}
                      onChange={e => setMatrixSearch(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded bg-white w-64 text-slate-800"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Readiness:</span>
                    <select
                      value={matrixStatusFilter}
                      onChange={e => setMatrixStatusFilter(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800"
                    >
                      <option value="all">All statuses</option>
                      <option value="MAPPED">Mapped</option>
                      <option value="DEPENDENCY_BLOCKED">Dependency Blocked</option>
                      <option value="MAPPING_REQUIRED">Mapping Required</option>
                      <option value="NOT_INSTRUMENTED">Not Instrumented</option>
                    </select>

                    <span className="text-slate-500 ml-2">Family:</span>
                    <select
                      value={selectedFamily}
                      onChange={e => setSelectedFamily(e.target.value as any)}
                      className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800"
                    >
                      <option value="all">All families</option>
                      <option value="acquisition">Acquisition</option>
                      <option value="ingestion">Ingestion</option>
                      <option value="preparation_validation">Preparation & Validation</option>
                      <option value="consumer_hospital">Consumer Hospital</option>
                      <option value="partner_qualification">Partner Qualification</option>
                      <option value="hlc_delivery">HLC Delivery</option>
                      <option value="dialler_activity">Dialler Activity</option>
                      <option value="commercial_activation">Commercial & Activation</option>
                      <option value="tedi_feedback">TEDI Feedback</option>
                      <option value="advertising_feedback">Advertising Feedback</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="py-2.5 px-3 font-medium">Node ID</th>
                        <th className="py-2.5 px-3 font-medium">Diagram Label</th>
                        <th className="py-2.5 px-3 font-medium">Family</th>
                        <th className="py-2.5 px-3 font-medium">Intended Rule & Evidence</th>
                        <th className="py-2.5 px-3 font-medium">Mapped Table / Field</th>
                        <th className="py-2.5 px-3 font-medium">Entity Grain</th>
                        <th className="py-2.5 px-3 font-medium">Readiness</th>
                        <th className="py-2.5 px-3 font-medium">Dependencies / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMatrixNodes.map(node => (
                        <tr key={node.nodeId} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">{node.nodeId}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">{node.originalLabel}</td>
                          <td className="py-2.5 px-3 text-slate-600 capitalize">{node.family.replace('_', ' ')}</td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-sm leading-relaxed">{node.intendedRule}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {node.mappedTable || 'None'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{node.entityGrain}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">{getStatusBadge(node.readiness)}</td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-xs text-[11px]">
                            {node.unresolvedDependencies.length > 0
                              ? node.unresolvedDependencies.join('; ')
                              : node.notes}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* TAB 5: TEDI & ECHO RECONCILIATION */}
            {activeTab === 'tedi' && (
              <section className="cx-command-panel">
                <header>
                  <div>
                    <span className="cx-command-section-kicker">Reconciliation Feeds</span>
                    <h2>TEDI External Feedback & Echo Master Ingestion</h2>
                    <p>Scheduled file arrival, deduplication, warehouse loading, and monitoring statuses for external partner feeds.</p>
                  </div>
                </header>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 mb-6 space-y-1">
                  <div className="font-semibold text-slate-900">Monitoring Evidence Policy</div>
                  <p>
                    Documented schedules serve as reference metadata until approved against actual configuration.
                    Without direct monitoring evidence, feed status is designated <strong>Unknown</strong>, never assumed failed.
                    Underlying views in <code>dashboards-422710.lead_ledger</code> pointing to <code>offernet-dmp:external_data_echos</code> are recorded with their exact GCP permission blockers.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="py-2.5 px-3 font-medium">Partner</th>
                        <th className="py-2.5 px-3 font-medium">Feedback File Type</th>
                        <th className="py-2.5 px-3 font-medium">Expected Cadence</th>
                        <th className="py-2.5 px-3 font-medium">Scheduled Time (UTC)</th>
                        <th className="py-2.5 px-3 font-medium">Observed Status</th>
                        <th className="py-2.5 px-3 font-medium">Last Received</th>
                        <th className="py-2.5 px-3 font-medium">Last Loaded</th>
                        <th className="py-2.5 px-3 font-medium">Technical Evidence & Blockers</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.tediFeedbackSummary.schedules.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-semibold text-slate-900 uppercase">{item.partner.replace('_', ' ')}</td>
                          <td className="py-2.5 px-3 capitalize text-slate-800">{item.fileType}</td>
                          <td className="py-2.5 px-3 capitalize text-slate-600">{item.expectedCadence}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{item.expectedTimeUtc}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`font-medium ${
                              item.observedStatus === 'LOADED_UNMATCHED' ? 'text-amber-800' : 'text-slate-500'
                            }`}>
                              {item.observedStatus.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{item.lastReceivedTimestamp || '—'}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{item.lastLoadedTimestamp || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-sm text-[11px] leading-relaxed">{item.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* TAB 6: READ-ONLY RULE SIMULATOR */}
            {activeTab === 'simulation' && (
              <div className="space-y-6">
                {/* Mandatory Warning Banner */}
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg text-amber-950 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-sm text-amber-900">
                    <AlertTriangle size={16} className="text-amber-700" />
                    <span>READ-ONLY RULE SIMULATION MODE</span>
                  </div>
                  <p className="font-medium">
                    THIS IS A READ-ONLY RULE SIMULATION. RESULTS DO NOT REPRESENT OBSERVED PRODUCTION TRAFFIC AND ARE EXCLUDED FROM ACTUAL REPORTED METRICS.
                  </p>
                  <p className="text-amber-900/90">
                    This simulator allows testing hypothetical duplicate window durations or eligibility criteria without modifying any production lead-routing services, dialler records, or warehouse data.
                  </p>
                </div>

                <section className="cx-command-panel">
                  <header>
                    <div>
                      <span className="cx-command-section-kicker">Read-Only Experimentation</span>
                      <h2>Hypothetical Rule Scenario Simulator</h2>
                      <p>Model the volume impact of changing partner duplicate windows or vetting rules on historical cohorts.</p>
                    </div>
                  </header>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">Target Partner</label>
                      <select
                        value={simPartner}
                        onChange={e => {
                          const p = e.target.value as OffershopPartner;
                          setSimPartner(p);
                          setSimDuplicateHours(OFFERSHOP_PARTNER_CONFIGS[p].duplicateWindowHours);
                        }}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-900"
                      >
                        {Object.values(OFFERSHOP_PARTNER_CONFIGS).map(p => (
                          <option key={p.id} value={p.id}>
                            {p.displayName} (Baseline: {p.duplicateWindowText})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Hypothetical Duplicate Window ({simDuplicateHours} Hours)
                      </label>
                      <input
                        type="range"
                        min="12"
                        max="480"
                        step="12"
                        value={simDuplicateHours}
                        onChange={e => setSimDuplicateHours(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                        <span>12h</span>
                        <span>48h (2d)</span>
                        <span>168h (7d)</span>
                        <span>240h (10d)</span>
                        <span>480h (20d)</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">Colour Vetting Strictness</label>
                      <select
                        value={simColourRule}
                        onChange={e => setSimColourRule(e.target.value as any)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-900"
                      >
                        <option value="GreenAndAmber">Standard (Green & Amber Pass)</option>
                        <option value="GreenOnly">Strict (Green Only Pass)</option>
                        <option value="All">Permissive (Green, Amber & Red Pass)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end mb-6">
                    <button
                      type="button"
                      onClick={runSimulation}
                      disabled={simLoading}
                      className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                    >
                      <PlayCircle size={14} />
                      <span>{simLoading ? 'Simulating…' : 'Execute Read-Only Simulation'}</span>
                    </button>
                  </div>

                  {simError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded mb-4">
                      {simError}
                    </div>
                  )}

                  {simResult && (
                    <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div>
                          <span className="text-xs text-amber-800 font-semibold font-mono uppercase tracking-wide">
                            Simulation Output · Excluded From Observed Totals
                          </span>
                          <h4 className="text-sm font-semibold text-slate-900">
                            Partner: {OFFERSHOP_PARTNER_CONFIGS[simResult.partner].displayName}
                          </h4>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">
                          Simulated at {new Date(simResult.simulatedAt).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-3 bg-slate-50 rounded">
                          <span className="text-xs text-slate-500 block mb-1">Observed Baseline</span>
                          <strong className="text-base font-mono tabular-nums text-slate-800">
                            {formatTableNumber(simResult.observedBaselineCount)}<small className="block text-xs font-normal text-text-sec">{simResult.reason}</small>
                          </strong>
                          <div className="text-[11px] text-slate-500 mt-0.5">Historical period</div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded">
                          <span className="text-xs text-slate-500 block mb-1">Simulated Eligible Leads</span>
                          <strong className="text-base font-mono tabular-nums text-emerald-700">
                            {formatTableNumber(simResult.simulatedEligibleCount)}
                          </strong>
                          <div className="text-[11px] text-slate-500 mt-0.5">Under hypothetical rules</div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded">
                          <span className="text-xs text-slate-500 block mb-1">Simulated Suppressed Leads</span>
                          <strong className="text-base font-mono tabular-nums text-slate-600">
                            {formatTableNumber(simResult.simulatedSuppressedCount)}
                          </strong>
                          <div className="text-[11px] text-slate-500 mt-0.5">Duplicate / rule filtered</div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded">
                          <span className="text-xs text-slate-500 block mb-1">Simulated Volume Delta</span>
                          <strong className={`text-base font-mono tabular-nums ${
                            simResult.simulatedChangePct == null ? 'text-text-sec' : simResult.simulatedChangePct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {simResult.simulatedChangePct == null ? 'Unavailable — baseline required' : `${simResult.simulatedChangePct >= 0 ? '+' : ''}${simResult.simulatedChangePct}%`}
                          </strong>
                          <div className="text-[11px] text-slate-500 mt-0.5">Vs baseline</div>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </div>

      <RootCauseDrawer
        open={Boolean(rootMetric)}
        metric={rootMetric}
        metricLabel={rootMetricLabel}
        onClose={() => {
          setRootMetric(null);
          setRootMetricLabel(undefined);
        }}
      />
    </div>
  );
}
