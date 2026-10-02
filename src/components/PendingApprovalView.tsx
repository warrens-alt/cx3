import React from 'react';
import { Clock, LogOut, Mail } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { BRAND } from '../../contracts/naming';
import ConversionXBrand from './ConversionXBrand';

export default function PendingApprovalView() {
  const { user, profile, signOut } = useAuth();

  return (
    <div className="cx-access-page">
      {/* Top Header - Consistent 54px height, hairline border, identical brand lockup */}
      <header className="cx-access-header">
        <div className="cx-access-brand">
          <ConversionXBrand variant="wordmark" tone="light" />
          <small className="cx-access-context">Access Governance Gateway</small>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="cx-access-header-action"
        >
          <LogOut className="cx-access-icon" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="cx-access-main">
        <div className="cx-access-card cx-access-centered">

          <div className="cx-access-status cx-access-warning">
            <Clock className="cx-access-status-icon" />
          </div>

          <div className="cx-access-heading">
            <div className="cx-access-state cx-access-warning">
              Access Request Pending
            </div>
            <h1 className="cx-access-title">
              Account Awaiting Administrator Approval
            </h1>
            <p className="cx-access-description">
              Your Google identity has been successfully authenticated, but access to {BRAND.name} is restricted until an administrator assigns your role and client workspace permissions.
            </p>
          </div>

          {/* User details card */}
          <div className="cx-access-identity">
            <div className="cx-access-person">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={`${user?.displayName || user?.email || 'User'} profile avatar`}
                  referrerPolicy="no-referrer"
                  className="cx-access-avatar"
                />
              ) : (
                <div className="cx-access-avatar cx-access-initials">
                  {user?.displayName
                    ? user.displayName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                    : user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="cx-access-person-copy">
                <div className="cx-access-person-name">{user?.displayName || 'Authenticated User'}</div>
                <div className="cx-access-email">
                  <Mail className="cx-access-icon" />
                  {user?.email}
                </div>
              </div>
            </div>

            <div className="cx-access-role">
              <span className="cx-access-label">Pending Role:</span>
              <span className="cx-access-role-value">{profile?.role || 'Pending Assignment'}</span>
            </div>
          </div>

          <div className="cx-access-message">
            Your access status is monitored while this page is open. Once an administrator activates your account, the workspace will become available automatically.
          </div>

          <p className="cx-access-note">No manual refresh is required.</p>

        </div>
      </main>

      {/* Unified Enterprise Footer */}
      <footer className="cx-access-footer">
        <div className="cx-access-footer-copy">
          <strong className="cx-access-footer-brand">{BRAND.name}</strong>
          <span aria-hidden="true" className="cx-access-separator">·</span>
          <span>Security & Access Governance</span>
        </div>
        <div>
          <span>Protected analytical workspace</span>
        </div>
      </footer>
    </div>
  );
}
