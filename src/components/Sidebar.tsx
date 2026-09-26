import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Search, X, ChevronDown, Settings, Layers, LogOut, Info, RefreshCw, BarChart3, Database, Shield } from 'lucide-react';
import { BRAND } from '../../contracts/naming';
import { NAV_GROUPS } from '../lib/navigation';
import { isCurrentPage, navigationTarget } from '../lib/presentation';
import { useClient } from '../lib/ClientContext';
import { useAuth } from '../lib/AuthContext';

export default function Sidebar({ onClose, onSearch }: { onClose?: () => void; onSearch: () => void }) {
  const location = useLocation(), { clientConfig } = useClient();
  const { user, profile, isAdmin, signOut } = useAuth();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [bqStatus, setBqStatus] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/bq/status')
      .then(res => res.json())
      .then(d => {
        if (d.success) setBqStatus(Boolean(d.connected));
      })
      .catch(() => setBqStatus(false));
  }, []);

  const q = query.trim().toLowerCase();
  const groups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => !q || (item.name + ' ' + group.title).toLowerCase().includes(q)),
  })).filter(group => group.items.length);

  return (
    <aside className="cx-sidebar">
      <div className="cx-brand">
        <Link to="/" onClick={onClose} aria-label={`${BRAND.name} home`} className="cx-brand-link">
          <span className="cx-brand-icon"><Activity size={18} aria-hidden="true" /></span>
          <span>
            <strong>{BRAND.name}</strong>
            <small>Lead-to-sale attribution</small>
          </span>
        </Link>
        {onClose && (
          <button type="button" className="cx-nav-icon" aria-label="Close navigation" onClick={onClose}>
            <X size={18} />
          </button>
        )}
      </div>

      <div className="cx-nav-search">
        <Search size={15} aria-hidden="true" />
        <input
          aria-label="Filter navigation"
          placeholder="Search navigation…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" aria-label="Clear navigation search" onClick={() => setQuery('')}>
            <X size={15} />
          </button>
        )}
      </div>

      {/* Primary Link: Platform Insights */}
      <div className="px-3 pb-1 pt-1">
        <Link
          to="/acquisition"
          onClick={onClose}
          aria-current={location.pathname === '/acquisition' || location.pathname === '/platform-insights' ? 'page' : undefined}
          className={`cx-nav-link !py-2 !px-3 font-semibold text-xs rounded-md transition-all ${
            location.pathname === '/acquisition' || location.pathname === '/platform-insights'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
              : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <BarChart3 size={15} aria-hidden="true" className="text-blue-600" />
          <span>Platform Insights</span>
        </Link>
      </div>

      <nav aria-label="Main navigation" className="cx-navigation">
        {!groups.length && <p className="cx-nav-empty" role="status">No pages match “{query}”.</p>}
        {groups.map(group => {
          const id = 'nav-' + group.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
          const expanded = Boolean(q || !collapsed[group.title]);
          return (
            <section key={group.title}>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={id}
                className="cx-nav-group"
                onClick={() => setCollapsed(old => ({ ...old, [group.title]: !old[group.title] }))}
              >
                <span className="flex items-center gap-1.5">{group.title}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono text-[#6F809A] font-medium">
                    {group.items.length}
                  </span>
                  <ChevronDown size={13} className={expanded ? '' : '-rotate-90'} aria-hidden="true" />
                </div>
              </button>
              <ul id={id} hidden={!expanded}>
                {group.items.map(item => {
                  const Icon = item.icon;
                  const active = isCurrentPage(location.pathname, item.path, location.search);
                  return (
                    <li key={`${group.title}-${item.name}-${item.path}`}>
                      <Link
                        to={navigationTarget(item.path, location.pathname, location.search)}
                        aria-current={active ? 'page' : undefined}
                        onClick={onClose}
                        className="cx-nav-link"
                      >
                        <Icon size={16} aria-hidden="true" />
                        <span>{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </nav>

      <div className="cx-sidebar-footer">
        {/* BigQuery Live Telemetry Status */}
        <div className="flex items-center justify-between px-2.5 py-1.5 text-xs mb-2 rounded-md bg-slate-50 border border-slate-200/90 font-mono">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${bqStatus ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${bqStatus ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </span>
            <span className="font-semibold text-slate-700 text-[10.5px] tracking-tight">
              {bqStatus ? 'BIGQUERY SYNCED' : 'BQ RECONNECTING'}
            </span>
          </div>
          <span className="text-[9.5px] text-slate-400 font-mono uppercase tracking-wider font-semibold">LIVE</span>
        </div>

        <button type="button" onClick={onSearch} className="cx-nav-command mb-1.5">
          <Search size={14} className="text-slate-400" />
          <span>Quick search</span>
          <kbd>⌘ K</kbd>
        </button>

        <div className="cx-workspace mb-2">
          <Layers size={15} aria-hidden="true" className="text-slate-500" />
          <span>
            <strong>Workspace</strong>
            <small>{clientConfig?.name || 'Bastionflowe Production'}</small>
          </span>
          <Link to="/admin" aria-label="Open configuration" onClick={onClose}>
            <Settings size={14} />
          </Link>
        </div>

        {isAdmin && (
          <div className="mb-2">
            <Link
              to="/access-control"
              onClick={onClose}
              aria-current={location.pathname === '/access-control' || location.pathname === '/users' ? 'page' : undefined}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                location.pathname === '/access-control' || location.pathname === '/users'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-100/80 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Shield size={13} className="text-blue-600" />
                <span>Access Control</span>
              </div>
              <span className="text-[10px] font-semibold text-blue-700 font-mono tracking-tight">
                ADMIN
              </span>
            </Link>
          </div>
        )}

        {/* Account identity */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 px-0.5 mt-1">
          <div className="flex items-center gap-2 min-w-0">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-7 h-7 rounded-full border border-slate-200 shrink-0 object-cover ring-1 ring-slate-100"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0 font-mono">
                {user?.displayName
                  ? user.displayName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                  : user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div className="min-w-0">
              <strong className="block text-xs font-semibold text-slate-900 truncate">
                {user?.displayName || (profile?.role === 'admin' ? 'Warren Stear' : 'Team Member')}
              </strong>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                <span className="truncate max-w-[90px]">{user?.email || 'authenticated'}</span>
                {profile?.role && (
                  <>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="uppercase text-slate-600 font-semibold">{profile.role}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            aria-label="Sign out"
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
