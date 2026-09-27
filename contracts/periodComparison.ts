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
export interface RateContribution {
  key: string;
  currentNumerator: number;
  previousNumerator: number;
  contributionPp: number;
  isNewSegment?: boolean;
  isVanishedSegment?: boolean;
}

/**
 * Order-neutral outcome decomposition:
 * O = N × r
 * ΔO = O1 - O0 = volume contribution + rate contribution
 * volume contribution = (N1 - N0) × (r0 + r1) / 2
 * rate contribution = (r1 - r0) × (N0 + N1) / 2
 *
 * Example:
 * N0 = 1000, r0 = 0.10 => O0 = 100
 * N1 = 1200, r1 = 0.08 => O1 = 96
 * ΔO = -4
 * volume contribution = (1200 - 1000) * (0.10 + 0.08) / 2 = 200 * 0.09 = +18
 * rate contribution = (0.08 - 0.10) * (1000 + 1200) / 2 = -0.02 * 1100 = -22
 * sum = 18 + (-22) = -4
 */
export interface OutcomeChangeDecomposition {
  n0: number;
  r0: number; // fraction e.g. 0.10
  n1: number;
  r1: number; // fraction e.g. 0.08
  o0: number;
  o1: number;
  outcomeDelta: number;
  volumeContribution: number;
  rateContribution: number;
  sum: number;
  residual: number;
  status: 'RECONCILED' | 'UNAVAILABLE';
  method: string;
}

export function decomposeOutcomeChange(
  n0: number | null | undefined,
  r0: number | null | undefined, // fraction e.g. 0.10
  n1: number | null | undefined,
  r1: number | null | undefined  // fraction e.g. 0.08
): OutcomeChangeDecomposition | null {
  if (
    n0 == null || r0 == null || n1 == null || r1 == null ||
    !Number.isFinite(n0) || !Number.isFinite(r0) || !Number.isFinite(n1) || !Number.isFinite(r1) ||
    n0 < 0 || n1 < 0
  ) {
    return null;
  }
  const o0 = n0 * r0;
  const o1 = n1 * r1;
  const outcomeDelta = o1 - o0;
  const volumeContribution = (n1 - n0) * (r0 + r1) / 2;
  const rateContribution = (r1 - r0) * (n0 + n1) / 2;
  const sum = volumeContribution + rateContribution;
  const residual = outcomeDelta - sum;
  return {
    n0, r0, n1, r1,
    o0, o1,
    outcomeDelta,
    volumeContribution,
    rateContribution,
    sum,
    residual,
    status: Math.abs(residual) < 1e-6 ? 'RECONCILED' : 'UNAVAILABLE',
    method: 'Order-neutral decomposition: volume=(N1-N0)*(r0+r1)/2, rate=(r1-r0)*(N0+N1)/2. Descriptive, not causal.',
  };
}

/**
 * Additive allocation of rate change across mutually exclusive segments.
 * New and vanished segments are explicitly identified; historical rates are not fabricated.
 */
export function decomposeRateChange(current: RateSegment[], previous: RateSegment[]) {
  const valid = (rows: RateSegment[]) => new Set(rows.map(r => r.key)).size === rows.length && rows.every(r => Number.isFinite(r.numerator) && Number.isFinite(r.denominator) && r.numerator >= 0 && r.denominator >= 0 && r.numerator <= r.denominator);
  const currentDenominator = current.reduce((sum, r) => sum + r.denominator, 0);
  const previousDenominator = previous.reduce((sum, r) => sum + r.denominator, 0);
  if (!valid(current) || !valid(previous) || currentDenominator <= 0 || previousDenominator <= 0) return null;
  
  const c = new Map(current.map(r => [r.key, r])), p = new Map(previous.map(r => [r.key, r]));
  const allKeys = [...new Set([...c.keys(), ...p.keys()])];
  const newSegments: string[] = [];
  const vanishedSegments: string[] = [];
  
  const contributions: RateContribution[] = allKeys.map(key => {
    const cur = c.get(key);
    const prev = p.get(key);
    const isNew = !prev;
    const isVanished = !cur;
    if (isNew) newSegments.push(key);
    if (isVanished) vanishedSegments.push(key);
    
    const curNum = cur?.numerator ?? 0;
    const prevNum = prev?.numerator ?? 0;
    const contributionPp = 100 * (curNum / currentDenominator - prevNum / previousDenominator);
    return {
      key,
      currentNumerator: curNum,
      previousNumerator: prevNum,
      contributionPp,
      isNewSegment: isNew || undefined,
      isVanishedSegment: isVanished || undefined,
    };
  });
  
  const currentOverallRate = current.reduce((s, r) => s + r.numerator, 0) / currentDenominator;
  const previousOverallRate = previous.reduce((s, r) => s + r.numerator, 0) / previousDenominator;
  const deltaPp = 100 * (currentOverallRate - previousOverallRate);
  const totalReconciledPp = contributions.reduce((s, r) => s + r.contributionPp, 0);
  const residualPp = deltaPp - totalReconciledPp;
  const hasIncompleteSegments = newSegments.length > 0 || vanishedSegments.length > 0;
  
  return {
    deltaPp,
    residualPp,
    contributions: contributions.sort((a, b) => a.contributionPp - b.contributionPp),
    newSegments,
    vanishedSegments,
    hasIncompleteSegments,
    status: Math.abs(residualPp) <= 1e-9 ? ('RECONCILED' as const) : ('UNAVAILABLE' as const),
    method: 'Difference in each exclusive segment’s outcome contribution to the overall rate. New or vanished segments are explicitly partitioned without inventing zero prior rates. Descriptive, not causal.',
  };
}
