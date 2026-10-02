import React, { useEffect, useId, useState } from 'react';
import { ArrowRight, Pin } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useClient } from '../../lib/ClientContext';
import { getAnalyticalSessionKey, subscribeToAnalyticalSession } from '../../lib/analyticalSession';
import { useAuth } from '../../lib/AuthContext';
import { extractOffernetFilters, useFilters } from '../../lib/FilterContext';
import { formatTableNumber } from '../../lib/formatters';
import { fetchExceptions, fetchMarketingRootCause, fetchRootCause, type ExceptionAnalyticsData, type MarketingRootCauseData, type RootCauseData } from '../../lib/offernetClient';
import { driverMetricKind, driverScope, driverSegmentLink, type DriverDimension } from './driverAnalysisModel';
import '../../styles/investigationDrivers.css';

export interface DriverEvidenceItem {
  kind: 'metric' | 'exception' | 'driver' | 'segment';
  label: string;
  value: string;
  definition: string;
  provenance: string;
  identifier: string;
  observedAt?: string;
}
interface DriverAnalysisProps {
  metric?: string | null;
  metricLabel?: string;
  exceptionData?: ExceptionAnalyticsData | null;
  exceptionError?: string | null;
  onInspect?: () => void;
  onPin?: (item: DriverEvidenceItem) => void;
}
interface AnalysisResult {
  key: string;
  operational?: RootCauseData & { generatedAt?: string };
  marketing?: MarketingRootCauseData & { generatedAt?: string };
  exceptions?: ExceptionAnalyticsData;
  error?: string;
}
interface BreakdownRow {
  name: string;
  current: number | null;
  previous?: number | null;
  contribution?: number | null;
  delta?: number | null;
  shareOfDelta?: number | null;
  population?: number;
  previousPopulation?: number;
  share?: number | null;
}
const number = (value: number | null | undefined) => value == null ? 'Unavailable' : formatTableNumber(value);
const signed = (value: number | null | undefined, unit = '') => value == null ? 'Unavailable' : `${value > 0 ? '+' : ''}${formatTableNumber(value)}${unit ? ` ${unit}` : ''}`;

export function DriverBreakdown({ label, rows, unit, compared, concentration, recordsAllowed, href, onInspect, onPin, decomposition = false, contributionLabel = 'Descriptive contribution' }: {
  label: string; rows: BreakdownRow[]; unit: string; compared: boolean; concentration: boolean;
  recordsAllowed: boolean; decomposition?: boolean; contributionLabel?: string; href?: (name: string) => string; onInspect?: () => void; onPin?: (row: BreakdownRow) => void;
}) {
  const max = rows.reduce((largest, row) => Math.max(largest, Math.abs(concentration ? row.current ?? 0 : row.contribution ?? 0)), 1);
  return <>
    <div className="cx-driver-bars" aria-label={`${label}: ${concentration ? 'current affected leads' : contributionLabel.toLowerCase()}`}>
      {rows.slice(0, 6).map(row => <div className="cx-driver-bar" key={row.name}>
        <span>{row.name}</span><div aria-hidden="true"><i style={{ width: `${100 * Math.abs(concentration ? row.current ?? 0 : row.contribution ?? 0) / max}%` }} /></div>
        <strong>{concentration ? number(row.current) : signed(row.contribution, unit)}</strong>
      </div>)}
    </div>
    <div className="cx-driver-table-scroll" role="region" aria-label={`${label} exact breakdown`} tabIndex={0}>
      <table className="cx-driver-table">
        <caption>{label} · {concentration ? 'current affected population' : 'matched-period evidence'}</caption>
        <thead><tr><th scope="col">Segment</th><th scope="col">Current{concentration ? ' leads' : ''}</th>{compared && <th scope="col">Previous</th>}{decomposition && <th scope="col">Segment change</th>}<th scope="col">{concentration ? 'Share of population' : contributionLabel}</th>{decomposition && <th scope="col">Share of delta</th>}{href && <th scope="col"><span className="sr-only">Narrow investigation</span></th>}{onPin && <th scope="col"><span className="sr-only">Pin evidence</span></th>}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.name}>
          <th scope="row">{row.name}</th>
          <td>{number(row.current)}{row.current != null && unit === 'pp' ? '%' : ''}{row.population !== undefined && <small>Denominator {number(row.population)}</small>}</td>
          {compared && <td>{number(row.previous)}{row.previous != null && unit === 'pp' ? '%' : ''}{row.previousPopulation !== undefined && <small>Denominator {number(row.previousPopulation)}</small>}</td>}
          {decomposition && <td>{signed(row.delta, unit)}</td>}
          <td>{concentration ? row.share == null ? 'Unavailable' : `${number(row.share)}%` : signed(row.contribution, unit)}</td>
          {decomposition && <td>{row.shareOfDelta == null ? 'Unavailable' : `${number(row.shareOfDelta)}%`}</td>}
          {href && <td><Link to={href(row.name)} onClick={onInspect} aria-label={`${recordsAllowed ? 'Inspect records' : 'Narrow investigation'}: ${row.name}`}>{recordsAllowed ? 'Records' : 'Narrow'} <ArrowRight size={12} aria-hidden="true" /></Link></td>}
          {onPin && <td><button type="button" onClick={() => onPin(row)} aria-label={`Pin ${row.name} evidence`}><Pin size={13} aria-hidden="true" /></button></td>}
        </tr>)}</tbody>
      </table>
      {rows.length === 0 && <p className="cx-driver-note">No segments are available for this scoped population.</p>}
    </div>
  </>;
}

