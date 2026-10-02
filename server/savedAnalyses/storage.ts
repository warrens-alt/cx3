import { MAX_SAVED_COLLECTION_BYTES, SavedAnalysisError } from './repository';

/** Shared by saved-definition providers; enforce actual streamed bytes as well as declared size. */
export async function readSavedJson(body: ReadableStream<Uint8Array> | null, declaredSize?: number, exactSize = false): Promise<unknown> {
  if (declaredSize !== undefined && (!Number.isSafeInteger(declaredSize) || declaredSize < 0 || declaredSize > MAX_SAVED_COLLECTION_BYTES)) {
    await body?.cancel().catch(() => {});
    throw new SavedAnalysisError('SAVED_COLLECTION_TOO_LARGE', 'Saved investigations exceed the safe read limit.', 503);
  }
  if (!body) throw new SavedAnalysisError('SAVED_STORAGE_RESPONSE', 'Storage returned no saved-investigation data.', 503);
  const reader = body.getReader();
  try {
    const parts: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_SAVED_COLLECTION_BYTES) {
        await reader.cancel();
        throw new SavedAnalysisError('SAVED_COLLECTION_TOO_LARGE', 'Saved investigations exceed the safe read limit.', 503);
      }
      parts.push(value);
    }
    if (exactSize && length !== declaredSize) throw new Error();
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof SavedAnalysisError) throw error;
    throw new SavedAnalysisError('SAVED_STORAGE_RESPONSE', 'Storage returned invalid saved-investigation data. No definitions were changed.', 503);
  } finally { reader.releaseLock(); }
}
