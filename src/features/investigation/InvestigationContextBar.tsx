import { investigationReasonFor } from '../../../contracts/investigation';
import React, { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useClient } from '../../lib/ClientContext';
import { useFilters } from '../../lib/FilterContext';
import { formatTableNumber } from '../../lib/formatters';
import { filterDescription } from '../../shared/evidence/auditPresentation';
import { clearInvestigationParams, investigationLabel, investigationPath, SEGMENT_KEYS, SEGMENT_LABELS, shareableInvestigationPath, type InvestigationModel } from './investigationModel';

export function useInvestigationModel(overrides: Partial<InvestigationModel> = {}): InvestigationModel {
  const { selectedClient, clientConfig } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [params] = useSearchParams();
  return { type: params.has('drill') ? 'exception' : params.has('investigationMetric') ? 'metric' : 'population', label: investigationLabel(params),
    search: params.get('search') || undefined, drill: params.get('drill') || '', drillValue: params.get('drillValue') || '', metric: params.get('investigationMetric') || '',
    clientId: selectedClient, clientLabel: clientConfig?.name || selectedClient, startDate, endDate, filters,
    segments: SEGMENT_KEYS.filter(key => params.has(key)).map(key => ({ key, label: SEGMENT_LABELS[key], value: params.get(key)! })),
    validationStatus: 'NOT_VERIFIED', dateBasis: 'Lead capture cohort', countingGrain: 'Distinct lead', ...overrides };
}

