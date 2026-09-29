import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { getAreaForPath, getRouteItem, type RouteItem } from '../routeManifest';
import { useScopedNavigationTarget } from '../../hooks/useScopedNavigationTarget';
import { useAuth } from '../../lib/AuthContext';

interface AreaNavigationProps {
  className?: string;
}

export default function AreaNavigation({ className = '' }: AreaNavigationProps) {
  const location = useLocation();
  const scoped = useScopedNavigationTarget();
  const { isAdmin } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const activeArea = getAreaForPath(location.pathname);
  const currentPath = location.pathname === '/' ? '/overview' : location.pathname;

  // Filter out admin-only pages if user is not admin
  const primaryTabs = activeArea.primaryTabs.filter(tab => !tab.adminOnly || isAdmin);
  const moreViews = activeArea.moreViews.filter(view => !view.adminOnly || isAdmin);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && moreOpen) {
        setMoreOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreOpen]);

  // Do not render if the area has no tabs at all
  if (primaryTabs.length === 0 && moreViews.length === 0) {
    return null;
  }

  const normalize = (p: string) => {
    const clean = p.split('?')[0].replace(/\/+$/, '') || '/';
    return clean === '/' ? '/overview' : clean;
  };

  const isCurrent = (path: string) => {
    const normCurrent = normalize(currentPath);
    const normPath = normalize(path);

    if (normCurrent === normPath) return true;
    const item = getRouteItem(normPath);
    if (item?.urlAliases?.some(alias => normalize(alias) === normCurrent)) return true;
    return false;
  };

  const isMoreViewActive = moreViews.some(v => isCurrent(v.path));

  return (
    <nav
      className={`cx-area-nav bg-surface border-b border-border z-20 ${className}`}
      aria-label={`${activeArea.name} navigation`}
    >
      <div className="cx-area-nav-inner max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2 w-full min-w-0">
        <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pt-1">
          {primaryTabs.map(tab => {
            const active = isCurrent(tab.path);
            return (
              <Link
                key={tab.path}
                to={scoped(tab.path)}
                aria-current={active ? 'page' : undefined}
                className={`cx-area-nav-item inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs whitespace-nowrap transition-all border-b-2 rounded-t-md ${
                  active
                    ? 'border-blue-600 dark:border-blue-400 text-blue-700 dark:text-blue-300 font-bold bg-blue-50/80 dark:bg-blue-950/40 -mb-[1px]'
                    : 'border-transparent text-text-sec hover:text-blue-600 dark:hover:text-blue-400 hover:bg-surface-subtle/80 font-medium'
                }`}
                title={tab.description}
              >
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </div>

        {moreViews.length > 0 && (
          <div className="relative inline-block shrink-0 py-1" ref={dropdownRef}>
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setMoreOpen(prev => !prev)}
              aria-expanded={moreOpen}
              aria-haspopup="true"
              aria-controls="area-more-menu"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                isMoreViewActive
                  ? 'border-action/40 bg-action/5 text-action font-semibold'
                  : 'border-border bg-surface hover:bg-surface-subtle text-text-sec hover:text-text-main'
              }`}
            >
              <span>More views</span>
              <ChevronDown size={13} aria-hidden="true" className={`transition-transform duration-150 ${moreOpen ? 'rotate-180' : ''}`} />
            </button>

            {moreOpen && (
              <div
                id="area-more-menu"
                className="absolute right-0 mt-1.5 w-64 rounded-xl shadow-lg bg-surface border border-border py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
                role="menu"
              >
                {moreViews.map(view => {
                  const active = isCurrent(view.path);
                  return (
                    <Link
                      key={view.path}
                      to={scoped(view.path)}
                      role="menuitem"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setMoreOpen(false)}
                      className={`block px-3.5 py-2.5 hover:bg-surface-subtle transition-colors ${
                        active ? 'text-action font-semibold bg-action/10' : 'text-text-main'
                      }`}
                      title={view.description}
                    >
                      <div className="font-semibold text-xs flex items-center justify-between">
                        <span>{view.name}</span>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-action" />}
                      </div>
                      <div className="text-[11px] text-text-mute truncate mt-0.5">{view.description}</div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
