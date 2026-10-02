import { createHash, randomUUID } from 'node:crypto';
import {
  parseSavedInvestigationDefinition, parseSavedInvestigationDraft,
  type SavedInvestigationDefinition, type SavedInvestigationDraft,
} from '../../contracts/savedAnalysis';
import { normalizeOperationalParams } from '../offernetScope';
import { buildInvestigationPredicate } from '../analytics/investigation/exceptionPredicates';

export const MAX_SAVED_INVESTIGATIONS = 100;
export const MAX_SAVED_COLLECTION_BYTES = 512 * 1024;
const MAX_WRITE_ATTEMPTS = 5;

export class SavedAnalysisError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message); this.name = 'SavedAnalysisError';
  }
}

export interface SavedInvestigationCollection {
  version: 1;
  ownerSubject: string;
  tenantId: string;
  definitions: SavedInvestigationDefinition[];
}
/** Runtime-owned durable storage. Implementations must never emulate successful writes in memory. */
export interface SavedInvestigationBackend {
  read(ownerSubject: string, tenantId: string): Promise<{ collection: SavedInvestigationCollection | null; generation: string }>;
  compareAndSwap(ownerSubject: string, tenantId: string, generation: string, collection: SavedInvestigationCollection): Promise<boolean>;
}

export function savedInvestigationObjectName(ownerSubject: string, tenantId: string): string {
  if (typeof tenantId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(tenantId)) {
    throw new SavedAnalysisError('INVALID_SAVED_TENANT', 'An explicit valid workspace is required.');
  }
  if (typeof ownerSubject !== 'string' || !ownerSubject.trim() || ownerSubject.length > 256 || /[\x00-\x1f\x7f]/.test(ownerSubject)) {
    throw new SavedAnalysisError('INVALID_SAVED_OWNER', 'A verified saved-investigation owner is required.', 401);
  }
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  return `saved-investigations/v1/${hash(tenantId)}/${hash(ownerSubject)}.json`;
}

export function validateSavedInvestigationCollection(value: unknown, ownerSubject: string, tenantId: string): SavedInvestigationCollection {
  savedInvestigationObjectName(ownerSubject, tenantId);
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    const collection = value as SavedInvestigationCollection;
    if (Object.keys(collection).some(key => !['version', 'ownerSubject', 'tenantId', 'definitions'].includes(key))
      || collection.version !== 1 || collection.ownerSubject !== ownerSubject || collection.tenantId !== tenantId
      || !Array.isArray(collection.definitions) || collection.definitions.length > MAX_SAVED_INVESTIGATIONS
      || Buffer.byteLength(JSON.stringify(collection), 'utf8') > MAX_SAVED_COLLECTION_BYTES) throw new Error();
    const ids = new Set<string>();
    const definitions = collection.definitions.map(value => {
      const definition = parseSavedInvestigationDefinition(value);
      validateSavedInvestigationId(definition.id);
      validateSavedInvestigationQuery(definition);
      if (definition.ownerSubject !== ownerSubject || definition.scope.tenantId !== tenantId || ids.has(definition.id)) throw new Error();
      ids.add(definition.id);
      return definition;
    });
    return { version: 1, ownerSubject, tenantId, definitions };
  } catch {
    throw new SavedAnalysisError('SAVED_COLLECTION_INVALID', 'Saved investigations failed integrity checks. No definitions were changed.', 503);
  }
}

function validatedDraft(value: SavedInvestigationDraft, tenantId: string): SavedInvestigationDraft {
  let draft: SavedInvestigationDraft;
  try { draft = parseSavedInvestigationDraft(value); }
  catch { throw new SavedAnalysisError('INVALID_SAVED_INVESTIGATION', 'The investigation definition is invalid or contains unsupported data.', 422); }
  if (draft.scope.tenantId !== tenantId) throw new SavedAnalysisError('SAVED_TENANT_CONFLICT', 'The definition must belong to the selected workspace.', 422);
  validateSavedInvestigationQuery(draft);
  return draft;
}

/** Recheck the authoritative operational filters and SQL predicate without warehouse access. */
export function validateSavedInvestigationQuery(draft: SavedInvestigationDraft): void {
  const { params } = normalizeOperationalParams({
    clientId: draft.scope.tenantId, startDate: draft.scope.startDate ?? undefined, endDate: draft.scope.endDate ?? undefined,
    filters: draft.scope.filters, ...draft.investigation,
  });
  buildInvestigationPredicate(params, {});
}

function validateRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new SavedAnalysisError('INVALID_SAVED_REVISION', 'A positive saved-investigation revision is required.');
}
export function validateSavedInvestigationId(id: string): void {
  if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) {
    throw new SavedAnalysisError('INVALID_SAVED_ID', 'Invalid saved-investigation identifier.');
  }
}

