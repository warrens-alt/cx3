import { validateDate, type FilterCondition } from '../../contracts/filters';

export interface DateRangeDraft {
  start: string;
  end: string;
  startIncomplete?: boolean;
  endIncomplete?: boolean;
}

/** Validate a complete user action before publishing it to the URL scope. */
export function dateDraftError(draft: DateRangeDraft): string | null {
  if (draft.startIncomplete) return 'Enter a complete start date.';
  if (draft.endIncomplete) return 'Enter a complete end date.';
  try { validateDate(draft.start, 'startDate'); }
  catch { return 'Choose a valid start date.'; }
  try { validateDate(draft.end, 'endDate'); }
  catch { return 'Choose a valid end date.'; }
  if (draft.start && draft.end && draft.start > draft.end) return 'End date must be on or after start date.';
  return null;
}

export function scopeFilterSummary(condition: FilterCondition): string {
  if (condition.operator === 'in') return condition.values?.map(String).join(', ') || '';
  if (condition.operator === 'between') return `${condition.min}–${condition.max}`;
  const value = String(condition.value ?? '');
  if (condition.operator === 'not_equals') return `Not ${value}`;
  if (condition.operator === 'greater_than') return `More than ${value}`;
  if (condition.operator === 'less_than') return `Less than ${value}`;
  return value;
}

/** A single-choice selector must not impersonate a multiple/exclusion scope. */
export function scopeSelectValue(condition: FilterCondition | undefined): string | null {
  if (!condition) return '';
  if (condition.operator === 'equals' && typeof condition.value === 'string' && condition.value) return condition.value;
  if (condition.operator === 'in' && condition.values?.length === 1 && typeof condition.values[0] === 'string' && condition.values[0]) return condition.values[0];
  return null;
}
