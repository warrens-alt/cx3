import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, Clock3, MinusCircle, Phone } from 'lucide-react';
import { buildLeadEvidenceSummary } from './leadEvidenceSummaryModel';

const icons = { observed: CheckCircle2, untimed: Clock3, 'not-recorded': MinusCircle, missing: CircleHelp, anomaly: AlertTriangle };

/** A reading guide for returned evidence, never a completed funnel or score. */
export default function LeadEvidenceSummary({ row, compact = false }: { row: Readonly<Record<string, unknown>>; compact?: boolean }) {
  const evidence = useMemo(() => buildLeadEvidenceSummary(row), [row]);
  return <div className="cx-lead-evidence-summary" data-compact={compact}>
    {!compact && <><h3>Recorded lifecycle</h3><p className="cx-dossier-note">Each position has its own evidence state. A downstream outcome does not supply missing upstream events.</p></>}
    <ol className="cx-lead-state-strip" aria-label="Recorded lifecycle evidence">{evidence.stages.map(stage => {
      const Icon = icons[stage.state];
      return <li key={stage.key} data-evidence-stage={stage.key} data-evidence-state={stage.state} aria-label={`${stage.label}: ${stage.status}${stage.qualification ? ` · ${stage.qualification}` : ''}`}>
        <span className="cx-lead-state-label">{compact ? stage.shortLabel : stage.label}</span>
        <span className="cx-lead-state-status"><Icon size={compact ? 13 : 15} aria-hidden="true"/><span className={compact ? 'sr-only' : undefined}>{stage.status}</span></span>
        {!compact && <>{stage.timestamp && <time dateTime={stage.timestamp}>{stage.timestamp}</time>}{stage.qualification && <span className="cx-lead-state-qualification">{stage.qualification}</span>}{stage.state === 'anomaly' && <span className="cx-lead-state-detail">{stage.detail}</span>}</>}
      </li>;
    })}</ol>
    <div className="cx-lead-evidence-chips"><span><Phone size={12} aria-hidden="true"/>Calls: {evidence.calls}</span>{evidence.anomalies.length > 0 && <span data-attention="true"><AlertTriangle size={12} aria-hidden="true"/>Chronology requires review</span>}</div>
    {!compact && <p className="cx-dossier-note">Calls are a recorded aggregate. Attempt-level timestamps, CLI and agent chronology are unavailable in this analytical row. Qualification labels present supplied flags only.</p>}
  </div>;
}
