import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';
import { AUTHORITATIVE_METRICS } from '../../../contracts/metricRegistry';
import { useAuth } from '../../lib/AuthContext';
import { auditDestination, auditScopeSearch, canShareAuditScope, scopedViewPath, filterDescription, resultState, type AuditScope, type AuditDefinition, type AuditProvenance } from './auditPresentation';
import { useAuditMode } from './AuditMode';
import CopyEvidenceButton from './CopyEvidenceButton';
import EvidenceTrace from './EvidenceTrace';
import MetricAnatomy from './MetricAnatomy';
import EvidenceCoverage from './EvidenceCoverage';
import EvidenceExclusions from './EvidenceExclusions';
import ReconciliationView from './ReconciliationView';
import AuditDependencyMap from './AuditDependencyMap';
import { buildAuditPanelModel } from './auditPanelModel';
import { auditStateLabel, type AuditDimension, type EvidenceTraceNode, type MetricAnatomyModel, type EvidenceCoverageModel, type EvidenceExclusionsModel, type AuditDependencyModel, type AuditReconciliationModel } from './auditVisualModel';
import SupportingRecordPreview from './SupportingRecordPreview';
export { buildScopeSearch } from './auditPresentation';

export interface InspectorContent {
  /** False when a route URL cannot restore this exact evidence contract (use signed replay). */
  shareable?: boolean;
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
  anatomy?: MetricAnatomyModel;
  showAnatomy?: boolean;
  coverage?: EvidenceCoverageModel;
  qualification?: EvidenceExclusionsModel;
  dependencies?: AuditDependencyModel;
  reconciliation?: AuditReconciliationModel;
  trace?: EvidenceTraceNode[];
  dimensions?: AuditDimension[];
}
export default function InspectorHost({ open, onClose, content }: { open: boolean; onClose: () => void; content: InspectorContent | null }) {
  const dialogRef = useDialogAccessibility<HTMLDivElement>(open, onClose);
  const { isAdmin } = useAuth();
  const { enabled: auditEnabled } = useAuditMode();
  const location = useLocation();
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  useEffect(() => { if (!open) setPreviewKey(null); }, [open]);
  if (!open || !content) return null;
  const contract = content.metricId ? AUTHORITATIVE_METRICS[content.metricId] : undefined;
  const provenance = content.provenance;
  const definition = content.definition;
  const scopeSearch = auditScopeSearch(location.search, content.scope);
  const scoped = (path: string) => auditDestination(path, location.search, content.scope);
  const viewPath = scopedViewPath(location.pathname, location.search, content.scope);
  const viewURL = typeof window === 'undefined' ? viewPath : new URL(viewPath, window.location.origin).href;
  const shareable = content.shareable !== false && canShareAuditScope(scopeSearch) && canShareAuditScope(location.search);
  const params = new URLSearchParams(scopeSearch);
  let filters: Record<string, unknown> = content.scope?.filters || {};
  if (!content.scope) {
    try { filters = JSON.parse(params.get('filters') || '{}'); } catch { filters = { filters: params.get('filters') }; }
    for (const key of ['vendor', 'source', 'medium', 'grade', 'cli', 'campaign', 'channel', 'adset', 'agent']) if (params.has(key)) filters[key] = params.getAll(key).join(', ');
  }
  const validation = provenance?.validationStatus || 'NOT_VERIFIED';
  const grain = provenance?.countingGrain || definition?.grain || contract?.countingGrain;
  const dateBasis = provenance?.dateBasis || definition?.dateBasis || contract?.dateBasis;
  const state = resultState(content.value);
  const drillPath = content.recordDrill ? `/lead-explorer?${new URLSearchParams({ view: 'population', drill: content.recordDrill.drill, ...(content.recordDrill.drillValue ? { drillValue: content.recordDrill.drillValue } : {}) })}` : null;
  const technical = [
    ['Metric ID', content.metricId], ['Metric version', provenance?.metricVersion || contract?.version],
    ['Query job ID', provenance?.queryJobId], ['Report version', provenance?.reportVersion],
    ['Model version', provenance?.modelVersion], ['Timezone', provenance?.timezone || contract?.timezone],
    ['Contract source (definition only)', contract?.source],
    ['Field mapping', contract?.mappingStatus], ['Source business meaning', contract?.sourceContractStatus],
    ['Contract reconciliation declaration', contract?.reconciliationStatus],
  ].filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0);
  const hasComponents = content.numeratorCount !== undefined || content.denominatorCount !== undefined;
  const scopeDescription = `${content.scope?.clientLabel || params.get('clientId') || 'Workspace not supplied'} · ${params.get('startDate') || 'No start bound'} → ${params.get('endDate') || 'No end bound'}`;
  const visual = buildAuditPanelModel(content, scopeDescription);
  const recordPath = drillPath ? scoped(drillPath) : null;
  const currentPreviewKey = JSON.stringify([content.title, recordPath]);
  const panel = <div className="cx-audit-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="inspector-title" className="cx-audit-drawer">
      <header><div><span className="cx-audit-eyebrow">Audit evidence</span><h2 id="inspector-title">{content.title}</h2>{content.subtitle && <p>{content.subtitle}</p>}</div><button type="button" className="cx-icon-button" onClick={onClose} aria-label="Close inspector"><X size={18}/></button></header>
      <div className="cx-audit-body">
