import React from 'react';
import EvidenceTray from './EvidenceTray';
import InvestigationCaseRail from './InvestigationCaseRail';

/** One mounted evidence subtree follows the workspace at every viewport size. */
export default function InvestigationEvidenceWorkspace({ children, confidence, signals }: {
  children: React.ReactNode;
  confidence?: React.ReactNode;
  signals?: React.ReactNode;
}) {
  return <div className="cx-investigation-evidence-workspace">
    {signals || <InvestigationCaseRail />}
    <div className="cx-investigation-main-analysis">{children}</div>
    <aside className="cx-investigation-evidence-panel" aria-label="Investigation evidence">
      <EvidenceTray rail confidence={confidence} />
    </aside>
  </div>;
}
