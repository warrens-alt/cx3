import React from 'react';
import { ArrowRight, FileSearch } from 'lucide-react';
import type { CommercialBridgeStage } from './commercialBridgeModel';
import type { CommercialAuditNode } from '../../features/commercial/commercialAudit';
import { formatAuditValue } from '../../shared/evidence/auditVisualModel';

export default function CommercialOutcomeRail({ stages, onInspect }: { stages: CommercialBridgeStage[]; onInspect?: (node: CommercialAuditNode) => void }) {
  return <ol className="cx-commercial-outcome-rail" aria-label="Commercial matched lifecycle">
    {stages.map((stage, index) => <li key={stage.key} data-stage={stage.key} data-state={stage.state}>
      <div className="cx-commercial-outcome-position"><span>{String(index + 1).padStart(2, '0')}</span>{index < stages.length - 1 && <ArrowRight size={14} aria-hidden="true" />}</div>
      <h4>{stage.label}</h4><strong>{stage.value === null ? 'UNAVAILABLE' : formatAuditValue(stage.value)}</strong>
      <small>{stage.scope}</small>
      {onInspect && <button className="cx-audit-evidence-control" type="button" onClick={() => onInspect(stage.auditNode)} aria-label={`Audit evidence: ${stage.label}`}><FileSearch size={13} aria-hidden="true" />Evidence</button>}
    </li>)}
  </ol>;
}
