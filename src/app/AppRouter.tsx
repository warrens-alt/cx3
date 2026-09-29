import React, { Suspense } from 'react';
import { Route, Routes, Link, useLocation, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { AlertCircle } from 'lucide-react';
import { useClient } from '../lib/ClientContext';
import { isChunkLoadError, attemptChunkRecovery } from '../lib/chunkRecovery';
import { PageSkeleton } from '../components/Skeleton';
import { navigationPage } from '../lib/navigation';
import { PAGE_TITLES } from '../../contracts/naming';
import ScopePreservingRedirect from './navigation/ScopePreservingRedirect';

function safeImport<T>(loader: () => Promise<T>): Promise<T> {
  return loader().catch((error: any) => {
    if (isChunkLoadError(error) && attemptChunkRecovery()) {
      return new Promise<T>(() => {});
    }
    throw error;
  });
}

// Lazy-loaded report and specialist surfaces
export const VersionedReports = React.lazy(() => safeImport(() => import('../pages/VersionedReports')));
export const UserManagement = React.lazy(() => safeImport(() => import('../pages/UserManagement')));
export const OverviewPage = React.lazy(() => safeImport(() => import('../features/overview/OverviewPage')));
export const JourneyPage = React.lazy(() => safeImport(() => import('../features/journey/JourneyPage')));
export const ContactPage = React.lazy(() => safeImport(() => import('../features/contact/ContactPage')));
export const SpeedPage = React.lazy(() => safeImport(() => import('../features/contact/SpeedPage')));
export const ExecutiveOverview = React.lazy(() => safeImport(() => import('../pages/ExecutiveOverview')));
export const FunnelIntelligence = React.lazy(() => safeImport(() => import('../pages/FunnelIntelligence')));
export const SpeedToLeadIntelligence = React.lazy(() => safeImport(() => import('../pages/SpeedToLeadIntelligence')));
export const ContactStrategyIntelligence = React.lazy(() => safeImport(() => import('../pages/ContactStrategyIntelligence')));
export const VendorLeadQuality = React.lazy(() => safeImport(() => import('../pages/VendorLeadQuality')));
export const TemporalIntelligence = React.lazy(() => safeImport(() => import('../pages/TemporalIntelligence')));
export const SalesActivationPage = React.lazy(() => safeImport(() => import('../features/sales/SalesActivationPage')));
export const SalesActivationIntelligence = React.lazy(() => safeImport(() => import('../pages/SalesActivationIntelligence')));
export const CommercialIntelligence = React.lazy(() => safeImport(() => import('../pages/CommercialIntelligence')));
export const DataIntegrityIntelligence = React.lazy(() => safeImport(() => import('../pages/DataIntegrityIntelligence')));
export const AgentPerformanceIntelligence = React.lazy(() => safeImport(() => import('../pages/AgentPerformanceIntelligence')));
export const CampaignIntelligence = React.lazy(() => safeImport(() => import('../pages/CampaignIntelligence')));
export const AiOperationalInsights = React.lazy(() => safeImport(() => import('../pages/AiOperationalInsights')));
export const LeadExplorerIntelligence = React.lazy(() => safeImport(() => import('../pages/LeadExplorerIntelligence')));
export const Vetting = React.lazy(() => safeImport(() => import('../pages/Vetting')));
export const VisualWorkspace = React.lazy(() => safeImport(() => import('../pages/VisualWorkspace')));
export const CliPerformance = React.lazy(() => safeImport(() => import('../pages/CliPerformance')));
export const Cohorts = React.lazy(() => safeImport(() => import('../pages/Cohorts')));
export const SettingsPage = React.lazy(() => safeImport(() => import('../pages/Settings')));
export const AdminValidation = React.lazy(() => safeImport(() => import('../pages/AdminValidation')));
export const RoutingIntelligence = React.lazy(() => safeImport(() => import('../pages/RoutingIntelligence')));
export const ConsumerReentry = React.lazy(() => safeImport(() => import('../pages/ConsumerReentry')));
export const VendorPerformance = React.lazy(() => safeImport(() => import('../pages/VendorPerformance')));
export const Exceptions = React.lazy(() => safeImport(() => import('../pages/Exceptions')));
export const CommercialReconciliation = React.lazy(() => safeImport(() => import('../pages/CommercialReconciliation')));
export const LeadLedger = React.lazy(() => safeImport(() => import('../features/leadLedger/LeadLedgerWorkspace')));
export const WarehouseAnalytics = React.lazy(() => safeImport(() => import('../pages/WarehouseAnalytics')));
export const OffershopProcessObservability = React.lazy(() => safeImport(() => import('../pages/OffershopProcessObservability')));
export const LeadEngineLayout = React.lazy(() => safeImport(() => import('../leadEngine/LeadEngineLayout')));

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
                : error?.message || 'Navigation is still available. Retry the page or return to Overview.'}
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
                Overview
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
        <Routes>
          {/* PRIMARY OFFERNET OPERATIONAL INTELLIGENCE PLATFORM ROUTES */}
          <Route path="/" element={<OverviewPage key={selectedClient} />} />
          <Route path="/overview" element={<OverviewPage key={selectedClient} />} />
          <Route path="/funnel" element={<JourneyPage key={selectedClient} />} />
          <Route path="/speed-to-lead" element={<SpeedPage key={selectedClient} />} />
          <Route path="/contact-strategy" element={<ContactPage key={selectedClient} />} />
          <Route
            path="/vendor-dispositions"
            element={<ScopePreservingRedirect to="/contact-strategy?tab=vendor_dispositions" replace />}
          />
          <Route path="/cli-performance" element={<CliPerformance key={selectedClient} />} />
          <Route path="/vendor-quality" element={<VendorLeadQuality key={selectedClient} />} />
          <Route path="/temporal" element={<TemporalIntelligence key={selectedClient} />} />
          <Route path="/sales-activation" element={<SalesActivationPage key={selectedClient} />} />
          <Route path="/commercial" element={<CommercialIntelligence key={selectedClient} />} />
          <Route path="/data-integrity" element={<DataIntegrityIntelligence key={selectedClient} />} />
          <Route path="/agent-performance" element={<AgentPerformanceIntelligence key={selectedClient} />} />
          <Route path="/campaigns" element={<CampaignIntelligence key={selectedClient} />} />
          <Route path="/ai-insights" element={<AiOperationalInsights key={selectedClient} />} />
          <Route path="/lead-explorer" element={<LeadExplorerIntelligence key={selectedClient} />} />

          {/* WAREHOUSE EVIDENCE & AUDIT REPORTS */}
          <Route path="/warehouse" element={<WarehouseAnalytics key={selectedClient} />} />
          <Route path="/warehouse-analytics" element={<WarehouseAnalytics key={selectedClient} />} />
          <Route path="/reports" element={<VersionedReports key={selectedClient} />} />
          <Route path="/vendors" element={<VendorPerformance key={selectedClient} />} />
          <Route path="/exceptions" element={<Exceptions key={selectedClient} />} />
          <Route path="/reconciliation" element={<CommercialReconciliation key={selectedClient} />} />
          <Route path="/vetting" element={<Vetting key={selectedClient} />} />
          <Route path="/visuals" element={<VisualWorkspace />} />
          <Route path="/routing" element={<RoutingIntelligence />} />
          <Route path="/consumers" element={<ConsumerReentry />} />
          <Route path="/cohorts" element={<Cohorts />} />
          <Route path="/access-control" element={<UserManagement key={selectedClient} />} />
          <Route path="/users" element={<UserManagement key={selectedClient} />} />
          <Route path="/lead-ledger" element={<LeadLedger />} />
          <Route path="/offershop-flow" element={<OffershopProcessObservability />} />
          <Route path="/admin" element={<SettingsPage />} />
          <Route path="/validation" element={<AdminValidation />} />
          <Route path="/lead-engine" element={<LeadEngineLayout />} />

          {/* EXPLICIT URL ALIASES & COMPATIBILITY REDIRECTS */}
          <Route path="/insights" element={<ScopePreservingRedirect to="/overview" replace />} />
          <Route path="/explore" element={<ScopePreservingRedirect to="/lead-explorer" replace />} />
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
          <Route path="/explorer" element={<ScopePreservingRedirect to="/lead-explorer" replace />} />
          <Route path="/settings" element={<ScopePreservingRedirect to="/admin" replace />} />
          <Route path="/calls" element={<ScopePreservingRedirect to="/contact-strategy" replace />} />
          <Route path="/leads" element={<ScopePreservingRedirect to="/lead-explorer" replace />} />
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
                  Open Overview
                </Link>
              </section>
            }
          />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
