import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, GitFork, LayoutDashboard, Menu, PhoneCall } from 'lucide-react';
import { navigationTarget } from '../lib/presentation';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
  menuOpen?: boolean;
}

export default function MobileBottomNav({ onOpenMenu, menuOpen = false }: MobileBottomNavProps) {
  const location = useLocation();
  const itemClass = (active: boolean) => `flex flex-col items-center justify-center gap-0.5 text-[10.5px] select-none touch-manipulation active:scale-95 transition-all min-h-[48px] ${active ? 'text-[#315EAD] font-semibold' : 'text-slate-500'}`;
  const dot = <span className="w-1 h-1 rounded-full bg-[#315EAD]" />;

  const overview = location.pathname === '/' || location.pathname === '/overview';
  const funnel = location.pathname === '/funnel' || location.pathname === '/lead-performance';
  const contact = ['/speed-to-lead','/contact-strategy','/cli-performance','/agent-performance','/temporal'].includes(location.pathname);
  const performance = ['/vendor-quality','/sales-activation','/campaigns','/commercial'].includes(location.pathname);
  const more = !overview && !funnel && !contact && !performance;

  return (
    <nav className="cx-mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 lg:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom,0px)]" aria-label="Mobile navigation">
      <div className="grid grid-cols-5 h-[58px] max-w-lg mx-auto">
        <Link to={navigationTarget('/overview', location.pathname, location.search)} aria-current={overview ? 'page' : undefined} className={itemClass(overview)}>
          <LayoutDashboard size={18} aria-hidden="true" /><span>Overview</span>{overview && dot}
        </Link>
        <Link to={navigationTarget('/funnel', location.pathname, location.search)} aria-current={funnel ? 'page' : undefined} className={itemClass(funnel)}>
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
