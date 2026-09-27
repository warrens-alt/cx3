import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { getAreaForPath, type RouteItem } from '../routeManifest';
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
  const currentPath = location.pathname;

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

  // Do not render if the area only has 1 tab and no more views
  if (primaryTabs.length <= 1 && moreViews.length === 0) {
    return null;
  }

  const isCurrent = (path: string) => {
    if (path === '/vendor-dispositions' && location.pathname === '/contact-strategy') {
      const params = new URLSearchParams(location.search);
      return params.get('tab') === 'vendor_dispositions';
    }
    if (path === '/contact-strategy' && location.pathname === '/contact-strategy') {
      const params = new URLSearchParams(location.search);
      return params.get('tab') !== 'vendor_dispositions';
    }
    return currentPath === path;
  };

  const isMoreViewActive = moreViews.some(v => isCurrent(v.path));

  return (
    <nav
      className={`cx-area-nav ${className}`}
      aria-label={`${activeArea.name} navigation`}
    >
      <div className="flex items-center justify-between gap-1.5 py-1 w-full min-w-0">
        <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1">
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
              <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>

            {moreOpen && (
              <div
                id="area-more-menu"
                className="absolute right-0 sm:left-0 mt-1 w-56 rounded-md shadow-lg bg-surface border border-border-subtle py-1 z-50 text-xs"
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
                      className={`block px-4 py-2 hover:bg-surface-sec transition-colors ${
                        active ? 'text-brand-primary font-semibold bg-brand-soft' : 'text-text-main'
                      }`}
                      title={view.description}
                    >
                      <div className="font-medium">{view.name}</div>
                      <div className="text-xs text-text-mute truncate">{view.description}</div>
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
