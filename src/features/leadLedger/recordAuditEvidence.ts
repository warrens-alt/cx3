import type { InspectorContent } from '../../shared/evidence/InspectorHost';
import type { AuditScope } from '../../shared/evidence/auditPresentation';
import type { LedgerTimeline, LedgerTimelineEvent } from './timeline';

/** Keep the loaded record's evidence and supplied qualification flags; do not qualify it again. */
export function recordEventAuditEvidence(row: Readonly<Record<string, unknown>>, event: LedgerTimelineEvent, journey: LedgerTimeline, validationStatus?: string, scope?: AuditScope, onViewSource?: (fields: string[]) => void): InspectorContent {
  const qualificationField = event.kind === 'delivery' ? 'qualified_delivery' : event.kind === 'call' ? 'dialled' : event.kind === 'activation' ? 'qualified_activation' : null;
  const qualification = qualificationField ? row[qualificationField] : undefined;
  const qualificationValue = qualification === true ? 'Qualified' : qualification === false ? 'Excluded from qualified progression' : 'Qualification not supplied';
  const anomalies = journey.anomalies.filter(anomaly => anomaly.field.endsWith(`→ ${event.kind}`) || event.evidenceFields.some(field => field.label === anomaly.field));
  return {
    type: 'custom', title: `${event.title} evidence`, subtitle: 'Selected Lead Journey record · already loaded evidence', showAnatomy: false,
    value: event.timestamp || (event.evidenceFields.length ? 'Recorded · timestamp unavailable' : null), scope,
    definition: { meaning: event.description, grain: 'Selected returned lead record', dateBasis: 'The record remains within the displayed lead population.', calculation: 'Snapshot milestones reuse the maintained Lead Journey timestamp and flag presentation. Untimed outcomes do not establish chronology.', limitations: journey.limitations },
    provenance: { validationStatus, timezone: 'UTC' },
    dimensions: [
      { key: 'record', label: 'Normalised record evidence', state: 'observed', detail: event.evidenceFields.map(field => `${field.label}: ${String(field.value ?? 'Unavailable')}`).join(' · ') },
      { key: 'mapping', label: 'Source field mapping', state: 'mapped', detail: event.sourceFields.join(', ') },
      { key: 'time', label: 'Event timing', state: event.timestamp ? 'observed' : 'unavailable', detail: event.timestamp || 'No exact event timestamp was returned.' },
      { key: 'qualification', label: 'Supplied qualification', state: qualification === true ? 'observed' : qualification === false ? 'partial' : 'unavailable', detail: qualificationField ? `${qualificationField}: ${qualificationValue}` : 'No qualification flag for this stage is returned in this snapshot.' },
      { key: 'chronology', label: 'Chronology anomalies', state: anomalies.length ? 'partial' : 'not_verified', detail: anomalies.length ? anomalies.map(anomaly => anomaly.message).join(' · ') : 'No anomaly for this milestone is shown. This does not establish complete event history or metric qualification.' },
      { key: 'reconciliation', label: 'Independent reconciliation', state: 'not_verified', detail: 'An original source match does not establish independent reconciliation.' },
      { key: 'business', label: 'Business verification', state: 'not_verified', detail: 'Recorded lifecycle evidence does not certify billing, collection or business completion.' },
    ],
    trace: [
      { key: 'source', type: 'source', label: 'Original source field names', value: event.sourceFields.join(', '), state: 'mapped', detail: 'Declared field mapping. Original values remain separate source records.', ...(onViewSource ? { action: { label: 'View original source fields', supported: true as const, authorized: true as const, onClick: () => onViewSource(event.sourceFields) } } : {}) },
      { key: 'normalized', type: 'normalization', label: 'Returned analytical evidence', value: event.evidenceFields.map(field => `${field.label}: ${String(field.value ?? 'Unavailable')}`).join(' · ') || null, state: event.evidenceFields.length ? 'observed' : 'unavailable', detail: event.description },
      { key: 'qualification', type: 'qualification', label: 'Supplied qualification', value: qualificationValue, state: typeof qualification === 'boolean' ? qualification ? 'observed' : 'partial' : 'unavailable', detail: 'Shown only from an already-returned flag. No qualification rule is recalculated in this view.' },
      { key: 'display', type: 'display', label: event.title, value: event.timestamp || 'Recorded · untimed', state: event.timestamp ? 'observed' : 'partial', detail: event.timestamp ? 'Observed timestamp in UTC; chronology anomalies remain visible separately.' : 'The record has stage evidence, but its exact time and order are unavailable.' },
    ],
    detailLimitation: 'This panel reuses the selected loaded record. It does not fetch supporting records, add an identity to a shareable URL or synthesize call attempts.',
  };
}
