// Trust-Safe Analytical Calculation Helpers
// Strictly fail-closed: missing evidence or zero denominators must NEVER become false measured zeros.

export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return null;
  return num;
}

export function countOrZero(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num);
}

export function ratioOrNull(
  numerator: unknown,
  denominator: unknown,
  decimals: number = 4
): number | null {
  const num = numberOrNull(numerator);
  const den = numberOrNull(denominator);
  if (num === null || den === null || den <= 0) return null;
  if (num === 0) return 0;
  const res = num / den;
  return Number(res.toFixed(decimals));
}

export function percentOrNull(
  numerator: unknown,
  denominator: unknown,
  decimals: number = 1
): number | null {
  const num = numberOrNull(numerator);
  const den = numberOrNull(denominator);
  // Denominator <= 0 means no measurable population -> return null (not 0%)
  if (num === null || den === null || den <= 0) return null;
  // Genuine zero numerator with positive denominator -> return 0 (measured zero)
  if (num === 0) return 0;
  const res = (num / den) * 100;
  return Number(res.toFixed(decimals));
}

export function durationSecondsOrNull(value: unknown): number | null {
  const num = numberOrNull(value);
  if (num === null || num < 0) return null;
  return Math.round(num);
}

export function formatDurationOrNull(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) return null;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

export function formatDurationSafe(seconds: number | null | undefined): string {
  const formatted = formatDurationOrNull(seconds);
  return formatted ?? '—';
}
