import React from 'react';
import { Info } from 'lucide-react';
import { statusLabel as readableStatus } from '../lib/statusPresentation';

export default function OperationalPageHeader({
  eyebrow,
  title,
  description,
  status = 'NOT_VERIFIED',
  statusLabel = 'Operational analytics',
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status?: string;
  statusLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="cx-command-hero cx-operational-page-header">
      <div>
        <span className="cx-command-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="cx-operational-page-actions">
        {actions}
        <div className="cx-trust-pill" role="note" aria-label={`${statusLabel}: ${readableStatus(status)}`}>
          <Info size={15} aria-hidden="true" />
          <span>
            <strong>{readableStatus(status)}</strong>
            <small>{statusLabel}</small>
          </span>
        </div>
      </div>
    </header>
  );
}
