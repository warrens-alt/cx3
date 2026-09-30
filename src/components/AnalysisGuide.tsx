import { useState, useRef, useEffect, useId, type ReactNode } from 'react';
import { Info, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { definitionsForDomain } from '../../contracts/analyticsLineage';
import { navigationPage, relatedPages } from '../lib/navigation';
import { useAuth } from '../lib/AuthContext';
import { useFilters } from '../lib/FilterContext';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import SourceCapabilityNotice from './SourceCapabilityNotice';
import AnalyticsDefinitions from './AnalyticsDefinitions';
import '../styles/guidedAnalytics.css';

const specialContexts: Record<string, { basis: string; grain: string }> = {
  campaigns: { basis: 'Marketing reporting date, not the operational capture date', grain: 'Platform reporting rows at their contracted campaign/ad-set grain; platform events are not unique ledger leads' },
  commercial: { basis: 'Marketing reporting dates and operational capture cohorts remain separate unless an approved attribution contract aligns them', grain: 'Independently aggregated marketing and operational populations; planning budget is not spend' },
  cohorts: { basis: 'Intake-date cohorts followed to the available event cutoff', grain: 'Selected cohort members; recent cohorts have less follow-up time' },
  routing: { basis: 'The route/capture basis declared in the source evidence', grain: 'Lead routes and handoff sequences; route counts need not equal unique leads' },
  'cli-performance': { basis: 'Source-provided report or call date', grain: 'Approved call events or imported CLI report rows; provider contact labels are not automatically RPC' },
};
export interface AnalysisContext { purpose: string; grain: string; basis: string; nullMeaning: string; originalSource?: boolean }
export default function AnalysisGuide({ additionalContent, analysisContext }: { additionalContent?: ReactNode; analysisContext?: AnalysisContext }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (panel.current && !panel.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('[role="dialog"][aria-modal="true"]')) { event.preventDefault(); close(); }
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  const { startDate, endDate } = useFilters();
  const scoped = useScopedNavigationTarget();
  const page = navigationPage(pathname);
  if (!page || page.section === 'settings') return null;
  const domain = pathname.split('/')[1] || 'overview';
  const first = definitionsForDomain(domain)[0];
  const context = analysisContext || specialContexts[domain] || { basis: first?.dateBasis || 'See the metric definition', grain: first?.grain || 'See the source contract' };
  const next = relatedPages(page.section, isAdmin).filter(item => item.path !== page.path && item.path !== '/data-integrity').slice(0, 3);
  return <div className="cx-analysis-help" ref={panel} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
    <button ref={trigger} type="button" className="cx-button-secondary" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen(value => !value)}><Info size={14} aria-hidden="true" />About this analysis</button>
    {open && <section id={panelId} className="cx-analysis-help-panel" aria-label="About this analysis">
      <header className="cx-analysis-dialog-heading"><h2>About this analysis</h2><button type="button" className="cx-icon-button" onClick={close} aria-label="Close about this analysis"><X size={18} /></button></header>
      <div className="cx-analysis-dialog-content cx-read-guide">
        <section><h3>What am I looking at?</h3><p>{analysisContext?.purpose || page.description}</p></section>
        <section><h3>What is counted?</h3><p>{context.grain}.</p><p>Lead counts, vendor routes, call events and contracts are different populations.</p></section>
        <section><h3>Date basis</h3><p>{context.basis}.</p><p>{startDate || 'Open start'} to {endDate || 'Open end'}. The selected period is not the source-feed cutoff.</p></section>
        <section><h3>How to interpret missing values</h3><p>{analysisContext?.nullMeaning || first?.nullMeaning || 'Missing outcomes are not failures. Compare feed completeness and follow-up age.'}</p><p>Review each metric’s numerator and denominator in Metric definitions. Unsupported filters are rejected, not silently removed.</p></section>
        <section><h3>Known source limitations</h3><SourceCapabilityNotice /><p>Source availability does not establish freshness or independent reconciliation. Check Data status for the existing evidence.</p></section>
        {additionalContent}
        <section><h3>{analysisContext?.originalSource ? 'Source field definitions' : 'Metric definitions'}</h3>{analysisContext?.originalSource ? <p>Raw fields retain their original source labels and values. Normalised metric definitions and lineage belong to the separate Operational analysis view.</p> : <AnalyticsDefinitions />}</section>
        <nav aria-label="Continue this investigation">{next.map(item => <Link key={item.path} to={scoped(item.path)} onClick={() => setOpen(false)}>{item.name}</Link>)}<Link to={scoped('/data-integrity')} onClick={() => setOpen(false)}>Check evidence</Link></nav>
      </div>
    </section>}
  </div>;
}
