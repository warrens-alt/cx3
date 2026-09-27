import './styles/reportBrowsing.css';
import './styles/operations.css';
import './styles/navigation.css';
import './styles/theme.css';
import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, Link } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { Menu, Search, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, ArrowRight, AlertCircle, Columns3, Shield } from 'lucide-react';
import { BRAND, PAGE_TITLES } from '../contracts/naming';
import { ClientProvider, useClient } from './lib/ClientContext';
import { FilterProvider, useFilters } from './lib/FilterContext';
import { useTableDensity } from './lib/useTableDensity';
import { navigationPage, isOperationalRoute } from './lib/navigation';
import { applicationMode, DEMO_ENTRY_URL } from './lib/applicationMode';
import Sidebar from './components/Sidebar';
import Modal from './components/Modal';
import AppliedScope from './components/AppliedScope';
import MobileBottomNav from './components/MobileBottomNav';
import { PageSkeleton } from './components/Skeleton';
import { useDevice } from './hooks/useDevice';
import { AuthProvider, useAuth } from './lib/AuthContext';
import AuthGate from './components/AuthGate';
import { ThemeProvider } from './lib/ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import { isChunkLoadError, attemptChunkRecovery } from './lib/chunkRecovery';

function safeImport<T>(loader: () => Promise<T>): Promise<T> {
  return loader().catch((error: any) => {
    if (isChunkLoadError(error) && attemptChunkRecovery()) {
      return new Promise<T>(() => {});
    }
    throw error;
  });
}

const VersionedReports = React.lazy(() => safeImport(() => import('./pages/VersionedReports')));
const UserManagement = React.lazy(() => safeImport(() => import('./pages/UserManagement')));
const ExecutiveOverview = React.lazy(() => safeImport(() => import('./pages/ExecutiveOverview')));
const FunnelIntelligence = React.lazy(() => safeImport(() => import('./pages/FunnelIntelligence')));
const SpeedToLeadIntelligence = React.lazy(() => safeImport(() => import('./pages/SpeedToLeadIntelligence')));
const ContactStrategyIntelligence = React.lazy(() => safeImport(() => import('./pages/ContactStrategyIntelligence')));
const VendorLeadQuality = React.lazy(() => safeImport(() => import('./pages/VendorLeadQuality')));
const TemporalIntelligence = React.lazy(() => safeImport(() => import('./pages/TemporalIntelligence')));
const SalesActivationIntelligence = React.lazy(() => safeImport(() => import('./pages/SalesActivationIntelligence')));
const CommercialIntelligence = React.lazy(() => safeImport(() => import('./pages/CommercialIntelligence')));
const DataIntegrityIntelligence = React.lazy(() => safeImport(() => import('./pages/DataIntegrityIntelligence')));
const AgentPerformanceIntelligence = React.lazy(() => safeImport(() => import('./pages/AgentPerformanceIntelligence')));
const CampaignIntelligence = React.lazy(() => safeImport(() => import('./pages/CampaignIntelligence')));
const AiOperationalInsights = React.lazy(() => safeImport(() => import('./pages/AiOperationalInsights')));
const LeadExplorerIntelligence = React.lazy(() => safeImport(() => import('./pages/LeadExplorerIntelligence')));

const GlobalFilter = React.lazy(() => safeImport(() => import('./components/GlobalFilter')));
const CommandPalette = React.lazy(() => safeImport(() => import('./components/CommandPalette')));
const Vetting = React.lazy(() => safeImport(() => import('./pages/Vetting')));
const VisualWorkspace = React.lazy(() => safeImport(() => import('./pages/VisualWorkspace')));
const CliPerformance = React.lazy(() => safeImport(() => import('./pages/CliPerformance')));
const Cohorts = React.lazy(() => safeImport(() => import('./pages/Cohorts')));
const SettingsPage = React.lazy(() => safeImport(() => import('./pages/Settings')));
const AdminValidation = React.lazy(() => safeImport(() => import('./pages/AdminValidation')));
const RoutingIntelligence = React.lazy(() => safeImport(() => import('./pages/RoutingIntelligence')));
const ConsumerReentry = React.lazy(() => safeImport(() => import('./pages/ConsumerReentry')));
const VendorPerformance = React.lazy(() => safeImport(() => import('./pages/VendorPerformance')));
const Exceptions = React.lazy(() => safeImport(() => import('./pages/Exceptions')));
const CommercialReconciliation = React.lazy(() => safeImport(() => import('./pages/CommercialReconciliation')));
const DemoWorkspace = React.lazy(() => safeImport(() => import('./pages/DemoWorkspace')));
const LeadLedger = React.lazy(() => safeImport(() => import('./pages/LeadLedger')));
const WarehouseAnalytics = React.lazy(() => safeImport(() => import('./pages/WarehouseAnalytics')));


