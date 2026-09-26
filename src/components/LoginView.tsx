import React, { useState } from 'react';
import { Activity, Shield, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { BRAND } from '../../contracts/naming';

export default function LoginView() {
  const { signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate with Google. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-blue-600 selection:text-white relative font-sans">
      {/* Background Tech Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'linear-gradient(#E2E8F0 1px, transparent 1px), linear-gradient(90deg, #E2E8F0 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      {/* Top Header - Unified with app topbar (54px height, hairline border, identical brand lockup) */}
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
              Lead-to-sale attribution
            </small>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 text-xs rounded-md bg-slate-50 border border-slate-200 font-mono">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-semibold text-slate-700 text-[10.5px] tracking-tight">
              BIGQUERY SYNCED
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-[9.5px] text-slate-500 uppercase font-semibold">LIVE</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 font-mono pl-3 border-l border-slate-200">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>Bastionflowe Production</span>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-7 sm:p-8 shadow-sm space-y-6 relative overflow-hidden">
          {/* Subtle top brand hairline accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500" />

          <div className="space-y-2 text-center pt-1">
            <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center mx-auto shadow-2xs mb-2">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-display">
              Identity & Access Verification
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              Single Sign-On authentication for verified analysts, operational teams, and workspace managers across Offernet.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign In Button */}
          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs border border-slate-300 hover:border-slate-400 transition-all duration-150 shadow-2xs hover:shadow-xs disabled:opacity-60 active:scale-[0.99] cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-blue-600 rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>{submitting ? 'Connecting with Google SSO…' : 'Sign in with Google'}</span>
            </button>
          </div>

          {/* Access Policy Pillars - Clean Unboxed Discipline */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono font-semibold tracking-wider uppercase text-slate-400">
              <span>Security Governance</span>
              <span>Policy Active</span>
            </div>
            <div className="grid grid-cols-1 gap-2 text-[11.5px] text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Google identity authentication</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Server-authorised workspace scoping</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Authenticated analytical API access</span>
              </div>
            </div>
          </div>

          {/* Bottom Telemetry Strip */}
          <div className="pt-2.5 text-center text-[10.5px] font-mono text-slate-400 border-t border-slate-100">
            Access is granted only after account and workspace authorisation.
          </div>
        </div>
      </main>

      {/* Unified Enterprise Footer */}
      <footer className="relative z-10 border-t border-slate-200 bg-white/90 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <strong className="font-semibold text-slate-700">{BRAND.name}</strong>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>{BRAND.platform}</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>{BRAND.engine}</span>
        </div>
        <div>
          <span>Protected analytical workspace</span>
        </div>
      </footer>
    </div>
  );
}
