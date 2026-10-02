import React from 'react';
import { AUTHORITATIVE_METRICS } from '../../../../contracts/metricRegistry';
import type { LifecycleDiagnostics } from '../../../../contracts/lifecycleAnalytics';
import { STAGE_METRIC_IDS } from '../../../shared/evidence/auditPresentation';
import { AuditDimensions } from '../../../shared/evidence/EvidenceTrace';
import type { AuditDimension } from '../../../shared/evidence/auditVisualModel';
import { formatTableNumber } from '../../../lib/formatters';
import type { JourneyStageItem } from '../model/journeyAdapter';

export default function JourneyAuditLens({ stages, lifecycle, onInspectStage }: { stages: JourneyStageItem[]; lifecycle?: LifecycleDiagnostics; onInspectStage: (stage: JourneyStageItem) => void }) {
  return <section className="cx-journey-audit-lens" aria-label="Lifecycle audit evidence lens">
    <header><h3>Stage evidence</h3><p>Each stage keeps its own returned population and evidence states. Reconciliation and business meaning are independent of source mapping.</p></header>
    <ol>{stages.map(stage => {
      const contract = AUTHORITATIVE_METRICS[STAGE_METRIC_IDS[stage.key]];
      const recorded = stage.key === 'delivered' || stage.key === 'dialled' || stage.key === 'rpc' ? lifecycle?.recordedEvidence?.[stage.key] : undefined;
      const dimensions: AuditDimension[] = [
        { key: 'returned', label: 'Returned population', state: stage.volume === null ? 'unavailable' : 'observed', detail: stage.volume === null ? 'This stage count was not returned.' : `${formatTableNumber(stage.volume)} distinct scoped leads.` },
        { key: 'mapping', label: 'Mapping', state: contract?.mappingStatus === 'APPROVED' ? 'mapped' : 'not_verified', detail: contract?.fields.join(', ') },
        { key: 'scope', label: 'Reporting scope', state: 'scoped', detail: contract?.dateBasis },
        { key: 'reconciliation', label: 'Independent reconciliation', state: 'not_verified', detail: 'No independent reconciliation is supplied for this stage and scope.' },
        { key: 'business', label: 'Business meaning', state: 'not_verified', detail: 'Declared source mapping does not establish approved business meaning.' },
      ];
      return <li key={stage.key} data-stage={stage.key}>
        <div className="cx-journey-audit-stage-heading"><h4>{stage.name}</h4><strong>{formatTableNumber(stage.volume)}</strong></div>
        <AuditDimensions dimensions={dimensions} label={`${stage.name} evidence state`} />
        {recorded !== undefined && <p className="cx-journey-audit-qualified">Recorded evidence: <b>{formatTableNumber(recorded)}</b><br />Qualified population: <b>{formatTableNumber(stage.volume)}</b></p>}
        <button type="button" className="cx-audit-evidence-control" onClick={() => onInspectStage(stage)} aria-label={`Audit evidence: ${stage.name}`}>Audit evidence</button>
      </li>;
    })}</ol>
  </section>;
}
