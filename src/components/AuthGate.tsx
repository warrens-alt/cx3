import React from 'react';
import { useAuth } from '../lib/AuthContext';
import LoginView from './LoginView';
import PendingApprovalView from './PendingApprovalView';
import SuspendedView from './SuspendedView';
import { AlertCircle, RefreshCw, LogOut, ShieldAlert } from 'lucide-react';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const {
    user,
    profile,
    loading,
    accessState,
    authError,
    retryAuth,
    signOut,
    isActive,
    isPending,
    isSuspended,
  } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 space-y-4 font-sans" role="status" aria-live="polite">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
          <div className="absolute inset-0 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </div>
        <p className="text-xs text-slate-500 font-mono tracking-wide">Checking account access…</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  if (isSuspended) {
    return <SuspendedView />;
  }

  if (isPending) {
    return <PendingApprovalView />;
  }

  if (authError || accessState === 'SERVICE_FAILURE') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-lg border border-red-200 p-6 shadow-sm space-y-4" role="alert" aria-live="assertive">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
              <AlertCircle size={20} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Access Service Unavailable</h2>
              <p className="text-xs text-slate-500">Failed to verify account permissions</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {authError || 'An access service failure prevented permission verification. Analytical access is blocked until access can be verified.'}
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={retryAuth}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              <LogOut size={13} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile || accessState === 'MISSING_PROFILE' || accessState === 'REVOKED') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-lg border border-amber-200 p-6 shadow-sm space-y-4" role="alert">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Account Profile Not Found</h2>
              <p className="text-xs text-slate-500">No active profile exists for this identity</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your account is authenticated, but no active operational profile exists or access was revoked. Contact an administrator for access.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={retryAuth}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-800 rounded-md hover:bg-slate-900 transition-colors shadow-xs cursor-pointer"
            >
              <LogOut size={13} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isActive && profile) {
    return <>{children}</>;
  }

  // Explicit fallback state with retry and sign-out
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4" role="alert">
        <h2 className="text-sm font-semibold text-slate-900">Access Not Authorized</h2>
        <p className="text-xs text-slate-600">Your account cannot access operational analytics at this time.</p>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={retryAuth}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} />
            <span>Retry</span>
          </button>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-800 rounded-md hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <LogOut size={13} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
