import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Database, Layers, LogOut, Search, Settings, Shield, X } from 'lucide-react';
import { BRAND } from '../../contracts/naming';
import { NAV_GROUPS, navigationPage, relatedPages } from '../lib/navigation';
import { isCurrentPage, navigationTarget } from '../lib/presentation';
import { useClient } from '../lib/ClientContext';
import { useAuth } from '../lib/AuthContext';

export default function Sidebar({ onClose, onSearch, searchShortcut = 'Ctrl K' }: { onClose?: () => void; onSearch: () => void; searchShortcut?: string }) {
  const location = useLocation();
  const { clientConfig } = useClient();
  const { user, profile, isAdmin, signOut } = useAuth();
  const currentPage = navigationPage(location.pathname);
  const [warehouseConnected, setWarehouseConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (!clientConfig?.id) return;
    const controller = new AbortController();
    setWarehouseConnected(null);
    fetch(`/api/analytics/health?clientId=${encodeURIComponent(clientConfig.id)}`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(payload => setWarehouseConnected(Boolean(payload.success && payload.health?.status === 'Connected')))
      .catch(() => {
        if (!controller.signal.aborted) setWarehouseConnected(false);
      });
    return () => controller.abort();
  }, [clientConfig?.id]);

  return (
    <aside className="cx-sidebar">
      <div className="cx-brand">
        <Link to={navigationTarget('/overview', location.pathname, location.search)} onClick={onClose} aria-label={`${BRAND.name} home`} className="cx-brand-link">
          <span className="cx-brand-icon"><Activity size={18} aria-hidden="true" /></span>
          <span className="cx-brand-copy">
            <strong>{BRAND.name}</strong>
            <small>Lead operations</small>
          </span>
        </Link>
        {onClose && (
          <button type="button" className="cx-nav-icon" aria-label="Close navigation" onClick={onClose}>
            <X size={18} />
          </button>
        )}
      </div>

      <button type="button" onClick={onSearch} className="cx-sidebar-search" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K">
        <Search size={15} aria-hidden="true" />
        <span>Find a page</span>
        <kbd aria-hidden="true">{searchShortcut}</kbd>
      </button>

      <nav aria-label="Main navigation" className="cx-navigation cx-navigation-simple">
        {NAV_GROUPS.map(group => (
          <section key={group.title}>
            <div className="cx-nav-section-label">{group.title}</div>
            <ul>
              {group.items.map(item => {
                const Icon = item.icon;
                const active = isCurrentPage(location.pathname, item.path, location.search);
                const currentSection = currentPage?.section === item.section;
                const related = relatedPages(item.section, isAdmin);
                const showRelated = currentSection && related.length > 1 && item.section !== 'settings';
                return (
                  <li key={`${group.title}-${item.name}-${item.path}`}>
                    <Link
                      to={navigationTarget(item.path, location.pathname, location.search)}
                      aria-current={showRelated ? 'location' : active ? 'page' : currentSection ? 'location' : undefined}
                      data-current-section={currentSection || undefined}
                      onClick={onClose}
                      className="cx-nav-link"
                      title={item.description}
                    >
                      <Icon size={16} aria-hidden="true" />
                      <span>{item.name}</span>
                    </Link>
                    {showRelated && <ul className="cx-related-navigation" aria-label={`${item.name} pages`}>
                      {related.map(page => <li key={page.path}><Link
                        to={navigationTarget(page.path, location.pathname, location.search)}
                        aria-current={isCurrentPage(location.pathname, page.path, location.search) ? 'page' : undefined}
                        title={page.description} onClick={onClose}>{page.name}</Link></li>)}
                    </ul>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>

      <div className="cx-sidebar-footer">
        <div className="cx-sidebar-health" role="status">
          <Database size={13} aria-hidden="true" />
          <div>
            <strong>{warehouseConnected === null ? 'Checking warehouse' : warehouseConnected ? 'Warehouse connected' : 'Warehouse unavailable'}</strong>
            <small>{warehouseConnected === null ? 'Confirming source availability' : warehouseConnected === false ? 'Operational data may be unavailable' : 'Live operational source'}</small>
          </div>
          <span data-state={warehouseConnected === null ? 'checking' : warehouseConnected ? 'connected' : 'unavailable'} />
        </div>

        <div className="cx-workspace">
          <Layers size={15} aria-hidden="true" />
          <span>
            <strong>Workspace</strong>
            <small>{clientConfig?.name || 'Select a workspace'}</small>
          </span>
          <Link to={navigationTarget('/admin', location.pathname, location.search)} aria-label="Open Settings" onClick={onClose}>
            <Settings size={14} />
          </Link>
        </div>

        {isAdmin && (
          <Link
            to="/access-control"
            onClick={onClose}
            aria-current={location.pathname === '/access-control' || location.pathname === '/users' ? 'page' : undefined}
            className="cx-sidebar-admin"
          >
            <Shield size={14} />
            <span>Access control</span>
            <small>Admin</small>
          </Link>
        )}

        <div className="cx-account-row">
          <div className="cx-account-identity">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" />
            ) : (
              <span className="cx-account-avatar">
                {user?.displayName
                  ? user.displayName.split(' ').map(name => name[0]).join('').slice(0, 2).toUpperCase()
                  : user?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            )}
            <span>
              <strong>{user?.displayName || 'Team member'}</strong>
              <small>{profile?.role || 'authenticated'}</small>
            </span>
          </div>
          <button type="button" onClick={() => signOut()} aria-label="Sign out" title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
