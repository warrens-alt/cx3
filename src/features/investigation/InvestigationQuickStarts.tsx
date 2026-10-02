import React from 'react';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { conceptIcons } from '../../shared/visuals/lifecyclePresentation';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { clearInvestigationParams, investigationPath } from './investigationModel';

export default function InvestigationQuickStarts() {
  const [params] = useSearchParams();
  const { isAdmin } = useAuth();
  const base = clearInvestigationParams(params);
  const { timing: Timing, exception: Exception, vendor: Vendor, investigation: Investigation, evidence: Evidence } = conceptIcons;
  return <nav id="investigation-signal" tabIndex={-1} className="cx-investigation-starts" aria-label="Start an investigation">
    <Link to={investigationPath('/investigate', base, { investigationMetric: 'fetchedLeads', search: null })}><TrendingUp size={17} aria-hidden="true"/><span>What changed?</span><ArrowRight size={13} aria-hidden="true"/></Link>
    <Link to={investigationPath('/investigate', base, { drill: 'awaiting-first-dial', search: null })}><Timing size={17} aria-hidden="true"/><span>Where are leads stuck?</span><ArrowRight size={13} aria-hidden="true"/></Link>
    <a href="#exception-workbench"><Exception size={17} aria-hidden="true"/><span>Inspect exceptions</span><ArrowRight size={13} aria-hidden="true"/></a>
    <Link to={investigationPath('/investigate', base, { investigationMetric: 'leadToSaleRate', search: null })}><Vendor size={17} aria-hidden="true"/><span>Vendor / source contribution</span><ArrowRight size={13} aria-hidden="true"/></Link>
    {isAdmin && <Link to={investigationPath('/lead-explorer', base, { search: null })}><Investigation size={17} aria-hidden="true"/><span>Find a specific lead</span><ArrowRight size={13} aria-hidden="true"/></Link>}
    <Link to={investigationPath('/data-integrity', params)}><Evidence size={17} aria-hidden="true"/><span>Can I trust this evidence?</span><ArrowRight size={13} aria-hidden="true"/></Link>
  </nav>;
}
