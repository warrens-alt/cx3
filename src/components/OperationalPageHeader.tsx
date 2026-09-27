import React from 'react';
import { Info } from 'lucide-react';
import { statusLabel as readableStatus } from '../lib/statusPresentation';
import AnalyticsDefinitions from './AnalyticsDefinitions';
import AnalysisGuide from './AnalysisGuide';
import ReviewLauncher from './ReviewLauncher';
import SectionNavigation from './SectionNavigation';

export default function OperationalPageHeader({ title, description, status = 'NOT_VERIFIED', statusLabel = 'Operational analytics', actions }: {
  eyebrow: string; title: string; description: string; status?: string; statusLabel?: string; actions?: React.ReactNode;
}) {
  return <>
    <SectionNavigation />
    <header className="cx-command-hero cx-operational-page-header">
      <div><h1>{title}</h1><p>{description}</p></div>
      <div className="cx-operational-page-actions">
        {actions}<ReviewLauncher/><AnalyticsDefinitions/>
        <div className="cx-trust-pill" role="note" aria-label={`${statusLabel}: ${readableStatus(status)}`}><Info size={15} aria-hidden="true"/><span><strong>{readableStatus(status)}</strong><small>{statusLabel}</small></span></div>
      </div>
    </header>
    <AnalysisGuide/>
  </>;
}
