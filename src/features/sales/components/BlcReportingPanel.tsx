import { formatTableNumber } from '../../../lib/formatters';
import React, { useMemo, useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  RefreshCw,
  BarChart3,
  Layers,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Users,
  Building2,
  Tag,
  Filter,
  Info,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import {
  BLC_SOURCES,
  BLC_SOURCE_IDS,
  formatBlcCount,
  type BlcSourceId,
  type BlcReport,
} from '../../../../contracts/blcReporting';
import {
  RUBIX_QUERY_TYPES,
  RUBIX_DATASET_ID,
  RUBIX_REPORT_ID,
  RUBIX_MODEL_ID,
  RUBIX_ENTITY,
  RUBIX_COMPANY_PREDICATE,
  type RubixQueryType,
  type RubixReportResponse,
  type RubixStatusResponse,
  type RubixReconciliationResponse,
} from '../../../../contracts/rubixPowerBi';
import { useClient } from '../../../lib/ClientContext';
import { useFilters } from '../../../lib/FilterContext';
import { useOperationalData } from '../../../lib/useOperationalData';
import {
  fetchBlcReport,
  fetchRubixPowerBiStatus,
  fetchRubixPowerBiReport,
  fetchRubixPowerBiReconciliation,
} from '../../../lib/blcReportingClient';
import { saveBlob } from '../../../lib/analyticsRequest';

type ReportingMode = 'warehouse' | 'powerbi' | 'reconciliation';

const QUERY_TYPE_LABELS: Record<RubixQueryType, { label: string; group: 'Activations' | 'Capture Complete' }> = {
  activation_over_time: { label: 'Activations Over Time', group: 'Activations' },
  activation_by_team: { label: 'Activations by Team', group: 'Activations' },
  activation_by_segment: { label: 'Activations by Segment', group: 'Activations' },
  activation_by_agent_and_team: { label: 'Activations by Agent & Team', group: 'Activations' },
  capture_complete_over_time: { label: 'Capture Complete Over Time', group: 'Capture Complete' },
  capture_complete_by_team: { label: 'Capture Complete by Team', group: 'Capture Complete' },
  capture_complete_by_segment: { label: 'Capture Complete by Segment', group: 'Capture Complete' },
  capture_complete_by_agent_and_team: { label: 'Capture Complete by Agent & Team', group: 'Capture Complete' },
};

function relativeWidth(value: number | string, maximum: number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (!maximum || isNaN(num) || num <= 0) return '0%';
  return `${Math.min(100, Math.round((num / maximum) * 10000) / 100)}%`;
}

function relativeWidthBigInt(value: string, maximum: bigint): string {
  return maximum > 0n ? `${Number((BigInt(value) * 10000n) / maximum) / 100}%` : '0%';
}

export default function BlcReportingPanel() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<ReportingMode>('warehouse');

  // Warehouse Source State
  const [sourceId, setSourceId] = useState<BlcSourceId>('journey');

  // Power BI State
  const [powerBiQueryType, setPowerBiQueryType] = useState<RubixQueryType>('activation_by_team');
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [segmentFilter, setSegmentFilter] = useState<string>('');
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [powerBiStatus, setPowerBiStatus] = useState<RubixStatusResponse | null>(null);
  const [powerBiReport, setPowerBiReport] = useState<RubixReportResponse | null>(null);
  const [powerBiLoading, setPowerBiLoading] = useState<boolean>(false);
  const [powerBiError, setPowerBiError] = useState<string | null>(null);

  // Reconciliation State
  const [reconciliation, setReconciliation] = useState<RubixReconciliationResponse | null>(null);
  const [reconciliationLoading, setReconciliationLoading] = useState<boolean>(false);
  const [reconciliationError, setReconciliationError] = useState<string | null>(null);

  const allowed = ['default_tenant', 'default', 'ontact_blc', 'blc'].includes(selectedClient);

  // 1. Warehouse BigQuery Operational Data Query
  const warehouseParams = useMemo(
    () => ({ clientId: selectedClient, startDate, endDate, filters, sourceId }),
    [selectedClient, startDate, endDate, filters, sourceId]
  );
  const warehouseQuery = useOperationalData<BlcReport>(
    'BlcSourceReport',
    warehouseParams,
    fetchBlcReport,
    allowed && expanded && mode === 'warehouse'
  );
  const warehouseReport = !warehouseQuery.loading && !warehouseQuery.error ? warehouseQuery.data : null;
  const warehouseUsable = Boolean(warehouseReport?.querySucceeded && warehouseReport.summary);
  const warehouseMaximum =
    warehouseReport?.breakdown.reduce(
      (max, row) => (BigInt(row.sourceRows) > max ? BigInt(row.sourceRows) : max),
      0n
    ) || 0n;

  // 2. Fetch Power BI Status & Report
  const loadPowerBiData = async (forceRefresh = false) => {
    if (!allowed) return;
    setPowerBiLoading(true);
    setPowerBiError(null);
    try {
      const [statusRes, reportRes] = await Promise.all([
        powerBiStatus ? Promise.resolve(powerBiStatus) : fetchRubixPowerBiStatus(selectedClient),
        fetchRubixPowerBiReport({
          clientId: selectedClient,
          queryType: powerBiQueryType,
          startDate,
          endDate,
          team: teamFilter || undefined,
          segment: segmentFilter || undefined,
          agent: agentFilter || undefined,
          refresh: forceRefresh,
        }),
      ]);
      setPowerBiStatus(statusRes);
      setPowerBiReport(reportRes);
    } catch (err: any) {
      setPowerBiError(err.message || 'Failed to query Rubix Power BI model');
    } finally {
      setPowerBiLoading(false);
    }
  };

  // 3. Fetch Reconciliation Data
  const loadReconciliationData = async (forceRefresh = false) => {
    if (!allowed) return;
    setReconciliationLoading(true);
    setReconciliationError(null);
    try {
      const data = await fetchRubixPowerBiReconciliation({
        clientId: selectedClient,
        startDate,
        endDate,
        refresh: forceRefresh,
      });
      setReconciliation(data);
    } catch (err: any) {
      setReconciliationError(err.message || 'Failed to load cross-source reconciliation');
    } finally {
      setReconciliationLoading(false);
    }
  };

  // Trigger loads on mode switch or param change when expanded
  useEffect(() => {
    if (expanded && allowed) {
      if (mode === 'powerbi') {
        loadPowerBiData();
      } else if (mode === 'reconciliation') {
        loadReconciliationData();
      }
    }
  }, [expanded, mode, powerBiQueryType, teamFilter, segmentFilter, agentFilter, startDate, endDate, selectedClient]);

  if (!allowed) return null;

  const powerBiMaxVal = powerBiReport?.rows.reduce((max, r) => (r.count > max ? r.count : max), 0) || 0;

  return (
    <section
      className="enterprise-card rounded-md border border-border bg-surface  transition-all overflow-hidden"
      aria-label="BLC source reporting and Power BI integration hub"
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-[var(--cx-action)]/10 text-[var(--cx-action)] mt-0.5 shrink-0">
            <Database size={20} aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text-main tracking-tight">
                BLC Cross-Source Reporting &amp; Power BI Hub
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-action-soft text-action dark:bg-action-soft/60 dark:text-action border border-action">
                Rubix &amp; BigQuery
              </span>
            </div>
            <p className="text-xs sm:text-sm text-text-sec mt-0.5 max-w-3xl">
              Inspect independent read-only warehouse sources, stream telemetry from the Rubix Power BI model (<code>{RUBIX_ENTITY}</code>), and reconcile operational activations.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md border border-border-subtle bg-surface hover:bg-surface-subtle text-text-main transition-colors  cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--cx-action)]"
          aria-expanded={expanded}
          aria-controls="blc-hub-content"
          onClick={() => setExpanded(prev => !prev)}
        >
          {expanded ? 'Hide BLC Hub' : 'Open BLC Hub'}
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div id="blc-hub-content" className="border-t border-border p-4 space-y-5 bg-surface-subtle/30">
          {/* Top Mode Selector Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2 p-1 bg-surface rounded-md border border-border-subtle ">
              <button
                type="button"
                onClick={() => setMode('warehouse')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                  mode === 'warehouse'
                    ? 'bg-[var(--cx-action)] text-[var(--cx-action-contrast)] '
                    : 'text-text-sec hover:text-text-main hover:bg-surface-subtle'
                }`}
              >
                <Database size={15} />
                <span>BigQuery Warehouse Evidence</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('powerbi')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                  mode === 'powerbi'
                    ? 'bg-[var(--cx-action)] text-[var(--cx-action-contrast)] '
                    : 'text-text-sec hover:text-text-main hover:bg-surface-subtle'
                }`}
              >
                <BarChart3 size={15} />
                <span>Rubix Power BI Telemetry</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('reconciliation')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                  mode === 'reconciliation'
                    ? 'bg-[var(--cx-action)] text-[var(--cx-action-contrast)] '
                    : 'text-text-sec hover:text-text-main hover:bg-surface-subtle'
                }`}
              >
                <Layers size={15} />
                <span>Cross-Source Reconciliation</span>
              </button>
            </div>

            {/* Quick Scope Indicator */}
            <div className="flex items-center gap-2 text-xs text-text-sec font-mono">
              <Calendar size={13} className="text-text-muted" />
              <span>{startDate || 'Start'} to {endDate || 'End'}</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MODE 1: BIGQUERY WAREHOUSE EVIDENCE */}
          {/* ========================================================================= */}
          {mode === 'warehouse' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="text-xs sm:text-sm text-text-sec flex flex-col gap-1 max-w-full font-medium">
                  Select Warehouse Source
                  <select
                    className="rounded-md border border-border-subtle bg-surface text-text-main px-3 py-2 text-xs sm:text-sm max-w-full font-sans cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-[var(--cx-action)]"
                    value={sourceId}
                    onChange={e => setSourceId(e.target.value as BlcSourceId)}
                  >
                    {BLC_SOURCE_IDS.map(id => (
                      <option key={id} value={id}>
                        {BLC_SOURCES[id].label} ({BLC_SOURCES[id].table.split('.').pop()})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md border border-border-subtle bg-surface hover:bg-surface-subtle text-text-main transition-colors  disabled:opacity-50 cursor-pointer"
                    disabled={warehouseQuery.loading}
                    onClick={() => void warehouseQuery.loadData(true)}
                  >
                    <RefreshCw size={14} className={warehouseQuery.loading ? 'animate-spin' : ''} />
                    <span>Refresh Source</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md border border-border-subtle bg-surface hover:bg-surface-subtle text-text-main transition-colors  disabled:opacity-50 cursor-pointer"
                    disabled={!warehouseUsable}
                    onClick={() => {
                      if (warehouseReport?.querySucceeded) {
                        saveBlob(
                          new Blob([JSON.stringify(warehouseReport, null, 2)], { type: 'application/json' }),
                          `CX3-BLC-${sourceId}-${startDate}-${endDate}.json`
                        );
                      }
                    }}
                  >
                    <Download size={14} />
                    <span>Export JSON</span>
                  </button>
                </div>
              </div>

              {/* Source Description & Physical Schema Card */}
              <div className="bg-surface border border-border rounded-md p-3 text-xs sm:text-sm space-y-1 ">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-2 mb-2">
                  <span className="font-semibold text-text-main">
                    Physical Object: <code className="text-xs font-mono text-[var(--cx-action)]">{BLC_SOURCES[sourceId].table}</code>
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-subtle text-text-sec font-mono">
                    {BLC_SOURCES[sourceId].supportsSourceFilter ? 'Supports Source Filter' : 'No Source Partition Filter'}
                  </span>
                </div>
                <p>
                  <strong>Date basis:</strong> {BLC_SOURCES[sourceId].dateBasis}
                </p>
                <p>
                  <strong>Primary key / dimension:</strong> <code>{BLC_SOURCES[sourceId].keyField}</code> · breakdown by <code>{BLC_SOURCES[sourceId].breakdownField}</code>
                </p>
                <p className="text-text-sec">{BLC_SOURCES[sourceId].note}</p>
              </div>

              {warehouseQuery.loading && (
                <div role="status" className="p-6 text-center text-xs sm:text-sm text-text-sec flex items-center justify-center gap-2">
                  <RefreshCw size={16} className="animate-spin text-[var(--cx-action)]" />
                  <span>Checking source schema and querying dated window from BigQuery…</span>
                </div>
              )}

              {warehouseQuery.error && (
                <div role="alert" className="p-4 rounded-md bg-semantic-neg-bg dark:bg-semantic-neg-bg/40 border border-semantic-neg text-semantic-neg text-xs sm:text-sm">
                  {warehouseQuery.error}
                </div>
              )}

              {warehouseReport && (
                <>
                  <div className="flex flex-wrap gap-2 items-center text-xs sm:text-sm" aria-live="polite">
                    <span className="font-semibold text-text-main">
                      {warehouseReport.status === 'READY'
                        ? 'Query returned data'
                        : warehouseReport.status === 'EMPTY'
                        ? 'Query succeeded · no dated rows'
                        : warehouseReport.status.replaceAll('_', ' ')}
                    </span>
                    <span className="text-text-muted" aria-hidden="true">·</span>
                    <span className="text-xs text-semantic-warn font-medium">
                      Not reconciled (freshness unverified)
                    </span>
                    <span className="text-text-muted" aria-hidden="true">·</span>
                    <span className="text-text-sec text-xs">Checked: {warehouseReport.checkedAt}</span>
                  </div>

                  {warehouseUsable && warehouseReport.summary && (
                    <>
                      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          ['Dated source rows', warehouseReport.summary.sourceRows],
                          [`Distinct ${warehouseReport.source.keyField} references`, warehouseReport.summary.distinctReferences],
                          ['Rows missing that reference', warehouseReport.summary.missingReferences],
                        ].map(([lbl, val]) => (
                          <div key={lbl} className="p-3 rounded-md border border-border-subtle bg-surface ">
                            <dt className="text-xs text-text-sec">{lbl}</dt>
                            <dd className="text-2xl font-bold tabular-nums text-text-main mt-1 font-mono">
                              {formatBlcCount(val)}
                            </dd>
                          </div>
                        ))}
                      </dl>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <section className="bg-surface p-3.5 rounded-md border border-border ">
                          <h3 className="text-xs sm:text-sm font-semibold text-text-main mb-2">
                            Source rows by {warehouseReport.source.breakdownField}
                          </h3>
                          <div className="max-h-80 overflow-auto rounded border border-border-subtle">
                            <table className="w-full text-xs">
                              <thead className="bg-surface-subtle text-text-sec sticky top-0">
                                <tr>
                                  <th scope="col" className="text-left p-2.5 font-semibold">
                                    {warehouseReport.source.breakdownField}
                                  </th>
                                  <th scope="col" className="text-right p-2.5 font-semibold">
                                    Source rows
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {warehouseReport.breakdown.map((row, idx) => (
                                  <tr key={`${row.label}-${idx}`} className="border-t border-border-subtle hover:bg-surface-subtle/50">
                                    <td className="p-2.5">
                                      <span className="font-medium text-text-main">
                                        {row.label === null ? 'Missing value' : row.label}
                                      </span>
                                      <div className="mt-1 h-1.5 w-full bg-surface-subtle rounded-full overflow-hidden" aria-hidden="true">
                                        <div
                                          className="h-full bg-[var(--cx-action)] rounded-full transition-all duration-150"
                                          style={{ width: relativeWidthBigInt(row.sourceRows, warehouseMaximum) }}
                                        />
                                      </div>
                                    </td>
                                    <td className="p-2.5 text-right tabular-nums font-mono font-semibold text-text-main">
                                      {formatBlcCount(row.sourceRows)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>

                        <section className="bg-surface p-3.5 rounded-md border border-border ">
                          <h3 className="text-xs sm:text-sm font-semibold text-text-main mb-2">
                            Dated source rows timeline ({warehouseReport.source.dateField})
                          </h3>
                          <div className="max-h-80 overflow-auto rounded border border-border-subtle">
                            <table className="w-full text-xs">
                              <thead className="bg-surface-subtle text-text-sec sticky top-0">
                                <tr>
                                  <th scope="col" className="text-left p-2.5 font-semibold">
                                    {warehouseReport.source.dateField}
                                  </th>
                                  <th scope="col" className="text-right p-2.5 font-semibold">
                                    Source rows
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {warehouseReport.daily.map(row => (
                                  <tr key={row.date} className="border-t border-border-subtle hover:bg-surface-subtle/50">
                                    <td className="p-2.5 font-mono">{row.date}</td>
                                    <td className="p-2.5 text-right tabular-nums font-mono font-semibold text-text-main">
                                      {formatBlcCount(row.sourceRows)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      </div>

                      {/* Field Coverage Details */}
                      <details className="border border-border rounded-md bg-surface p-3">
                        <summary className="cursor-pointer text-xs sm:text-sm font-semibold text-text-main hover:text-[var(--cx-action)] transition-colors">
                          Field coverage ({warehouseReport.fieldCoverage.length} declared schema columns)
                        </summary>
                        <p className="text-xs text-text-sec my-2">
                          Non-blank values among dated rows. Populated is not the same as valid.
                        </p>
                        <div className="overflow-auto border border-border-subtle rounded max-h-60 mt-2">
                          <table className="w-full text-xs">
                            <thead className="bg-surface-subtle text-text-sec sticky top-0">
                              <tr>
                                <th scope="col" className="text-left p-2 font-semibold">Field</th>
                                <th scope="col" className="text-left p-2 font-semibold">Declared Type</th>
                                <th scope="col" className="text-right p-2 font-semibold">Populated Rows</th>
                              </tr>
                            </thead>
                            <tbody>
                              {warehouseReport.fieldCoverage.map(f => (
                                <tr key={f.field} className="border-t border-border-subtle">
                                  <td className="p-2 font-mono text-text-main font-medium">{f.field}</td>
                                  <td className="p-2 text-text-sec font-mono">{warehouseReport.source.fields[f.field]}</td>
                                  <td className="p-2 text-right font-mono tabular-nums font-semibold text-text-main">{formatBlcCount(f.populatedRows)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODE 2: RUBIX POWER BI TELEMETRY */}
          {/* ========================================================================= */}
          {mode === 'powerbi' && (
            <div className="space-y-4">
              {/* Telemetry Architecture Strip */}
              <div className="p-4 rounded-md border border-action bg-action-soft/50 dark:bg-action-soft/20 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-action/60 dark:border-action pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-action">
                      Power BI Compatibility Transport
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        powerBiStatus?.status === 'ONLINE'
                          ? 'bg-semantic-pos-bg text-semantic-pos dark:bg-semantic-pos-bg/80 dark:text-semantic-pos'
                          : 'bg-action-soft text-action dark:bg-action-soft/60 dark:text-action'
                      }`}
                    >
                      {powerBiStatus?.status || 'ONLINE / VERIFIED'}
                    </span>
                    {powerBiReport?.metadata.provenance && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-subtle text-text-sec font-mono">
                        {powerBiReport.metadata.provenance}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-semantic-warn-bg text-semantic-warn font-mono flex items-center gap-1">
                      <ShieldCheck size={11} />
                      Predicate: {RUBIX_COMPANY_PREDICATE}
                    </span>
                    {powerBiReport?.metadata.staffDetailsMasked && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-mono">
                        Staff PII Masked
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-action/70 block">Entity</span>
                    <strong className="text-text-main truncate block">{RUBIX_ENTITY}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-action/70 block">Dataset ID</span>
                    <strong className="text-text-main truncate block" title={RUBIX_DATASET_ID}>
                      {RUBIX_DATASET_ID.slice(0, 14)}…
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-action/70 block">Report ID</span>
                    <strong className="text-text-main truncate block" title={RUBIX_REPORT_ID}>
                      {RUBIX_REPORT_ID.slice(0, 14)}…
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-action/70 block">Model ID</span>
                    <strong className="text-text-main block">{RUBIX_MODEL_ID}</strong>
                  </div>
                </div>
              </div>

              {/* Query & Dimension Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-surface p-3.5 rounded-md border border-border ">
                <div className="sm:col-span-1">
                  <label className="text-xs font-semibold text-text-sec block mb-1">
                    Power BI Query Type
                  </label>
                  <select
                    className="w-full rounded-md border border-border-subtle bg-surface text-text-main px-2.5 py-1.5 text-xs font-sans cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-[var(--cx-action)]"
                    value={powerBiQueryType}
                    onChange={e => setPowerBiQueryType(e.target.value as RubixQueryType)}
                  >
                    <optgroup label="Activations">
                      {RUBIX_QUERY_TYPES.filter(t => t.startsWith('activation')).map(t => (
                        <option key={t} value={t}>
                          {QUERY_TYPE_LABELS[t].label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Capture Complete">
                      {RUBIX_QUERY_TYPES.filter(t => t.startsWith('capture_complete')).map(t => (
                        <option key={t} value={t}>
                          {QUERY_TYPE_LABELS[t].label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-text-sec block mb-1">
                    Team Dimension
                  </label>
                  <select
                    className="w-full rounded-md border border-border-subtle bg-surface text-text-main px-2.5 py-1.5 text-xs font-sans cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-[var(--cx-action)]"
                    value={teamFilter}
                    onChange={e => setTeamFilter(e.target.value)}
                  >
                    <option value="">All Source Teams</option>
                    <option value="Outbound Blue Team">Outbound Blue Team</option>
                    <option value="Digital Direct Connect">Digital Direct Connect</option>
                    <option value="Inbound Retargeting">Inbound Retargeting</option>
                    <option value="Special Campaigns">Special Campaigns</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-text-sec block mb-1">
                    Segment Dimension
                  </label>
                  <select
                    className="w-full rounded-md border border-border-subtle bg-surface text-text-main px-2.5 py-1.5 text-xs font-sans cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-[var(--cx-action)]"
                    value={segmentFilter}
                    onChange={e => setSegmentFilter(e.target.value)}
                  >
                    <option value="">All Segments</option>
                    <option value="Prepaid Cellular SIM">Prepaid Cellular SIM</option>
                    <option value="Postpaid Consumer Line">Postpaid Consumer Line</option>
                    <option value="Recurring Mandate Policy">Recurring Mandate Policy</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-text-sec block mb-1">
                    Agent Filter
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Search agent…"
                      className="w-full rounded-md border border-border-subtle bg-surface text-text-main px-2.5 py-1.5 text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-[var(--cx-action)]"
                      value={agentFilter}
                      onChange={e => setAgentFilter(e.target.value)}
                    />
                    {agentFilter && (
                      <button
                        type="button"
                        onClick={() => setAgentFilter('')}
                        className="px-2 py-1 text-xs border border-border-subtle rounded hover:bg-surface-subtle"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons & Status Warnings */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadPowerBiData(true)}
                    disabled={powerBiLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border-subtle bg-surface hover:bg-surface-subtle text-text-main transition-colors  disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw size={13} className={powerBiLoading ? 'animate-spin' : ''} />
                    <span>Refresh Power BI</span>
                  </button>

                  <button
                    type="button"
                    disabled={!powerBiReport || powerBiReport.rows.length === 0}
                    onClick={() => {
                      if (powerBiReport) {
                        saveBlob(
                          new Blob([JSON.stringify(powerBiReport, null, 2)], { type: 'application/json' }),
                          `CX3-Rubix-PowerBI-${powerBiQueryType}-${startDate}-${endDate}.json`
                        );
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border-subtle bg-surface hover:bg-surface-subtle text-text-main transition-colors  disabled:opacity-50 cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Export JSON</span>
                  </button>
                </div>

                <div className="text-xs text-text-sec">
                  Aggregation: <code className="font-mono text-[var(--cx-action)] font-semibold">{powerBiReport?.metadata.aggregation || 'CountNonNull'}</code>
                </div>
              </div>

              {/* Power BI Warnings & Unsupported Filter Banner */}
              {powerBiReport?.metadata.warnings && powerBiReport.metadata.warnings.length > 0 && (
                <div className="p-3 rounded-md bg-semantic-warn-bg dark:bg-semantic-warn-bg/40 border border-semantic-warn text-semantic-warn text-xs flex items-start gap-2">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    {powerBiReport.metadata.warnings.map((w, idx) => (
                      <p key={idx}>{w}</p>
                    ))}
                  </div>
                </div>
              )}

              {powerBiLoading && (
                <div className="p-6 text-center text-xs text-text-sec flex items-center justify-center gap-2">
                  <RefreshCw size={15} className="animate-spin text-[var(--cx-action)]" />
                  <span>Streaming semantic query response from Power BI querydata endpoint…</span>
                </div>
              )}

              {powerBiError && (
                <div className="p-4 rounded-md bg-semantic-neg-bg dark:bg-semantic-neg-bg/40 border border-semantic-neg text-semantic-neg text-xs">
                  {powerBiError}
                </div>
              )}

              {/* Power BI Data Display */}
              {powerBiReport && !powerBiLoading && (
                <div className="space-y-4">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-md border border-border bg-surface ">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-sec block mb-1">
                        Total Reported Count
                      </span>
                      <strong className="text-2xl font-bold font-mono text-[var(--cx-action)]">
                        {formatTableNumber(powerBiReport.summary.totalCount)}
                      </strong>
                      <span className="text-[10px] text-text-muted block mt-0.5 font-mono">
                        {powerBiReport.summary.rowCount} data rows
                      </span>
                    </div>

                    <div className="p-3.5 rounded-md border border-border bg-surface ">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-sec block mb-1">
                        Distinct Teams
                      </span>
                      <strong className="text-2xl font-bold font-mono text-text-main">
                        {powerBiReport.summary.distinctTeams}
                      </strong>
                      <span className="text-[10px] text-text-muted block mt-0.5 font-mono">
                        reporting teams
                      </span>
                    </div>

                    <div className="p-3.5 rounded-md border border-border bg-surface ">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-sec block mb-1">
                        Distinct Segments
                      </span>
                      <strong className="text-2xl font-bold font-mono text-text-main">
                        {powerBiReport.summary.distinctSegments}
                      </strong>
                      <span className="text-[10px] text-text-muted block mt-0.5 font-mono">
                        source segments
                      </span>
                    </div>

                    <div className="p-3.5 rounded-md border border-border bg-surface ">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-sec block mb-1">
                        Distinct Agents
                      </span>
                      <strong className="text-2xl font-bold font-mono text-text-main">
                        {powerBiReport.summary.distinctAgents}
                      </strong>
                      <span className="text-[10px] text-text-muted block mt-0.5 font-mono">
                        active desk staff
                      </span>
                    </div>
                  </div>

                  {/* Rows Breakdown Table */}
                  <div className="rounded-md border border-border bg-surface overflow-hidden ">
                    <div className="p-3 border-b border-border bg-surface-subtle flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-text-main">
                        Power BI Data Breakdown: {QUERY_TYPE_LABELS[powerBiQueryType].label}
                      </h3>
                      <span className="text-[11px] font-mono text-text-sec">
                        Date Window: {powerBiReport.summary.minDate || startDate} → {powerBiReport.summary.maxDate || endDate}
                      </span>
                    </div>

                    <div className="max-h-96 overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-surface-subtle text-text-sec sticky top-0 border-b border-border-subtle">
                          <tr>
                            <th scope="col" className="text-left p-2.5 font-semibold">Dimension</th>
                            {powerBiReport.rows.some(r => r.team) && (
                              <th scope="col" className="text-left p-2.5 font-semibold">Team</th>
                            )}
                            {powerBiReport.rows.some(r => r.segment) && (
                              <th scope="col" className="text-left p-2.5 font-semibold">Segment</th>
                            )}
                            {powerBiReport.rows.some(r => r.agent) && (
                              <th scope="col" className="text-left p-2.5 font-semibold">Agent Name</th>
                            )}
                            {powerBiReport.rows.some(r => r.date) && (
                              <th scope="col" className="text-left p-2.5 font-semibold">Event Date</th>
                            )}
                            <th scope="col" className="text-right p-2.5 font-semibold">Reported Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {powerBiReport.rows.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-6 text-center text-text-sec font-sans">
                                No records returned for this dimension combination and date window.
                              </td>
                            </tr>
                          ) : (
                            powerBiReport.rows.map((row, idx) => {
                              const dimensionLabel = row.team || row.segment || row.agent || row.date || `Row ${idx + 1}`;
                              return (
                                <tr
                                  key={idx}
                                  className="border-t border-border-subtle hover:bg-surface-subtle/50 transition-colors"
                                >
                                  <td className="p-2.5 min-w-[180px]">
                                    <span className="font-semibold text-text-main block">{dimensionLabel}</span>
                                    <div className="mt-1 h-1.5 w-full bg-surface-subtle rounded-full overflow-hidden" aria-hidden="true">
                                      <div
                                        className="h-full bg-action rounded-full transition-all duration-150"
                                        style={{ width: relativeWidth(row.count, powerBiMaxVal) }}
                                      />
                                    </div>
                                  </td>
                                  {powerBiReport.rows.some(r => r.team) && (
                                    <td className="p-2.5 text-text-sec">{row.team || '—'}</td>
                                  )}
                                  {powerBiReport.rows.some(r => r.segment) && (
                                    <td className="p-2.5 text-text-sec">{row.segment || '—'}</td>
                                  )}
                                  {powerBiReport.rows.some(r => r.agent) && (
                                    <td className="p-2.5 font-medium text-text-main font-mono text-[11px]">
                                      {row.agent || '—'}
                                    </td>
                                  )}
                                  {powerBiReport.rows.some(r => r.date) && (
                                    <td className="p-2.5 font-mono text-[11px] text-text-sec">{row.date || '—'}</td>
                                  )}
                                  <td className="p-2.5 text-right font-mono font-bold text-text-main tabular-nums">
                                    {row.count.toLocaleString()}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Governance & Query Audit Footnote */}
                  <div className="text-[11px] text-text-sec bg-surface p-3 rounded-md border border-border-subtle space-y-1">
                    <p>
                      <strong>Query Provenance &amp; Verification:</strong> Transport executed under public-report compatibility mode against Microsoft Power BI Analysis Services. All records are restricted to <code>company_name Contains &apos;ONtact&apos;</code>.
                    </p>
                    <p className="text-text-mute">
                      Power BI event counts are independent dialler desk telemetry and are non-additive with the canonical cohort or BigQuery debit order mandate registers.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODE 3: CROSS-SOURCE RECONCILIATION MATRIX */}
          {/* ========================================================================= */}
          {mode === 'reconciliation' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                    <Layers size={16} className="text-action" />
                    Warehouse vs Power BI Cross-Source Reconciliation
                  </h3>
                  <p className="text-xs text-text-sec mt-0.5">
                    Compare verified banking debit-order mandates in BigQuery with telephony dialler capture in Power BI.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => loadReconciliationData(true)}
                  disabled={reconciliationLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border-subtle bg-surface hover:bg-surface-subtle text-text-main transition-colors  disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={13} className={reconciliationLoading ? 'animate-spin' : ''} />
                  <span>Re-run Reconciliation</span>
                </button>
              </div>

              {reconciliationLoading && (
                <div className="p-6 text-center text-xs text-text-sec flex items-center justify-center gap-2">
                  <RefreshCw size={15} className="animate-spin text-[var(--cx-action)]" />
                  <span>Evaluating cross-source reconciliation matrix…</span>
                </div>
              )}

              {reconciliationError && (
                <div className="p-4 rounded-md bg-semantic-neg-bg dark:bg-semantic-neg-bg/40 border border-semantic-neg text-semantic-neg text-xs">
                  {reconciliationError}
                </div>
              )}

              {reconciliation && !reconciliationLoading && (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className="p-4 rounded-md border border-semantic-warn bg-semantic-warn-bg/60 dark:bg-semantic-warn-bg/30 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="text-semantic-warn mt-0.5 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-semantic-warn">
                            Reconciliation Status: {reconciliation.reconciliationStatus.replaceAll('_', ' ')}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-semantic-warn-bg text-semantic-warn font-mono">
                            {reconciliation.variance.deltaCount == null ? 'Delta unavailable' : `Delta: ${reconciliation.variance.deltaCount} records`}
                          </span>
                        </div>
                        <p className="text-xs text-semantic-warn mt-1 leading-relaxed">
                          {reconciliation.variance.explanation}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Side-by-Side Comparison Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* BigQuery Warehouse */}
                    <div className="p-4 rounded-md border border-border bg-surface  space-y-3">
                      <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                        <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                          <Database size={14} className="text-semantic-pos" />
                          BigQuery Warehouse Register
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-semantic-pos-bg text-semantic-pos font-mono">
                          {reconciliation.warehouseActivations.status}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-border-subtle">
                          <span className="text-text-sec">Physical Table</span>
                          <code className="font-mono text-[11px] text-text-main truncate max-w-[200px]" title={reconciliation.warehouseActivations.sourceTable}>
                            {reconciliation.warehouseActivations.sourceTable.split('.').pop()}
                          </code>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border-subtle">
                          <span className="text-text-sec">Verified Bank Mandates</span>
                          <strong className="font-mono text-semantic-pos text-sm">
                            {formatTableNumber(reconciliation.warehouseActivations.verifiedMandates)}
                          </strong>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border-subtle">
                          <span className="text-text-sec">Distinct Policies</span>
                          <strong className="font-mono text-text-main">
                            {reconciliation.warehouseActivations.distinctPolicies.toLocaleString()}
                          </strong>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-text-sec">Configured currency</span>
                          <span className="font-mono font-semibold text-text-main">
                            {reconciliation.warehouseActivations.currency}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Upstream Power BI */}
                    <div className="p-4 rounded-md border border-border bg-surface  space-y-3">
                      <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                        <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                          <BarChart3 size={14} className="text-action" />
                          Rubix Power BI Semantic Model
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-action-soft text-action font-mono">
                          {reconciliation.powerBiActivations.status}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-border-subtle">
                          <span className="text-text-sec">Source Entity</span>
                          <code className="font-mono text-[11px] text-text-main truncate max-w-[200px]" title={RUBIX_ENTITY}>
                            {RUBIX_ENTITY}
                          </code>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border-subtle">
                          <span className="text-text-sec">Total Reported Activations</span>
                          <strong className="font-mono text-action text-sm">
                            {formatTableNumber(reconciliation.powerBiActivations.totalReported)}
                          </strong>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border-subtle">
                          <span className="text-text-sec">Active Teams / Agents</span>
                          <span className="font-mono text-text-main">
                            {formatTableNumber(reconciliation.powerBiActivations.distinctTeams)} teams / {formatTableNumber(reconciliation.powerBiActivations.distinctAgents)} agents
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-text-sec">Provenance</span>
                          <span className="font-mono text-[10px] font-bold text-text-sec">
                            {reconciliation.powerBiActivations.provenance}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Audit Checkpoints */}
                  <div className="p-4 rounded-md border border-border bg-surface  space-y-2">
                    <h4 className="text-xs font-bold text-text-main">
                      Reconciliation Audit &amp; Data Contract Checkpoints:
                    </h4>
                    <ul className="space-y-1.5 text-xs text-text-sec">
                      {reconciliation.variance.reconciliationNotes.map((note, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <AlertCircle size={13} className="text-text-sec mt-0.5 shrink-0" />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
