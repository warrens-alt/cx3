import React, { lazy, Suspense, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useClient } from '../../lib/ClientContext';
import { useScopedNavigationTarget } from '../../hooks/useScopedNavigationTarget';
import { selectionLabel, validJourneySelection, type JourneySelection } from './journeySelection';
import './journeyWorkspace.css';

const JourneyWorkbench = lazy(() => import('./JourneyWorkbench'));
const Acquisition = lazy(() => import('../../pages/CampaignIntelligence'));
const Qualification = lazy(() => import('../../pages/Vetting'));
const Routing = lazy(() => import('../../pages/RoutingIntelligence'));
const Process = lazy(() => import('../../pages/OffershopProcessObservability'));
const Vendors = lazy(() => import('../../pages/VendorLeadQuality'));
const Cohorts = lazy(() => import('../../pages/Cohorts'));
const Outcomes = lazy(() => import('../../features/sales/SalesActivationPage'));
const Consumers = lazy(() => import('../../pages/ConsumerReentry'));

export const JOURNEY_WORKSPACE_LENSES = [
  ['overview', 'Lifecycle', '/journey'], ['acquisition', 'Acquisition', '/journey/acquisition'],
  ['qualification', 'Qualification', '/journey/qualification'], ['routing', 'Routing', '/journey/routing'],
  ['process', 'Process flow', '/journey/process'], ['vendors', 'Vendors', '/journey/vendors'],
  ['cohorts', 'Cohorts', '/journey/cohorts'], ['outcomes', 'Outcomes', '/journey/outcomes'],
  ['consumers', 'Re-entry', '/journey/consumers'],
] as const;
const specialists: Record<string, React.ComponentType> = { acquisition: Acquisition, qualification: Qualification, routing: Routing, process: Process, vendors: Vendors, cohorts: Cohorts, outcomes: Outcomes, consumers: Consumers };
function restoredSelection(client: string): JourneySelection {
  try { return validJourneySelection(sessionStorage.getItem(`cx.journey.selection.v1:${client}`)); } catch { return 'fetched'; }
}

export default function JourneyWorkspace({ lens }: { lens?: string }) {
  const location = useLocation();
  const scoped = useScopedNavigationTarget();
  const { selectedClient } = useClient();
  const active = lens || location.pathname.split('/')[2] || 'overview';
  const [selectionState, setSelectionState] = useState(() => ({ client: selectedClient, value: restoredSelection(selectedClient) }));
  const selection = selectionState.client === selectedClient ? selectionState.value : restoredSelection(selectedClient);
  const select = (value: JourneySelection) => {
    setSelectionState({ client: selectedClient, value });
    try { sessionStorage.setItem(`cx.journey.selection.v1:${selectedClient}`, value); } catch { /* Memory selection remains available. */ }
  };
  const Specialist = specialists[active];
  return <div className="cx-product-journey">
    {Specialist && <div className="cx-journey-workspace-heading"><span>Journey</span><small>Lifecycle context: <strong>{selectionLabel(selection)}</strong></small></div>}
    {Specialist && <div className="cx-journey-context-note"><Link to={scoped('/journey')}>Return to {selectionLabel(selection)} analysis</Link><span>Selected lifecycle context is retained. This lens keeps its own counting grain and date basis.</span></div>}
    <Suspense fallback={<div className="cx-workspace-lens-loading" role="status">Opening Journey analysis…</div>}>
      {Specialist ? <Specialist /> : <JourneyWorkbench selection={selection} onSelect={select} />}
    </Suspense>
  </div>;
}
