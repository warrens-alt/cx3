import React from 'react';
import ReportingScopeBar, {
  type ReportingScopeBarProps,
} from '../shared/reporting/ReportingScopeBar';

const localDateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfQuarter = (date: Date) => new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export function buildPeriodPresets(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = startOfMonth(today);
  const previousMonthEnd = addDays(monthStart, -1);
  const previousMonthStart = startOfMonth(previousMonthEnd);
  const weekday = today.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const weekStart = addDays(today, mondayOffset);
  const quarterStart = startOfQuarter(today);

  return [
    { id: 'all', label: 'All time', start: '', end: '' },
    { id: 'today', label: 'Today', start: localDateOnly(today), end: localDateOnly(today) },
    { id: 'wtd', label: 'Week to date', start: localDateOnly(weekStart), end: localDateOnly(today) },
    { id: 'last7', label: 'Last 7 days', start: localDateOnly(addDays(today, -6)), end: localDateOnly(today) },
    { id: 'mtd', label: 'Month to date', start: localDateOnly(monthStart), end: localDateOnly(today) },
    { id: 'last30', label: 'Last 30 days', start: localDateOnly(addDays(today, -29)), end: localDateOnly(today) },
    { id: 'previous_month', label: 'Previous month', start: localDateOnly(previousMonthStart), end: localDateOnly(previousMonthEnd) },
    { id: 'qtd', label: 'Quarter to date', start: localDateOnly(quarterStart), end: localDateOnly(today) },
  ];
}

export const PERIOD_PRESETS = buildPeriodPresets();

export interface OffernetFilterBarProps extends Omit<ReportingScopeBarProps, 'policy'> {}

/**
 * Compatibility adapter routing legacy page invocations to the shared
 * ReportingScopeBar control family.
 */
export const OffernetFilterBar: React.FC<OffernetFilterBarProps> = props => {
  return <ReportingScopeBar policy="operational" {...props} />;
};

export default OffernetFilterBar;
