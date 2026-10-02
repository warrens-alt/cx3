import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ScanSearch } from 'lucide-react';
import type { ExceptionAnalyticsData } from '../../../contracts/exceptionAnalytics';
import { formatTableNumber } from '../../lib/formatters';
import { useInvestigationModel } from './InvestigationContextBar';
import { investigationPath } from './investigationModel';
import InvestigationQuickStarts from './InvestigationQuickStarts';
import SavedInvestigations from './SavedInvestigations';

/** Case navigation consumes returned observations; it never fetches another population. */
export default function InvestigationCaseRail({ signals, populationCount, validationStatus }: {
  signals?: ExceptionAnalyticsData['exceptions'];
  populationCount?: number | null;
  validationStatus?: string;
}) {
  const model = useInvestigationModel();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1180px)').matches);
  const active = Boolean(model.drill || model.metric);
  return <aside className="cx-investigation-signal-panel" aria-label="Signals and case context">
    <details className="cx-investigation-case-rail" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary><ScanSearch size={16} aria-hidden="true" /><span>Signals &amp; saved cases</span><ChevronDown size={14} aria-hidden="true" /></summary>
      <div className="cx-investigation-case-rail-body">
        <section className="cx-investigation-active-signal" aria-label="Active signal">
          <span className="cx-investigation-rail-eyebrow">{active ? 'Active signal' : 'Case context'}</span>
          <h2>{model.label}</h2>
          <p>{populationCount == null ? 'Affected population unavailable' : `${formatTableNumber(populationCount)} affected leads`}</p>
          <small>{validationStatus || 'NOT_VERIFIED'}</small>
        </section>
        {model.segments.length > 0 && <section className="cx-investigation-rail-segments" aria-label="Active case segments"><h3>Selected segments</h3>{model.segments.map(segment => <button type="button" className="cx-button-secondary" key={segment.key} aria-label={`Remove case segment ${segment.label}: ${segment.value}`} onClick={() => setParams(previous => { const next = new URLSearchParams(previous); next.delete(segment.key); next.delete('page'); return next; })}>{segment.label}: {segment.value}<span aria-hidden="true">×</span></button>)}</section>}
        <SavedInvestigations />
        {signals && signals.length > 0 && <nav className="cx-investigation-signal-list" aria-label="Observed signals"><h3>Observed signals</h3>{signals.map(signal => <Link key={signal.id} aria-current={model.drill === signal.id ? 'true' : undefined} to={investigationPath('/investigate', params, { drill: signal.id, drillValue: null, investigationMetric: null, search: null })}><span>{signal.title}<small>{signal.severity ? `${signal.severity} severity` : 'Severity not supplied'}</small></span><strong>{signal.count == null ? 'Unavailable' : formatTableNumber(signal.count)}</strong></Link>)}</nav>}
        <section className="cx-investigation-rail-starts"><h3>{active ? 'Explore another question' : 'Start an investigation'}</h3><InvestigationQuickStarts /></section>
      </div>
    </details>
  </aside>;
}
