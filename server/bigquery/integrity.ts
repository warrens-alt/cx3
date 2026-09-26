export const MODEL_VERSION = '2026-09-20.1';
export type CheckStatus = 'PASS' | 'WARNING' | 'FAIL' | 'NOT_VERIFIED';
export function comparison(raw: number | null, semantic: number | null): { status: CheckStatus; difference: number | null; discrepancy: string } {
  if (raw === null || semantic === null || !Number.isFinite(raw) || !Number.isFinite(semantic)) return { status: 'NOT_VERIFIED', difference: null, discrepancy: 'One or more independent measurements are unavailable.' };
  const difference = semantic - raw;
  return difference === 0 ? { status: 'PASS', difference, discrepancy: 'Independent measurements match for this metric and scope.' } : { status: 'FAIL', difference, discrepancy: `Measured difference: ${difference}. Reconciliation required.` };
}
export function overallStatus(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes('FAIL')) return 'FAIL';
  if (statuses.includes('WARNING')) return 'WARNING';
  if (!statuses.length || statuses.includes('NOT_VERIFIED')) return 'NOT_VERIFIED';
  return 'PASS';
}
export function validTimestampSql(expression: string): string {
  return `CASE WHEN REGEXP_CONTAINS(TRIM(CAST(${expression} AS STRING)), r'^(1900|1970)(-|$)') THEN NULL ELSE SAFE_CAST(NULLIF(TRIM(CAST(${expression} AS STRING)), '') AS TIMESTAMP) END`;
}
/** Prevent spreadsheet formula execution in exported string cells; numbers retain their type. */
export function safeCsvCell(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return /^[\s\uFEFF]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
}
export function finiteOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value); return Number.isFinite(n) ? n : null;
}
export function maturityValue(value: unknown, cohortEnd: string, cutoff: string, day: number): number | null {
  const age = Math.floor((Date.parse(cutoff) - Date.parse(cohortEnd)) / 86400000);
  return !Number.isFinite(age) || age < day ? null : finiteOrNull(value);
}
