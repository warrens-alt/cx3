import {
  SavedAnalysisError, savedInvestigationObjectName, validateSavedInvestigationCollection,
  type SavedInvestigationBackend, type SavedInvestigationCollection,
} from './repository';
import { readSavedJson } from './storage';

/** Native binding shape shared with the existing private CLI storage integration. */
import type { CliR2Bucket } from '../cliImports/r2';
export interface SavedInvestigationR2Environment {
  SAVED_ANALYSES?: CliR2Bucket;
  CX_SAVED_ANALYSES_STORAGE_PROVIDER?: string;
  CX_SAVED_ANALYSES_R2_PRIVATE_CONFIRMED?: string;
}

export function configuredR2SavedInvestigationBackend(env: SavedInvestigationR2Environment): SavedInvestigationBackend | null {
  if (!env.CX_SAVED_ANALYSES_STORAGE_PROVIDER && !env.SAVED_ANALYSES && !env.CX_SAVED_ANALYSES_R2_PRIVATE_CONFIRMED) return null;
  if (env.CX_SAVED_ANALYSES_STORAGE_PROVIDER !== 'r2' || !env.SAVED_ANALYSES
    || typeof env.SAVED_ANALYSES.get !== 'function' || typeof env.SAVED_ANALYSES.put !== 'function') {
    throw new SavedAnalysisError('SAVED_R2_CONFIGURATION', 'Select R2 and bind approved private saved-investigation storage as SAVED_ANALYSES.', 503);
  }
  if (env.CX_SAVED_ANALYSES_R2_PRIVATE_CONFIRMED !== 'true') {
    throw new SavedAnalysisError('SAVED_R2_PRIVACY_UNCONFIRMED', 'Confirm that saved-investigation storage has no public URL or custom domain before enabling saves.', 503);
  }
  return new R2SavedInvestigationBackend(env.SAVED_ANALYSES);
}

const validEtag = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\x00-\x20\x7f"\\]/.test(value);
const storageError = () => new SavedAnalysisError('SAVED_R2_UNAVAILABLE', 'Private saved-investigation storage failed. Existing definitions were not replaced.', 503);

export class R2SavedInvestigationBackend implements SavedInvestigationBackend {
  constructor(private readonly bucket: CliR2Bucket) {}
  async read(ownerSubject: string, tenantId: string) {
    const key = savedInvestigationObjectName(ownerSubject, tenantId);
    let object;
    try { object = await this.bucket.get(key); } catch { throw storageError(); }
    if (object === null) return { collection: null, generation: '0' };
    if (!object?.body || !validEtag(object.etag)) {
      await object?.body?.cancel().catch(() => {});
      throw new SavedAnalysisError('SAVED_R2_ETAG', 'Storage returned no safe revision. Saved-investigation changes are disabled.', 503);
    }
    const value = await readSavedJson(object.body, object.size, true);
    return { collection: validateSavedInvestigationCollection(value, ownerSubject, tenantId), generation: `r2:${object.etag}` };
  }
  async compareAndSwap(ownerSubject: string, tenantId: string, generation: string, collection: SavedInvestigationCollection): Promise<boolean> {
    const key = savedInvestigationObjectName(ownerSubject, tenantId);
    const validated = validateSavedInvestigationCollection(collection, ownerSubject, tenantId);
    const condition = new Headers();
    if (generation === '0') condition.set('If-None-Match', '*');
    else if (generation.startsWith('r2:') && validEtag(generation.slice(3))) condition.set('If-Match', `"${generation.slice(3)}"`);
    else throw new SavedAnalysisError('SAVED_R2_ETAG', 'Invalid storage revision.', 503);
    try {
      const result = await this.bucket.put(key, JSON.stringify(validated), {
        onlyIf: condition, httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'private, no-store' },
      });
      if (result === null) return false;
      if (!validEtag(result?.etag)) throw storageError();
      return true;
    } catch { throw storageError(); }
  }
}
