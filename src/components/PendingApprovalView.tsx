import React from 'react';
import { Activity, Clock, LogOut, Mail } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { BRAND } from '../../contracts/naming';

export default function PendingApprovalView() {
  const { user, profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans relative selection:bg-blue-600 selection:text-white">
      {/* Background Tech Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'linear-gradient(#E2E8F0 1px, transparent 1px), linear-gradient(90deg, #E2E8F0 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      {/* Top Header - Consistent 54px height, hairline border, identical brand lockup */}
      <header className="relative z-10 h-[54px] border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="cx-brand-icon">
            <Activity size={18} aria-hidden="true" />
          </span>
          <div>
            <strong className="block text-sm font-bold tracking-tight text-slate-900 leading-tight">
              {BRAND.name}
            </strong>
            <small className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider font-medium">
              Access Governance Gateway
            </small>
          </div>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-md transition-colors border border-slate-300 shadow-2xs cursor-pointer font-medium active:scale-[0.98]"
        >
          <LogOut className="w-3.5 h-3.5 text-slate-500" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-7 sm:p-8 shadow-sm space-y-6 text-center relative overflow-hidden">
          {/* Subtle top amber hairline accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />

          <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-2xs">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono font-semibold text-amber-700 uppercase tracking-wider">
              Access Request Pending
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-display">
              Account Awaiting Administrator Approval
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              Your Google identity has been successfully authenticated, but access to {BRAND.name} is restricted until an administrator assigns your role and client workspace permissions.
            </p>
          </div>

          {/* User details card */}
          <div className="bg-slate-50 rounded-md p-3.5 border border-slate-200 text-left space-y-2.5 text-xs">
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={`${user?.displayName || user?.email || 'User'} profile avatar`}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full ring-1 ring-slate-300 object-cover"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-xs shadow-2xs">
                  {user?.displayName
                    ? user.displayName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                    : user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900 truncate">{user?.displayName || 'Authenticated User'}</div>
                <div className="text-slate-500 text-[11px] truncate flex items-center gap-1.5 font-mono">
                  <Mail className="w-3 h-3 text-slate-400" />
                  {user?.email}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-mono">Pending Role:</span>
              <span className="font-semibold text-slate-700 capitalize font-mono">{profile?.role || 'Pending Assignment'}</span>
            </div>
          </div>

          <div className="p-3 rounded-md bg-blue-50/70 border border-blue-100 text-blue-800 text-[11px] leading-relaxed text-left">
            Your access status is monitored while this page is open. Once an administrator activates your account, the workspace will become available automatically.
          </div>

          <p className="text-[11px] text-slate-500">No manual refresh is required.</p>

        </div>
      </main>

      {/* Unified Enterprise Footer */}
      <footer className="relative z-10 border-t border-slate-200 bg-white/90 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <strong className="font-semibold text-slate-700">{BRAND.name}</strong>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>Security & Access Governance</span>
        </div>
        <div>
          <span>Protected analytical workspace</span>
        </div>
      </footer>
    </div>
  );
}
