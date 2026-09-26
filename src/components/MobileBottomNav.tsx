import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, GitFork, Zap, ShieldCheck, Menu, Search } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}

export default function MobileBottomNav({ onOpenMenu, onOpenSearch }: MobileBottomNavProps) {
  const location = useLocation();

  const isOverview = location.pathname === '/' || location.pathname === '/overview';
  const isFunnel = location.pathname === '/funnel' || location.pathname === '/lead-performance';
  const isSpeedToLead = location.pathname === '/speed-to-lead';
  const isVendors = location.pathname === '/vendor-quality' || location.pathname === '/vendors';
  const isMore = !isOverview && !isFunnel && !isSpeedToLead && !isVendors;

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 lg:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-5 h-14 max-w-lg mx-auto">
        {/* 1. Overview */}
        <NavLink
          to="/overview"
          className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] select-none touch-manipulation active:scale-95 transition-all min-h-[44px] ${
            isOverview ? 'text-[#315EAD] font-semibold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard size={18} className={isOverview ? 'stroke-[2.2]' : 'stroke-[1.8]'} />
          <span>Overview</span>
          {isOverview && <span className="w-1 h-1 rounded-full bg-[#315EAD]" />}
        </NavLink>

        {/* 2. Funnel */}
        <NavLink
          to="/funnel"
          className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] select-none touch-manipulation active:scale-95 transition-all min-h-[44px] ${
            isFunnel ? 'text-[#315EAD] font-semibold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <GitFork size={18} className={isFunnel ? 'stroke-[2.2]' : 'stroke-[1.8]'} />
          <span>Funnel</span>
          {isFunnel && <span className="w-1 h-1 rounded-full bg-[#315EAD]" />}
        </NavLink>

        {/* 3. Speed to Lead */}
        <NavLink
          to="/speed-to-lead"
          className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] select-none touch-manipulation active:scale-95 transition-all min-h-[44px] ${
            isSpeedToLead ? 'text-[#315EAD] font-semibold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Zap size={18} className={isSpeedToLead ? 'stroke-[2.2]' : 'stroke-[1.8]'} />
          <span>Speed</span>
          {isSpeedToLead && <span className="w-1 h-1 rounded-full bg-[#315EAD]" />}
        </NavLink>

        {/* 4. Vendors */}
        <NavLink
          to="/vendor-quality"
          className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] select-none touch-manipulation active:scale-95 transition-all min-h-[44px] ${
            isVendors ? 'text-[#315EAD] font-semibold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck size={18} className={isVendors ? 'stroke-[2.2]' : 'stroke-[1.8]'} />
          <span>Vendors</span>
          {isVendors && <span className="w-1 h-1 rounded-full bg-[#315EAD]" />}
        </NavLink>

        {/* 5. More / Menu */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open full platform navigation menu"
          className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] select-none touch-manipulation active:scale-95 transition-all cursor-pointer min-h-[44px] ${
            isMore ? 'text-[#315EAD] font-semibold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Menu size={18} className={isMore ? 'stroke-[2.2] text-[#315EAD]' : 'stroke-[1.8]'} />
          <span>More</span>
          {isMore && <span className="w-1 h-1 rounded-full bg-[#315EAD]" />}
        </button>
      </div>
    </nav>
  );
}
