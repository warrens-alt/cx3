import React from 'react';
import PageHeader from './PageHeader';
import { statusLabel as readableStatus } from '../lib/statusPresentation';
import { ReportActions } from '../shared/reporting/ReportPresentation';

export default function OperationalPageHeader({ title, description, status = 'NOT_VERIFIED', statusLabel = 'Operational analytics', actions }: {
  eyebrow: string; title: string; description: string; status?: string; statusLabel?: string; actions?: React.ReactNode;
}) {
  return <PageHeader title={title} description={description}>
    <ReportActions aboutContent={<p>{statusLabel}: {readableStatus(status)}</p>}>{actions}</ReportActions>
  </PageHeader>;
}