<section className="cx-audit-result"><h3 className="sr-only">Result</h3><strong>{state === 'Unavailable' ? '—' : content.value}</strong>{content.unit && state !== 'Unavailable' && <span>{content.unit}</span>}<p>{state} · <span data-validation={validation}>{validation === 'NOT_VERIFIED' ? 'Not verified (NOT_VERIFIED)' : validation}</span></p>{content.relatedValue && <p>{content.relatedValue.label}: {content.relatedValue.value ?? '—'}</p>}<p id="audit-metric-definition">{definition?.meaning || contract?.plainDefinition || content.subtitle || 'A metric definition is not supplied for this aggregate.'}</p>
          <p className="cx-audit-scope-summary"><b>Scope</b><br />{params.get('startDate') || 'No start bound'}{params.get('endDate') !== params.get('startDate') ? ` → ${params.get('endDate') || 'No end bound'}` : ''} · {filters.vendor !== undefined ? filterDescription(filters.vendor) : 'All vendors'} · {filters.source !== undefined ? filterDescription(filters.source) : 'All sources'}{Object.keys(filters).filter(key => !['vendor', 'source'].includes(key)).length > 0 ? ` · ${Object.keys(filters).filter(key => !['vendor', 'source'].includes(key)).length} additional filters` : ''}</p>
        </section>
        <section className="cx-audit-state-section"><h3>Evidence state</h3><ul className="cx-audit-dimensions" aria-label="Independent evidence dimensions">{visual.dimensions.map(dimension => <li key={dimension.key} data-state={dimension.state}><div><strong>{dimension.label}</strong><span>{auditStateLabel(dimension.state)}</span></div>{dimension.detail && <small>{dimension.detail}</small>}</li>)}</ul></section>
        {content.showAnatomy !== false && <section><MetricAnatomy model={visual.anatomy}/></section>}
        <section><EvidenceTrace nodes={visual.trace} label="Evidence trace"/></section>
        {content.coverage && <section><EvidenceCoverage model={content.coverage}/></section>}
        {content.qualification && <section><EvidenceExclusions model={content.qualification}/></section>}
        {content.dependencies && <section><AuditDependencyMap model={content.dependencies}/></section>}
        <section><ReconciliationView model={visual.reconciliation}/></section>
        <div className="cx-audit-limitations">
          {(definition?.nullMeaning || contract?.treatmentOfUnknown) && <p>{definition?.nullMeaning || contract?.treatmentOfUnknown.replaceAll('_', ' ')}</p>}
          {(definition?.limitations || contract?.caveats)?.length ? <div role="note"><strong>Limitations</strong><ul>{(definition?.limitations || contract?.caveats)!.map((item, index) => <li key={index}>{item}</li>)}</ul></div> : null}
        </div>
<section className="cx-audit-support"><h3>Supporting records</h3>{isAdmin && recordPath ? <><button type="button" className="cx-button-secondary" aria-expanded={previewKey === currentPreviewKey} onClick={() => setPreviewKey(previewKey === currentPreviewKey ? null : currentPreviewKey)}>{previewKey === currentPreviewKey ? 'Hide supporting preview' : 'Load supporting preview'}</button>{previewKey === currentPreviewKey && <SupportingRecordPreview key={currentPreviewKey} recordPath={recordPath}/>}<Link className="cx-button-primary" to={recordPath} onClick={onClose}>Inspect supporting records <ExternalLink size={13}/></Link></> : <p>{drillPath ? 'Individual lead records and timeline events require administrator access.' : 'Record-level evidence is not available for this aggregate.'}</p>}{content.detailLimitation && <p>{content.detailLimitation}</p>}
          {content.reportPath && <Link className="cx-button-secondary" to={scoped(content.reportPath)} onClick={onClose}>Open detailed analysis</Link>}
        </section>
