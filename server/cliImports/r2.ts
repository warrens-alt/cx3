import {
  CliArchiveError, cliTenantObjectName, validateCliArchive, MAX_CLI_ARCHIVE_BYTES,
  type CliArchive, type CliArchiveBackend,
} from './archive';

/** Structural subset of the native R2 binding; no S3 token or Google credential is used. */
export interface CliR2Object { etag: string; size: number; body: ReadableStream<Uint8Array> }
export interface CliR2Bucket {
  get(key: string): Promise<CliR2Object | null>;
  put(key: string, body: string, options: {
    onlyIf: Headers;
    httpMetadata: { contentType: string; cacheControl: string };
  }): Promise<{ etag: string } | null>;
}
export interface CliR2Environment {
  CLI_REPORTS?: CliR2Bucket;
  CX_CLI_STORAGE_PROVIDER?: string;
  CX_CLI_R2_PRIVATE_CONFIRMED?: string;
}

/** Explicitly select R2. A missing binding must never silently fall back to GCS or memory. */
export function configuredR2CliArchive(env: CliR2Environment): CliArchiveBackend {
  if (env.CX_CLI_STORAGE_PROVIDER !== 'r2') {
    throw new CliArchiveError('CLI_R2_CONFIGURATION', 'Set CX_CLI_STORAGE_PROVIDER=r2 for the Cloudflare archive.', 503);
  }
  if (!env.CLI_REPORTS || typeof env.CLI_REPORTS.get !== 'function' || typeof env.CLI_REPORTS.put !== 'function') {
    throw new CliArchiveError('CLI_R2_BINDING_MISSING', 'Bind an approved private R2 bucket as CLI_REPORTS on this Worker.', 503);
  }
  if (env.CX_CLI_R2_PRIVATE_CONFIRMED !== 'true') {
    throw new CliArchiveError('CLI_R2_PRIVACY_UNCONFIRMED', 'Disable public bucket URLs and custom domains, then set CX_CLI_R2_PRIVATE_CONFIRMED=true. No report was saved.', 503);
  }
  // This is owner confirmation, not a Cloudflare account-policy inspection. See deployment guide.
  return new R2CliArchiveBackend(env.CLI_REPORTS);
}

function validEtag(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\x00-\x20\x7f"\\]/.test(value);
}
function storageError(): CliArchiveError {
  return new CliArchiveError('CLI_R2_UNAVAILABLE', 'R2 archive access failed. Check the Worker binding; existing reports were not replaced.', 503);
}
async function boundedObject(object: CliR2Object): Promise<unknown> {
  if (!Number.isSafeInteger(object.size) || object.size < 0 || object.size > MAX_CLI_ARCHIVE_BYTES) {
    await object.body.cancel().catch(() => {});
    throw new CliArchiveError('CLI_ARCHIVE_TOO_LARGE', 'The R2 archive exceeds the safe read limit.', 503);
  }
  const reader = object.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CLI_ARCHIVE_BYTES) {
        await reader.cancel();
        throw new CliArchiveError('CLI_ARCHIVE_TOO_LARGE', 'The R2 archive exceeds the safe read limit.', 503);
      }
      parts.push(value);
    }
    if (size !== object.size) throw storageError();
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof CliArchiveError) throw error;
    throw new CliArchiveError('CLI_ARCHIVE_INVALID', 'R2 returned invalid archive data. No reports were changed.', 503);
  } finally { reader.releaseLock(); }
}

/** Conditional ETag writes preserve the existing archive's cross-instance retry semantics. */
export class R2CliArchiveBackend implements CliArchiveBackend {
  constructor(private readonly bucket: CliR2Bucket) {}

  async read(tenantId: string): Promise<{ archive: CliArchive | null; generation: string }> {
    const key = cliTenantObjectName(tenantId);
    let object: CliR2Object | null;
    try { object = await this.bucket.get(key); } catch { throw storageError(); }
    if (object === null) return { archive: null, generation: '0' };
    if (!object?.body || !validEtag(object.etag)) {
      await object?.body?.cancel().catch(() => {});
      throw new CliArchiveError('CLI_R2_ETAG', 'R2 returned no valid ETag. Unsafe archive writes are disabled.', 503);
    }
    return { archive: validateCliArchive(await boundedObject(object), tenantId), generation: `r2:${object.etag}` };
  }

  async compareAndSwap(tenantId: string, generation: string, archive: CliArchive): Promise<boolean> {
    const key = cliTenantObjectName(tenantId);
    validateCliArchive(archive, tenantId);
    const condition = new Headers();
    if (generation === '0') condition.set('If-None-Match', '*');
    else if (generation.startsWith('r2:') && validEtag(generation.slice(3))) {
      condition.set('If-Match', `"${generation.slice(3)}"`);
    } else throw new CliArchiveError('CLI_R2_ETAG', 'Invalid R2 archive revision. Unsafe writes are disabled.', 503);
    try {
      const result = await this.bucket.put(key, JSON.stringify(archive), {
        onlyIf: condition,
        httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'private, no-store' },
      });
      // Native R2 returns null when the conditional write loses a race. Never retry unconditionally.
      if (result === null) return false;
      if (!validEtag(result?.etag)) throw storageError();
      return true;
    } catch { throw storageError(); }
  }
}
