import type { MetricResult } from '../../contracts/reporting';

export function formatReportValue(
  metricOrValue: MetricResult | string | number | null | undefined,
  currency: string = 'ZAR'
): string {
  if (metricOrValue === null || metricOrValue === undefined) return 'Unavailable';

  let val: string | number | null | undefined;
  let unit: string | undefined;

  if (typeof metricOrValue === 'object' && 'calculationStatus' in metricOrValue) {
    if (metricOrValue.calculationStatus !== 'CHECKED') {
      return 'Unavailable';
    }
    val = metricOrValue.value;
    unit = metricOrValue.unit;
  } else {
    val = metricOrValue;
  }

  if (val === null || val === undefined || val === '') return 'Unavailable';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (Number.isNaN(num)) return String(val);

  if (unit === 'percent') {
    return `${num.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
  }
  if (unit === 'currency') {
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : 'R';
    return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (unit === 'seconds') {
    if (num < 60) return `${Math.round(num)}s`;
    const mins = Math.floor(num / 60);
    const secs = Math.round(num % 60);
    return `${mins}m ${secs}s`;
  }
  return num.toLocaleString();
}
