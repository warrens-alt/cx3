import React from 'react';
import '../styles/shell.css';
import ConversionXBrand from './ConversionXBrand';
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
      <div className="cx-access-loading" role="status" aria-live="polite">
        <ConversionXBrand variant="wordmark" tone="light" />
        <span className="cx-access-spinner" aria-hidden="true" />
        <p className="cx-access-loading-note">Checking account access…</p>
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
      <div className="cx-access-page cx-access-error">
        <div className="cx-access-card cx-access-alert cx-access-critical" role="alert" aria-live="assertive">
          <div className="cx-access-error-brand"><ConversionXBrand variant="wordmark" tone="light" /></div>
          <div className="cx-access-alert-heading">
            <div className="cx-access-status cx-access-critical">
              <AlertCircle size={20} />
            </div>
            <div>
              <h2 className="cx-access-title">Access Service Unavailable</h2>
              <p className="cx-access-description">Failed to verify account permissions</p>
            </div>
          </div>
          <p className="cx-access-description">
            {authError || 'An access service failure prevented permission verification. Analytical access is blocked until access can be verified.'}
          </p>
          <div className="cx-access-actions">
            <button
              type="button"
              onClick={retryAuth}
              className="cx-access-action cx-access-action-primary"
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={signOut}
              className="cx-access-action"
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
      <div className="cx-access-page cx-access-error">
        <div className="cx-access-card cx-access-alert cx-access-warning" role="alert">
          <div className="cx-access-error-brand"><ConversionXBrand variant="wordmark" tone="light" /></div>
          <div className="cx-access-alert-heading">
            <div className="cx-access-status cx-access-warning">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="cx-access-title">Account Profile Not Found</h2>
              <p className="cx-access-description">No active profile exists for this identity</p>
            </div>
          </div>
          <p className="cx-access-description">
            Your account is authenticated, but no active operational profile exists or access was revoked. Contact an administrator for access.
          </p>
          <div className="cx-access-actions">
            <button
              type="button"
              onClick={retryAuth}
              className="cx-access-action"
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={signOut}
              className="cx-access-action cx-access-action-primary"
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
    <div className="cx-access-page cx-access-error">
      <div className="cx-access-card cx-access-alert" role="alert">
        <div className="cx-access-error-brand"><ConversionXBrand variant="wordmark" tone="light" /></div>
        <h2 className="cx-access-title">Access Not Authorized</h2>
        <p className="cx-access-description">Your account cannot access operational analytics at this time.</p>
        <div className="cx-access-actions">
          <button
            type="button"
            onClick={retryAuth}
            className="cx-access-action"
          >
            <RefreshCw size={13} />
            <span>Retry</span>
          </button>
          <button
            type="button"
            onClick={signOut}
            className="cx-access-action cx-access-action-primary"
          >
            <LogOut size={13} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
