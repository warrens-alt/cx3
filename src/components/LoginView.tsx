import React, { useState } from 'react';
import { Shield, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { BRAND } from '../../contracts/naming';
import ConversionXBrand from './ConversionXBrand';

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
    <div className="cx-access-page">
      <header className="cx-access-header">
        <ConversionXBrand variant="wordmark" tone="light" />
        <div className="cx-access-security">
          <Shield size={15} aria-hidden="true" />
          <span>ACCESS-CONTROLLED WORKSPACE</span>
        </div>
      </header>

      <main className="cx-access-main">
        <div className="cx-access-card">
          <div className="cx-access-heading">
            <div className="cx-access-status"><KeyRound size={24} aria-hidden="true" /></div>
            <h1>Identity &amp; Access Verification</h1>
            <p>Google sign-in for {BRAND.name} workspace access. Workspace permissions are applied after authentication.</p>
          </div>

          {error && (
            <div className="cx-access-message" data-state="critical">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button type="button" onClick={handleGoogleSignIn} disabled={submitting} className="cx-access-signin">
            {submitting ? <span className="cx-access-spinner" aria-hidden="true" /> : (
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

          <div className="cx-access-policy">
            <div className="cx-access-policy-heading"><span>Security Governance</span><span>Policy Active</span></div>
            <ul>
              <li><CheckCircle2 size={15} aria-hidden="true" /><span>Google identity authentication</span></li>
              <li><CheckCircle2 size={15} aria-hidden="true" /><span>Server-authorised workspace scoping</span></li>
              <li><CheckCircle2 size={15} aria-hidden="true" /><span>Authenticated analytical API access</span></li>
            </ul>
          </div>
          <p className="cx-access-note">Access is granted only after account and workspace authorisation.</p>
        </div>
      </main>

      <footer className="cx-access-footer">
        <div><strong>{BRAND.name}</strong><span>{BRAND.platform}</span></div>
        <p>{BRAND.engine}</p>
        <span>Protected analytical workspace</span>
      </footer>
    </div>
  );
}