<details className="cx-audit-disclosure" open={auditEnabled || undefined}><summary>How this is calculated</summary>
          {hasComponents && <dl className="cx-audit-calculation">
            {content.numeratorCount !== undefined && <div><dt>{content.numeratorLabel || contract?.numeratorDescription || 'Supplied numerator'}</dt><dd>{content.numeratorCount?.toLocaleString() ?? '— (Unavailable)'}</dd></div>}
            {content.denominatorCount !== undefined && <div><dt>{content.denominatorLabel || contract?.denominatorDescription || 'Supplied denominator'}</dt><dd>{content.denominatorCount?.toLocaleString() ?? '— (Unavailable)'}</dd></div>}
          </dl>}
          {definition?.calculation ? <p>{definition.calculation}</p> : contract ? <><p>{contract.numeratorDescription}{contract.denominatorDescription ? ` / ${contract.denominatorDescription}` : ''}</p>{contract.denominator === null && <p>Count / sum; no denominator.</p>}</> : <p>Calculation metadata is not supplied for this aggregate.</p>}
          {content.rate !== undefined && <p>Supplied rate: {content.rate ?? '— (Unavailable)'}</p>}
        </details>
<details className="cx-audit-disclosure" open={auditEnabled || undefined}><summary>Reporting scope &amp; filters</summary><dl>
          <div><dt>Workspace</dt><dd>{content.scope?.clientLabel || params.get('clientId') || params.get('workspace') || 'Not supplied'}{content.scope?.clientLabel && <small>{content.scope.clientId}</small>}</dd></div>
          <div><dt>Period</dt><dd>{params.get('startDate') || 'No start bound'} → {params.get('endDate') || 'No end bound'}</dd></div>
          {dateBasis && <div><dt>Date basis</dt><dd>{dateBasis}</dd></div>}
          <div><dt>Vendor</dt><dd>{filters.vendor !== undefined ? filterDescription(filters.vendor) : 'All (no vendor filter)'}</dd></div>
          <div><dt>Source</dt><dd>{filters.source !== undefined ? filterDescription(filters.source) : 'All (no source filter)'}</dd></div>
          {Object.entries(filters).filter(([key]) => !['vendor', 'source'].includes(key)).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{filterDescription(value)}</dd></div>)}
        </dl>{shareable ? <><CopyEvidenceButton value={viewURL} label="Copy scoped link"/><details><summary>Scoped view link</summary><p className="cx-audit-selectable">{viewURL}</p><p>Restores the report and supported URL scope. A selected metric or local drawer state is not encoded unless the report already supports it.</p></details></> : <p>{content.shareable === false ? 'Use the signed replay token to restore this immutable report. A page link cannot restore its complete execution contract.' : 'This exact record-search or private-identity scope is local and cannot be copied as a shareable link.'}</p>}</details>
<details className="cx-audit-disclosure" open={auditEnabled || undefined}><summary>Data provenance</summary><dl><div><dt>Validation</dt><dd data-validation={validation}>{validation}</dd></div>
          {Object.entries({ 'Source / table': provenance?.source, 'Source completeness': provenance?.sourceCompleteness, 'Evaluated at': provenance?.evaluatedAt, 'Generated at': provenance?.generatedAt, 'Observation cutoff': provenance?.observationCutoff }).filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>{provenance?.generatedAt && <p>Generated at describes this response, not source freshness.</p>}{!provenance?.source && <p>Additional source provenance is not supplied by this operational response.</p>}
          <p>Approved field mapping does not certify source business meaning or reconcile production totals. Operational analytics are separate from immutable published reporting releases.</p><Link to={scoped('/reports')} onClick={onClose}>View evidence releases</Link>
        </details>
<details className="cx-audit-disclosure" open={auditEnabled || undefined}><summary>Metric definition &amp; technical details</summary><dl>{grain && <div><dt>Counting grain</dt><dd>{grain}</dd></div>}</dl><dl>{technical.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{contract && <><p>Eligibility: {contract.eligibility}</p><p>Exclusions: {contract.exclusions}</p></>}{content.details}{technical.length === 0 && !content.details && <p>No additional technical metadata is supplied.</p>}</details>
      </div><footer><button type="button" className="cx-button-secondary" onClick={onClose}>Close</button></footer>
    </div>
  </div>;
  // A dossier is sticky, scrollable and a size container. Its stacking context
  // must not trap a modal audit overlay or the dialog's background/focus locks.
  return typeof document === 'undefined' ? panel : createPortal(panel, document.body);
}
