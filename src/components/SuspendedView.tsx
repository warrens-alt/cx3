import React from 'react';
import { Activity, ShieldAlert, LogOut, Mail } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { BRAND } from '../../contracts/naming';

export default function SuspendedView() {
  const { user, signOut } = useAuth();

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
          {/* Subtle top rose hairline accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600" />

          <div className="w-12 h-12 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono font-semibold text-rose-700 uppercase tracking-wider">
              Access Suspended
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-display">
              Workspace Access Suspended
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              Your account access has been revoked or temporarily suspended by the platform administrator.
            </p>
          </div>

          <div className="bg-slate-50 rounded-md p-3.5 border border-slate-200 text-left space-y-2.5 text-xs">
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full ring-1 ring-slate-300 object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-300 flex items-center justify-center text-slate-700 font-semibold text-xs">
                  {user?.displayName
                    ? user.displayName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                    : user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900 truncate">{user?.displayName || 'User'}</div>
                <div className="text-slate-500 text-[11px] truncate flex items-center gap-1.5 font-mono">
                  <Mail className="w-3 h-3 text-slate-400" />
                  {user?.email}
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11.5px] text-slate-500 leading-relaxed">
            If you believe this suspension is in error, contact your platform administrator or internal support owner.
          </p>

          <button
            type="button"
            onClick={signOut}
            className="btn-secondary w-full !h-9 text-xs font-semibold gap-2 shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Return to Log In</span>
          </button>
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
