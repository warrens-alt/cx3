import React, { Suspense } from 'react';
import { Route, Routes, Link, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { AlertCircle } from 'lucide-react';
import { useClient } from '../lib/ClientContext';
import { isChunkLoadError, attemptChunkRecovery } from '../lib/chunkRecovery';
import { PageSkeleton } from '../components/Skeleton';
import { navigationPage } from '../lib/navigation';
import { PAGE_TITLES } from '../../contracts/naming';
import ScopePreservingRedirect, { LeadLedgerCompatibilityRedirect } from './navigation/ScopePreservingRedirect';
import AnalyticsReadinessPanel from '../shared/reporting/AnalyticsReadinessPanel';
import { ReportPresentationProvider } from '../shared/reporting/ReportPresentation';
import SourceCapabilityNotice from '../components/SourceCapabilityNotice';

function safeImport<T>(loader: () => Promise<T>): Promise<T> {
  return loader().catch((error: any) => {
    if (isChunkLoadError(error) && attemptChunkRecovery()) {
      return new Promise<T>(() => {});
    }
    throw error;
  });
}

// Lazy-loaded report and specialist surfaces
export const UserManagement = React.lazy(() => safeImport(() => import('../pages/UserManagement')));
export const OverviewPage = React.lazy(() => safeImport(() => import('../features/overview/OverviewPage')));
export const AiOperationalInsights = React.lazy(() => safeImport(() => import('../pages/AiOperationalInsights')));
export const LeadExplorerIntelligence = React.lazy(() => safeImport(() => import('../pages/LeadExplorerIntelligence')));
export const VisualWorkspace = React.lazy(() => safeImport(() => import('../pages/VisualWorkspace')));
export const SettingsPage = React.lazy(() => safeImport(() => import('../pages/Settings')));
export const AdminValidation = React.lazy(() => safeImport(() => import('../pages/AdminValidation')));
export const Exceptions = React.lazy(() => safeImport(() => import('../pages/Exceptions')));

export const JourneyWorkspace = React.lazy(() => safeImport(() => import('../workspaces/journey/JourneyWorkspace')));
export const OperationsWorkspace = React.lazy(() => safeImport(() => import('../workspaces/operations/OperationsWorkspace')));
export const CommercialWorkspace = React.lazy(() => safeImport(() => import('../workspaces/commercial/CommercialWorkspace')));
export const EvidenceWorkspace = React.lazy(() => safeImport(() => import('../workspaces/evidence/EvidenceWorkspace')));

export default function AppRouter() {
  const location = useLocation();
  const { selectedClient } = useClient();

  const pageNav = navigationPage(location.pathname);
  const pageTitle =
    pageNav?.name ||
    ({ '/visuals': 'Visual Workspace', '/vetting': 'Vetting', '/validation': 'Validation' } as Record<string, string>)[location.pathname] ||
    PAGE_TITLES[location.pathname] ||
    'Operational Platform';

  return (
    <ErrorBoundary
      resetKeys={[location.pathname]}
      onError={err => console.error('Route error caught by ErrorBoundary:', err)}
      fallbackRender={({ error, resetErrorBoundary }: any) => {
        const isChunkError =
          error &&
          (error.message?.includes('dynamically imported module') ||
            error.message?.includes('Failed to fetch') ||
            error.message?.includes('Loading chunk') ||
            error.name === 'ChunkLoadError');
        return (
          <section className="cx-route-error" role="alert">
            <AlertCircle size={28} />
            <h1>{isChunkError ? 'App update available' : 'This page could not be displayed'}</h1>
            <p>
              {isChunkError
                ? 'A newer version of ConversionX was deployed. Reloading will fetch the latest page.'
                : error?.message || 'Navigation is still available. Retry the page or return to Command.'}
            </p>
            <div>
              <button
                type="button"
                className="cx-button-primary"
                onClick={isChunkError ? () => window.location.reload() : resetErrorBoundary}
              >
                {isChunkError ? 'Reload page' : 'Retry page'}
              </button>
              <Link className="cx-button-secondary" to="/">
                Command
              </Link>
            </div>
          </section>
        );
      }}
    >
      <Suspense
        fallback={
          <div className="cx-route-loading">
            <p role="status">Opening {pageTitle}…</p>
            <div aria-hidden="true">
              <PageSkeleton />
            </div>
          </div>
        }
      >
        <ReportPresentationProvider>
        <AnalyticsReadinessPanel />
        <SourceCapabilityNotice warningsOnly />
        <Routes>
          {/* Canonical workspace paths. Existing URLs below remain adapters. */}
          <Route path="/command" element={<OverviewPage key={selectedClient} />} />
          <Route path="/journey" element={<JourneyWorkspace key={selectedClient} />} />
          <Route path="/journey/acquisition" element={<JourneyWorkspace key={selectedClient} />} />
          <Route path="/journey/qualification" element={<JourneyWorkspace key={selectedClient} />} />
          <Route path="/journey/routing" element={<JourneyWorkspace key={selectedClient} />} />
          <Route path="/journey/process" element={<JourneyWorkspace key={selectedClient} />} />
          <Route path="/journey/vendors" element={<JourneyWorkspace key={selectedClient} />} />
          <Route path="/journey/cohorts" element={<JourneyWorkspace key={selectedClient} />} />
          <Route path="/journey/outcomes" element={<JourneyWorkspace key={selectedClient} />} />
          <Route path="/journey/consumers" element={<JourneyWorkspace key={selectedClient} />} />
          <Route path="/operations" element={<OperationsWorkspace key={selectedClient} />} />
          <Route path="/operations/contact" element={<OperationsWorkspace key={selectedClient} />} />
          <Route path="/operations/response" element={<OperationsWorkspace key={selectedClient} />} />
          <Route path="/operations/dispositions" element={<OperationsWorkspace key={selectedClient} />} />
          <Route path="/operations/cli" element={<OperationsWorkspace key={selectedClient} />} />
          <Route path="/operations/agents" element={<OperationsWorkspace key={selectedClient} />} />
          <Route path="/operations/time" element={<OperationsWorkspace key={selectedClient} />} />
          <Route path="/evidence" element={<EvidenceWorkspace key={selectedClient} />} />
          <Route path="/evidence/sources" element={<EvidenceWorkspace key={selectedClient} />} />
          <Route path="/evidence/metrics" element={<EvidenceWorkspace key={selectedClient} />} />
          <Route path="/evidence/reconciliation" element={<EvidenceWorkspace key={selectedClient} />} />
          <Route path="/evidence/releases" element={<EvidenceWorkspace key={selectedClient} />} />
          <Route path="/evidence/warehouse" element={<EvidenceWorkspace key={selectedClient} />} />
          <Route path="/evidence/vendors" element={<EvidenceWorkspace key={selectedClient} />} />
          <Route path="/commercial/reconciliation" element={<CommercialWorkspace key={selectedClient} lens="reconciliation" />} />

          {/* PRIMARY OFFERNET OPERATIONAL INTELLIGENCE PLATFORM ROUTES */}
          <Route path="/" element={<OverviewPage key={selectedClient} />} />
          <Route path="/overview" element={<OverviewPage key={selectedClient} />} />
          <Route path="/funnel" element={<JourneyWorkspace key={selectedClient} lens="lifecycle" />} />
          <Route path="/speed-to-lead" element={<OperationsWorkspace key={selectedClient} lens="response" />} />
          <Route path="/contact-strategy" element={<OperationsWorkspace key={selectedClient} lens="contact" />} />
          <Route
            path="/vendor-dispositions"
            element={<ScopePreservingRedirect to="/contact-strategy?tab=vendor_dispositions" replace />}
          />
          <Route path="/cli-performance" element={<OperationsWorkspace key={selectedClient} lens="cli" />} />
          <Route path="/vendor-quality" element={<JourneyWorkspace key={selectedClient} lens="vendors" />} />
          <Route path="/temporal" element={<OperationsWorkspace key={selectedClient} lens="time" />} />
          <Route path="/sales-activation" element={<JourneyWorkspace key={selectedClient} lens="outcomes" />} />
          <Route path="/commercial" element={<CommercialWorkspace key={selectedClient} />} />
          <Route path="/data-integrity" element={<EvidenceWorkspace key={selectedClient} lens="overview" />} />
          <Route path="/agent-performance" element={<OperationsWorkspace key={selectedClient} lens="agents" />} />
          <Route path="/campaigns" element={<JourneyWorkspace key={selectedClient} lens="acquisition" />} />
          <Route path="/ai-insights" element={<AiOperationalInsights key={selectedClient} />} />
          <Route path="/lead-explorer" element={<LeadExplorerIntelligence key={selectedClient} />} />

          {/* WAREHOUSE EVIDENCE & AUDIT REPORTS */}
          <Route path="/warehouse" element={<EvidenceWorkspace key={selectedClient} lens="warehouse" />} />
          <Route path="/warehouse-analytics" element={<EvidenceWorkspace key={selectedClient} lens="warehouse" />} />
          <Route path="/reports" element={<EvidenceWorkspace key={selectedClient} lens="releases" />} />
          <Route path="/vendors" element={<EvidenceWorkspace key={selectedClient} lens="vendors" />} />
          <Route path="/investigate" element={<Exceptions key={selectedClient} />} />
          <Route path="/exceptions" element={<Exceptions key={selectedClient} />} />
          <Route path="/reconciliation" element={<CommercialWorkspace key={selectedClient} lens="reconciliation" />} />
          <Route path="/vetting" element={<JourneyWorkspace key={selectedClient} lens="qualification" />} />
          <Route path="/visuals" element={<VisualWorkspace />} />
          <Route path="/routing" element={<JourneyWorkspace key={selectedClient} lens="routing" />} />
          <Route path="/consumers" element={<JourneyWorkspace key={selectedClient} lens="consumers" />} />
          <Route path="/cohorts" element={<JourneyWorkspace key={selectedClient} lens="cohorts" />} />
          <Route path="/access-control" element={<UserManagement key={selectedClient} />} />
          <Route path="/users" element={<UserManagement key={selectedClient} />} />
          <Route path="/lead-ledger" element={<LeadLedgerCompatibilityRedirect />} />
          <Route path="/offershop-flow" element={<JourneyWorkspace key={selectedClient} lens="process" />} />
          <Route path="/admin" element={<SettingsPage />} />
          <Route path="/validation" element={<AdminValidation />} />

          {/* EXPLICIT URL ALIASES & COMPATIBILITY REDIRECTS */}
          <Route path="/insights" element={<ScopePreservingRedirect to="/overview" replace />} />
          <Route path="/explore" element={<ScopePreservingRedirect to="/lead-explorer" extraParams={{ view: 'population' }} replace />} />
          <Route path="/acquisition" element={<ScopePreservingRedirect to="/campaigns" replace />} />
          <Route path="/lead-performance" element={<ScopePreservingRedirect to="/funnel" replace />} />
          <Route path="/call-performance" element={<ScopePreservingRedirect to="/contact-strategy" replace />} />
          <Route path="/outcomes" element={<ScopePreservingRedirect to="/sales-activation" replace />} />
          <Route path="/sources" element={<ScopePreservingRedirect to="/vendor-quality" replace />} />
          <Route path="/quality" element={<ScopePreservingRedirect to="/vendor-quality" replace />} />
          <Route path="/revetting" element={<ScopePreservingRedirect to="/vetting" replace />} />
          <Route path="/data-trust" element={<ScopePreservingRedirect to="/data-integrity" replace />} />
          <Route path="/data-quality" element={<ScopePreservingRedirect to="/data-integrity" replace />} />
          <Route path="/data-coverage" element={<ScopePreservingRedirect to="/data-integrity" replace />} />
          <Route path="/audit" element={<ScopePreservingRedirect to="/data-integrity" replace />} />
          <Route path="/explorer" element={<ScopePreservingRedirect to="/lead-explorer" extraParams={{ view: 'population' }} replace />} />
          <Route path="/settings" element={<ScopePreservingRedirect to="/admin" replace />} />
          <Route path="/calls" element={<ScopePreservingRedirect to="/contact-strategy" replace />} />
          <Route path="/leads" element={<ScopePreservingRedirect to="/lead-explorer" extraParams={{ view: 'population' }} replace />} />
          <Route path="/deal-flow" element={<ScopePreservingRedirect to="/offershop-flow" replace />} />
          <Route path="/process-flow" element={<ScopePreservingRedirect to="/offershop-flow" replace />} />
          <Route path="/platform-insights" element={<ScopePreservingRedirect to="/campaigns" replace />} />

          {/* 404 NOT FOUND */}
          <Route
            path="*"
            element={
              <section className="cx-route-error" role="alert">
                <h1>Page not found</h1>
                <p>The requested workspace page does not exist.</p>
                <Link className="cx-button-primary" to="/">
                  Open Command
                </Link>
              </section>
            }
          />
        </Routes>
        </ReportPresentationProvider>
      </Suspense>
    </ErrorBoundary>
  );
}
