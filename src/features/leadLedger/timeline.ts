import { ledgerTimestamp } from '../../../contracts/leadLedgerReplica';
import { ledgerCalls, ledgerOutcome } from '../../lib/leadLedgerValues';

export type LedgerTimelineKind = 'capture' | 'delivery' | 'call' | 'rpc' | 'sale' | 'activation';
export type LedgerTimelineValue = string | number | boolean | null;
export interface LedgerTimelineEvidence { label: string; value: LedgerTimelineValue }
export interface LedgerTimelineEvent {
  id: LedgerTimelineKind;
  kind: LedgerTimelineKind;
  title: string;
  timestamp: string | null;
  timestampStatus: 'observed' | 'unavailable';
  description: string;
  evidenceFields: LedgerTimelineEvidence[];
  sourceFields: string[];
  // The returned vendor belongs to a representative transaction, whereas the
  // milestones below are lead aggregates. It cannot establish stage ownership.
  owner: null;
  vendor: null;
  agent: null;
}
export interface LedgerTimelineTransition {
  fromId: LedgerTimelineKind;
  toId: LedgerTimelineKind;
  label: string;
  milliseconds: number | null;
  state: 'observed' | 'unavailable' | 'anomaly';
}
export interface LedgerTimelineAnomaly {
  field: string;
  value: LedgerTimelineValue;
  message: string;
}
export interface LedgerTimeline {
  /** Lifecycle display positions, not a claim about the timing of untimed events. */
  milestones: LedgerTimelineEvent[];
  /** Only observed valid timestamps participate in chronological ordering. */
  timedEvents: LedgerTimelineEvent[];
  untimedEvents: LedgerTimelineEvent[];
  transitions: LedgerTimelineTransition[];
  calls: {
    count: string | number | null;
    evidenceFields: LedgerTimelineEvidence[];
    limitation: string;
  };
  outcomes: Array<{ kind: 'rpc' | 'sale' | 'activation'; title: string; state: 'recorded' | 'not-recorded' | 'unavailable' }>;
  /** Furthest supported lifecycle stage; this is not the latest event by time. */
  currentStage: LedgerTimelineEvent | null;
  /** Observed capture-to-last-timed-stage span, never the total journey duration. */
  duration: { milliseconds: number; label: string; caption: 'Recorded timestamp span' } | null;
  anomalies: LedgerTimelineAnomaly[];
  limitations: string[];
}

type StageDefinition = {
  kind: LedgerTimelineKind;
  title: string;
  timeField?: string;
  flagField?: string;
  evidenceFields: string[];
  sourceFields: string[];
  description: string;
};

// This allowlist mirrors fields already returned by the operational Ledger.
// Qualification, sale/RPC/activation times and individual call attempts are not
// returned by that endpoint. Do not substitute fields from other API contracts.
const stages: readonly StageDefinition[] = [
  { kind: 'capture', title: 'Captured', timeField: 'fetched', evidenceFields: ['fetched', 'source', 'medium'], sourceFields: ['Fetched', 'Offershop Source', 'OFFERNET MEDIUM'], description: 'Earliest recorded intake timestamp in the returned lead population.' },
  { kind: 'delivery', title: 'Delivered', timeField: 'delivered_time', evidenceFields: ['delivered_time'], sourceFields: ['HLC Delivered'], description: 'Earliest recorded delivery timestamp in the returned lead population. The returned vendor does not identify the owner of this aggregate milestone.' },
  { kind: 'call', title: 'First dial', timeField: 'first_call_time', flagField: 'dialled', evidenceFields: ['first_call_time', 'dialled'], sourceFields: ['HLC First Call Date'], description: 'First dial evidence in the returned lead population. Individual call attempts and their owners are unavailable in this snapshot.' },
  { kind: 'rpc', title: 'Right-party contact', flagField: 'contacted', evidenceFields: ['contacted'], sourceFields: ['HLC RPC'], description: 'The returned lead-level RPC flag records contact. The exact time and attempt number are unavailable.' },
  { kind: 'sale', title: 'Sale', flagField: 'sale', evidenceFields: ['sale'], sourceFields: ['HLC Sale'], description: 'The returned lead-level sale flag records a sale. The exact event time is unavailable in this snapshot.' },
  { kind: 'activation', title: 'Activation', flagField: 'activated', evidenceFields: ['activated'], sourceFields: ['HLC Activated'], description: 'The returned lead-level activation flag records activation. The exact event time is unavailable in this snapshot.' },
];

function evidenceValue(value: unknown): LedgerTimelineValue {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return '[Unsupported returned value]';
}

function evidence(row: Readonly<Record<string, unknown>>, fields: readonly string[]): LedgerTimelineEvidence[] {
  return fields.filter(field => row[field] != null && !(typeof row[field] === 'string' && String(row[field]).trim() === ''))
    .map(field => ({ label: field, value: evidenceValue(row[field]) }));
}

