import type { DataIntegrityData } from '../../lib/offernetClient';

export type IntegrityCheck = DataIntegrityData['checks'][number];

/** Presentation grouping only. Keep each returned check and its exact measured value. */
export function groupIntegrityChecks(checks: IntegrityCheck[]) {
  const measured: IntegrityCheck[] = [];
  const limitations: IntegrityCheck[] = [];
  for (const check of checks) {
    const unavailable = check.discrepancyCount == null ||
      ['UNKNOWN', 'UNAVAILABLE'].includes(check.status) ||
      ['UNKNOWN', 'UNAVAILABLE', 'NOT_VERIFIED'].includes(check.evidence);
    (unavailable ? limitations : measured).push(check);
  }
  return { measured, limitations };
}
