import React from 'react';
import PageHeader from './PageHeader';
import { PageShell } from './PageShell';

export interface AnalyticsPageLayoutProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  scope?: React.ReactNode;
  status?: React.ReactNode;
  /** Compatibility slot for a header with existing report metadata or actions. */
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

/** Presentation only: changing layout must not change query or editor lifetimes. */
export default function AnalyticsPageLayout({ title, description, actions, scope, status, header, children, className = '', ariaLabel }: AnalyticsPageLayoutProps) {
  return <PageShell className={`cx-command-page cx-analytics-page ${className}`} ariaLabel={ariaLabel}>
    <div className="cx-command-content cx-analytics-page-content">
      {header || <PageHeader title={title} description={description}>{actions}</PageHeader>}
      {scope}
      {status}
      {children}
    </div>
  </PageShell>;
}