export default function DriverAnalysis({ metric: suppliedMetric, metricLabel, exceptionData, exceptionError, onInspect, onPin }: DriverAnalysisProps) {
  const { selectedClient, ready: workspaceReady, error: workspaceError } = useClient();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters, filterError } = useFilters();
  const [params] = useSearchParams();
  const headingId = useId();
  const metric = suppliedMetric ?? params.get('investigationMetric');
  const drill = params.get('drill');
  const search = params.get('search');
  const kind = driverMetricKind(metric);
  const [selectedDimension, setSelectedDimension] = useState<string>('vendor');
  const [sessionKey, setSessionKey] = useState(getAnalyticalSessionKey);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  useEffect(() => subscribeToAnalyticalSession(next => { setSessionKey(next); setResult(null); }), []);
  const scope = driverScope(params);
  const request = JSON.stringify({ clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined, ...extractOffernetFilters(filters), ...scope, ...(metric ? { metric } : {}) });
  const requestKey = JSON.stringify([request, search, filterError, exceptionData !== undefined, sessionKey]);
  const unavailable = workspaceError || (workspaceReady === false ? 'Workspace evidence is not ready for this investigation.' : null) || (filterError ? 'Correct the reporting filters before analysing this population.'
    : search ? 'Driver analysis is unavailable while record-text search is active. Clear the search to compare the complete investigation population.'
    : metric && !kind ? `A matched-period breakdown is unavailable for ${metricLabel || metric}. This metric has no supported decomposition.`
    : kind === 'marketing' && Object.keys(scope).length ? 'Marketing breakdowns do not support this record investigation predicate or narrowing.'
    : metric && (!startDate || !endDate) ? 'Select an explicit start and end date to compare matched periods without changing reporting scope.'
    : !metric && !drill ? 'Select an investigation or supported metric to see its population breakdown.'
    : !selectedClient ? 'Select a workspace to analyse this population.' : null);

  useEffect(() => {
    if (unavailable || (!metric && exceptionData !== undefined)) return;
    const controller = new AbortController();
    const query = JSON.parse(request);
    const call = metric ? kind === 'marketing' ? fetchMarketingRootCause(query, true, controller.signal) : fetchRootCause(query, true, controller.signal) : fetchExceptions(query, true, controller.signal);
    call.then(data => {
      if (!controller.signal.aborted) setResult({ key: requestKey, ...(metric ? kind === 'marketing' ? { marketing: data as MarketingRootCauseData } : { operational: data as RootCauseData } : { exceptions: data as ExceptionAnalyticsData }) });
    }).catch(error => { if (!controller.signal.aborted) setResult({ key: requestKey, error: error?.message || 'The scoped breakdown could not be loaded.' }); });
    return () => controller.abort();
  }, [request, requestKey, unavailable, metric, kind, exceptionData]);

  const activeResult = result?.key === requestKey ? result : null;
  const operational = activeResult?.operational;
  const marketing = activeResult?.marketing;
  const exceptions = exceptionData || activeResult?.exceptions;
  const exception = !metric ? exceptions?.exceptions.find(item => item.id === drill) : undefined;
  const dimensions = operational?.dimensions.map(item => ({ key: item.key, label: item.label })) || marketing?.dimensions.map(item => ({ key: item.key, label: item.label })) || (exception ? [{ key: 'vendor', label: 'Vendor' }, { key: 'source', label: 'Source' }] : []);
  const dimension = dimensions.find(item => item.key === selectedDimension) || dimensions[0];
  const operationalDimension = operational?.dimensions.find(item => item.key === dimension?.key);
  const marketingDimension = marketing?.dimensions.find(item => item.key === dimension?.key);
  const rows: BreakdownRow[] = operationalDimension?.segments.map(item => ({ name: item.name, current: item.currentValue, previous: item.previousValue, contribution: item.contribution, delta: item.currentValue == null || item.previousValue == null ? null : item.currentValue - item.previousValue, shareOfDelta: item.shareOfDelta, population: operational?.metric.kind === 'rate' ? item.currentDenominator : undefined, previousPopulation: operational?.metric.kind === 'rate' ? item.previousDenominator : undefined }))
    || marketingDimension?.segments.map(item => ({ name: item.name, current: item.currentValue, previous: item.previousValue, contribution: item.delta }))
    || (exception ? (dimension?.key === 'source' ? exception.bySource : exception.byVendor).map(item => ({ name: item.name, current: item.count, share: exception.count > 0 ? item.count / exception.count * 100 : null })) : []);
  const title = operational?.metric.label || marketing?.metric?.label || exception?.title || metricLabel || 'Driver analysis';
  const unit = operational?.metric.deltaUnit || (marketing?.metric?.unit === 'currency' ? 'R' : marketing?.metric?.unit) || 'leads';
  const current = operational ? operational.metric.currentValue : marketing?.metric ? marketing.metric.currentValue : exception?.count;
  const previous = operational ? operational.metric.previousValue : marketing?.metric ? marketing.metric.previousValue : exception?.previousCount;
  const delta = operational ? operational.metric.delta : marketing?.metric ? marketing.metric.delta : exception?.absoluteChange;
  const currentWindow = operational?.currentWindow || marketing?.currentWindow || exceptions?.comparison?.current;
  const previousWindow = operational?.previousWindow || marketing?.previousWindow || exceptions?.comparison?.previous;
  const status = operational?.validationStatus || marketing?.validationStatus || exceptions?.validationStatus || 'NOT_VERIFIED';
  const error = unavailable || (!metric && exceptionError) || activeResult?.error || (marketing?.status === 'UNAVAILABLE' ? marketing.reason || 'Marketing evidence is unavailable.' : null) || (exceptions && !exception && !metric ? 'A matched-period exception breakdown is unavailable for this predicate. The exact record population remains available below.' : null);
  const ready = Boolean(operational || marketing?.metric || exception);
  const valueSuffix = operational?.metric.kind === 'rate' || marketing?.metric?.unit === 'pp' ? '%' : marketing?.metric?.unit === 'currency' ? ' R' : '';
  const methodology = operational?.methodology || marketing?.methodology || exceptions?.comparisonReason || '';
  const pin = (row?: BreakdownRow) => onPin?.({ kind: row ? operational ? 'driver' : 'segment' : exception ? 'exception' : 'metric', label: row ? `${dimension?.label}: ${row.name}` : title, value: row ? operational ? `${signed(row.contribution, unit)} contribution` : `${number(row.current)}${valueSuffix}` : `${number(current)}${valueSuffix}`, definition: row ? `${dimension?.label} breakdown of ${title}. Current ${number(row.current)}${row.current != null ? valueSuffix : ''}; previous ${number(row.previous)}${row.previous != null ? valueSuffix : ''}. ${operational ? `Share of delta: ${row.shareOfDelta == null ? 'Unavailable' : `${number(row.shareOfDelta)}%`}. ` : ''}Descriptive evidence; no causal claim.` : exception?.detail || methodology, provenance: exception ? '/api/analytics/offernet/exceptions' : marketing ? '/api/analytics/offernet/marketing-root-cause' : '/api/analytics/offernet/root-cause', identifier: row ? `${dimension?.key}:${row.name}` : metric || drill || '', observedAt: operational?.generatedAt || marketing?.generatedAt || exceptions?.generatedAt });

  return <section className="cx-driver-analysis" aria-labelledby={headingId} aria-busy={!error && !ready}>
    <header><div><p className="cx-driver-eyebrow">Where is it happening?</p><h2 id={headingId}>{title}</h2></div>{ready && <span className="cx-driver-status">{status}</span>}</header>
    {error ? <p className="cx-driver-note" role={activeResult?.error ? 'alert' : undefined}>{error}</p> : !ready ? <p className="cx-driver-note" role="status">Loading the scoped population breakdown…</p> : <>
      <div className="cx-driver-summary"><div><span>Current</span><strong>{number(current)}{current != null ? valueSuffix : ''}</strong><small>{currentWindow ? `${currentWindow.startDate} → ${currentWindow.endDate}` : 'Current reporting scope'}</small></div><div><span>Matched previous</span><strong>{number(previous)}{previous != null ? valueSuffix : ''}</strong><small>{previousWindow ? `${previousWindow.startDate} → ${previousWindow.endDate}` : 'Comparison unavailable'}</small></div><div><span>Change</span><strong>{signed(delta, unit)}</strong><small>{exception ? `Affected distinct leads · Percentage change: ${exception.percentageChange == null ? 'Unavailable' : `${signed(exception.percentageChange)}%`}` : 'Returned metric difference'}</small></div>{onPin && <button type="button" className="cx-driver-pin" onClick={() => pin()}><Pin size={13} aria-hidden="true" /> Pin evidence</button>}</div>
      <p className="cx-driver-note">{exception ? 'Current concentration by vendor and source. Segment comparisons, grade and age breakdowns are unavailable for this exception.' : marketing ? 'Segment changes describe observed media differences; they are not an additive decomposition and do not establish a cause. Dimensions must not be added together.' : 'Descriptive contribution shows where the observed difference is concentrated; matched periods do not establish a cause. Each dimension describes the same population and must not be added to another dimension.'}</p>
      <div className="cx-driver-dimensions" role="group" aria-label="Breakdown dimension">{dimensions.map(item => <button type="button" key={item.key} aria-pressed={dimension?.key === item.key} onClick={() => setSelectedDimension(item.key)}>{item.label}</button>)}</div>
      {dimension && <DriverBreakdown label={dimension.label} rows={rows} unit={unit} compared={!exception} concentration={Boolean(exception)} decomposition={Boolean(operational)} contributionLabel={marketing ? 'Segment change' : 'Descriptive contribution'} recordsAllowed={isAdmin} href={marketing ? undefined : name => { const recordParams = new URLSearchParams(params); if (!recordParams.has('clientId')) recordParams.set('clientId', selectedClient); return driverSegmentLink(recordParams, dimension.key as DriverDimension, name, isAdmin, metric); }} onInspect={onInspect} onPin={onPin ? row => pin(row) : undefined} />}
      <details className="cx-driver-method"><summary>Method, reconciliation and limitations</summary><p>{methodology}</p>{exception && <p>{exceptions?.populationNote}</p>}{operationalDimension && <p>Reconciliation: {operationalDimension.reconciliationStatus || 'NOT_VERIFIED'} · Residual: {signed(operationalDimension.residual, unit)}. Reconciliation describes arithmetic agreement and does not verify source evidence.</p>}<p>Validation: {status}. Missing evidence and unavailable denominators remain unavailable.</p></details>
    </>}
  </section>;
}
