import React from 'react';
import { useAuth } from '../lib/AuthContext';
import LoginView from './LoginView';
import PendingApprovalView from './PendingApprovalView';
import SuspendedView from './SuspendedView';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, isActive, isPending, isSuspended } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 space-y-4 font-sans">
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

  if (isActive) {
    return <>{children}</>;
  }

  // Fallback while state resolves
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-800 font-sans">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
