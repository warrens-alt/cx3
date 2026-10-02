import { GoogleAuth } from 'google-auth-library';
import {
  SavedAnalysisError, savedInvestigationObjectName, validateSavedInvestigationCollection,
  type SavedInvestigationBackend, type SavedInvestigationCollection,
} from './repository';
import { readSavedJson } from './storage';

type AuthorizedFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Explicit saved-definition configuration. Never borrows warehouse or CLI archive credentials. */
export function configuredSavedInvestigationBackend(env: NodeJS.ProcessEnv = process.env): SavedInvestigationBackend | null {
  const provider = env.CX_SAVED_ANALYSES_STORAGE_PROVIDER?.trim();
  const bucket = env.CX_SAVED_ANALYSES_BUCKET?.trim();
  if (!provider && !bucket && !env.CX_SAVED_ANALYSES_CREDENTIALS) return null;
  if (provider !== 'gcs' || !bucket || !/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucket)) {
    throw new SavedAnalysisError('SAVED_STORAGE_CONFIGURATION', 'Configure the saved-investigation GCS provider and approved private bucket.', 503);
  }
  let credentials;
  try {
    if (env.CX_SAVED_ANALYSES_CREDENTIALS) {
      credentials = JSON.parse(env.CX_SAVED_ANALYSES_CREDENTIALS);
      if (credentials?.type !== 'service_account' || typeof credentials.client_email !== 'string'
        || typeof credentials.private_key !== 'string') throw new Error();
    }
  } catch { throw new SavedAnalysisError('SAVED_STORAGE_CONFIGURATION', 'Saved-investigation storage credentials are invalid.', 503); }
  const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/devstorage.read_write'] });
  return new GcsSavedInvestigationBackend(bucket, async (url, init = {}) => {
    try {
      const token = await auth.getAccessToken();
      if (!token) throw new Error();
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      return await fetch(url, { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
    } catch { throw new SavedAnalysisError('SAVED_STORAGE_UNAVAILABLE', 'Private saved-investigation storage could not be reached or authenticated.', 503); }
  });
}

async function storageFailure(response: Response): Promise<never> {
  await response.body?.cancel().catch(() => {});
  throw new SavedAnalysisError('SAVED_STORAGE_ACCESS', 'Private saved-investigation storage access failed. No definitions were changed.', 503);
}

/** GCS generation preconditions prevent concurrent instances from replacing another save. */
export class GcsSavedInvestigationBackend implements SavedInvestigationBackend {
  private readonly base: string;
  constructor(private readonly bucket: string, private readonly request: AuthorizedFetch) {
    this.base = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}`;
  }
  private async assertPrivate(): Promise<void> {
    const response = await this.request(`${this.base}?fields=iamConfiguration`);
    if (!response.ok) return storageFailure(response);
    const metadata = await readSavedJson(response.body) as { iamConfiguration?: {
      uniformBucketLevelAccess?: { enabled?: boolean }; publicAccessPrevention?: string;
    } };
    if (metadata?.iamConfiguration?.uniformBucketLevelAccess?.enabled !== true || metadata.iamConfiguration.publicAccessPrevention !== 'enforced') {
      throw new SavedAnalysisError('SAVED_STORAGE_NOT_PRIVATE', 'Saved investigations require uniform bucket access and enforced public access prevention.', 503);
    }
  }
  async read(ownerSubject: string, tenantId: string) {
    const name = savedInvestigationObjectName(ownerSubject, tenantId);
    await this.assertPrivate();
    const response = await this.request(`${this.base}/o/${encodeURIComponent(name)}?alt=media`, { cache: 'no-store' });
    if (response.status === 404) { await response.body?.cancel(); return { collection: null, generation: '0' }; }
    if (!response.ok) return storageFailure(response);
    const generation = response.headers.get('x-goog-generation');
    if (!generation || !/^\d+$/.test(generation)) {
      await response.body?.cancel();
      throw new SavedAnalysisError('SAVED_STORAGE_GENERATION', 'Storage returned no safe revision. Saved-investigation changes are disabled.', 503);
    }
    const length = response.headers.get('content-length');
    const value = await readSavedJson(response.body, length === null ? undefined : Number(length));
    return { collection: validateSavedInvestigationCollection(value, ownerSubject, tenantId), generation };
  }
  async compareAndSwap(ownerSubject: string, tenantId: string, generation: string, collection: SavedInvestigationCollection): Promise<boolean> {
    const name = savedInvestigationObjectName(ownerSubject, tenantId);
    const validated = validateSavedInvestigationCollection(collection, ownerSubject, tenantId);
    if (!/^\d+$/.test(generation)) throw new SavedAnalysisError('SAVED_STORAGE_GENERATION', 'Invalid storage revision.', 503);
    await this.assertPrivate();
    const query = new URLSearchParams({ uploadType: 'media', name, ifGenerationMatch: generation });
    // Multipart metadata keeps the object private/no-store even for separately authorised direct reads.
    const boundary = 'cx_saved_investigation_boundary';
    const metadata = JSON.stringify({ name, contentType: 'application/json; charset=utf-8', cacheControl: 'private, no-store' });
    query.set('uploadType', 'multipart');
    const body = `--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${JSON.stringify(validated)}\r\n--${boundary}--\r\n`;
    const response = await this.request(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(this.bucket)}/o?${query}`, {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
    });
    if (response.status === 412) { await response.body?.cancel(); return false; }
    if (!response.ok) return storageFailure(response);
    await response.body?.cancel();
    return true;
  }
}
