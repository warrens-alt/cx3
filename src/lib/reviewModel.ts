import type { OverviewData } from './offernetClient';
import { ANALYTICS_METRIC_DEFINITIONS } from '../../contracts/analyticsLineage';

export const REVIEW_QUESTIONS = [
  { id: 'change', title: 'Why did conversion change?', detail: 'Compare volume, stage rates and reporting completeness before assigning a cause.', paths: ['/funnel', '/vendor-quality', '/data-integrity'] },
  { id: 'contact', title: 'Are delivered leads being worked?', detail: 'Separate first-dial speed, recorded attempts and right-party contact.', paths: ['/speed-to-lead', '/contact-strategy', '/cli-performance'] },
  { id: 'quality', title: 'Which sources and grades differ?', detail: 'Compare like-for-like lead populations, routing and follow-up age.', paths: ['/vendor-quality', '/vetting', '/routing'] },
  { id: 'activation', title: 'Where are sales getting stuck?', detail: 'Inspect sales awaiting activation. Contract-stage totals require a validated identity link.', paths: ['/sales-activation', '/exceptions', '/data-integrity'] },
  { id: 'commercial', title: 'What did acquisition cost?', detail: 'Use observed spend and matched outcomes. Planning budget is not actual spend.', paths: ['/commercial', '/campaigns', '/reconciliation'] },
] as const;

export function validReviewWindow(start: string, end: string): boolean {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  return valid(start) && valid(end) && start <= end;
}
export function previousCalendarWindow(start: string, end: string) {
  if (!validReviewWindow(start, end)) return null;
  const day = 86400000;
  const first = Date.parse(`${start}T00:00:00Z`);
  const days = Math.round((Date.parse(`${end}T00:00:00Z`) - first) / day) + 1;
  return { startDate: new Date(first - days * day).toISOString().slice(0, 10), endDate: new Date(first - day).toISOString().slice(0, 10), days };
}
export function completedReviewWeek(now = new Date(), timezone = 'Africa/Johannesburg') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (name: string) => parts.find(value => value.type === name)!.value;
  const today = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  const weekday = (today.getUTCDay() + 6) % 7;
  const end = new Date(today.getTime() - (weekday + 1) * 86400000);
  return { startDate: new Date(end.getTime() - 6 * 86400000).toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}
export interface ReviewMetric { id: string; label: string; value: number | null; delta: number | null; unit: '%' | 'count'; deltaUnit: '%' | 'pp'; calculation: string }
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
export function reviewMetrics(data: OverviewData | null): ReviewMetric[] {
  if (!data) return [];
  const definitions = new Map(ANALYTICS_METRIC_DEFINITIONS.map(item => [item.id, item]));
  const entries: Array<[keyof OverviewData['kpis'], string, keyof NonNullable<OverviewData['comparison']>, '%' | 'count']> = [
    ['fetchedLeads', 'Fetched leads', 'fetchedDelta', 'count'],
    ['deliveryRate', 'Delivered / fetched', 'deliveryRateDelta', '%'],
    ['dialRate', 'Dialled / delivered', 'dialRateDelta', '%'],
    ['contactRate', 'RPC / dialled', 'contactRateDelta', '%'],
    ['leadToSaleRate', 'Sales / fetched', 'saleRateDelta', '%'],
    ['activationRate', 'Activations / sales', 'activationRateDelta', '%'],
  ];
  return entries.map(([id, label, change, unit]) => {
    const definition = definitions.get(id);
    return { id, label, unit, value: finite(data.kpis[id]), delta: data.comparisonWindow ? finite(data.comparison?.[change]) : null,
      deltaUnit: unit === 'count' ? '%' : 'pp',
      calculation: definition ? `${definition.numerator}${definition.denominator ? ` / ${definition.denominator} × 100` : ''}` : 'See source metric definition' };
  });
}
export function reviewMetricText(value: number | null, unit: '%' | 'count'): string {
  if (value === null) return 'Unavailable';
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: unit === '%' ? 2 : 0 })}${unit === '%' ? '%' : ''}`;
}
