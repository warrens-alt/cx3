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
      className={`cx-area-nav ${className}`}
      aria-label={`${activeArea.name} navigation`}
    >
      <div className="flex items-center justify-between gap-1.5 py-1 w-full min-w-0">
        <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-0.5">
          {primaryTabs.map(tab => {
            const active = isCurrent(tab.path);
            return (
              <Link
                key={tab.path}
                to={scoped(tab.path)}
                aria-current={active ? 'page' : undefined}
                className={`cx-area-nav-item ${active ? 'active' : ''}`}
                title={tab.description}
              >
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </div>

        {moreViews.length > 0 && (
          <div className="relative inline-block shrink-0" ref={dropdownRef}>
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setMoreOpen(prev => !prev)}
              aria-expanded={moreOpen}
              aria-haspopup="true"
              aria-controls="area-more-menu"
              className={`cx-area-nav-item flex items-center gap-1 cursor-pointer ${
                isMoreViewActive ? 'active' : ''
              }`}
            >
              <span>More views</span>
              <ChevronDown size={14} aria-hidden="true" className={`transition-transform duration-150 ${moreOpen ? 'rotate-180' : ''}`} />
            </button>

            {moreOpen && (
              <div
                id="area-more-menu"
                className="absolute right-0 mt-1.5 w-60 rounded-lg shadow-xl bg-surface dark:bg-slate-900 border border-border dark:border-slate-800 py-1.5 z-50 text-xs"
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
                      className={`block px-3.5 py-2 hover:bg-surface-subtle dark:hover:bg-slate-800 transition-colors ${
                        active ? 'text-brand-primary font-semibold bg-brand-soft dark:bg-blue-950/40' : 'text-text-main dark:text-slate-200'
                      }`}
                      title={view.description}
                    >
                      <div className="font-medium text-xs">{view.name}</div>
                      <div className="text-[11px] text-text-mute dark:text-slate-400 truncate mt-0.5">{view.description}</div>
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
