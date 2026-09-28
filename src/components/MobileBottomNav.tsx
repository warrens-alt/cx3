import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, GitFork, PhoneCall, AlertTriangle, Menu } from 'lucide-react';
import { navigationTarget } from '../lib/presentation';
import { getAreaForPath } from '../app/routeManifest';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
  menuOpen?: boolean;
}

export default function MobileBottomNav({ onOpenMenu, menuOpen = false }: MobileBottomNavProps) {
  const location = useLocation();
  const itemClass = (active: boolean) => `cx-mobile-nav-item ${active ? 'cx-mobile-nav-active' : ''}`;
  const dot = <span className="cx-mobile-nav-dot" aria-hidden="true" />;

  const currentArea = getAreaForPath(location.pathname).id;

  const isOverview = currentArea === 'overview';
  const isJourney = currentArea === 'journey';
  const isContact = currentArea === 'contact';
  const isInvestigate = currentArea === 'investigate';
  const isMore = !isOverview && !isJourney && !isContact && !isInvestigate;

  return (
    <nav
      className="cx-mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 lg:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5 h-[58px] max-w-lg mx-auto">
        <Link
          to={navigationTarget('/overview', location.pathname, location.search)}
          aria-current={isOverview ? 'page' : undefined}
          className={itemClass(isOverview)}
        >
          <LayoutDashboard size={18} aria-hidden="true" />
          <span>Overview</span>
          {isOverview && dot}
        </Link>

        <Link
          to={navigationTarget('/funnel', location.pathname, location.search)}
          aria-current={isJourney ? (location.pathname === '/funnel' ? 'page' : 'location') : undefined}
          className={itemClass(isJourney)}
        >
          <GitFork size={18} aria-hidden="true" />
          <span>Journey</span>
          {isJourney && dot}
        </Link>

        <Link
          to={navigationTarget('/contact-strategy', location.pathname, location.search)}
          aria-current={isContact ? (location.pathname === '/contact-strategy' ? 'page' : 'location') : undefined}
          className={itemClass(isContact)}
        >
          <PhoneCall size={18} aria-hidden="true" />
          <span>Contact</span>
          {isContact && dot}
        </Link>

        <Link
          to={navigationTarget('/exceptions', location.pathname, location.search)}
          aria-current={isInvestigate ? (location.pathname === '/exceptions' ? 'page' : 'location') : undefined}
          className={itemClass(isInvestigate)}
        >
          <AlertTriangle size={18} aria-hidden="true" />
          <span>Investigate</span>
          {isInvestigate && dot}
        </Link>

        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open full navigation"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? 'mobile-navigation-dialog' : undefined}
          className={itemClass(isMore)}
        >
          <Menu size={18} aria-hidden="true" />
          <span>More</span>
          {isMore && dot}
        </button>
      </div>
    </nav>
  );
}
