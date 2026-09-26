import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, GitFork, LayoutDashboard, Menu, PhoneCall } from 'lucide-react';
import { navigationTarget } from '../lib/presentation';
import { navigationPage } from '../lib/navigation';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
  menuOpen?: boolean;
}

export default function MobileBottomNav({ onOpenMenu, menuOpen = false }: MobileBottomNavProps) {
  const location = useLocation();
  const itemClass = (active: boolean) => `cx-mobile-nav-item ${active ? 'cx-mobile-nav-active' : ''}`;
  const dot = <span className="cx-mobile-nav-dot" aria-hidden="true" />;

  const section = navigationPage(location.pathname)?.section;
  const overview = section === 'overview';
  const funnel = section === 'funnel';
  const contact = section === 'contact';
  const performance = section === 'performance';
  const more = !overview && !funnel && !contact && !performance;

  return (
    <nav className="cx-mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 lg:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom,0px)]" aria-label="Mobile navigation">
      <div className="grid grid-cols-5 h-[58px] max-w-lg mx-auto">
        <Link to={navigationTarget('/overview', location.pathname, location.search)} aria-current={overview ? 'page' : undefined} className={itemClass(overview)}>
          <LayoutDashboard size={18} aria-hidden="true" /><span>Overview</span>{overview && dot}
        </Link>
        <Link to={navigationTarget('/funnel', location.pathname, location.search)} aria-current={funnel ? (location.pathname === '/funnel' ? 'page' : 'location') : undefined} className={itemClass(funnel)}>
          <GitFork size={18} aria-hidden="true" /><span>Funnel</span>{funnel && dot}
        </Link>
        <Link to={navigationTarget('/speed-to-lead', location.pathname, location.search)} aria-current={contact ? (location.pathname === '/speed-to-lead' ? 'page' : 'location') : undefined} className={itemClass(contact)}>
          <PhoneCall size={18} aria-hidden="true" /><span>Contact</span>{contact && dot}
        </Link>
        <Link to={navigationTarget('/vendor-quality', location.pathname, location.search)} aria-current={performance ? (location.pathname === '/vendor-quality' ? 'page' : 'location') : undefined} className={itemClass(performance)}>
          <BarChart3 size={18} aria-hidden="true" /><span>Performance</span>{performance && dot}
        </Link>
        <button type="button" onClick={onOpenMenu} aria-label="Open full navigation" aria-haspopup="dialog" aria-expanded={menuOpen} aria-controls={menuOpen ? 'mobile-navigation-dialog' : undefined} className={itemClass(more)}>
          <Menu size={18} aria-hidden="true" /><span>More</span>{more && dot}
        </button>
      </div>
    </nav>
  );
}
