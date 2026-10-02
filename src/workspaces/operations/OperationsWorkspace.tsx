import React, { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import './operationsWorkspace.css';

const Overview = lazy(() => import('./OperationsOverview'));
const Contact = lazy(() => import('../../features/contact/ContactPage'));
const Response = lazy(() => import('../../features/contact/SpeedPage'));
const Temporal = lazy(() => import('../../pages/TemporalIntelligence'));
const Cli = lazy(() => import('../../pages/CliPerformance'));
const Agents = lazy(() => import('../../pages/AgentPerformanceIntelligence'));

export const OPERATIONS_WORKSPACE_LENSES = [
  ['overview', 'Overview', '/operations'], ['contact', 'Contact effort', '/operations/contact'],
  ['response', 'Response speed', '/operations/response'], ['dispositions', 'Vendor outcomes', '/operations/dispositions'],
  ['time', 'Time & day', '/operations/time'], ['cli', 'Caller ID', '/operations/cli'], ['agents', 'Agents', '/operations/agents'],
] as const;

export default function OperationsWorkspace({ lens }: { lens?: string }) {
  const location = useLocation();
  const requested = lens || location.pathname.split('/')[2] || 'overview';
  // Preserve the established contact compatibility URL; canonical lenses use paths.
  const legacyDisposition = location.pathname === '/contact-strategy' && (new URLSearchParams(location.search).get('tab') === 'vendor_dispositions' || new URLSearchParams(location.search).has('inspectVendor'));
  const active = requested === 'contact' && legacyDisposition ? 'dispositions' : requested;
  return <div className="cx-product-operations">
    {active !== 'overview' && <div className="cx-operations-workspace-heading"><span>Operations</span><small>Delivery → contact effort → recorded outcomes</small></div>}
    {active === 'agents' && <p className="cx-operations-basis-note">Agent activity uses recorded call-event dates. Unsupported operational filters remain explicit errors.</p>}
    <Suspense fallback={<div className="cx-workspace-lens-loading" role="status">Opening Operations analysis…</div>}>
      {active === 'contact' || active === 'dispositions' ? <Contact initialTab={active === 'dispositions' ? 'vendor_dispositions' : 'call_counts'} workspace />
        : active === 'response' ? <Response /> : active === 'time' ? <Temporal /> : active === 'cli' ? <Cli /> : active === 'agents' ? <Agents /> : <Overview />}
    </Suspense>
  </div>;
}
