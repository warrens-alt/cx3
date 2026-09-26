import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AlertTriangle, GitFork, LayoutDashboard, Menu, PhoneCall } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}

export default function MobileBottomNav({ onOpenMenu }: MobileBottomNavProps) {
  const location = useLocation();
  const itemClass = (active: boolean) => `flex flex-col items-center justify-center gap-0.5 text-[10.5px] select-none touch-manipulation active:scale-95 transition-all min-h-[44px] ${active ? 'text-[#315EAD] font-semibold' : 'text-slate-500'}`;
  const dot = <span className="w-1 h-1 rounded-full bg-[#315EAD]" />;

  const overview = location.pathname === '/' || location.pathname === '/overview';
  const funnel = location.pathname === '/funnel' || location.pathname === '/lead-performance';
  const contact = ['/speed-to-lead','/contact-strategy','/cli-performance','/agent-performance','/temporal'].includes(location.pathname);
  const exceptions = location.pathname === '/exceptions';
  const more = !overview && !funnel && !contact && !exceptions;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 lg:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom,0px)]" aria-label="Mobile navigation">
      <div className="grid grid-cols-5 h-14 max-w-lg mx-auto">
        <NavLink to="/overview" className={itemClass(overview)}>
          <LayoutDashboard size={18} /><span>Overview</span>{overview && dot}
        </NavLink>
        <NavLink to="/funnel" className={itemClass(funnel)}>
          <GitFork size={18} /><span>Funnel</span>{funnel && dot}
        </NavLink>
        <NavLink to="/speed-to-lead" className={itemClass(contact)}>
          <PhoneCall size={18} /><span>Contact</span>{contact && dot}
        </NavLink>
        <NavLink to="/exceptions" className={itemClass(exceptions)}>
          <AlertTriangle size={18} /><span>Exceptions</span>{exceptions && dot}
        </NavLink>
        <button type="button" onClick={onOpenMenu} aria-label="Open full navigation" className={itemClass(more)}>
          <Menu size={18} /><span>More</span>{more && dot}
        </button>
      </div>
    </nav>
  );
}
