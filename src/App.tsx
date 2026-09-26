import './styles/reportBrowsing.css';
import './styles/operations.css';
import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, Link } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { Menu, Search, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, ArrowRight, AlertCircle, Columns3, Shield } from 'lucide-react';
import { BRAND, PAGE_TITLES } from '../contracts/naming';
import { ClientProvider, useClient } from './lib/ClientContext';
import { FilterProvider, useFilters } from './lib/FilterContext';
import { DENSITY_KEY, safeDensity, type TableDensity } from './lib/presentation';
import { applicationMode, DEMO_ENTRY_URL } from './lib/applicationMode';
import Sidebar from './components/Sidebar';
import Modal from './components/Modal';
import AppliedScope from './components/AppliedScope';
import MobileBottomNav from './components/MobileBottomNav';
import { PageSkeleton } from './components/Skeleton';
import { useDevice } from './hooks/useDevice';
import { AuthProvider, useAuth } from './lib/AuthContext';
import AuthGate from './components/AuthGate';
import { safeImport, isChunkLoadError, attemptChunkRecovery } from './lib/chunkRecovery';

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


function Shell() {
  const location=useLocation(), { selectedClient, loading:clientLoading, error:clientError, ready:clientReady, retry:retryClient, clients, setSelectedClient }=useClient();
  const { startDate, endDate, filters, filterError, resetScope } = useFilters();
  const { user, profile, isAdmin } = useAuth();
  const device = useDevice();
  const [mobile,setMobile]=useState(false), [sidebar,setSidebar]=useState(true), [command,setCommand]=useState(false);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [density,setDensity]=useState<TableDensity>(()=>{try{return safeDensity(localStorage.getItem(DENSITY_KEY));}catch{return 'comfortable';}});
  
  const operationalRoutes = [
    '/', '/overview', '/funnel', '/speed-to-lead', '/contact-strategy', 
    '/cli-performance',
    '/vendor-quality', '/temporal', '/sales-activation', '/commercial', 
    '/data-integrity', '/agent-performance', '/campaigns', '/ai-insights', '/lead-explorer', '/exceptions', '/routing', '/cohorts'
  ];
  const isOperationalPage = operationalRoutes.includes(location.pathname);
  const evidencePage = ['/reports','/vendors','/exceptions','/reconciliation','/lead-ledger','/admin','/access-control','/users'].includes(location.pathname) || isOperationalPage;
  useEffect(()=>{try{localStorage.setItem(DENSITY_KEY,density);}catch{}},[density]);
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
    <div className={`cx-desktop-sidebar transition-all duration-300 ease-in-out ${sidebar ? 'w-[224px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
      <div className="w-[224px] h-full">
        <Sidebar onSearch={openSearch}/>
      </div>
    </div>
    <Modal open={mobile} onClose={()=>setMobile(false)} label="Navigation" className="cx-nav-modal"><Sidebar onClose={()=>setMobile(false)} onSearch={openSearch}/></Modal>
    <div className="cx-workarea">
      <header className="cx-topbar">
        <button type="button" className="cx-icon-button cx-mobile-menu" aria-label="Open navigation" onClick={()=>setMobile(true)}><Menu size={20}/></button>
        <button type="button" className="cx-icon-button cx-desktop-toggle" aria-label={sidebar?'Collapse navigation':'Expand navigation'} aria-expanded={sidebar} onClick={()=>setSidebar(old=>!old)}>{sidebar?<PanelLeftClose size={18}/>:<PanelLeftOpen size={18}/>}</button>
        <div className="cx-breadcrumb"><span>{BRAND.name}</span><span aria-hidden="true">/</span><strong>{(location.pathname==='/visuals'?'Visual Workspace':location.pathname==='/vetting'?'Vetting':PAGE_TITLES[location.pathname])||'Operational Platform'}</strong></div>
        <div className="cx-topbar-actions">
          {isAdmin && (
            <Link
              to="/access-control"
              aria-label="User and Access Control"
              title="User & Access Control"
              className={`cx-icon-button !px-2.5 !gap-1.5 !w-auto text-xs font-semibold ${
                location.pathname === '/access-control' || location.pathname === '/users' ? '!bg-blue-50 !text-blue-700 !border-blue-300' : ''
              }`}
            >
              <Shield size={14} className="text-blue-600" />
              <span className="hidden md:inline">Access Control</span>
            </Link>
          )}
          <button type="button" className="cx-search-trigger" aria-label="Search pages" onClick={openSearch}><Search size={16}/><span>Find a section</span><kbd>⌘ K</kbd></button>
          <button type="button" className="cx-icon-button hidden sm:inline-flex" aria-label={density==='comfortable'?'Use compact table spacing':'Use comfortable table spacing'} aria-pressed={density==='compact'} onClick={()=>setDensity(old=>old==='compact'?'comfortable':'compact')}><Columns3 size={18}/></button>
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
        {clientLoading && <p className="cx-filter-loading" role="status">Connecting to BigQuery warehouse…</p>}
        {clientReady && !evidencePage && <div className="cx-legacy-bar"><div role="note" className="flex items-center gap-2 flex-wrap"><span className="cx-legacy-badge"><AlertCircle size={12} aria-hidden="true"/>Legacy Exploration</span><span className="text-slate-600 text-xs hidden sm:inline">Metrics are exploratory and not independently reconciled.</span><Link to="/reports">Evidence Reports <ArrowRight size={13}/></Link></div>
          <button type="button" className={`cx-button-secondary ${filtersOpen ? 'border-[#3562B3] bg-[#EDF5FC] text-[#315EAD]' : ''}`} aria-expanded={filtersOpen} aria-controls="legacy-filters" onClick={()=>setFiltersOpen(old=>!old)}><SlidersHorizontal size={14}/><span>Report filters</span></button>
          <AppliedScope/>
        </div>}
        {clientReady && !evidencePage && <div id="legacy-filters" hidden={!filtersOpen}>{filtersOpen && !filterError && <Suspense fallback={<p className="cx-filter-loading" role="status">Loading report controls…</p>}><GlobalFilter/></Suspense>}</div>}
        <ErrorBoundary
          resetKeys={[location.pathname]}
          fallbackRender={({ error, resetErrorBoundary }: any) => {
            const isChunk = isChunkLoadError(error);
            return (
              <section className="cx-route-error" role="alert">
                <AlertCircle size={28}/>
                <h1>{isChunk ? 'App update available' : 'This page could not be displayed'}</h1>
                <p>{isChunk ? 'A newer version of ConversionX was deployed. Reloading will fetch the latest page.' : 'Navigation is still available. Retry the page or return to Overview.'}</p>
                <div>
                  <button className="cx-button-primary" onClick={isChunk ? () => { if (!attemptChunkRecovery(0)) window.location.reload(); } : resetErrorBoundary}>
                    {isChunk ? 'Reload page' : 'Retry page'}
                  </button>
                  <Link className="cx-button-secondary" to="/">Overview</Link>
                </div>
              </section>
            );
          }}
        >
          {clientReady && filterError ? <section className="cx-scope-error" role="alert"><AlertCircle size={22}/><div><h1>Reporting selection needs attention</h1><p>{filterError}</p><p>No analytical request was sent with an invalid selection.</p><button type="button" className="cx-button-primary" onClick={resetScope}>Reset reporting scope</button></div></section> : <Suspense fallback={<PageSkeleton/>}>
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
      <MobileBottomNav onOpenMenu={()=>setMobile(true)} />
    </div>
    {command && <Suspense fallback={<Modal open label="Loading search" onClose={()=>setCommand(false)}><div className="p-6"><p role="status">Loading navigation…</p><button className="cx-button-secondary mt-4" onClick={()=>setCommand(false)}>Close</button></div></Modal>}><CommandPalette isOpen onClose={()=>setCommand(false)}/></Suspense>}
  </div>;
}
function LiveApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthGate>
          <ClientProvider>
            <FilterProvider>
              <Shell />
            </FilterProvider>
          </ClientProvider>
        </AuthGate>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default function App(){
  // Select before mounting any live provider. Full-document mode links also discard the old query cache.
  const mode = applicationMode(typeof window === 'undefined' ? '' : window.location.search);
  if (mode === 'demo') return <Suspense fallback={<p className="p-8" role="status">Loading synthetic demo data… No live connection.</p>}><DemoWorkspace/></Suspense>;
  return <LiveApp/>;
}
