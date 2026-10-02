import type { LedgerLead, LedgerReplicaReport } from '../../../contracts/leadLedgerReplica';
import type { RawLeadsData } from '../../lib/offernetClient';
import type { AuditDimension, EvidenceTraceNode } from '../../shared/evidence/auditVisualModel';
import { buildLedgerTimeline } from '../leadLedger/timeline';
import type { InvestigationLead } from './InvestigationRecordList';

export interface DossierAuditEvidence {
  dimensions: AuditDimension[];
  trace: EvidenceTraceNode[];
  qualifications: Array<{ label: string; field: string; value: string }>;
  chronology: string[];
}

const qualificationFields = [
  ['Delivery', 'qualified_delivery'],
  ['First dial', 'dialled'],
  ['Sale → activation', 'qualified_activation'],
] as const;
const chronologyFields = [
  ['delivery_before_capture', 'Delivery before capture'],
  ['first_dial_before_capture', 'First dial before capture'],
  ['first_dial_before_delivery', 'First dial before delivery'],
  ['sale_before_capture', 'Sale before capture'],
  ['activation_before_sale', 'Activation before sale'],
] as const;

/** Present the two loaded evidence grains without deriving a normalized row or
 * treating an identity match as reconciliation. No requests or qualification rules. */
export function buildDossierAuditEvidence(row?: InvestigationLead, result?: RawLeadsData, sourceLead?: LedgerLead, sourceReport?: LedgerReplicaReport): DossierAuditEvidence {
  const analytical = row && result ? row : undefined;
  const journey = analytical ? buildLedgerTimeline(analytical) : null;
  const qualifications = qualificationFields.map(([label, field]) => ({
    label, field,
    value: analytical?.[field] === true ? 'Qualified' : analytical?.[field] === false ? 'Excluded from qualified progression' : 'Qualification not supplied',
  }));
  const chronology = analytical ? [
    ...chronologyFields.filter(([field]) => analytical[field] === true).map(([, label]) => label),
    ...(journey?.anomalies.map(anomaly => `${anomaly.field}: ${anomaly.message}`) || []),
  ] : [];
  const qualificationSupplied = qualificationFields.some(([, field]) => typeof analytical?.[field] === 'boolean');
  const qualificationExcluded = qualificationFields.some(([, field]) => analytical?.[field] === false);
  const qualificationPartial = qualificationExcluded || qualificationFields.some(([, field]) => typeof analytical?.[field] !== 'boolean');
  const source = sourceReport?.metadata.coverage?.source || result?.metadata?.source;
  const sourceAvailable = Boolean(sourceLead?.records.length);
  const originalRecordDetail = sourceAvailable
    ? `${sourceLead!.records.length} original source records are displayed separately. This is a source-row count, not an additional analytical lead count.`
    : 'Original source records have not been supplied for this selection.';
  const sourceIssues = sourceLead?.issues || [];
  const qualificationDetail = analytical
    ? qualifications.map(item => `${item.field}: ${item.value}`).join(' · ')
    : 'No exact normalized row is loaded. Raw source outcomes do not supply analytical qualification flags.';
  return {
    qualifications,
    chronology,
    dimensions: [
      { key: 'analytical', label: 'Normalized lead evidence', state: analytical ? 'observed' : 'unavailable', detail: analytical ? 'One loaded analytical lead row. Its representative fields and supplied flags stay in the analytical grain.' : 'An exact normalized lead row has not been loaded for this source identity.' },
      { key: 'source', label: 'Original source records', state: sourceAvailable ? 'observed' : 'unavailable', detail: originalRecordDetail },
      { key: 'qualification', label: 'Supplied analytical qualification', state: qualificationSupplied ? qualificationPartial ? 'partial' : 'observed' : 'unavailable', detail: qualificationDetail },
      { key: 'chronology', label: 'Chronology observations', state: chronology.length || sourceIssues.length ? 'partial' : 'not_verified', detail: [...chronology, ...sourceIssues].join(' · ') || 'No ordering anomaly is displayed. Complete event history and qualification are not established by that absence.' },
      { key: 'reconciliation', label: 'Independent reconciliation', state: 'not_verified', detail: 'An exact lead identity match does not establish that normalized milestones reconcile to every original source record.' },
      { key: 'business', label: 'Business verification', state: 'not_verified', detail: 'Recorded outcomes and raw reported amounts do not certify billing, collection or business completion.' },
    ],
    trace: [
      { key: 'source', type: 'source', label: 'Returned source evidence', value: source || null, state: sourceAvailable ? 'observed' : source ? 'mapped' : 'unavailable', detail: originalRecordDetail },
      { key: 'normalized', type: 'normalization', label: 'Loaded analytical row', value: analytical ? String(analytical.lead_id) : null, state: analytical ? 'observed' : 'unavailable', detail: 'Original source rows are not converted into a universal analytical row in this dossier.' },
      { key: 'qualification', type: 'qualification', label: 'Returned qualification flags', value: analytical ? qualificationDetail : null, state: qualificationSupplied ? qualificationPartial ? 'partial' : 'observed' : 'unavailable', detail: 'Only returned flags are presented. The dossier does not recalculate inclusion or qualification.' },
      { key: 'display', type: 'display', label: 'Lead Evidence dossier', value: analytical ? '1 normalized lead row' : null, state: analytical || sourceAvailable ? 'observed' : 'unavailable', detail: originalRecordDetail },
      { key: 'reconciliation', type: 'reconciliation', label: 'Independent source reconciliation', value: null, state: 'not_verified', detail: 'No independent reconciliation result is returned for this selection.' },
    ],
  };
}
