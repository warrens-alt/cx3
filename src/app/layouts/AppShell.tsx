import React, { Suspense, useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import {
  Menu,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  AlertCircle,
  Columns3,
} from 'lucide-react';
import { BRAND, PAGE_TITLES } from '../../../contracts/naming';
import { useClient } from '../../lib/ClientContext';
import { useFilters } from '../../lib/FilterContext';
import { useTableDensity } from '../../lib/useTableDensity';
import { navigationPage, isOperationalRoute } from '../../lib/navigation';
import { DEMO_ENTRY_URL } from '../../lib/applicationMode';
import { useDevice } from '../../hooks/useDevice';
import PrimaryNavigation from '../navigation/PrimaryNavigation';
import AreaNavigation from '../navigation/AreaNavigation';
import MobileBottomNav from '../../components/MobileBottomNav';
import Modal from '../../components/Modal';
import ThemeToggle from '../../components/ThemeToggle';
import { PageSkeleton } from '../../components/Skeleton';
import CommandPalette from '../../components/CommandPalette';
import { getAreaForPath } from '../routeManifest';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const {
    selectedClient,
    loading: clientLoading,
    error: clientError,
    ready: clientReady,
    retry: retryClient,
    clients,
    setSelectedClient,
  } = useClient();

  const { filterError, resetScope } = useFilters();
  const device = useDevice();
  const [mobile, setMobile] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [command, setCommand] = useState(false);
  const { density, toggleDensity } = useTableDensity();

  const currentArea = getAreaForPath(location.pathname);
  const pageNav = navigationPage(location.pathname);
  const pageTitle =
    pageNav?.name ||
    ({ '/visuals': 'Visual Workspace', '/vetting': 'Vetting', '/validation': 'Validation' } as Record<string, string>)[location.pathname] ||
    PAGE_TITLES[location.pathname] ||
    'Operational Platform';

  const searchShortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

  useEffect(() => {
    document.title = `${pageTitle} · ${BRAND.name}`;
  }, [pageTitle]);

  // Route change lifecycle: reset overlays, scroll to top, and focus main content
  useEffect(() => {
    setMobile(false);
    setCommand(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const main = document.getElementById('main-content');
    main?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const frame = window.requestAnimationFrame(() => {
      main?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  // Command shortcut ⌘K listener
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMobile(false);
        setCommand(old => !old);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  // Desktop media query listener
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const close = () => {
      if (mq.matches) setMobile(false);
    };
    mq.addEventListener('change', close);
    return () => mq.removeEventListener('change', close);
  }, []);

  const openSearch = () => {
    setMobile(false);
    setCommand(true);
  };

  return (
    <div
      className="cx-app"
      data-density={density}
      data-device={device.type}
      data-touch={device.isTouch}
      data-orientation={device.orientation}
    >
      <a className="cx-skip" href="#main-content">
        Skip to report content
      </a>

      {/* Desktop Sidebar */}
      <div
        id="desktop-navigation"
        inert={!sidebar}
        aria-hidden={!sidebar ? true : undefined}
        className={`cx-desktop-sidebar transition-all duration-300 ease-in-out ${
          sidebar ? 'w-[224px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="w-[224px] h-full">
          <PrimaryNavigation
            onSearch={openSearch}
            searchShortcut={searchShortcut}
          />
        </div>
      </div>

      {/* Mobile Drawer Modal */}
      <Modal
        id="mobile-navigation-dialog"
        open={mobile}
        onClose={() => setMobile(false)}
        label="Navigation"
        className="cx-nav-modal"
      >
        <PrimaryNavigation
          onClose={() => setMobile(false)}
          onSearch={openSearch}
          searchShortcut={searchShortcut}
        />
      </Modal>

      {/* Work Area */}
      <div className="cx-workarea">
        {/* Compact Workspace Header */}
        <header className="cx-topbar">
          <button
            type="button"
            className="cx-icon-button cx-mobile-menu"
            aria-label="Open navigation"
            aria-haspopup="dialog"
            aria-expanded={mobile}
            aria-controls={mobile ? 'mobile-navigation-dialog' : undefined}
            onClick={() => setMobile(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="cx-icon-button cx-desktop-toggle"
            aria-label={sidebar ? 'Collapse navigation' : 'Expand navigation'}
            title={sidebar ? 'Collapse navigation' : 'Expand navigation'}
            aria-controls="desktop-navigation"
            aria-expanded={sidebar}
            onClick={() => setSidebar(old => !old)}
          >
            {sidebar ? (
              <PanelLeftClose size={18} aria-hidden="true" />
            ) : (
              <PanelLeftOpen size={18} aria-hidden="true" />
            )}
          </button>

          {/* Breadcrumb: Brand / Area / Title */}
          <div className="cx-breadcrumb" aria-label="Current page">
            <span>{BRAND.name}</span>
            <span aria-hidden="true">/</span>
            <span className="text-text-mute hidden sm:inline">{currentArea.name}</span>
            <span aria-hidden="true" className="hidden sm:inline">/</span>
            <strong title={pageTitle}>{pageTitle}</strong>
          </div>

          <div className="cx-topbar-actions">
            {/* Search trigger */}
            <button
              type="button"
              className="cx-search-trigger"
              aria-label="Search pages"
              aria-haspopup="dialog"
              aria-keyshortcuts="Control+K Meta+K"
              title={`Find a page (${searchShortcut})`}
              onClick={openSearch}
            >
              <Search size={16} aria-hidden="true" />
              <span>Find a page</span>
              <kbd aria-hidden="true">{searchShortcut}</kbd>
            </button>

            {/* Density toggle */}
            <button
              type="button"
              className="cx-icon-button cx-density-toggle hidden sm:inline-flex"
              aria-label={
                density === 'comfortable'
                  ? 'Use compact table spacing'
                  : 'Use comfortable table spacing'
              }
              title={`Table spacing: ${density}. Switch to ${
                density === 'comfortable' ? 'compact' : 'comfortable'
              }.`}
              aria-pressed={density === 'compact'}
              onClick={toggleDensity}
            >
              <Columns3 size={18} aria-hidden="true" />
              <span>Spacing: {density === 'comfortable' ? 'Comfortable' : 'Compact'}</span>
            </button>

            {/* Theme toggle */}
            <ThemeToggle />

            {/* Workspace Client Switcher */}
            <label className="cx-workspace-select">
              <span className="hidden sm:inline">Client</span>
              <select
                aria-label="Active client"
                value={selectedClient}
                onChange={event => setSelectedClient(event.target.value)}
                disabled={clientLoading || !clients.length}
              >
                {!selectedClient && (
                  <option value="" disabled>
                    Select client
                  </option>
                )}
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {/* Contextual Area Navigation (Progression, Acquisition, Qualification, Routing, etc.) */}
        <AreaNavigation />

        {/* Main Content Area */}
        <main id="main-content" tabIndex={-1} className="cx-main pb-16 lg:pb-0">
          {clientError && (
            <section className="cx-scope-error" role="alert">
              <AlertCircle size={22} />
              <div>
                <h1>Workspace access is unavailable</h1>
                <p>{clientError}</p>
                <p>No fallback tenant or substitute analytical data is being displayed.</p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="cx-button-primary" onClick={retryClient}>
                    Retry workspace access
                  </button>
                  <a className="cx-button-secondary" href={DEMO_ENTRY_URL}>
                    View demo data
                  </a>
                </div>
                <p>The demo is a separate, synthetic workspace. It does not access your live data.</p>
              </div>
            </section>
          )}

          {clientLoading && (
            <p className="cx-filter-loading" role="status">
              Loading your workspace access…
            </p>
          )}

          {clientReady && filterError && (
            <section className="cx-scope-error" role="alert">
              <AlertCircle size={22} />
              <div>
                <h1>Reporting selection needs attention</h1>
                <p>{filterError}</p>
                <p>No analytical request was sent with an invalid selection.</p>
                <button type="button" className="cx-button-primary" onClick={resetScope}>
                  Reset reporting scope
                </button>
              </div>
            </section>
          )}

          {clientReady && !filterError && children}
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav onOpenMenu={() => setMobile(true)} menuOpen={mobile} />
      </div>

      {/* Command Palette */}
      {command && (
        <Suspense
          fallback={
            <Modal open label="Loading search" onClose={() => setCommand(false)}>
              <div className="p-6">
                <p role="status">Loading navigation…</p>
                <button
                  type="button"
                  className="cx-button-secondary mt-4"
                  onClick={() => setCommand(false)}
                >
                  Close
                </button>
              </div>
            </Modal>
          }
        >
          <CommandPalette isOpen onClose={() => setCommand(false)} />
        </Suspense>
      )}
    </div>
  );
}