/** No cache: every operation reads the current durable owner/tenant collection. */
export class DurableSavedInvestigationRepository {
  constructor(private readonly backend: SavedInvestigationBackend) {}

  private async read(ownerSubject: string, tenantId: string) {
    savedInvestigationObjectName(ownerSubject, tenantId);
    const result = await this.backend.read(ownerSubject, tenantId);
    if (typeof result.generation !== 'string' || !result.generation) {
      throw new SavedAnalysisError('SAVED_STORAGE_GENERATION', 'Storage did not return a safe revision.', 503);
    }
    const collection = result.collection === null
      ? { version: 1 as const, ownerSubject, tenantId, definitions: [] }
      : validateSavedInvestigationCollection(result.collection, ownerSubject, tenantId);
    return { collection, generation: result.generation };
  }

  async list(ownerSubject: string, tenantId: string): Promise<SavedInvestigationDefinition[]> {
    const { collection } = await this.read(ownerSubject, tenantId);
    return collection.definitions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }

  private async mutate<T>(ownerSubject: string, tenantId: string, change: (collection: SavedInvestigationCollection) => T): Promise<T> {
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
      const { collection, generation } = await this.read(ownerSubject, tenantId);
      const result = change(collection);
      if (Buffer.byteLength(JSON.stringify(collection), 'utf8') > MAX_SAVED_COLLECTION_BYTES) {
        throw new SavedAnalysisError('SAVED_COLLECTION_LIMIT', 'Saved investigations have reached the workspace storage limit. Remove an unused definition before saving another.', 409);
      }
      const validated = validateSavedInvestigationCollection(collection, ownerSubject, tenantId);
      if (await this.backend.compareAndSwap(ownerSubject, tenantId, generation, validated)) return result;
    }
    throw new SavedAnalysisError('SAVED_REVISION_CONFLICT', 'Saved investigations changed during this request. Reload and try again.', 409);
  }

  async create(ownerSubject: string, tenantId: string, value: SavedInvestigationDraft): Promise<SavedInvestigationDefinition> {
    savedInvestigationObjectName(ownerSubject, tenantId);
    const draft = validatedDraft(value, tenantId);
    const id = randomUUID(), timestamp = new Date().toISOString();
    const definition = parseSavedInvestigationDefinition({ ...draft, id, ownerSubject, createdAt: timestamp, updatedAt: timestamp, revision: 1 });
    return this.mutate(ownerSubject, tenantId, collection => {
      if (collection.definitions.length >= MAX_SAVED_INVESTIGATIONS) {
        throw new SavedAnalysisError('SAVED_INVESTIGATION_LIMIT', `A maximum of ${MAX_SAVED_INVESTIGATIONS} investigations can be saved in this workspace.`, 409);
      }
      collection.definitions.push(definition);
      return definition;
    });
  }

  async update(ownerSubject: string, tenantId: string, id: string, revision: number, value: SavedInvestigationDraft): Promise<SavedInvestigationDefinition> {
    savedInvestigationObjectName(ownerSubject, tenantId);
    validateSavedInvestigationId(id); validateRevision(revision);
    const draft = validatedDraft(value, tenantId);
    return this.mutate(ownerSubject, tenantId, collection => {
      const index = collection.definitions.findIndex(definition => definition.id === id);
      if (index < 0) throw new SavedAnalysisError('SAVED_INVESTIGATION_NOT_FOUND', 'Saved investigation not found in this workspace.', 404);
      const previous = collection.definitions[index];
      if (previous.revision !== revision || revision === Number.MAX_SAFE_INTEGER) {
        throw new SavedAnalysisError('SAVED_REVISION_CONFLICT', 'This saved investigation changed. Reload before updating it.', 409);
      }
      const definition = parseSavedInvestigationDefinition({ ...draft, id, ownerSubject, createdAt: previous.createdAt, updatedAt: new Date().toISOString(), revision: revision + 1 });
      collection.definitions[index] = definition;
      return definition;
    });
  }

  async remove(ownerSubject: string, tenantId: string, id: string, revision: number): Promise<void> {
    savedInvestigationObjectName(ownerSubject, tenantId);
    validateSavedInvestigationId(id); validateRevision(revision);
    await this.mutate(ownerSubject, tenantId, collection => {
      const index = collection.definitions.findIndex(definition => definition.id === id);
      if (index < 0) throw new SavedAnalysisError('SAVED_INVESTIGATION_NOT_FOUND', 'Saved investigation not found in this workspace.', 404);
      if (collection.definitions[index].revision !== revision) {
        throw new SavedAnalysisError('SAVED_REVISION_CONFLICT', 'This saved investigation changed. Reload before deleting it.', 409);
      }
      collection.definitions.splice(index, 1);
    });
  }
}
