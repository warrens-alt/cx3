import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { getAreaForPath, getRouteItem } from '../routeManifest';
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

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

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

  const moreLabel = activeArea.id === 'investigate' ? 'Evidence & Audit' : 'More analyses';
  const isMoreViewActive = moreViews.some(v => isCurrent(v.path));

  return (
    <nav
      className={`cx-area-nav bg-surface border-b border-border z-20 ${className}`}
      aria-label={`${activeArea.name} navigation`}
      data-navigation-area={activeArea.id}
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
                className="cx-area-nav-item rounded-t-md"
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
              aria-controls="area-more-menu"
              data-current-section={isMoreViewActive || undefined}
              className="cx-area-more-trigger inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer"
            >
              <span>{moreLabel}</span>
              <ChevronDown size={13} aria-hidden="true" className={`transition-transform duration-150 ${moreOpen ? 'rotate-180' : ''}`} />
            </button>

            {moreOpen && (
              <div
                id="area-more-menu"
                className="cx-area-more-menu absolute right-0 mt-1.5 rounded-lg shadow-sm bg-surface border border-border py-1.5 z-50 text-xs"
                role="group"
                aria-label={moreLabel}
              >
                <p className="cx-area-more-heading">{activeArea.id === 'investigate' ? moreLabel : `More ${activeArea.name} analysis`}</p>
                {moreViews.map(view => {
                  const active = isCurrent(view.path);
                  return (
                    <Link
                      key={view.path}
                      to={scoped(view.path)}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setMoreOpen(false)}
                      className="cx-area-more-item block px-3.5 py-2.5 transition-colors"
                      title={view.description}
                    >
                      <div className="font-semibold text-xs flex items-center justify-between">
                        <span>{view.name}</span>
                        {active && <span className="cx-area-more-indicator w-1.5 h-1.5 rounded-full" aria-hidden="true" />}
                      </div>
                      <div className="cx-area-more-description">{view.description}</div>
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
