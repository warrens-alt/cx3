import React, { lazy, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { ReportSkeleton } from '../../components/OperationalState';
import { ReportStatusSlot } from '../../shared/reporting/ReportPresentation';
import { useScopedNavigationTarget } from '../../hooks/useScopedNavigationTarget';
import '../evidence/evidenceWorkspace.css';
import './commercialWorkspace.css';

const Commercial = lazy(() => import('../../pages/CommercialIntelligence'));
const Reconciliation = lazy(() => import('../../pages/CommercialReconciliation'));
export type CommercialLens = 'bridge' | 'reconciliation';
export default function CommercialWorkspace({ lens }: { lens?: CommercialLens }) {
  const location = useLocation();
  const scoped = useScopedNavigationTarget();
  const active = lens || (['/reconciliation', '/commercial/reconciliation'].includes(location.pathname) ? 'reconciliation' : 'bridge');
  return <section className="cx-command-content cx-product-workspace cx-commercial-product-workspace" aria-label="Commercial workspace">
    <header className="cx-product-workspace-heading"><div><h1>Commercial</h1><p>Connect observed media spend and recorded outcomes to the evidence needed for commercial decisions.</p></div><div className="cx-page-actions"><Link className="cx-button-secondary" to={scoped('/campaigns')}>Campaign & channel evidence <ArrowUpRight size={14} aria-hidden="true" /></Link><ReportStatusSlot /></div></header>
    <div className="cx-product-workspace-panel"><Suspense fallback={<ReportSkeleton label="Opening commercial evidence" />}>{active === 'reconciliation' ? <Reconciliation embedded /> : <Commercial embedded />}</Suspense></div>
  </section>;
}