function Shell() {
  const location=useLocation(), { selectedClient, loading:clientLoading, error:clientError, ready:clientReady, retry:retryClient, clients, setSelectedClient }=useClient();
  const { startDate, endDate, filters, filterError, resetScope } = useFilters();
  const { user, profile, isAdmin } = useAuth();
  const device = useDevice();
  const [mobile,setMobile]=useState(false), [sidebar,setSidebar]=useState(true), [command,setCommand]=useState(false);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const { density, toggleDensity } = useTableDensity();
  const pageTitle = navigationPage(location.pathname)?.name || ({ '/visuals': 'Visual Workspace', '/vetting': 'Vetting', '/validation': 'Validation' } as Record<string, string>)[location.pathname] || PAGE_TITLES[location.pathname] || 'Operational Platform';
  const searchShortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';
  
  const isOperationalPage = isOperationalRoute(location.pathname);
  const evidencePage = true;
  useEffect(() => { document.title = `${pageTitle} · ${BRAND.name}`; }, [pageTitle]);
  useEffect(()=>{
    setMobile(false);
    setCommand(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const main = document.getElementById('main-content');
    main?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const frame = window.requestAnimationFrame(() => {
      main?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  },[location.pathname]);
  useEffect(()=>{const listener=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setMobile(false);setCommand(old=>!old);}};
    window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);
  },[]);
  useEffect(()=>{const mq=window.matchMedia('(min-width: 1024px)');const close=()=>{if(mq.matches)setMobile(false);};mq.addEventListener('change',close);return()=>mq.removeEventListener('change',close);},[]);
  const openSearch=()=>{setMobile(false);setCommand(true);};
  return <div className="cx-app" data-density={density} data-device={device.type} data-touch={device.isTouch} data-orientation={device.orientation}>
    <a className="cx-skip" href="#main-content">Skip to report content</a>
    <div id="desktop-navigation" inert={!sidebar} aria-hidden={!sidebar ? true : undefined} className={`cx-desktop-sidebar transition-all duration-300 ease-in-out ${sidebar ? 'w-[224px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
      <div className="w-[224px] h-full">
        <Sidebar onSearch={openSearch} searchShortcut={searchShortcut}/>
      </div>
    </div>
    <Modal id="mobile-navigation-dialog" open={mobile} onClose={()=>setMobile(false)} label="Navigation" className="cx-nav-modal"><Sidebar onClose={()=>setMobile(false)} onSearch={openSearch} searchShortcut={searchShortcut}/></Modal>
    <div className="cx-workarea">
      <header className="cx-topbar">
        <button type="button" className="cx-icon-button cx-mobile-menu" aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={mobile} aria-controls={mobile ? 'mobile-navigation-dialog' : undefined} onClick={()=>setMobile(true)}><Menu size={20} aria-hidden="true"/></button>
        <button type="button" className="cx-icon-button cx-desktop-toggle" aria-label={sidebar?'Collapse navigation':'Expand navigation'} title={sidebar?'Collapse navigation':'Expand navigation'} aria-controls="desktop-navigation" aria-expanded={sidebar} onClick={()=>setSidebar(old=>!old)}>{sidebar?<PanelLeftClose size={18} aria-hidden="true"/>:<PanelLeftOpen size={18} aria-hidden="true"/>}</button>
        <div className="cx-breadcrumb" aria-label="Current page"><span>{BRAND.name}</span><span aria-hidden="true">/</span><strong title={pageTitle}>{pageTitle}</strong></div>
        <div className="cx-topbar-actions">
          <button type="button" className="cx-search-trigger" aria-label="Search pages" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" title={`Find a page (${searchShortcut})`} onClick={openSearch}><Search size={16} aria-hidden="true"/><span>Find a page</span><kbd aria-hidden="true">{searchShortcut}</kbd></button>
          <button type="button" className="cx-icon-button cx-density-toggle hidden sm:inline-flex" aria-label={density==='comfortable'?'Use compact table spacing':'Use comfortable table spacing'} title={`Table spacing: ${density}. Switch to ${density==='comfortable'?'compact':'comfortable'}.`} aria-pressed={density==='compact'} onClick={toggleDensity}><Columns3 size={18} aria-hidden="true"/><span>Spacing: {density==='comfortable'?'Comfortable':'Compact'}</span></button>
          <ThemeToggle />
          {!isOperationalPage && (
            <label className="cx-workspace-select">
              <span className="hidden sm:inline">Client</span>
              <select aria-label="Active client" value={selectedClient} onChange={event=>setSelectedClient(event.target.value)} disabled={clientLoading || !clients.length}>
                {!selectedClient&&<option value="" disabled>Select client</option>}
                {clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>
          )}
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="cx-main pb-16 lg:pb-0">
        {clientError && <section className="cx-scope-error" role="alert"><AlertCircle size={22}/><div><h1>Workspace access is unavailable</h1><p>{clientError}</p><p>No fallback tenant or substitute analytical data is being displayed.</p><div className="flex flex-wrap gap-3"><button type="button" className="cx-button-primary" onClick={retryClient}>Retry workspace access</button><a className="cx-button-secondary" href={DEMO_ENTRY_URL}>View demo data</a></div><p>The demo is a separate, synthetic workspace. It does not access your live data.</p></div></section>}
        {clientLoading && <p className="cx-filter-loading" role="status">Loading your workspace access…</p>}
        {clientReady && !evidencePage && <div className="cx-legacy-bar"><div role="note" className="flex items-center gap-2 flex-wrap"><span className="cx-legacy-badge"><AlertCircle size={12} aria-hidden="true"/>Legacy Exploration</span><span className="text-slate-600 text-xs hidden sm:inline">Metrics are exploratory and not independently reconciled.</span><Link to="/reports">Evidence Reports <ArrowRight size={13}/></Link></div>
          <button type="button" className={`cx-button-secondary ${filtersOpen ? 'border-[#3562B3] bg-[#EDF5FC] text-[#315EAD]' : ''}`} aria-expanded={filtersOpen} aria-controls="legacy-filters" onClick={()=>setFiltersOpen(old=>!old)}><SlidersHorizontal size={14}/><span>Report filters</span></button>
          <AppliedScope/>
        </div>}
        {clientReady && !evidencePage && <div id="legacy-filters" hidden={!filtersOpen}>{filtersOpen && !filterError && <Suspense fallback={<p className="cx-filter-loading" role="status">Loading report controls…</p>}><GlobalFilter/></Suspense>}</div>}
        <ErrorBoundary
          resetKeys={[location.pathname]}
          onError={(err) => console.error('Route error caught by ErrorBoundary:', err)}
          fallbackRender={({ error, resetErrorBoundary }: any) => {
            const isChunkError = error && (
              error.message?.includes('dynamically imported module') ||
              error.message?.includes('Failed to fetch') ||
              error.message?.includes('Loading chunk') ||
              error.name === 'ChunkLoadError'
            );
            return (
              <section className="cx-route-error" role="alert">
                <AlertCircle size={28}/>
                <h1>{isChunkError ? 'App update available' : 'This page could not be displayed'}</h1>
                <p>{isChunkError ? 'A newer version of ConversionX was deployed. Reloading will fetch the latest page.' : error?.message || 'Navigation is still available. Retry the page or return to Overview.'}</p>
                <div>
                  <button type="button" className="cx-button-primary" onClick={isChunkError ? () => window.location.reload() : resetErrorBoundary}>
                    {isChunkError ? 'Reload page' : 'Retry page'}
                  </button>
                  <Link className="cx-button-secondary" to="/">Overview</Link>
                </div>
              </section>
            );
          }}
        >
          {clientReady && filterError ? <section className="cx-scope-error" role="alert"><AlertCircle size={22}/><div><h1>Reporting selection needs attention</h1><p>{filterError}</p><p>No analytical request was sent with an invalid selection.</p><button type="button" className="cx-button-primary" onClick={resetScope}>Reset reporting scope</button></div></section> : <Suspense fallback={<div className="cx-route-loading"><p role="status">Opening {pageTitle}…</p><div aria-hidden="true"><PageSkeleton/></div></div>}>
            {clientReady && <Routes>
              {/* PRIMARY OFFERNET OPERATIONAL INTELLIGENCE PLATFORM ROUTES */}
              <Route path="/" element={<ExecutiveOverview key={selectedClient} />} />
              <Route path="/overview" element={<ExecutiveOverview key={selectedClient} />} />
              <Route path="/funnel" element={<FunnelIntelligence key={selectedClient} />} />
              <Route path="/speed-to-lead" element={<SpeedToLeadIntelligence key={selectedClient} />} />
              <Route path="/contact-strategy" element={<ContactStrategyIntelligence key={selectedClient} />} />
              <Route path="/cli-performance" element={<CliPerformance key={selectedClient} />} />
              <Route path="/vendor-quality" element={<VendorLeadQuality key={selectedClient} />} />
              <Route path="/temporal" element={<TemporalIntelligence key={selectedClient} />} />
              <Route path="/sales-activation" element={<SalesActivationIntelligence key={selectedClient} />} />
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
              <Route path="/insights" element={<Navigate to="/overview" replace />} />
              <Route path="/explore" element={<Navigate to="/lead-explorer" replace />} />
              <Route path="/routing" element={<RoutingIntelligence />} />
              <Route path="/consumers" element={<ConsumerReentry />} />
              <Route path="/acquisition" element={<Navigate to="/campaigns" replace />} />
              <Route path="/lead-performance" element={<Navigate to="/funnel" replace />} />
              <Route path="/call-performance" element={<Navigate to="/contact-strategy" replace />} />
              <Route path="/cohorts" element={<Cohorts />} />
              <Route path="/outcomes" element={<Navigate to="/sales-activation" replace />} />
              <Route path="/sources" element={<Navigate to="/vendor-quality" replace />} />
              <Route path="/quality" element={<Navigate to="/vendor-quality" replace />} />
              <Route path="/revetting" element={<Navigate to="/vetting" replace />} />
              <Route path="/data-trust" element={<Navigate to="/data-integrity" replace />} />
              <Route path="/data-quality" element={<Navigate to="/data-integrity" replace />} />
              <Route path="/data-coverage" element={<Navigate to="/data-integrity" replace />} />
              <Route path="/audit" element={<Navigate to="/data-integrity" replace />} />
              <Route path="/access-control" element={<UserManagement key={selectedClient} />} />
              <Route path="/users" element={<UserManagement key={selectedClient} />} />
              <Route path="/explorer" element={<Navigate to="/lead-explorer" replace />} />
              <Route path="/admin" element={<SettingsPage />} />
              <Route path="/settings" element={<Navigate to="/admin" replace />} />
              <Route path="/calls" element={<Navigate to="/contact-strategy" replace />} />
              <Route path="/leads" element={<Navigate to="/lead-explorer" replace />} />
              <Route path="/lead-ledger" element={<LeadLedger />} />
              <Route path="/platform-insights" element={<Navigate to="/campaigns" replace />} />
              <Route path="/validation" element={<AdminValidation />} />
              <Route path="*" element={<section className="cx-route-error"><h1>Page not found</h1><p>The requested workspace page does not exist.</p><Link className="cx-button-primary" to="/">Open Overview</Link></section>}/>
            </Routes>}
          </Suspense>}
        </ErrorBoundary>
      </main>
      <MobileBottomNav onOpenMenu={()=>setMobile(true)} menuOpen={mobile} />
    </div>
    {command && <Suspense fallback={<Modal open label="Loading search" onClose={()=>setCommand(false)}><div className="p-6"><p role="status">Loading navigation…</p><button type="button" className="cx-button-secondary mt-4" onClick={()=>setCommand(false)}>Close</button></div></Modal>}><CommandPalette isOpen onClose={()=>setCommand(false)}/></Suspense>}
  </div>;
}
function LiveApp() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AuthGate>
            <ClientProvider>
              <FilterProvider>
                <Shell />
              </FilterProvider>
            </ClientProvider>
          </AuthGate>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default function App(){
  // Select before mounting any live provider. Full-document mode links also discard the old query cache.
  const mode = applicationMode(typeof window === 'undefined' ? '' : window.location.search);
  if (mode === 'demo') return (
    <ThemeProvider>
      <Suspense fallback={<p className="p-8" role="status">Loading synthetic demo data… No live connection.</p>}>
        <DemoWorkspace/>
      </Suspense>
    </ThemeProvider>
  );
  return <LiveApp/>;
}
