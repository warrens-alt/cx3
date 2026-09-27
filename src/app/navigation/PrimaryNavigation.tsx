import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  Search,
  LayoutDashboard,
  GitFork,
  PhoneCall,
  BadgeCheck,
  CircleDollarSign,
  AlertTriangle,
  Settings,
  Shield,
  Database,
  Layers,
  LogOut,
  X,
} from 'lucide-react';
import { BRAND } from '../../../contracts/naming';
import { navigationTarget } from '../../lib/presentation';
import { getAreaForPath, BUSINESS_AREAS } from '../routeManifest';
import { useClient } from '../../lib/ClientContext';
import { useAuth } from '../../lib/AuthContext';
import ReviewLauncher from '../../components/ReviewLauncher';
import '../../styles/guidedAnalytics.css';

interface PrimaryNavigationProps {
  onClose?: () => void;
  onSearch: () => void;
  searchShortcut?: string;
}

export default function PrimaryNavigation({
  onClose,
  onSearch,
  searchShortcut = 'Ctrl K',
}: PrimaryNavigationProps) {
  const location = useLocation();
  const { clientConfig } = useClient();
  const { user, profile, isAdmin, signOut } = useAuth();

  const currentArea = getAreaForPath(location.pathname);

  const businessNavItems = BUSINESS_AREAS.slice(0, 6).map(area => ({
    id: area.id,
    name: area.name,
    path: area.landingPath,
    icon: area.icon,
    desc:
      area.id === 'overview'
        ? 'Decide where to look'
        : area.id === 'journey'
        ? 'Progression & acquisition'
        : area.id === 'contact'
        ? 'Calls & vendor outcomes'
        : area.id === 'sales'
        ? 'Sales, conversion & ageing'
        : area.id === 'commercial'
        ? 'Spend, revenue & attribution'
        : 'Exceptions, records & data quality',
  }));

  return (
    <aside className="cx-sidebar">
      {/* Brand header */}
      <div className="cx-brand">
        <Link
          to={navigationTarget('/overview', location.pathname, location.search)}
          onClick={onClose}
          aria-label={`${BRAND.name} home`}
          className="cx-brand-link"
        >
          <span className="cx-brand-icon">
            <Activity size={18} aria-hidden="true" />
          </span>
          <span className="cx-brand-copy">
            <strong>{BRAND.name}</strong>
            <small>Lead operations</small>
          </span>
        </Link>
        {onClose && (
          <button
            type="button"
            className="cx-nav-icon"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Global Command / Search - single visible trigger per viewport: topbar on desktop, sidebar drawer on mobile */}
      <button
        type="button"
        onClick={onSearch}
        className="cx-sidebar-search lg:hidden"
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search size={15} aria-hidden="true" />
        <span>Find a page</span>
        <kbd aria-hidden="true">{searchShortcut}</kbd>
      </button>

      {/* Review Mode Trigger */}
      <div className="cx-sidebar-review">
        <ReviewLauncher afterNavigate={onClose} />
      </div>

      {/* Primary Navigation - Exactly 6 Business Areas */}
      <nav aria-label="Main navigation" className="cx-navigation cx-navigation-simple flex-1">
        <section>
          <div className="cx-nav-section-label">Customer journey</div>
          <ul>
            {businessNavItems.map(item => {
              const Icon = item.icon;
              const isCurrentArea = currentArea.id === item.id;
              const isExactPage = location.pathname === item.path || (item.path === '/overview' && location.pathname === '/');
              return (
                <li key={item.id}>
                  <div className="cx-nav-goal-row">
                    <Link
                      to={navigationTarget(item.path, location.pathname, location.search)}
                      aria-current={isExactPage ? 'page' : isCurrentArea ? 'location' : undefined}
                      data-current-section={isCurrentArea || undefined}
                      onClick={onClose}
                      className="cx-nav-link"
                      title={item.desc}
                    >
                      <Icon size={16} aria-hidden="true" />
                      <span>{item.name}</span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Administration Section */}
        <section className="mt-4">
          <div className="cx-nav-section-label">Administration</div>
          <ul>
            <li>
              <div className="cx-nav-goal-row">
                <Link
                  to={navigationTarget('/admin', location.pathname, location.search)}
                  aria-current={location.pathname === '/admin' || location.pathname === '/settings' ? 'page' : undefined}
                  onClick={onClose}
                  className="cx-nav-link"
                  title="Workspace configuration and preferences"
                >
                  <Settings size={16} aria-hidden="true" />
                  <span>Settings</span>
                </Link>
              </div>
            </li>
            {isAdmin && (
              <li>
                <div className="cx-nav-goal-row">
                  <Link
                    to="/access-control"
                    aria-current={location.pathname === '/access-control' || location.pathname === '/users' ? 'page' : undefined}
                    onClick={onClose}
                    className="cx-nav-link"
                    title="Manage user access and roles"
                  >
                    <Shield size={16} aria-hidden="true" />
                    <span>Access control</span>
                  </Link>
                </div>
              </li>
            )}
          </ul>
        </section>
      </nav>

      {/* Footer */}
      <div className="cx-sidebar-footer">
        <Link
          className="cx-sidebar-source-link"
          to={navigationTarget('/data-integrity', location.pathname, location.search)}
          onClick={onClose}
        >
          <Database size={14} aria-hidden="true" />
          <span>Source status & completeness</span>
        </Link>

        <div className="cx-workspace">
          <Layers size={15} aria-hidden="true" />
          <span>
            <strong>Workspace</strong>
            <small>{clientConfig?.name || 'Select a workspace'}</small>
          </span>
          <div className="flex items-center gap-0.5">
            <Link
              to={navigationTarget('/admin', location.pathname, location.search)}
              aria-label="Open Settings"
              onClick={onClose}
            >
              <Settings size={14} />
            </Link>
          </div>
        </div>

        <div className="cx-account-row">
          <div className="cx-account-identity">
            <span className="cx-account-avatar">
              {user?.displayName
                ? user.displayName.split(' ').map(name => name[0]).join('').slice(0, 2).toUpperCase()
                : user?.email?.charAt(0).toUpperCase() || 'U'}
            </span>
            <span>
              <strong>{user?.displayName || 'Team member'}</strong>
              <small>{profile?.role || 'authenticated'}</small>
            </span>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
