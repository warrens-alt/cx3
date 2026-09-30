import React, { useState } from 'react';
import { Info } from 'lucide-react';
import InspectorHost, { type InspectorContent } from './InspectorHost';
import { AuditMetadata } from './AuditMode';
export default function AuditEvidenceButton({ content, compact = false }: { content: InspectorContent; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={compact ? 'cx-icon-button' : 'cx-button-secondary'} onClick={() => setOpen(true)} aria-label={`Inspect evidence: ${content.title}`}><Info size={14} aria-hidden="true" />{!compact && 'Inspect evidence'}</button><AuditMetadata metricId={content.metricId} grain={content.definition?.grain || content.provenance?.countingGrain} dateBasis={content.definition?.dateBasis || content.provenance?.dateBasis} validationStatus={content.provenance?.validationStatus}/>{open && <InspectorHost open={open} onClose={() => setOpen(false)} content={content}/>}</>;
}
