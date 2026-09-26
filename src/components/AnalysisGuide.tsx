import { Link, useLocation } from 'react-router-dom';
import { definitionsForDomain } from '../../contracts/analyticsLineage';
import { navigationPage, relatedPages } from '../lib/navigation';
import { useAuth } from '../lib/AuthContext';
import { useFilters } from '../lib/FilterContext';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import SourceCapabilityNotice from './SourceCapabilityNotice';
import '../styles/guidedAnalytics.css';

const specialContexts: Record<string, { basis: string; grain: string }> = {
  campaigns: { basis: 'Marketing reporting date, not the operational capture date', grain: 'Platform reporting rows at their contracted campaign/ad-set grain; platform events are not unique ledger leads' },
  commercial: { basis: 'Marketing reporting dates and operational capture cohorts remain separate unless an approved attribution contract aligns them', grain: 'Independently aggregated marketing and operational populations; planning budget is not spend' },
  cohorts: { basis: 'Intake-date cohorts followed to the available event cutoff', grain: 'Selected cohort members; recent cohorts have less follow-up time' },
  routing: { basis: 'The route/capture basis declared in the source evidence', grain: 'Lead routes and handoff sequences; route counts need not equal unique leads' },
  'cli-performance': { basis: 'Source-provided report or call date', grain: 'Approved call events or imported CLI report rows; provider contact labels are not automatically RPC' },
};
export default function AnalysisGuide() {
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  const { startDate, endDate } = useFilters();
  const scoped = useScopedNavigationTarget();
  const page = navigationPage(pathname);
  if (!page || page.section === 'settings') return null;
  const domain = pathname.split('/')[1] || 'overview';
  const first = definitionsForDomain(domain)[0];
  const context = specialContexts[domain] || { basis: first?.dateBasis || 'See the metric definition', grain: first?.grain || 'See the source contract' };
  const next = relatedPages(page.section, isAdmin).filter(item => item.path !== page.path && item.path !== '/data-integrity').slice(0, 3);
  return <><SourceCapabilityNotice/><details className="cx-read-guide">
    <summary>How to read this view <span>{page.description}</span></summary>
    <div className="cx-read-guide-grid"><div><strong>Reporting basis</strong><p>{context.basis}.</p><p>{startDate || 'Open start'} to {endDate || 'Open end'}. The selected period is not the source-feed cutoff.</p></div><div><strong>What is counted?</strong><p>{context.grain}.</p><p>Lead counts, vendor routes, call events and contracts are different populations.</p></div><div><strong>Before drawing a conclusion</strong><p>Missing outcomes are not failures. Compare feed completeness and follow-up age. Review each metric’s numerator and denominator in Metric definitions. Unsupported filters are rejected, not silently removed.</p></div></div>
    <nav aria-label="Continue this investigation">{next.map(item => <Link key={item.path} to={scoped(item.path)}>{item.name}</Link>)}<Link to={scoped('/data-integrity')}>Check evidence</Link></nav>
  </details></>;
}
