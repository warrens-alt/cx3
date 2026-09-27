import type { Filters } from '../../contracts/filters';
import { analyticsUrl } from './analyticsRequest';

export function cliExportUrl(scope: { clientId: string; startDate: string; endDate: string; filters: Filters }, local: { campaign: string; vendor: string; search: string }) {
  const filters = { ...scope.filters };
  for (const key of ['campaign', 'vendor'] as const) {
    const value = local[key];
    if (value === 'all') continue;
    const condition = filters[key];
    if (condition && !(
      (condition.operator === 'in' && condition.values?.includes(value)) ||
      (condition.operator === 'equals' && condition.value === value) ||
      (condition.operator === 'not_equals' && condition.value !== value)
    )) throw new Error(`The selected ${key} conflicts with the reporting scope. Reset the table filter before exporting.`);
    filters[key] = { operator: 'equals', value };
  }
  return analyticsUrl('/export', { ...scope, filters, grain: 'cli', search: local.search.trim() });
}
