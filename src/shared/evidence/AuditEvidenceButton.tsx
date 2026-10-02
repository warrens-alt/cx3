import React, { useState } from 'react';
import { GitBranch } from 'lucide-react';
import InspectorHost, { type InspectorContent } from './InspectorHost';
import { AuditMetadata } from './AuditMode';
export default function AuditEvidenceButton({ content, compact = true }: { content: InspectorContent; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={`cx-audit-evidence-control ${compact ? 'is-compact' : ''}`} onClick={() => setOpen(true)} title={`Audit evidence: ${content.title}`} aria-label={`Audit evidence: ${content.title}`}><GitBranch size={14} aria-hidden="true" /><span>Audit evidence</span></button><AuditMetadata metricId={content.metricId} grain={content.definition?.grain || content.provenance?.countingGrain} dateBasis={content.definition?.dateBasis || content.provenance?.dateBasis} validationStatus={content.provenance?.validationStatus}/>{open && <InspectorHost open={open} onClose={() => setOpen(false)} content={content}/>}</>;
}
