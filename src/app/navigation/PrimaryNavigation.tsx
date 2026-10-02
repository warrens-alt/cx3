import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, LogOut, X } from 'lucide-react';
import { BRAND } from '../../../contracts/naming';
import { navigationTarget } from '../../lib/presentation';
import { getAreaForPath, getRouteItem, BUSINESS_AREAS, type BusinessAreaId } from '../routeManifest';
import { useAuth } from '../../lib/AuthContext';
import ReviewLauncher from '../../components/ReviewLauncher';
import ConversionXBrand from '../../components/ConversionXBrand';

interface PrimaryNavigationProps {
  onClose?: () => void;
  onSearch: () => void;
  searchShortcut?: string;
  collapsed?: boolean;
  areaIds?: BusinessAreaId[];
}

/** The persistent navigation owns areas; AreaNavigation owns their pages. */
export default function PrimaryNavigation({
  onClose, onSearch, searchShortcut = 'Ctrl K', collapsed = false, areaIds,
}: PrimaryNavigationProps) {
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const currentArea = getAreaForPath(location.pathname);
  const currentRoute = getRouteItem(location.pathname);
  const areas = BUSINESS_AREAS.filter(area => !areaIds || areaIds.includes(area.id));
  const initials = user?.displayName
    ? user.displayName.split(' ').map(name => name[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'U';

  return <aside className="cx-sidebar" data-collapsed={collapsed}>
    <div className="cx-brand">
      <Link to={navigationTarget('/overview', location.pathname, location.search)} onClick={onClose}
        aria-label={`${BRAND.name} home`} title={`${BRAND.name} home`} className="cx-brand-link">
        <ConversionXBrand variant={collapsed ? 'symbol' : 'wordmark'} tone="light" />
      </Link>
      {onClose && <button type="button" className="cx-nav-icon" aria-label="Close navigation" onClick={onClose}><X size={18} aria-hidden="true" /></button>}
    </div>

    {onClose && <button type="button" onClick={onSearch} className="cx-sidebar-search"
      aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K">
      <Search size={16} aria-hidden="true" /><span>Find a page</span><kbd aria-hidden="true">{searchShortcut}</kbd>
    </button>}

    <nav aria-label="Main navigation" className="cx-navigation">
      {['operations', 'administration'].map(group => <ul key={group} className={group === 'administration' ? 'cx-navigation-admin' : undefined}>
        {areas.filter(area => (area.id === 'settings') === (group === 'administration')).map(area => {
          const Icon = area.icon;
          const active = currentArea.id === area.id;
          return <li key={area.id}>
            <Link to={navigationTarget(area.landingPath, location.pathname, location.search)}
              onClick={onClose} className="cx-nav-link" data-navigation-area={area.id}
              aria-label={area.name} title={collapsed ? area.name : area.description}
              aria-current={active ? currentRoute?.path === area.landingPath ? 'page' : 'location' : undefined}>
              <Icon size={19} aria-hidden="true" />
              <span className="cx-nav-label">{area.name}</span>
            </Link>
          </li>;
        })}
      </ul>)}
    </nav>

    <div className="cx-sidebar-footer">
      <div className="cx-account-identity" title={`${user?.displayName || 'Team member'} · ${profile?.role || 'authenticated'}`}>
        <span className="cx-account-avatar" aria-hidden="true">{initials}</span>
        <span className="cx-account-copy"><strong>{user?.displayName || 'Team member'}</strong><small>{profile?.role || 'authenticated'}</small></span>
      </div>
      <div className="cx-sidebar-tools">
        <div className="cx-sidebar-review"><ReviewLauncher compact afterNavigate={onClose} /></div>
        <button type="button" className="cx-nav-icon" onClick={() => signOut()} aria-label="Sign out" title="Sign out"><LogOut size={17} aria-hidden="true" /></button>
      </div>
    </div>
  </aside>;
}
