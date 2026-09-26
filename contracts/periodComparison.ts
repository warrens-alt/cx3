/** Calendar-day windows are inclusive. Dates represent the tenant's local calendar. */
export interface MatchedPeriodWindow {
  current: { startDate: string; endDate: string };
  previous: { startDate: string; endDate: string };
  days: number;
  kind: 'matched_previous_period';
}
const DAY = 86_400_000;
function calendarDate(value?: string): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}
export function matchedPeriodWindow(startDate?: string, endDate?: string): MatchedPeriodWindow | null {
  const start = calendarDate(startDate), end = calendarDate(endDate);
  if (start === null || end === null || end < start) return null;
  const days = (end - start) / DAY + 1;
  if (days > 366) return null;
  return {
    current: { startDate: startDate!, endDate: endDate! },
    previous: { startDate: new Date(start - days * DAY).toISOString().slice(0, 10), endDate: new Date(start - DAY).toISOString().slice(0, 10) },
    days, kind: 'matched_previous_period',
  };
}
export type ComparisonKind = 'count' | 'currency' | 'rate';
export interface MetricComparison {
  current: number | null; previous: number | null; kind: ComparisonKind;
  absoluteChange: number | null; percentageChange: number | null; percentagePointChange: number | null;
}
export function compareMetric(current: number | null, previous: number | null, kind: ComparisonKind): MetricComparison {
  const valid = current !== null && previous !== null && Number.isFinite(current) && Number.isFinite(previous);
  const delta = valid ? current! - previous! : null;
  return { current, previous, kind, absoluteChange: delta,
    percentageChange: kind !== 'rate' && delta !== null && previous !== 0 ? 100 * delta / Math.abs(previous!) : null,
    percentagePointChange: kind === 'rate' ? delta : null };
}
export interface RateSegment { key: string; numerator: number; denominator: number }
export interface RateContribution { key: string; currentNumerator: number; previousNumerator: number; contributionPp: number }
/** An exact additive allocation, NOT causal inference: sum(segment numerator / total denominator differences). */
export function decomposeRateChange(current: RateSegment[], previous: RateSegment[]) {
  const valid = (rows: RateSegment[]) => new Set(rows.map(r => r.key)).size === rows.length && rows.every(r => Number.isFinite(r.numerator) && Number.isFinite(r.denominator) && r.numerator >= 0 && r.denominator >= 0 && r.numerator <= r.denominator);
  const currentDenominator = current.reduce((sum, r) => sum + r.denominator, 0);
  const previousDenominator = previous.reduce((sum, r) => sum + r.denominator, 0);
  if (!valid(current) || !valid(previous) || currentDenominator <= 0 || previousDenominator <= 0) return null;
  const c = new Map(current.map(r => [r.key, r])), p = new Map(previous.map(r => [r.key, r]));
  const contributions: RateContribution[] = [...new Set([...c.keys(), ...p.keys()])].map(key => {
    const currentNumerator = c.get(key)?.numerator ?? 0, previousNumerator = p.get(key)?.numerator ?? 0;
    return { key, currentNumerator, previousNumerator, contributionPp: 100 * (currentNumerator / currentDenominator - previousNumerator / previousDenominator) };
  });
  const deltaPp = 100 * (current.reduce((s, r) => s + r.numerator, 0) / currentDenominator - previous.reduce((s, r) => s + r.numerator, 0) / previousDenominator);
  const residualPp = deltaPp - contributions.reduce((s, r) => s + r.contributionPp, 0);
  if (Math.abs(residualPp) > 1e-9) return null;
  return { deltaPp, residualPp, contributions: contributions.sort((a, b) => a.contributionPp - b.contributionPp), status: 'RECONCILED' as const,
    method: 'Difference in each exclusive segment’s outcome contribution to the overall rate; includes population mix and outcome changes. Descriptive, not causal.' };
}
