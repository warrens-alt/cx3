import { ledgerCalls } from '../../lib/leadLedgerValues';
import { buildLedgerTimeline, type LedgerTimelineKind } from '../leadLedger/timeline';

export type LeadStageState = 'observed' | 'untimed' | 'not-recorded' | 'missing' | 'anomaly';
export interface LeadStageEvidence {
  key: LedgerTimelineKind; label: string; shortLabel: string; state: LeadStageState;
  status: string; timestamp: string | null; detail: string; qualification?: string;
}
const positions = [
  { key: 'capture', label: 'Capture', shortLabel: 'Cap' },
  { key: 'delivery', label: 'Delivery', shortLabel: 'Del', qualification: 'qualified_delivery' },
  { key: 'call', label: 'First dial', shortLabel: 'Dial', qualification: 'dialled' },
  { key: 'rpc', label: 'Contact · RPC', shortLabel: 'RPC' },
  { key: 'sale', label: 'Sale', shortLabel: 'Sale' },
  { key: 'activation', label: 'Activation', shortLabel: 'Act', qualification: 'qualified_activation' },
] as const;
const suppliedAnomalies = [
  ['delivery_before_capture', 'delivery', 'Delivery before capture'],
  ['first_dial_before_capture', 'call', 'First dial before capture'],
  ['first_dial_before_delivery', 'call', 'First dial before delivery'],
  ['sale_before_capture', 'sale', 'Sale before capture'],
  ['activation_before_sale', 'activation', 'Activation before sale'],
] as const;

/** Presentation of one returned analytical row. Qualification stays literal;
 * existing timeline parsing owns valid timestamps and ordering observations. */
export function buildLeadEvidenceSummary(row: Readonly<Record<string, unknown>>, now?: number) {
  const journey = buildLedgerTimeline(row, now);
  const stages: LeadStageEvidence[] = positions.map(position => {
    const event = journey.milestones.find(item => item.kind === position.key);
    const outcome = journey.outcomes.find(item => item.kind === position.key);
    const anomalies = [
      ...journey.anomalies.filter(item => item.field.endsWith(`→ ${position.key}`) || (position.key === 'capture' && item.field === 'fetched') || (position.key === 'delivery' && item.field === 'delivered_time') || (position.key === 'call' && item.field === 'first_call_time')).map(item => item.message),
      ...suppliedAnomalies.filter(([field, key]) => key === position.key && row[field] === true).map(([, , label]) => label),
    ];
    const state: LeadStageState = anomalies.length ? 'anomaly' : event?.timestamp ? 'observed' : event ? 'untimed' : outcome?.state === 'not-recorded' ? 'not-recorded' : 'missing';
    const status = state === 'anomaly' ? 'Timing anomaly' : state === 'observed' ? 'Recorded time' : state === 'untimed' ? 'Recorded · untimed' : state === 'not-recorded' ? 'Not recorded' : 'Unavailable';
    const qualification = 'qualification' in position
      ? row[position.qualification] === true ? 'Qualified' : row[position.qualification] === false ? 'Excluded from qualified progression' : 'Qualification not supplied'
      : undefined;
    return { ...position, state, status, timestamp: event?.timestamp || null,
      detail: anomalies.join(' · ') || event?.description || (outcome?.state === 'not-recorded' ? 'The returned outcome flag is explicitly false.' : 'Required milestone evidence is not supplied. Missing evidence is not a measured negative.'),
      qualification };
  });
  return { stages, calls: ledgerCalls(row.total_calls),
    anomalies: [...new Set([...journey.anomalies.map(item => item.message), ...suppliedAnomalies.filter(([field]) => row[field] === true).map(([, , label]) => label)])] };
}
