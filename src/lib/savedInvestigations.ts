import { ApiRequestError } from './apiTransport';
import { getAnalyticalSessionGeneration, getAnalyticalSessionKey } from './analyticalSession';
import { parseSavedInvestigationDefinition, parseSavedInvestigationDraft, type SavedInvestigationDefinition, type SavedInvestigationDraft, type SavedInvestigationList } from '../../contracts/savedAnalysis';
export type { SavedInvestigationDefinition, SavedInvestigationDraft, SavedInvestigationList } from '../../contracts/savedAnalysis';

const invalid = () => new ApiRequestError('Saved investigation storage returned an invalid or mismatched definition.', 502, 'SAVED_DEFINITION_MISMATCH');
function tenant(clientId: string) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(clientId)) throw new Error('Select an explicit workspace for saved investigations.');
  return clientId;
}
async function request(path: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
  const generation = getAnalyticalSessionGeneration(), session = getAnalyticalSessionKey();
  if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
  const response = await fetch(`/api/saved-analyses${path}`, { ...init, credentials: 'same-origin', cache: 'no-store', signal, headers: { 'Content-Type': 'application/json', ...init.headers } });
  let payload: { success?: boolean; data?: unknown; error?: string };
  try { payload = await response.json(); } catch { throw invalid(); }
  if (signal?.aborted || generation !== getAnalyticalSessionGeneration() || session !== getAnalyticalSessionKey()) throw new DOMException('Analytical session changed', 'AbortError');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw invalid();
  if (!response.ok || payload.success !== true) throw new ApiRequestError(typeof payload.error === 'string' ? payload.error : 'Saved investigation request failed.', response.ok ? 502 : response.status, 'SAVED_INVESTIGATION_REQUEST', response.headers.get('x-request-id'));
  return payload.data;
}
function checkedDefinition(value: unknown, clientId: string): SavedInvestigationDefinition {
  try {
    const definition = parseSavedInvestigationDefinition(value);
    if (definition.scope.tenantId !== clientId) throw invalid();
    return definition;
  } catch { throw invalid(); }
}
export function savedInvestigationDraftFromDefinition(definition: SavedInvestigationDefinition): SavedInvestigationDraft {
  const { id: _id, ownerSubject: _owner, revision: _revision, createdAt: _created, updatedAt: _updated, ...draft } = parseSavedInvestigationDefinition(definition);
  return parseSavedInvestigationDraft(draft);
}
export async function listSavedInvestigations(clientId: string, signal?: AbortSignal): Promise<SavedInvestigationList> {
  const data = await request(`?${new URLSearchParams({ clientId: tenant(clientId) })}`, { method: 'GET' }, signal) as SavedInvestigationList;
  if (!data || typeof data.configured !== 'boolean' || !Array.isArray(data.definitions) || !Number.isSafeInteger(data.limit) || data.limit < 1 || data.limit > 1000 || data.definitions.length > data.limit || (!data.configured && data.definitions.length)) throw invalid();
  const definitions = data.definitions.map(value => checkedDefinition(value, clientId));
  if (new Set(definitions.map(value => value.id)).size !== definitions.length || new Set(definitions.map(value => value.ownerSubject)).size > 1) throw invalid();
  return { configured: data.configured, limit: data.limit, definitions };
}
export async function createSavedInvestigation(input: SavedInvestigationDraft, signal?: AbortSignal): Promise<SavedInvestigationDefinition> {
  const definition = parseSavedInvestigationDraft(input), clientId = tenant(definition.scope.tenantId);
  const result = checkedDefinition(await request('', { method: 'POST', body: JSON.stringify({ clientId, definition }) }, signal), clientId);
  if (result.revision !== 1 || JSON.stringify(savedInvestigationDraftFromDefinition(result)) !== JSON.stringify(definition)) throw invalid();
  return result;
}
export async function updateSavedInvestigation(original: SavedInvestigationDefinition, input: SavedInvestigationDraft, signal?: AbortSignal): Promise<SavedInvestigationDefinition> {
  const old = parseSavedInvestigationDefinition(original), definition = parseSavedInvestigationDraft(input), clientId = tenant(old.scope.tenantId);
  if (clientId !== definition.scope.tenantId) throw new Error('A saved investigation cannot move to a different workspace.');
  const result = checkedDefinition(await request(`/${encodeURIComponent(old.id)}`, { method: 'PUT', body: JSON.stringify({ clientId, definition, revision: old.revision }) }, signal), clientId);
  if (result.id !== old.id || result.ownerSubject !== old.ownerSubject || result.createdAt !== old.createdAt || result.revision !== old.revision + 1 || JSON.stringify(savedInvestigationDraftFromDefinition(result)) !== JSON.stringify(definition)) throw invalid();
  return result;
}
export async function deleteSavedInvestigation(input: SavedInvestigationDefinition, signal?: AbortSignal): Promise<void> {
  const definition = parseSavedInvestigationDefinition(input), clientId = tenant(definition.scope.tenantId);
  const data = await request(`/${encodeURIComponent(definition.id)}?${new URLSearchParams({ clientId, revision: String(definition.revision) })}`, { method: 'DELETE' }, signal) as { deleted?: boolean };
  if (data?.deleted !== true) throw invalid();
}
