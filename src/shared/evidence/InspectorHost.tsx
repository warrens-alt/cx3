import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';
import { AUTHORITATIVE_METRICS } from '../../../contracts/metricRegistry';
import { useAuth } from '../../lib/AuthContext';
import { useScopedNavigationTarget } from '../../hooks/useScopedNavigationTarget';
import { navigationTarget } from '../../lib/presentation';
import { buildScopeSearch, scopedViewPath, filterDescription, resultState, type AuditScope, type AuditDefinition, type AuditProvenance } from './auditPresentation';
import CopyEvidenceButton from './CopyEvidenceButton';
export { buildScopeSearch } from './auditPresentation';

export interface InspectorContent {
  type: 'metric' | 'stage' | 'segment' | 'custom';
  metricId?: string;
  title: string;
  subtitle?: string;
  value?: string | number | null;
  unit?: string;
  numeratorCount?: number | null;
  numeratorLabel?: string;
  denominatorCount?: number | null;
  denominatorLabel?: string;
  rate?: number | null;
  relatedValue?: { label: string; value: string | number | null };
  reportPath?: string;
  reportLabel?: string;
  detailLimitation?: string;
  recordDrill?: { drill: string; drillValue?: string; label?: string };
  details?: React.ReactNode;
  scope?: AuditScope;
  definition?: AuditDefinition;
  provenance?: AuditProvenance;
}
export default function InspectorHost({ open, onClose, content }: { open: boolean; onClose: () => void; content: InspectorContent | null }) {
  const dialogRef = useDialogAccessibility<HTMLDivElement>(open, onClose);
  const { isAdmin } = useAuth();
  const location = useLocation();
  const scopedTarget = useScopedNavigationTarget();
  if (!open || !content) return null;
  const contract = content.metricId ? AUTHORITATIVE_METRICS[content.metricId] : undefined;
  const provenance = content.provenance;
  const definition = content.definition;
  const scopeSearch = content.scope ? new URL(scopedViewPath(location.pathname, location.search, content.scope), 'https://scope.invalid').search : undefined;
  const scoped = (path: string) => {
    const target = scopeSearch !== undefined ? navigationTarget(path, location.pathname, scopeSearch) : scopedTarget(path);
    return target.pathname + target.search;
  };
  const viewPath = scopedViewPath(location.pathname, location.search, content.scope);
  const viewURL = typeof window === 'undefined' ? viewPath : new URL(viewPath, window.location.origin).href;
  const params = new URLSearchParams(scopeSearch ?? location.search);
  let filters: Record<string, unknown> = content.scope?.filters || {};
  if (!content.scope) {
    try { filters = JSON.parse(params.get('filters') || '{}'); } catch { filters = { filters: params.get('filters') }; }
    for (const key of ['vendor', 'source', 'medium', 'grade', 'cli', 'campaign', 'channel', 'adset', 'agent']) if (params.has(key)) filters[key] = params.getAll(key).join(', ');
  }
  const validation = provenance?.validationStatus || contract?.reconciliationStatus || 'NOT_VERIFIED';
  const grain = provenance?.countingGrain || definition?.grain || contract?.countingGrain;
  const dateBasis = provenance?.dateBasis || definition?.dateBasis || contract?.dateBasis;
  const state = resultState(content.value);
  const drillPath = content.recordDrill ? `/lead-explorer?${new URLSearchParams({ drill: content.recordDrill.drill, ...(content.recordDrill.drillValue ? { drillValue: content.recordDrill.drillValue } : {}) })}` : null;
  const technical = [
    ['Metric ID', content.metricId], ['Metric version', provenance?.metricVersion || contract?.version],
    ['Query job ID', provenance?.queryJobId], ['Report version', provenance?.reportVersion],
    ['Model version', provenance?.modelVersion], ['Timezone', provenance?.timezone || contract?.timezone],
    ['Contract source (definition only)', contract?.source],
  ].filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0);
  const hasComponents = content.numeratorCount !== undefined || content.denominatorCount !== undefined;
  return <div className="cx-audit-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="inspector-title" className="cx-audit-drawer">
      <header><div><span className="cx-audit-eyebrow">Audit evidence</span><h2 id="inspector-title">{content.title}</h2>{content.subtitle && <p>{content.subtitle}</p>}</div><button type="button" className="cx-icon-button" onClick={onClose} aria-label="Close inspector"><X size={18}/></button></header>
      <div className="cx-audit-body">
        <section className="cx-audit-result"><h3>Result</h3><strong>{state === 'Unavailable' ? '—' : content.value}</strong>{content.unit && state !== 'Unavailable' && <span>{content.unit}</span>}<p>{state} · <span data-validation={validation}>{validation === 'NOT_VERIFIED' ? 'Not verified (NOT_VERIFIED)' : validation}</span></p>{content.relatedValue && <p>{content.relatedValue.label}: {content.relatedValue.value ?? '—'}</p>}</section>
        <section id="audit-metric-definition"><h3>What this means</h3><p>{definition?.meaning || contract?.plainDefinition || content.subtitle || 'A metric definition is not supplied for this aggregate.'}</p><dl>
          {grain && <div><dt>Counting grain</dt><dd>{grain}</dd></div>}
          {(definition?.nullMeaning || contract?.treatmentOfUnknown) && <div><dt>Unknown value treatment</dt><dd>{definition?.nullMeaning || contract?.treatmentOfUnknown.replaceAll('_', ' ')}</dd></div>}
        </dl>{(definition?.limitations || contract?.caveats)?.length ? <details><summary>Limitations</summary><ul>{(definition?.limitations || contract?.caveats)!.map((item, index) => <li key={index}>{item}</li>)}</ul></details> : null}</section>
        <section><h3>How it is calculated</h3>
          {hasComponents && <dl className="cx-audit-calculation">
            {content.numeratorCount !== undefined && <div><dt>{content.numeratorLabel || contract?.numeratorDescription || 'Supplied numerator'}</dt><dd>{content.numeratorCount?.toLocaleString() ?? '— (Unavailable)'}</dd></div>}
            {content.denominatorCount !== undefined && <div><dt>{content.denominatorLabel || contract?.denominatorDescription || 'Supplied denominator'}</dt><dd>{content.denominatorCount?.toLocaleString() ?? '— (Unavailable)'}</dd></div>}
          </dl>}
          {definition?.calculation ? <p>{definition.calculation}</p> : contract ? <><p>{contract.numeratorDescription}{contract.denominatorDescription ? ` / ${contract.denominatorDescription}` : ''}</p>{contract.denominator === null && <p>Count / sum; no denominator.</p>}</> : <p>Calculation metadata is not supplied for this aggregate.</p>}
          {content.rate !== undefined && <p>Supplied rate: {content.rate ?? '— (Unavailable)'}</p>}
        </section>
        <section><h3>Reporting scope</h3><dl>
          <div><dt>Workspace</dt><dd>{content.scope?.clientLabel || params.get('clientId') || params.get('workspace') || 'Not supplied'}{content.scope?.clientLabel && <small>{content.scope.clientId}</small>}</dd></div>
          <div><dt>Period</dt><dd>{params.get('startDate') || 'No start bound'} → {params.get('endDate') || 'No end bound'}</dd></div>
          {dateBasis && <div><dt>Date basis</dt><dd>{dateBasis}</dd></div>}
          <div><dt>Vendor</dt><dd>{filters.vendor !== undefined ? filterDescription(filters.vendor) : 'All (no vendor filter)'}</dd></div>
          <div><dt>Source</dt><dd>{filters.source !== undefined ? filterDescription(filters.source) : 'All (no source filter)'}</dd></div>
          {Object.entries(filters).filter(([key]) => !['vendor', 'source'].includes(key)).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{filterDescription(value)}</dd></div>)}
        </dl><CopyEvidenceButton value={viewURL} label="Copy scoped link"/><details><summary>Scoped view link</summary><p className="cx-audit-selectable">{viewURL}</p><p>Restores the report and supported URL scope. A selected metric or local drawer state is not encoded unless the report already supports it.</p></details></section>
        <section><h3>Data / validation evidence</h3><dl><div><dt>Validation</dt><dd data-validation={validation}>{validation}</dd></div>
          {Object.entries({ 'Source / table': provenance?.source, 'Source completeness': provenance?.sourceCompleteness, 'Evaluated at': provenance?.evaluatedAt, 'Generated at': provenance?.generatedAt, 'Observation cutoff': provenance?.observationCutoff }).filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>{provenance?.generatedAt && <p>Generated at describes this response, not source freshness.</p>}{!provenance?.source && <p>Additional source provenance is not supplied by this operational response.</p>}
          <p>Operational analytics are separate from immutable published reporting releases.</p><Link to={scoped('/reports')} onClick={onClose}>View evidence releases</Link>
        </section>
        <section><h3>Supporting records</h3>{isAdmin && drillPath ? <Link className="cx-button-primary" to={scoped(drillPath)} onClick={onClose}>Inspect supporting records <ExternalLink size={13}/></Link> : <p>{drillPath ? 'Individual lead records and timeline events require administrator access.' : 'Record-level evidence is not available for this aggregate.'}</p>}{content.detailLimitation && <p>{content.detailLimitation}</p>}
          {content.reportPath && <Link className="cx-button-secondary" to={scoped(content.reportPath)} onClick={onClose}>Open detailed analysis</Link>}
        </section>
        <section><h3>Technical details</h3><details><summary>View metric definition and supplied metadata</summary><dl>{technical.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{contract && <><p>Eligibility: {contract.eligibility}</p><p>Exclusions: {contract.exclusions}</p></>}{content.details}{technical.length === 0 && !content.details && <p>No additional technical metadata is supplied.</p>}</details></section>
      </div><footer><button type="button" className="cx-button-secondary" onClick={onClose}>Close</button></footer>
    </div>
  </div>;
}
