import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, GitFork, PhoneCall, AlertTriangle, Menu } from 'lucide-react';
import { navigationTarget } from '../lib/presentation';
import { getAreaForPath, getRouteItem } from '../app/routeManifest';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
  menuOpen?: boolean;
}

export default function MobileBottomNav({ onOpenMenu, menuOpen = false }: MobileBottomNavProps) {
  const location = useLocation();
  const itemClass = (active: boolean) => `cx-mobile-nav-item flex flex-col items-center justify-center gap-[3px] min-h-12 text-[11px] leading-tight touch-manipulation ${active ? 'cx-mobile-nav-active font-semibold' : 'text-text-sec'}`;
  const dot = <span className="cx-mobile-nav-dot w-1 h-1 rounded-full" aria-hidden="true" />;

  const area = getAreaForPath(location.pathname);
  const currentArea = area.id;
  const currentPath = getRouteItem(location.pathname)?.path;
  const contextArea = currentArea === 'sales' || currentArea === 'commercial' ? area : null;
  const ContextIcon = contextArea?.icon;

  const isOverview = currentArea === 'overview';
  const isJourney = currentArea === 'journey';
  const isContact = currentArea === 'contact';
  const isInvestigate = currentArea === 'investigate';
  const isMore = !isOverview && !isJourney && !isContact && !isInvestigate;

  return (
    <nav
      className="cx-mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border-subtle lg:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5 h-[58px] max-w-lg mx-auto">
        <Link
          to={navigationTarget('/overview', location.pathname, location.search)}
          aria-current={isOverview ? (currentPath === '/overview' ? 'page' : 'location') : undefined}
          className={itemClass(isOverview)}
          data-navigation-area={getAreaForPath('/overview').id}
        >
          <LayoutDashboard size={18} aria-hidden="true" />
          <span>Overview</span>
          {isOverview && dot}
        </Link>

        <Link
          to={navigationTarget('/funnel', location.pathname, location.search)}
          aria-current={isJourney ? (currentPath === '/funnel' ? 'page' : 'location') : undefined}
          className={itemClass(isJourney)}
          data-navigation-area={getAreaForPath('/funnel').id}
        >
          <GitFork size={18} aria-hidden="true" />
          <span>Journey</span>
          {isJourney && dot}
        </Link>

        <Link
          to={navigationTarget('/contact-strategy', location.pathname, location.search)}
          aria-current={isContact ? (currentPath === '/contact-strategy' ? 'page' : 'location') : undefined}
          className={itemClass(isContact)}
          data-navigation-area={getAreaForPath('/contact-strategy').id}
        >
          <PhoneCall size={18} aria-hidden="true" />
          <span>Contact</span>
          {isContact && dot}
        </Link>

        <Link
          to={navigationTarget('/exceptions', location.pathname, location.search)}
          aria-current={isInvestigate ? (currentPath === '/exceptions' ? 'page' : 'location') : undefined}
          className={itemClass(isInvestigate)}
          data-navigation-area={getAreaForPath('/exceptions').id}
        >
          <AlertTriangle size={18} aria-hidden="true" />
          <span>Investigate</span>
          {isInvestigate && dot}
        </Link>

        {contextArea && ContextIcon ? <Link
          to={navigationTarget(contextArea.landingPath, location.pathname, location.search)}
          aria-current={currentPath === contextArea.landingPath ? 'page' : 'location'}
          className={itemClass(true)}
          data-navigation-area={contextArea.id}
        >
          <ContextIcon size={18} aria-hidden="true" />
          <span>{contextArea.id === 'sales' ? 'Sales' : 'Commercial'}</span>
          {dot}
        </Link> : <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open full navigation"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? 'mobile-navigation-dialog' : undefined}
          className={itemClass(isMore)}
          data-navigation-area={area.id}
        >
          <Menu size={18} aria-hidden="true" />
          <span>More</span>
          {isMore && dot}
        </button>}
      </div>
    </nav>
  );
}
