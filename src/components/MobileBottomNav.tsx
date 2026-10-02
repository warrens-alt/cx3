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
  const itemClass = (active: boolean) => `cx-mobile-nav-item${active ? ' cx-mobile-nav-active' : ''}`;
  const dot = <span className="cx-mobile-nav-dot" aria-hidden="true" />;

  const area = getAreaForPath(location.pathname);
  const currentArea = area.id;
  const currentPath = getRouteItem(location.pathname)?.path;

  const isOverview = currentArea === 'overview';
  const isJourney = currentArea === 'journey';
  const isContact = currentArea === 'contact';
  const isInvestigate = currentArea === 'investigate';
  const isMore = !isOverview && !isJourney && !isContact && !isInvestigate;

  return (
    <nav
      className="cx-mobile-bottom-nav"
      aria-label="Mobile navigation"
    >
      <div className="cx-mobile-nav-items">
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
          to={navigationTarget('/investigate', location.pathname, location.search)}
          aria-current={isInvestigate ? (currentPath === '/investigate' ? 'page' : 'location') : undefined}
          className={itemClass(isInvestigate)}
          data-navigation-area={getAreaForPath('/investigate').id}
        >
          <AlertTriangle size={18} aria-hidden="true" />
          <span>Investigate</span>
          {isInvestigate && dot}
        </Link>

        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="More areas"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? 'mobile-navigation-dialog' : undefined}
          aria-current={isMore ? 'location' : undefined}
          className={itemClass(isMore)}
          data-navigation-area={area.id}
        >
          <Menu size={18} aria-hidden="true" />
          <span>More</span>
          {isMore && dot}
        </button>
      </div>
    </nav>
  );
}
