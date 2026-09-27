import { GoogleAuth } from 'google-auth-library';
import {
  CliArchiveError, cliTenantObjectName, validateCliArchive, MAX_CLI_ARCHIVE_BYTES,
  type CliArchive, type CliArchiveBackend,
} from './archive';

type AuthorizedFetch = (url: string, init?: RequestInit) => Promise<Response>;
/** Explicit, server-only configuration; never borrows BIGQUERY_CREDENTIALS. */
export function configuredCliArchive(): CliArchiveBackend | null {
  const bucket = process.env.CX_CLI_IMPORT_BUCKET?.trim();
  if (!bucket) return null;
  if (!/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucket)) {
    throw new CliArchiveError('CLI_STORAGE_CONFIGURATION', 'The CLI archive bucket configuration is invalid.', 503);
  }
  let credentials;
  try {
    const raw = process.env.CX_CLI_IMPORT_CREDENTIALS;
    if (raw) {
      credentials = JSON.parse(raw);
      if (credentials?.type !== 'service_account' || typeof credentials.client_email !== 'string'
        || typeof credentials.private_key !== 'string') throw new Error('Invalid credentials');
    }
  } catch { throw new CliArchiveError('CLI_STORAGE_CONFIGURATION', 'The server-only CLI archive credential configuration is invalid.', 503); }
  const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/devstorage.read_write'] });
  const authorizedFetch: AuthorizedFetch = async (url, init = {}) => {
    try {
      const token = await auth.getAccessToken();
      if (!token) throw new Error('Missing token');
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      return await fetch(url, { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
    } catch { throw new CliArchiveError('CLI_STORAGE_UNAVAILABLE', 'Private CLI storage could not be reached or authenticated. No memory-only import was accepted.', 503); }
  };
  return new GcsCliArchiveBackend(bucket, authorizedFetch);
}
async function boundedJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get('content-length') || 0) > MAX_CLI_ARCHIVE_BYTES) {
    await response.body?.cancel();
    throw new CliArchiveError('CLI_ARCHIVE_TOO_LARGE', 'The stored CLI archive exceeds its safe read limit.', 503);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new CliArchiveError('CLI_STORAGE_RESPONSE', 'Private CLI storage returned an empty response.', 503);
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CLI_ARCHIVE_BYTES) {
        await reader.cancel();
        throw new CliArchiveError('CLI_ARCHIVE_TOO_LARGE', 'The stored CLI archive exceeds its safe read limit.', 503);
      }
      parts.push(value);
    }
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  } catch (error) {
    if (error instanceof CliArchiveError) throw error;
    throw new CliArchiveError('CLI_STORAGE_RESPONSE', 'Private CLI storage returned invalid archive data.', 503);
  } finally { reader.releaseLock(); }
}
async function storageFailure(response: Response): Promise<never> {
  await response.body?.cancel();
  throw new CliArchiveError('CLI_STORAGE_ACCESS', 'Private CLI storage access failed. Verify the dedicated bucket and service identity; existing reports were not replaced.', 503);
}
/** Whole-tenant atomic snapshots: concurrent instances cannot silently overwrite each other. */
export class GcsCliArchiveBackend implements CliArchiveBackend {
  private readonly base: string;
  constructor(private readonly bucket: string, private readonly request: AuthorizedFetch) {
    this.base = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}`;
  }
  private async assertPrivate(): Promise<void> {
    const response = await this.request(`${this.base}?fields=iamConfiguration`);
    if (!response.ok) return storageFailure(response);
    const metadata = await boundedJson(response) as { iamConfiguration?: {
      uniformBucketLevelAccess?: { enabled?: boolean }; publicAccessPrevention?: string;
    } };
    if (metadata?.iamConfiguration?.uniformBucketLevelAccess?.enabled !== true
      || metadata.iamConfiguration.publicAccessPrevention !== 'enforced') {
      throw new CliArchiveError('CLI_STORAGE_NOT_PRIVATE', 'CLI storage requires uniform bucket-level access and explicitly enforced public access prevention. No storage permissions were changed.', 503);
    }
  }
  async read(tenantId: string): Promise<{ archive: CliArchive | null; generation: string }> {
    const name = cliTenantObjectName(tenantId);
    await this.assertPrivate();
    const response = await this.request(`${this.base}/o/${encodeURIComponent(name)}?alt=media`, { cache: 'no-store' });
    if (response.status === 404) { await response.body?.cancel(); return { archive: null, generation: '0' }; }
    if (!response.ok) return storageFailure(response);
    const generation = response.headers.get('x-goog-generation');
    if (!generation || !/^\d+$/.test(generation)) {
      await response.body?.cancel();
      throw new CliArchiveError('CLI_STORAGE_GENERATION', 'Storage did not return an object generation. Unsafe archive writes are disabled.', 503);
    }
    return { archive: validateCliArchive(await boundedJson(response), tenantId), generation };
  }
  async compareAndSwap(tenantId: string, generation: string, archive: CliArchive): Promise<boolean> {
    const name = cliTenantObjectName(tenantId);
    validateCliArchive(archive, tenantId);
    if (!/^\d+$/.test(generation)) throw new CliArchiveError('CLI_STORAGE_GENERATION', 'Invalid archive generation.', 503);
    await this.assertPrivate();
    const query = new URLSearchParams({ uploadType: 'media', name, ifGenerationMatch: generation });
    const response = await this.request(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(this.bucket)}/o?${query}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(archive),
    });
    if (response.status === 412) { await response.body?.cancel(); return false; }
    if (!response.ok) return storageFailure(response);
    await response.body?.cancel();
    return true;
  }
}
