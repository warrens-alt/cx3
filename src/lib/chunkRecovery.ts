export const CHUNK_RELOAD_STORAGE_KEY = 'cx_chunk_reload';
export const CHUNK_RELOAD_GUARD_MS = 8000;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === 'string') {
    return isChunkErrorMessage(error);
  }
  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if (err.name === 'ChunkLoadError') return true;
    if (typeof err.message === 'string' && isChunkErrorMessage(err.message)) {
      return true;
    }
  }
  return false;
}

function isChunkErrorMessage(msg: string): boolean {
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('Failed to fetch') ||
    msg.includes('Loading chunk') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Unable to preload CSS')
  );
}

export function attemptChunkRecovery(
  guardMs: number = CHUNK_RELOAD_GUARD_MS,
  storage: Storage | null = typeof window !== 'undefined' ? window.sessionStorage : null,
  reloadFn: () => void = () => { if (typeof window !== 'undefined') window.location.reload(); }
): boolean {
  if (!storage) return false;
  try {
    const lastReload = Number(storage.getItem(CHUNK_RELOAD_STORAGE_KEY) || 0);
    const now = Date.now();
    if (now - lastReload > guardMs) {
      storage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
      reloadFn();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function registerVitePreloadRecovery(
  guardMs: number = CHUNK_RELOAD_GUARD_MS,
  target: EventTarget | null = typeof window !== 'undefined' ? window : null
): () => void {
  if (!target) return () => {};

  const listener = (event: Event) => {
    event.preventDefault();
    attemptChunkRecovery(guardMs);
  };

  target.addEventListener('vite:preloadError', listener);
  return () => {
    target.removeEventListener('vite:preloadError', listener);
  };
}

export function safeImport<T>(importFn: () => Promise<T>): Promise<T> {
  return importFn().catch((error) => {
    if (isChunkLoadError(error)) {
      attemptChunkRecovery();
    }
    throw error;
  });
}
