import '../../styles/shell.css';
import '../../styles/investigationWorkspace.css';
import { InvestigationEvidenceProvider } from '../../features/investigation/EvidenceTray';
import { AuditModeControl } from '../../shared/evidence/AuditMode';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Menu,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { BRAND, PAGE_TITLES } from '../../../contracts/naming';
import { useClient } from '../../lib/ClientContext';
import { useFilters } from '../../lib/FilterContext';
import { useTableDensity } from '../../lib/useTableDensity';
import { navigationPage } from '../../lib/navigation';
import { navigationTarget, SIDEBAR_COLLAPSED_KEY } from '../../lib/presentation';
import { useDevice } from '../../hooks/useDevice';
import PrimaryNavigation from '../navigation/PrimaryNavigation';
import AreaNavigation from '../navigation/AreaNavigation';
import MobileBottomNav from '../../components/MobileBottomNav';
import Modal from '../../components/Modal';
import ThemeToggle from '../../components/ThemeToggle';
import CommandPalette from '../../components/CommandPalette';
import { getAreaForPath, getRouteItem } from '../routeManifest';
import ConversionXBrand from '../../components/ConversionXBrand';

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
  const [mobile, setMobile] = useState<'all' | 'more' | null>(null);
  const [sidebar, setSidebar] = useState(() => {
    try { return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== 'true'; }
    catch { return true; }
  });
  const [command, setCommand] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const preferencesRef = useRef<HTMLDivElement>(null);
  const preferencesButtonRef = useRef<HTMLButtonElement>(null);
  const { density, setDensity } = useTableDensity();

  useEffect(() => {
    try { window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(!sidebar)); }
    catch { /* The local presentation remains usable when storage is unavailable. */ }
  }, [sidebar]);

  const currentArea = getAreaForPath(location.pathname);
  const pageNav = navigationPage(location.pathname);
  const routeItem = getRouteItem(location.pathname);
  const pageTitle =
    pageNav?.name ||
    routeItem?.name ||
    ({ '/visuals': 'Visual Workspace', '/vetting': 'Vetting', '/validation': 'Validation' } as Record<string, string>)[location.pathname] ||
    PAGE_TITLES[location.pathname] ||
    'Operational Platform';

  const searchShortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

  const documentPageTitle = currentArea && routeItem?.path === currentArea.landingPath ? currentArea.name : pageTitle;
  useEffect(() => {
    document.title = `${documentPageTitle} · ${BRAND.name}`;
  }, [documentPageTitle]);

  // Route change lifecycle: reset overlays, scroll to top, and focus main content
  useEffect(() => {
    setMobile(null);
    setCommand(false);
    setPreferencesOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const main = document.getElementById('main-content');
    main?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const frame = window.requestAnimationFrame(() => {
      main?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  // Outside click & Escape listener for preferences popover
  useEffect(() => {
    if (!preferencesOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (preferencesRef.current && !preferencesRef.current.contains(e.target as Node)) {
        setPreferencesOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreferencesOpen(false);
        preferencesButtonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [preferencesOpen]);

  // Command shortcut ⌘K listener
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMobile(null);
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
      if (mq.matches) setMobile(null);
    };
    mq.addEventListener('change', close);
    return () => mq.removeEventListener('change', close);
  }, []);

  const openSearch = () => {
    setMobile(null);
    setCommand(true);
  };

  return (
    <InvestigationEvidenceProvider><div
      className="cx-app"
      data-density={density}
      data-device={device.type}
      data-touch={device.isTouch}
      data-orientation={device.orientation}
    >
      <a className="cx-skip" href="#main-content">
        Skip to report content
      </a>

      {/* The collapsed desktop rail remains interactive. */}
      <div id="desktop-navigation" className="cx-desktop-sidebar" data-collapsed={!sidebar}>
        <PrimaryNavigation collapsed={!sidebar} onSearch={openSearch} searchShortcut={searchShortcut} />
      </div>

      {/* Mobile Drawer Modal */}
      <Modal
        id="mobile-navigation-dialog"
        open={Boolean(mobile)}
        onClose={() => setMobile(null)}
        label={mobile === 'more' ? 'More areas' : 'Navigation'}
        className="cx-nav-modal"
      >
        <PrimaryNavigation
          onClose={() => setMobile(null)}
          areaIds={mobile === 'more' ? ['commercial', 'evidence', 'settings'] : undefined}
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
            className="cx-shell-toggle cx-mobile-menu"
            aria-label="Open navigation"
            aria-haspopup="dialog"
            aria-expanded={Boolean(mobile)}
            aria-controls={mobile ? 'mobile-navigation-dialog' : undefined}
            onClick={() => setMobile('all')}
          >
            <Menu size={20} aria-hidden="true" />
          </button>

          <span className="cx-mobile-brand" aria-hidden="true"><ConversionXBrand variant="symbol" tone="auto" /></span>

          <button
            type="button"
            className="cx-shell-toggle cx-desktop-toggle"
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

          <nav className="cx-breadcrumb" aria-label="Breadcrumb" data-navigation-area={currentArea.id}>
            <Link to={navigationTarget(currentArea.landingPath, location.pathname, location.search)}
              className="cx-breadcrumb-area" title={currentArea.name}
              aria-current={currentArea.name.toLowerCase() === pageTitle.toLowerCase() ? 'page' : undefined}>
              {currentArea.name}
            </Link>
            {currentArea.name.toLowerCase() !== pageTitle.toLowerCase() && <>
              <span aria-hidden="true">/</span>
              <strong title={pageTitle} aria-current="page">{pageTitle}</strong>
            </>}
          </nav>

          <div className="cx-topbar-actions">
            {/* Search trigger */}
            <button
              type="button"
              className="cx-search-trigger"
              aria-label="Search workspaces"
              aria-haspopup="dialog"
              aria-keyshortcuts="Control+K Meta+K"
              title={`Search workspaces (${searchShortcut})`}
              onClick={openSearch}
            >
              <Search size={16} aria-hidden="true" />
              <span>Search workspaces</span>
              <kbd aria-hidden="true">{searchShortcut}</kbd>
            </button>

            {/* Workspace Client Switcher - Prominent */}
            <div className="cx-workspace-select">
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
            </div>

            {/* Display Preferences Popover (Density & Theme) */}
            <div className="relative inline-block" ref={preferencesRef}>
              <button
                ref={preferencesButtonRef}
                type="button"
                className="cx-display-preferences"
                aria-label="Display preferences"
                title="Display preferences: spacing, theme and Audit Mode"
                aria-expanded={preferencesOpen}
                aria-controls="display-preferences-dialog"
                onClick={() => setPreferencesOpen(prev => !prev)}
              >
                <SlidersHorizontal size={17} aria-hidden="true" />
              </button>

              {preferencesOpen && (
                <div
                  id="display-preferences-dialog"
                  className="cx-preferences-popover"
                  role="group"
                  aria-label="Display preferences"
                >
                  <div>
                    <div className="font-semibold text-text-main mb-1.5 flex items-center justify-between">
                      <span>Table spacing</span>
                      <span className="text-[11px] text-text-mute capitalize">{density}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 bg-surface-subtle p-1 rounded-md border border-border-subtle" role="group" aria-label="Table density">
                      <button
                        type="button"
                        aria-pressed={density === 'comfortable'}
                        onClick={() => setDensity('comfortable')}
                        aria-label="Comfortable table spacing"
                        className={`py-1 px-2 rounded font-medium text-xs text-center transition-colors cursor-pointer ${
                          density === 'comfortable' ? 'bg-surface text-text-main font-semibold' : 'text-text-sec hover:text-text-main'
                        }`}
                      >
                        Comfortable
                      </button>
                      <button
                        type="button"
                        aria-pressed={density === 'compact'}
                        onClick={() => setDensity('compact')}
                        aria-label="Compact table spacing"
                        className={`py-1 px-2 rounded font-medium text-xs text-center transition-colors cursor-pointer ${
                          density === 'compact' ? 'bg-surface text-text-main font-semibold' : 'text-text-sec hover:text-text-main'
                        }`}
                      >
                        Compact
                      </button>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border-subtle">
                    <div className="font-semibold text-text-main mb-1.5">Theme</div>
                    <ThemeToggle variant="segmented" className="w-full justify-between" />
                  </div>
                  <div><AuditModeControl />
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Contextual Area Navigation (Progression, Acquisition, Qualification, Routing, etc.) */}
        <AreaNavigation />

        {/* Main Content Area */}
        <main id="main-content" tabIndex={-1} className="cx-main">
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
                </div>
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
        <MobileBottomNav onOpenMenu={() => setMobile('more')} menuOpen={mobile === 'more'} />
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
    </div></InvestigationEvidenceProvider>
  );
}
