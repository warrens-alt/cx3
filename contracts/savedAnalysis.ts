import type { DateBasis, Grouping } from './reporting';
import { RequestError, validateDate } from './filters';
import { DRIVER_FIRST_DIAL_AGES, INVESTIGATION_LABELS, investigationReasonFor, type InvestigationNarrowing } from './investigation';

export const SAVED_ANALYSIS_VERSION = 'cx.saved-analysis.1.0.0';
export type AnalysisReleaseMode = 'current_observations' | 'pinned_release';

/** Persistence-neutral contract. No record data or credentials belong in a saved analysis. */
export interface SavedAnalysisDefinition {
  version: typeof SAVED_ANALYSIS_VERSION;
  id: string;
  name: string;
  ownerSubject: string;
  report: 'evidence' | 'vendor_performance' | 'exceptions' | 'commercial_reconciliation' | 'explore' | 'vetting';
  scope: {
    tenantId: string;
    startDate: string;
    endDate: string;
    dateBasis: DateBasis;
    grouping: Grouping;
    filters: { vendor?: string[]; source?: string[]; medium?: string[] };
  };
  metrics: string[];
  presentation: {
    chartType?: string;
    visibleSeries?: string[];
    sort?: { field: string; direction: 'asc' | 'desc' };
    tableDensity?: 'comfortable' | 'compact';
    layout?: string[];
  };
  release: { mode: AnalysisReleaseMode; releaseId: string | null };
}

export interface SavedAnalysisRepository {
  list(ownerSubject: string, tenantId: string): Promise<SavedAnalysisDefinition[]>;
  save(definition: SavedAnalysisDefinition): Promise<void>;
  remove(ownerSubject: string, id: string): Promise<void>;
}

/** Prevent a future adapter from calling a live view a frozen snapshot. */
export function validateSavedAnalysisRelease(definition: SavedAnalysisDefinition): void {
  if (definition.release.mode === 'pinned_release' && !definition.release.releaseId) {
    throw new Error('A pinned analysis requires an immutable release ID.');
  }
  if (definition.release.mode === 'current_observations' && definition.release.releaseId !== null) {
    throw new Error('A current-observation view cannot carry a release ID.');
  }
}

/** An operational investigation is a live view definition, never a record or result snapshot.
 * Keep the legacy release-report contract above intact: its grain/filter semantics differ.
 */
