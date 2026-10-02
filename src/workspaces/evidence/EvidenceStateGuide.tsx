import React from 'react';
import type { DataIntegrityData } from '../../lib/offernetClient';
import { AuditDimensions } from '../../shared/evidence/EvidenceTrace';
import type { AuditDimension } from '../../shared/evidence/auditVisualModel';

/** Each state answers its own question. A returned operational response is never certification. */
export function operationalEvidenceDimensions(data?: DataIntegrityData | null): AuditDimension[] {
  const observed = data?.sources?.some(source => source.rowCount != null) || data?.checks?.some(check => check.discrepancyCount != null);
  return [
    { key: 'source', label: 'Source observed', state: observed ? 'observed' : 'unavailable', detail: observed ? 'At least one source row count or check measurement was returned. Completeness remains separate.' : 'No source or check measurement is available in this view.' },
    { key: 'mapping', label: 'Mapping declared', state: 'mapped', detail: 'Versioned registry definitions describe logical source roles, fields and qualification.' },
    { key: 'reproduction', label: 'Metric reproduced', state: 'not_verified', detail: 'Open Releases to execute and replay an approved immutable result. This view supplies no replay result.' },
    { key: 'reconciliation', label: 'Independent reconciliation', state: 'not_verified', detail: 'Operational checks and same-query arithmetic do not establish an independent exact-scope comparison.' },
    { key: 'business', label: 'Business interpretation approved', state: 'not_verified', detail: 'No source-owner business approval is supplied by the operational integrity response.' },
  ];
}

export default function EvidenceStateGuide({ data }: { data?: DataIntegrityData | null }) {
  return <section className="cx-evidence-state-guide" aria-label="Reconciliation state model">
    <header><h2>What the evidence establishes</h2><p>Observation, mapping, replay, independent reconciliation and business approval answer separate questions.</p></header>
    <AuditDimensions dimensions={operationalEvidenceDimensions(data)} label="Independent evidence states" />
  </section>;
}
