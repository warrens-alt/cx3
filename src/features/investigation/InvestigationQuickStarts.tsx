import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { clearInvestigationParams, investigationPath } from './investigationModel';

export default function InvestigationQuickStarts() {
  const [params] = useSearchParams();
  const { isAdmin } = useAuth();
  const base = clearInvestigationParams(params);
  return <nav id="investigation-signal" tabIndex={-1} className="cx-investigation-starts" aria-label="Start an investigation">
    <Link to={investigationPath('/investigate', base, { investigationMetric: 'fetchedLeads', search: null })}>What changed?<ArrowRight size={14}/></Link>
    <Link to={investigationPath('/investigate', base, { drill: 'awaiting-first-dial', search: null })}>Where are leads getting stuck?<ArrowRight size={14}/></Link>
    <a href="#exception-workbench">Which exceptions need attention?<ArrowRight size={14}/></a>
    <Link to={investigationPath('/investigate', base, { investigationMetric: 'leadToSaleRate', search: null })}>Which vendor or source contributes most?<ArrowRight size={14}/></Link>
    {isAdmin && <Link to={investigationPath('/lead-explorer', base, { search: null })}>Find a specific lead<ArrowRight size={14}/></Link>}
    <Link to={investigationPath('/data-integrity', params)}>Can I trust this evidence?<ArrowRight size={14}/></Link>
  </nav>;
}
