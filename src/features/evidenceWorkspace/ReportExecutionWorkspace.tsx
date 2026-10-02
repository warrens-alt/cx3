import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Play, RotateCcw, FileSearch, Download } from 'lucide-react';
import { METRICS, METRIC_BY_ID, type EvidenceReportResult, type ReleaseManifest, type ReportRequest } from '../../../contracts/reporting';
import { useClient } from '../../lib/ClientContext';
import { useFilters } from '../../lib/FilterContext';
import { reportingFilters, reportingScopeError, reportLocalScopeError } from '../../lib/reportingScope';
import { createEvidenceReport } from '../../lib/reportingClient';
import InspectorHost, { type InspectorContent } from '../../shared/evidence/InspectorHost';
import { AuditDimensions } from '../../shared/evidence/EvidenceTrace';
import MetricAnatomy from '../../shared/evidence/MetricAnatomy';
import { reportDimensions, reportMetricInspector } from './reportEvidenceModel';
import ReportReplay from './ReportReplay';

/** One explicit execution in the existing release workspace. No operational fallback. */
export default function ReportExecutionWorkspace({ release }: { release: ReleaseManifest }) {
  const { clientId, clientConfig } = useClient();
  const location = useLocation();
  const { startDate, endDate, setStartDate, setEndDate, filters, filterError } = useFilters();
  const [metrics, setMetrics] = useState(() => release.execution?.supportedMetrics.slice(0, 1) || []);
  const [dateBasis, setDateBasis] = useState<ReportRequest['dateBasis']>(() => release.execution?.supportedDateBases[0] || 'capture_cohort');
  const [grouping, setGrouping] = useState<ReportRequest['grouping']>(() => release.execution?.supportedGroupings.includes('none') ? 'none' : release.execution?.supportedGroupings[0] || 'none');
  const [report, setReport] = useState<EvidenceReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reproduced, setReproduced] = useState(false);
  const [inspector, setInspector] = useState<InspectorContent | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  let applied: ReportRequest['filters'] = {}, projectionError: string | null = null;
  try { applied = reportingFilters(filters); } catch (err) { projectionError = err instanceof Error ? err.message : 'Unsupported reporting filters.'; }
  const request: ReportRequest = { tenantId: clientId, startDate, endDate, observationCutoff: release.cutoff, dateBasis, grouping, currency: clientConfig?.currency || 'ZAR', metrics, filters: applied };
  const scopeKey = JSON.stringify([request, release]);
  const [resultScope, setResultScope] = useState('');
  const currentReport = resultScope === scopeKey ? report : null;
  const scopeError = filterError || projectionError || reportLocalScopeError(location.search) || reportingScopeError(request, release);
  useEffect(() => {
    generation.current += 1; controller.current?.abort(); setBusy(false); setError(null); setReport(null); setInspector(null); setReproduced(false);
    return () => { generation.current += 1; controller.current?.abort(); };
  }, [scopeKey]);
  const run = async () => {
    if (scopeError) return;
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    const version = ++generation.current; setBusy(true); setError(null); setReport(null); setInspector(null); setReproduced(false);
    try { const value = await createEvidenceReport(request, release.releaseId, abort.signal); if (!abort.signal.aborted && generation.current === version) { setReport(value); setResultScope(scopeKey); } }
    catch (err) { if (!abort.signal.aborted && generation.current === version) setError(err instanceof Error ? err.message : 'Report execution failed.'); }
    finally { if (!abort.signal.aborted && generation.current === version) setBusy(false); }
  };
  const download = () => {
    if (!currentReport) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `evidence-${release.releaseId}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="cx-report-execution cx-admin-panel" aria-label="Execute immutable evidence report">
    <header><h2>Run an immutable report</h2><p>The release fixes the observation cutoff. Only registered metrics and scopes with a published aggregate can return a value.</p></header>
    <div className="cx-report-controls">
      <label>Start date<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
      <label>End date<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></label>
      <label>Date basis<select value={dateBasis} onChange={event => setDateBasis(event.target.value as ReportRequest['dateBasis'])}>{(release.execution?.supportedDateBases || ['capture_cohort']).map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
      <label>Group by<select value={grouping} onChange={event => setGrouping(event.target.value as ReportRequest['grouping'])}>{(release.execution?.supportedGroupings || ['none']).map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
    </div>
    <fieldset className="cx-report-metric-picker"><legend>Registered metrics</legend>{METRICS.filter(metric => release.execution?.supportedMetrics.includes(metric.id)).map(metric => <label key={metric.id}><input type="checkbox" checked={metrics.includes(metric.id)} onChange={event => setMetrics(current => event.target.checked ? [...current, metric.id] : current.filter(value => value !== metric.id))} />{metric.label}</label>)}{!release.execution && <p>NOT_SUPPORTED · No approved executable snapshot is registered for this release.</p>}</fieldset>
    {scopeError && <p className="cx-report-boundary" role="status">{scopeError}</p>}
    <div className="cx-report-actions"><button type="button" className="cx-button-primary" disabled={busy || !!scopeError} onClick={run}><Play size={15} aria-hidden="true" />{busy ? 'Executing…' : 'Run report'}</button>{busy && <button type="button" className="cx-button-secondary" onClick={() => { generation.current += 1; controller.current?.abort(); setBusy(false); }}><RotateCcw size={15} aria-hidden="true" />Cancel</button>}</div>
    {error && <p role="alert">{error}</p>}
    {currentReport && <div className="cx-report-result" aria-live="polite">
      <div className="cx-report-result-status"><strong>{currentReport.status}</strong><span>Generated: {currentReport.generatedAt} · {currentReport.metricVersion}</span><button type="button" className="cx-button-secondary" onClick={download}><Download size={15} aria-hidden="true" />Export result and evidence</button></div>
      {currentReport.message && <p role="status">{currentReport.message}</p>}
      <AuditDimensions label="Independent evidence states" dimensions={reportDimensions(currentReport, reproduced)} />
      <p className="cx-audit-visual-note">Observed → Mapped → Scoped → Reproduced → Independently reconciled → Business verified. These are independent questions; no state automatically establishes the next.</p>
      <div className="cx-report-metric-grid">{currentReport.totals.map(metric => {
        const definition = METRIC_BY_ID[metric.metricId]; const content = reportMetricInspector(currentReport, metric);
        return <article key={metric.metricId} className="cx-report-metric-card" aria-label={definition.label}>
          <h3>{definition.label}</h3><MetricAnatomy model={content.anatomy!} />
          <div className="cx-report-status-strip"><span>{metric.calculationStatus}</span><span>{metric.evidence.evidenceStatus}</span><span>{metric.completeness}</span></div>
          <dl><div><dt>Grain</dt><dd>{metric.evidence.grain}</dd></div><div><dt>Date basis</dt><dd>{metric.evidence.dateBasis}</dd></div><div><dt>Mapping</dt><dd>{metric.evidence.mappingStatus}</dd></div><div><dt>Independent reconciliation</dt><dd>{metric.evidence.reconciliationStatus}</dd></div><div><dt>Business meaning</dt><dd>{metric.evidence.businessMeaningStatus}</dd></div></dl>
          {metric.reason && <p>{metric.reason}</p>}
          <button type="button" className="cx-button-secondary" onClick={() => setInspector(content)}><FileSearch size={15} aria-hidden="true" />Inspect definition and lineage</button>
        </article>;
      })}</div>
      {currentReport.groups.length > 0 && <details className="cx-admin-panel"><summary>Exact grouped values ({currentReport.groups.length})</summary><div className="cx-admin-table-scroll" role="region" aria-label="Exact report groups" tabIndex={0}><table className="cx-admin-table"><thead><tr><th scope="col">Group</th><th scope="col">Metric</th><th scope="col">Value</th><th scope="col">Numerator</th><th scope="col">Denominator</th><th scope="col">Evidence</th></tr></thead><tbody>{currentReport.groups.map(row => <tr key={JSON.stringify([row.group, row.metricId])}><th scope="row">{row.group ?? 'Unassigned'}</th><td>{METRIC_BY_ID[row.metricId].label}</td><td>{row.value ?? 'Unavailable'}</td><td>{row.numerator ?? 'Unavailable'}</td><td>{row.denominator ?? 'Not applicable / unavailable'}</td><td>{row.evidence.evidenceStatus}</td></tr>)}</tbody></table></div></details>}
      <p className="cx-report-boundary">Supporting evidence is the frozen aggregate and its declared source lineage. No record-level reader is approved for this release; operational lead records cannot prove a frozen report.</p>
      <details className="cx-admin-panel"><summary>Generation and snapshot evidence</summary><dl>{[['Release', currentReport.releaseId], ['Snapshot', currentReport.snapshot?.table], ['Snapshot time', currentReport.snapshot?.snapshotTime], ['Generation contract', currentReport.generationContract], ['Scope hash', currentReport.scopeHash], ['Result hash', currentReport.resultHash], ['Query job', currentReport.queryJobId], ['Bytes processed', currentReport.queryEvidence.bytesProcessed]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Unavailable'}</dd></div>)}</dl></details>
    </div>}
    <ReportReplay key={currentReport?.executionId || scopeKey} tenantId={clientId} report={currentReport} onCompared={setReproduced} />
    <InspectorHost open={!!inspector && !!currentReport} onClose={() => setInspector(null)} content={inspector} />
  </section>;
}