export const SAVED_INVESTIGATION_VERSION = 'cx.saved-investigation.1.0.0';
export const SAVED_INVESTIGATION_METRICS = ['fetchedLeads', 'deliveryRate', 'dialRate', 'contactRate', 'leadToSaleRate', 'activationRate'] as const;
export const SAVED_INVESTIGATION_FILTERS = ['vendor', 'source', 'medium', 'grade'] as const;
export const SAVED_INVESTIGATION_KEYS = ['drill', 'drillValue', 'metric', 'segmentVendor', 'segmentSource', 'segmentGrade', 'segmentLeadAge'] as const;
export type SavedInvestigationFilters = Partial<Record<typeof SAVED_INVESTIGATION_FILTERS[number], { operator: 'equals'; value: string }>>;
export interface SavedInvestigationDraft {
  version: typeof SAVED_INVESTIGATION_VERSION;
  report: 'investigation';
  name: string;
  scope: {
    tenantId: string; startDate: string | null; endDate: string | null;
    dateBasis: 'intake_cohort'; countingGrain: 'lead'; filters: SavedInvestigationFilters;
  };
  investigation: InvestigationNarrowing & { drill?: string; drillValue?: string; metric?: string };
  release: { mode: 'current_observations'; releaseId: null };
}
export interface SavedInvestigationDefinition extends SavedInvestigationDraft {
  id: string; ownerSubject: string; createdAt: string; updatedAt: string; revision: number;
}
export interface SavedInvestigationList {
  configured: boolean; definitions: SavedInvestigationDefinition[]; limit: number;
}
const draftKeys = ['version', 'report', 'name', 'scope', 'investigation', 'release'];
const metadataKeys = ['id', 'ownerSubject', 'createdAt', 'updatedAt', 'revision'];
function object(value: unknown, allowed: readonly string[], required: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RequestError(`Invalid ${label}`, 422);
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(candidate, key))) {
    throw new RequestError(`Unsupported or missing fields in ${label}. Only investigation definitions can be saved.`, 422);
  }
  return candidate;
}
function text(value: unknown, label: string, max = 256): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new RequestError(`Invalid ${label}`, 422);
  return value.trim();
}
/** Strict, browser-safe allowlist. Unknown fields are rejected, never stripped to a broader view. */
export function parseSavedInvestigationDraft(value: unknown): SavedInvestigationDraft {
  const raw = object(value, draftKeys, draftKeys, 'saved investigation');
  if (raw.version !== SAVED_INVESTIGATION_VERSION || raw.report !== 'investigation') throw new RequestError('Unsupported saved investigation version or report', 422);
  const scopeKeys = ['tenantId', 'startDate', 'endDate', 'dateBasis', 'countingGrain', 'filters'];
  const scope = object(raw.scope, scopeKeys, scopeKeys, 'saved reporting scope');
  const tenantId = text(scope.tenantId, 'workspace', 80);
  if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) throw new RequestError('Invalid workspace', 422);
  if (scope.dateBasis !== 'intake_cohort' || scope.countingGrain !== 'lead') throw new RequestError('Saved investigations require the existing intake cohort and distinct lead grain', 422);
  const date = (input: unknown, label: string) => {
    if (input === null) return null;
    try { const result = validateDate(input, label); if (result) return result; } catch { /* stable contract error below */ }
    throw new RequestError(`Invalid ${label}; use a calendar date or an explicit open bound`, 422);
  };
  const startDate = date(scope.startDate, 'startDate'), endDate = date(scope.endDate, 'endDate');
  if (startDate && endDate && startDate > endDate) throw new RequestError('startDate must not be after endDate', 422);
  const filterInput = object(scope.filters, SAVED_INVESTIGATION_FILTERS, [], 'saved filters');
  const filters: SavedInvestigationFilters = {};
  for (const key of SAVED_INVESTIGATION_FILTERS) if (Object.hasOwn(filterInput, key)) {
    const condition = object(filterInput[key], ['operator', 'value'], ['operator', 'value'], `${key} filter`);
    const filterValue = text(condition.value, `${key} filter value`);
    if (condition.operator !== 'equals' || ['all', 'all vendors', 'all sources', 'all grades', 'undefined', 'null'].includes(filterValue.toLowerCase())) throw new RequestError(`Saved investigations require one exact ${key} value`, 422);
    filters[key] = { operator: 'equals', value: filterValue };
  }
  const input = object(raw.investigation, SAVED_INVESTIGATION_KEYS, [], 'investigation scope');
  const investigation: SavedInvestigationDraft['investigation'] = {};
  for (const key of SAVED_INVESTIGATION_KEYS) if (Object.hasOwn(input, key)) investigation[key] = text(input[key], key);
  if (investigation.metric && !SAVED_INVESTIGATION_METRICS.some(metric => metric === investigation.metric)) throw new RequestError('Unsupported saved investigation metric', 422);
  if (investigation.drill) {
    if (!Object.hasOwn(INVESTIGATION_LABELS, investigation.drill) || !investigationReasonFor(investigation.drill, investigation.drillValue)) throw new RequestError('Unsupported investigation predicate or value', 422);
    const valuePredicates = ['funnel-stage', 'funnel-loss', 'backlog-age', 'call-effort', 'lead-age', 'delivery-age', 'lifecycle-segment', 'lifecycle-vendor', 'lifecycle-source', 'lifecycle-grade'];
    if (Boolean(investigation.drillValue) !== valuePredicates.includes(investigation.drill)) throw new RequestError('The predicate and its value do not form a supported population', 422);
  } else if (investigation.drillValue) throw new RequestError('A predicate value requires its predicate', 422);
  if (investigation.segmentLeadAge && !DRIVER_FIRST_DIAL_AGES.some(bucket => bucket === investigation.segmentLeadAge)) throw new RequestError('Unsupported first-dial age narrowing', 422);
  const release = object(raw.release, ['mode', 'releaseId'], ['mode', 'releaseId'], 'saved release');
  if (release.mode !== 'current_observations' || release.releaseId !== null) throw new RequestError('Saved investigations reload current observations; they cannot pin a release', 422);
  return { version: SAVED_INVESTIGATION_VERSION, report: 'investigation', name: text(raw.name, 'investigation name', 100), scope: { tenantId, startDate, endDate, dateBasis: 'intake_cohort', countingGrain: 'lead', filters }, investigation, release: { mode: 'current_observations', releaseId: null } };
}
export function parseSavedInvestigationDefinition(value: unknown): SavedInvestigationDefinition {
  const raw = object(value, [...draftKeys, ...metadataKeys], [...draftKeys, ...metadataKeys], 'stored investigation');
  const draft = parseSavedInvestigationDraft(Object.fromEntries(draftKeys.map(key => [key, raw[key]])));
  const id = text(raw.id, 'saved investigation identifier', 80);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new RequestError('Invalid saved investigation identifier', 422);
  const ownerSubject = text(raw.ownerSubject, 'saved investigation owner', 256);
  const timestamp = (input: unknown) => {
    const result = text(input, 'saved timestamp', 30);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString() !== result) throw new RequestError('Invalid saved timestamp', 422);
    return result;
  };
  const createdAt = timestamp(raw.createdAt), updatedAt = timestamp(raw.updatedAt);
  if (updatedAt < createdAt || !Number.isSafeInteger(raw.revision) || Number(raw.revision) < 1) throw new RequestError('Invalid saved investigation revision', 422);
  return { ...draft, id, ownerSubject, createdAt, updatedAt, revision: raw.revision as number };
}
