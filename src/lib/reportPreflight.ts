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
  if (typeof val === 'number' && !Number.isFinite(val)) return 'Unavailable';
  // Warehouse decimal strings are evidence, not IEEE-754 chart coordinates.
  const text = String(val);
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return text;
  const [whole, fraction] = text.split('.');
  const exact = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`);
  if (unit === 'percent') return `${exact}%`;
  if (unit === 'currency') {
    const symbol = ({ USD: '$', EUR: '€', GBP: '£', ZAR: 'R' } as Record<string, string>)[currency] || `${currency} `;
    return `${symbol}${exact}`;
  }
  return exact;
}
