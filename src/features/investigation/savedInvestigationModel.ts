import { validateInvestigationUrlScope } from '../../../contracts/investigation';
import { parseSavedInvestigationDraft, parseSavedInvestigationDefinition, SAVED_INVESTIGATION_VERSION, SAVED_INVESTIGATION_FILTERS, SAVED_INVESTIGATION_KEYS, type SavedInvestigationDraft, type SavedInvestigationDefinition, type SavedInvestigationFilters } from '../../../contracts/savedAnalysis';
import { investigationLabel, type InvestigationModel } from './investigationModel';

function canonicalFilters(value: unknown): SavedInvestigationFilters {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid reporting filters.');
  const result: SavedInvestigationFilters = {};
  for (const [key, candidate] of Object.entries(value)) {
    const dimension = ['partner', 'ror_partner'].includes(key) ? 'vendor' : key;
    if (!SAVED_INVESTIGATION_FILTERS.some(name => name === dimension) || !candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Only supported vendor, source, medium and grade filters can be saved. Private identity filters cannot be saved.');
    const condition = candidate as Record<string, unknown>;
    const keys = condition.operator === 'equals' ? ['operator', 'value'] : condition.operator === 'in' ? ['operator', 'values'] : [];
    if (!keys.length || Object.keys(condition).some(name => !keys.includes(name))) throw new Error('Unsupported filter fields or operator; no broader definition was saved.');
    const selected = condition.operator === 'equals' ? [condition.value] : condition.values;
    if (!Array.isArray(selected) || selected.length !== 1 || typeof selected[0] !== 'string') throw new Error('Each saved operational filter must contain one exact value.');
    const name = dimension as keyof SavedInvestigationFilters;
    const normalized = selected[0].trim();
    if (result[name] && result[name]!.value !== normalized) throw new Error('Conflicting filter aliases cannot be saved.');
    result[name] = { operator: 'equals', value: normalized };
  }
  return result;
}

/** Only explicit analytical definition fields are projected. Never serialize the UI model or tray. */
export function buildSavedInvestigationDraft(model: InvestigationModel, params: URLSearchParams, name: string): SavedInvestigationDraft {
  validateInvestigationUrlScope(params);
  if (model.search || [...params.keys()].some(key => /^(search|sourceSearch|lead[_-]?id|consumer[_-]?id|transaction[_-]?id|selectedLead(Id)?|selectedIDs)$/i.test(key))) throw new Error('Clear private record search or identifier scope before saving this investigation. No restriction will be dropped automatically.');
  if (params.has('clientId') && params.get('clientId') !== model.clientId) throw new Error('Workspace selection does not match the current investigation.');
  if (['startDate', 'endDate'].some(key => params.has(key) && params.get(key) !== model[key as 'startDate' | 'endDate'])) throw new Error('Reporting dates do not match the current investigation.');
  const filters = canonicalFilters(model.filters);
  // Check the raw URL as well: generic filter parsing may canonicalize extra fields
  // or overwrite a structured restriction with a legacy scalar representation.
  if (params.has('filters')) {
    let encoded: unknown;
    try { encoded = JSON.parse(params.get('filters')!); } catch { throw new Error('Invalid encoded filters.'); }
    const original = canonicalFilters(encoded);
    for (const key of Object.keys(original) as Array<keyof SavedInvestigationFilters>) if (filters[key]?.value !== original[key]?.value) throw new Error('Conflicting reporting filters cannot be saved.');
  }
  for (const key of [...SAVED_INVESTIGATION_FILTERS, 'partner', 'ror_partner']) if (params.has(key)) {
    if (params.getAll(key).length !== 1) throw new Error('Repeated reporting filters cannot be saved.');
    const value = params.get(key)!.trim();
    const dimension = (['partner', 'ror_partner'].includes(key) ? 'vendor' : key) as keyof SavedInvestigationFilters;
    if (filters[dimension]?.value !== value) throw new Error('Resolve conflicting or unsupported reporting filters before saving.');
  }
  const investigation: SavedInvestigationDraft['investigation'] = {};
  for (const key of SAVED_INVESTIGATION_KEYS) {
    const urlKey = key === 'metric' ? 'investigationMetric' : key;
    if (params.has(urlKey)) investigation[key] = params.get(urlKey)!;
  }
  return parseSavedInvestigationDraft({ version: SAVED_INVESTIGATION_VERSION, report: 'investigation', name,
    scope: { tenantId: model.clientId, startDate: model.startDate || null, endDate: model.endDate || null, dateBasis: 'intake_cohort', countingGrain: 'lead', filters },
    investigation, release: { mode: 'current_observations', releaseId: null } });
}

/** Reopen replaces the old scope. Inherited query parameters would contaminate the saved population. */
export function savedInvestigationPath(value: SavedInvestigationDefinition): string {
  const definition = parseSavedInvestigationDefinition(value);
  const params = new URLSearchParams({ clientId: definition.scope.tenantId });
  if (definition.scope.startDate) params.set('startDate', definition.scope.startDate);
  if (definition.scope.endDate) params.set('endDate', definition.scope.endDate);
  if (Object.keys(definition.scope.filters).length) params.set('filters', JSON.stringify(definition.scope.filters));
  for (const [key, selected] of Object.entries(definition.investigation)) if (selected) params.set(key === 'metric' ? 'investigationMetric' : key, selected);
  return `/investigate?${params}`;
}
export function savedInvestigationSummary(definition: SavedInvestigationDefinition | SavedInvestigationDraft): string {
  const params = new URLSearchParams(Object.entries(definition.investigation).map(([key, value]) => [key === 'metric' ? 'investigationMetric' : key, value || '']));
  const dates = !definition.scope.startDate && !definition.scope.endDate ? 'All time' : `${definition.scope.startDate || 'Open start'} – ${definition.scope.endDate || 'Open end'}`;
  return [dates, investigationLabel(params), ...(definition.investigation.drill && definition.investigation.metric ? [`Metric: ${definition.investigation.metric}`] : []), ...Object.entries(definition.scope.filters).map(([key, condition]) => `${key}: ${condition!.value}`), ...Object.entries(definition.investigation).filter(([key]) => key.startsWith('segment')).map(([key, value]) => `${key.replace('segment', '')}: ${value}`)].join(' · ');
}