export default function InvestigationContextBar({ populationCount, validationStatus, dateBasis, countingGrain, loading, receivedAt, selectedLead, onClearLead, evidenceCount, children, compact = false, leading }: {
  evidenceCount?: number; populationCount?: number | null; validationStatus?: string; dateBasis?: string; countingGrain?: string; loading?: boolean; receivedAt?: number | null;
  selectedLead?: string | null; onClearLead?: () => void; children?: React.ReactNode; compact?: boolean; leading?: React.ReactNode;
}) {
  const overrides = { populationCount, ...(validationStatus ? { validationStatus } : {}), ...(dateBasis ? { dateBasis } : {}), ...(countingGrain ? { countingGrain } : {}) };
  const model = useInvestigationModel(overrides);
  const { setFilter } = useFilters();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [notice, setNotice] = useState('');
  const definition = investigationReasonFor(model.drill, model.drillValue);
  const active = model.drill || model.metric || model.segments.length;
  const base = clearInvestigationParams(params); base.delete('search');
  const copyPath = shareableInvestigationPath(location.pathname, params);
  const removeSegment = (key: string) => setParams(previous => { const next = new URLSearchParams(previous); next.delete(key); next.delete('page'); return next; });
  const copy = async () => {
    if (!copyPath) return;
    try { await navigator.clipboard.writeText(new URL(copyPath, window.location.origin).href); setNotice('Scoped link copied. Lead selection remains in this session.'); }
    catch { setNotice('Clipboard unavailable. Use the scoped link shown below.'); }
  };
  const breadcrumbs = <nav aria-label="Investigation narrowing" className="cx-investigation-breadcrumbs"><ol>
      <li><Link to={investigationPath('/investigate', base)}>Investigation inbox</Link></li>
      {(model.drill || model.metric) && <li><Link to={investigationPath('/investigate', params, Object.fromEntries([...SEGMENT_KEYS, 'search'].map(key => [key, null])))}>{model.label}</Link></li>}
      {model.segments.map((segment, index) => <li key={segment.key}><Link to={investigationPath(location.pathname, params, { ...Object.fromEntries([...model.segments.slice(index + 1).map(item => item.key), 'search'].map(key => [key, null])), ...(location.pathname === '/lead-explorer' && params.has('view') ? { view: params.get('view') } : {}) })}>{segment.label}: {segment.value}</Link></li>)}
      {selectedLead ? <li><button type="button" onClick={onClearLead}>Lead {selectedLead.length > 16 ? `${selectedLead.slice(0, 16)}…` : selectedLead} · back to population</button></li> : populationCount != null && <li aria-current="page">{formatTableNumber(populationCount)} leads</li>}
    </ol></nav>;
  const scope = <dl className="cx-investigation-scope"><div><dt>Workspace</dt><dd>{model.clientLabel || 'No workspace selected'}</dd></div><div><dt>Reporting period</dt><dd>{model.startDate || 'Open start'} – {model.endDate || 'Open end'}</dd></div><div><dt>Date basis / grain</dt><dd>{model.dateBasis} · {model.countingGrain}</dd></div><div><dt>Evidence status</dt><dd>{model.validationStatus}</dd></div><div><dt>Refresh</dt><dd>{loading ? 'Loading current scope' : receivedAt ? `Received ${new Date(receivedAt).toLocaleTimeString()}` : 'Receipt time unavailable'}</dd></div></dl>;
  const globalFilters = <div className="cx-investigation-chips" aria-label="Global filters"><span>Global filters</span>{Object.keys(model.filters).length ? Object.entries(model.filters).map(([key, condition]) => <button type="button" key={key} onClick={() => setFilter(key, null)} aria-label={`Remove global ${key} filter`}>{key}: {filterDescription(condition)} ×</button>) : <small>All values in reporting scope</small>}</div>;
  const actions = <div className="cx-investigation-actions">{!compact && evidenceCount !== undefined && <a className="cx-button-secondary" href="#investigation-evidence-tray" onClick={() => { const tray = document.getElementById('investigation-evidence-tray') as HTMLDetailsElement | null; if (tray) tray.open = true; }}>Evidence · {evidenceCount} pins</a>}{active ? <button type="button" className="cx-button-secondary" onClick={() => setParams(clearInvestigationParams(params))}>Clear investigation</button> : null}<button type="button" className="cx-button-secondary" onClick={() => { const toggle = document.querySelector<HTMLButtonElement>('[aria-label="Reporting scope"] .cx-scope-toggle'); if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click(); toggle?.focus(); }}>Change scope</button><button type="button" className="cx-button-secondary" disabled={!copyPath} onClick={() => { void copy(); }}>Copy scoped link</button></div>;
  const narrowing = <div id="investigation-segment" tabIndex={-1}>
      {!compact && globalFilters}
      <div className="cx-investigation-chips" aria-label="Investigation predicate and narrowing"><span>{compact ? 'Narrowing' : 'Investigation'}</span>{!compact && model.drill && <code>{model.drill}{model.drillValue ? `: ${model.drillValue}` : ''}</code>}{model.segments.length ? model.segments.map(segment => <button type="button" key={segment.key} onClick={() => removeSegment(segment.key)} aria-label={`Remove investigation ${segment.label}`}>{segment.label}: {segment.value} ×</button>) : <small>No additional narrowing</small>}</div>
    </div>;
  return <section className="cx-investigation-context" data-compact={compact} aria-label="Investigation context">
    {!compact && breadcrumbs}
    <div className="cx-investigation-heading"><div>{!compact && <span>{active ? 'Active investigation' : 'Reporting scope'}</span>}<h2>{model.label}</h2></div><strong>{loading ? 'Refreshing…' : populationCount == null ? 'Population unavailable' : `${formatTableNumber(populationCount)} affected leads`}</strong></div>
    {compact ? <div className="cx-investigation-case-scope" aria-label="Current case scope"><strong>{model.clientLabel || 'No workspace selected'}</strong><span>{model.startDate || 'Open start'} – {model.endDate || 'Open end'}</span>{Object.entries(model.filters).map(([key, condition]) => <span key={key}>{key}: {filterDescription(condition)}</span>)}{model.segments.map(segment => <span key={segment.key}>{segment.label}: {segment.value}</span>)}<span className="cx-investigation-summary-status">{model.validationStatus}</span>{selectedLead && <button type="button" onClick={onClearLead}>Dossier open · back to population</button>}</div> : scope}
    {!compact && narrowing}
    {leading}
    {!compact && children}
    {!compact && actions}
    <details className="cx-investigation-definition"><summary>{compact ? 'Scope and evidence details' : 'View evidence definition'}</summary>{compact && <>{breadcrumbs}{scope}{globalFilters}{narrowing}{children}{actions}{model.drill && <p>Predicate: <code>{model.drill}{model.drillValue ? `: ${model.drillValue}` : ''}</code></p>}</>}{definition && <p><strong>{definition.label}</strong>{definition.detail ? ` · ${definition.detail}` : ''}</p>}<p>The selected predicate defines membership in the reporting population. Investigation segments are additional restrictions; global filters remain applied. Missing evidence is not zero or proof of failure.</p><p>Matched periods do not equalise lead maturity. Operational evidence remains {model.validationStatus}; it is not an immutable published release.</p><p className="cx-investigation-support-boundary">Evidence sufficiency has not been established. Source coverage does not certify this population. Pins retain their original scopes; analyst conclusions remain notes, separate from validation.</p>{copyPath ? <Link to={copyPath}>{copyPath}</Link> : <p>A scoped link is unavailable while a record search or private identifier filter is active.</p>}</details>
    {notice && <p role="status">{notice}</p>}
  </section>;
}
