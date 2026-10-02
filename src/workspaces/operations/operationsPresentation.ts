import type { OperatingControlsData } from '../../lib/offernet/types';

/** Keep the returned exclusive buckets, including explicit zero and unrecorded. */
export function operationAttemptItems(rows: OperatingControlsData['attemptBuckets']) {
  return rows.map(row => ({ key: row.bucket, label: row.bucket, value: row.leads,
    appearance: row.bucket === 'Unrecorded' ? 'unrecorded' as const : undefined,
    detail: row.bucket === 'Unrecorded' ? 'Call counter unavailable' : 'Recorded cumulative call-count population',
    color: row.bucket === 'Unrecorded' ? 'var(--cx-text-muted)' : 'var(--cx-data-dialled)' }));
}
export function attemptInvestigationPath(bucket: string): string | null {
  if (!['0 calls', '1 call', '2 calls', '3 calls', '4 calls', '5+ calls', 'Unrecorded'].includes(bucket)) return null;
  return bucket === '0 calls' ? '/investigate?drill=zero-call-leads' : `/investigate?drill=call-effort&drillValue=${encodeURIComponent(bucket)}`;
}
