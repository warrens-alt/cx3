import React, { lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useScopedNavigationTarget } from '../../hooks/useScopedNavigationTarget';
import { ReportSkeleton } from '../../components/OperationalState';
import './evidenceWorkspace.css';

const Integrity = lazy(() => import('../../pages/DataIntegrityIntelligence'));
const Releases = lazy(() => import('../../pages/VersionedReports'));
const Warehouse = lazy(() => import('../../pages/WarehouseAnalytics'));
const Vendors = lazy(() => import('../../pages/VendorPerformance'));
export type EvidenceLens = 'overview' | 'sources' | 'metrics' | 'reconciliation' | 'releases' | 'warehouse' | 'vendors';
interface WorkspaceLens { id: EvidenceLens; label: string; path: string; detail: string }
export const EVIDENCE_LENSES: readonly WorkspaceLens[] = [
  { id: 'overview', label: 'Overview', path: '/evidence', detail: 'Observed gaps and independent evidence states' },
  { id: 'sources', label: 'Sources', path: '/evidence/sources', detail: 'Tenant-wide source observations and declared dependencies' },
  { id: 'metrics', label: 'Metrics', path: '/evidence/metrics', detail: 'Metric definitions and visual lineage' },
  { id: 'reconciliation', label: 'Reconciliation', path: '/evidence/reconciliation', detail: 'Measured gaps, independent comparison and operator evidence' },
  { id: 'releases', label: 'Releases', path: '/evidence/releases', detail: 'Immutable execution, release manifests and signed replay' },
  { id: 'warehouse', label: 'Warehouse', path: '/evidence/warehouse', detail: 'Registered catalogue and authorised source reads' },
  { id: 'vendors', label: 'Vendor evidence', path: '/evidence/vendors', detail: 'Vendor populations from an approved immutable release' },
];
export function evidenceLensForPath(path: string): EvidenceLens {
  if (['/reports', '/evidence/releases'].includes(path)) return 'releases';
  if (['/warehouse', '/warehouse-analytics', '/evidence/warehouse'].includes(path)) return 'warehouse';
  if (['/vendors', '/evidence/vendors'].includes(path)) return 'vendors';
  return (EVIDENCE_LENSES.find(item => item.path === path)?.id as EvidenceLens) || 'overview';
}

export default function EvidenceWorkspace({ lens }: { lens?: EvidenceLens }) {
  const location = useLocation();
  const navigate = useNavigate();
  const scoped = useScopedNavigationTarget();
  const active = lens || evidenceLensForPath(location.pathname);
  const legacyIntegrity = location.pathname === '/data-integrity';
  const changeSection = (section: string) => {
    const mapped = section === 'issues' ? 'reconciliation' : section === 'definitions' ? 'metrics' : section === 'diagnostics' ? 'sources' : section;
    navigate(scoped(EVIDENCE_LENSES.find(item => item.id === mapped)?.path || '/evidence'));
  };
  return <section className="cx-command-content cx-product-workspace cx-evidence-product-workspace" aria-label="Evidence workspace">
    <header className="cx-product-workspace-heading"><div><h1>Evidence</h1><p>Follow every observation to its source, definition and independent validation state.</p></div></header>
    <div className="cx-product-workspace-panel"><Suspense fallback={<ReportSkeleton label="Opening evidence lens" />}>
      {active === 'releases' ? <Releases embedded /> : active === 'warehouse' ? <Warehouse embedded /> : active === 'vendors' ? <Vendors embedded />
        : <Integrity embedded section={legacyIntegrity ? undefined : active} onSectionChange={changeSection} />}
    </Suspense></div>
  </section>;
}