/** Compact elapsed time without rounding a shorter interval into a later unit. */
export function formatLedgerDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return 'Time unavailable';
  if (milliseconds === 0) return '0s';
  if (milliseconds < 1000) return '<1s';
  const seconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  if (days) return `${days}d${hours ? ` ${hours}h` : minutes ? ` ${minutes}m` : ''}`;
  if (hours) return `${hours}h${minutes ? ` ${minutes}m` : ''}`;
  if (minutes) return `${minutes}m${seconds % 60 ? ` ${seconds % 60}s` : ''}`;
  return `${seconds}s`;
}

/**
 * Pure presentation of the already-loaded operational raw-leads row.
 * No requests, fallback source selection, metric recalculation or extra API
 * fields. generatedAt, cutoff, status, freshness and raw disposition cannot
 * establish a lifecycle event's time or owner.
 */
export function buildLedgerTimeline(row: Readonly<Record<string, unknown>>, now = Date.now()): LedgerTimeline {
  const milestones: LedgerTimelineEvent[] = [];
  const anomalies: LedgerTimelineAnomaly[] = [];
  for (const stage of stages) {
    const parsed = stage.timeField
      ? ledgerTimestamp(evidenceValue(row[stage.timeField]), now)
      : { timestamp: null, state: 'missing' as const };
    if (stage.timeField && (parsed.state === 'invalid' || parsed.state === 'future')) {
      anomalies.push({ field: stage.timeField, value: evidenceValue(row[stage.timeField]), message: `${stage.title}: ${parsed.state === 'future' ? 'future' : 'invalid'} timestamp excluded from chronology.` });
    }
    const hasFlag = Boolean(stage.flagField && ledgerOutcome(row[stage.flagField]) === 'TRUE');
    if (!parsed.timestamp && !hasFlag) continue;
    milestones.push({
      id: stage.kind, kind: stage.kind, title: stage.title,
      timestamp: parsed.timestamp, timestampStatus: parsed.timestamp ? 'observed' : 'unavailable',
      description: stage.description, evidenceFields: evidence(row, stage.evidenceFields), sourceFields: [...stage.sourceFields],
      owner: null, vendor: null, agent: null,
    });
  }

  const transitions: LedgerTimelineTransition[] = milestones.slice(1).map((event, index) => {
    const previous = milestones[index];
    if (!previous.timestamp || !event.timestamp) return { fromId: previous.id, toId: event.id, milliseconds: null, label: 'Time unavailable', state: 'unavailable' };
    const milliseconds = Date.parse(event.timestamp) - Date.parse(previous.timestamp);
    if (milliseconds < 0) {
      anomalies.push({ field: `${previous.id} → ${event.id}`, value: milliseconds, message: `${event.title} precedes ${previous.title.toLowerCase()} in the returned timestamps. This interval is excluded from elapsed durations.` });
      return { fromId: previous.id, toId: event.id, milliseconds: null, label: 'Timing anomaly', state: 'anomaly' };
    }
    return { fromId: previous.id, toId: event.id, milliseconds, label: formatLedgerDuration(milliseconds), state: 'observed' };
  });
  const timedEvents = milestones.filter(event => event.timestamp !== null)
    .sort((left, right) => Date.parse(left.timestamp!) - Date.parse(right.timestamp!));
  const untimedEvents = milestones.filter(event => event.timestamp === null);
  const first = milestones.find(event => event.kind === 'capture');
  const lastTimed = timedEvents[timedEvents.length - 1];
  const durationMs = first?.timestamp && lastTimed?.timestamp && timedEvents.length > 1 && anomalies.length === 0
    ? Date.parse(lastTimed.timestamp) - Date.parse(first.timestamp) : null;
  const count = ledgerCalls(row.total_calls);
  const outcomes: LedgerTimeline['outcomes'] = stages.filter(stage => stage.kind === 'rpc' || stage.kind === 'sale' || stage.kind === 'activation').map(stage => {
    const flag = ledgerOutcome(row[stage.flagField!]);
    return { kind: stage.kind as 'rpc' | 'sale' | 'activation', title: stage.title, state: flag === 'TRUE' ? 'recorded' : flag === 'FALSE' ? 'not-recorded' : 'unavailable' };
  });

  return {
    milestones, timedEvents, untimedEvents, transitions,
    calls: {
      count: count === 'Unavailable' ? null : count,
      evidenceFields: evidence(row, ['total_calls']),
      limitation: 'Aggregate call counter only. Individual timestamps, dispositions per attempt and the RPC attempt number are unavailable.',
    },
    outcomes,
    currentStage: milestones[milestones.length - 1] ?? null,
    duration: durationMs == null ? null : { milliseconds: durationMs, label: formatLedgerDuration(durationMs), caption: 'Recorded timestamp span' },
    anomalies,
    limitations: [
      'Lifecycle positions are a reading guide. Untimed milestones do not establish chronological order.',
      'RPC, sale and activation timestamps, qualification history and stage ownership are unavailable in this operational snapshot.',
      'Vendor, transaction and latest disposition fields describe the representative returned record; they do not identify the owner or outcome of each call.',
    ],
  };
}
