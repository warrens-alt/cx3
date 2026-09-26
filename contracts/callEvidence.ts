export interface CallEventEvidence {
  eventId: string;
  leadId: string;
  vendor: string;
  rpc: boolean | null;
}

export interface HlcCallSnapshotEvidence {
  recordId: string;
  leadId: string;
  vendor: string;
  totalCallsCounter: string | null;
  rpcFlag: boolean | null;
  sale: boolean;
}

export interface LeadVendorCallEvidence {
  leadId: string;
  vendor: string;
  observedCalls: string;
  observedRpc: boolean | null;
  legacySnapshotRows: string;
  legacyCounterAvailable: boolean;
  legacyRpcFlag: boolean | null;
  contactUnknown: boolean;
}

/**
 * Executable grain contract used by fixtures and model tests.
 * HLC snapshot rows never increment observed calls, and a sale never implies RPC.
 */
export function aggregateCallEvidence(events: CallEventEvidence[], snapshots: HlcCallSnapshotEvidence[]): LeadVendorCallEvidence[] {
  const groups = new Map<string, { leadId: string; vendor: string; events: Map<string, CallEventEvidence>; snapshots: Map<string, HlcCallSnapshotEvidence> }>();
  const group = (leadId: string, vendor: string) => {
    const key = JSON.stringify([leadId, vendor]);
    const current = groups.get(key) ?? { leadId, vendor, events: new Map(), snapshots: new Map() };
    groups.set(key, current);
    return current;
  };
  for (const event of events) group(event.leadId, event.vendor).events.set(event.eventId, event);
  for (const snapshot of snapshots) group(snapshot.leadId, snapshot.vendor).snapshots.set(snapshot.recordId, snapshot);
  return [...groups.values()].map(item => {
    const eventRows = [...item.events.values()], snapshotRows = [...item.snapshots.values()];
    const rpcValues = eventRows.map(event => event.rpc).filter((value): value is boolean => value !== null);
    const legacyRpcValues = snapshotRows.map(row => row.rpcFlag).filter((value): value is boolean => value !== null);
    return {
      leadId: item.leadId,
      vendor: item.vendor,
      observedCalls: String(eventRows.length),
      observedRpc: rpcValues.length ? rpcValues.some(Boolean) : null,
      legacySnapshotRows: String(snapshotRows.length),
      legacyCounterAvailable: snapshotRows.some(row => row.totalCallsCounter !== null),
      legacyRpcFlag: legacyRpcValues.length ? legacyRpcValues.some(Boolean) : null,
      contactUnknown: rpcValues.length === 0,
    };
  }).sort((a, b) => a.leadId.localeCompare(b.leadId) || a.vendor.localeCompare(b.vendor));
}
