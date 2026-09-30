import React from 'react';
import { statusLabel as readableStatus } from '../lib/statusPresentation';
import { ReportActions } from '../shared/reporting/ReportPresentation';

export default function OperationalPageHeader({ title, description, status = 'NOT_VERIFIED', statusLabel = 'Operational analytics', actions }: {
  eyebrow: string; title: string; description: string; status?: string; statusLabel?: string; actions?: React.ReactNode;
}) {
  return <header className="cx-command-hero cx-operational-page-header">
    <div><h1>{title}</h1><p>{description}</p></div>
    <ReportActions aboutContent={<p>{statusLabel}: {readableStatus(status)}</p>}>{actions}</ReportActions>
  </header>;
}
