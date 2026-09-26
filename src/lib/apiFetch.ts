import { auth } from './firebase';

type FetchLike = typeof globalThis.fetch;
type TokenProvider = () => Promise<string | null>;

function apiRequest(input: RequestInfo | URL): boolean {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (raw.startsWith('/api/')) return true;
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export function authenticatedApiFetch(baseFetch: FetchLike, tokenProvider: TokenProvider): FetchLike {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!apiRequest(input)) return baseFetch(input, init);

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));

    if (!headers.has('Authorization')) {
      const token = await tokenProvider().catch(() => null);
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }

    return baseFetch(input, { ...init, headers });
  }) as FetchLike;
}

let installed = false;

export function _resetInstalledForTesting() {
  installed = false;
}

/** Install once before React mounts so every same-origin /api request receives
 * the signed-in Firebase token. Production IAP still remains authoritative on
 * the server; the bearer token is consumed only by non-production Preview. */
export function installAuthenticatedApiFetch() {
  if (installed || typeof globalThis.fetch !== 'function') return;
  const baseFetch = globalThis.fetch.bind(globalThis) as FetchLike;
  const authFetch = authenticatedApiFetch(baseFetch, async () => {
    const user = auth.currentUser;
    return user ? await user.getIdToken() : null;
  });

  try {
    globalThis.fetch = authFetch;
    installed = true;
    return;
  } catch {
    // In browser environments where Window.prototype.fetch has only a getter,
    // direct assignment throws "TypeError: Cannot set property fetch of #<Window> which has only a getter".
  }

  try {
    Object.defineProperty(globalThis, 'fetch', {
      value: authFetch,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    installed = true;
    return;
  } catch (err) {
    // Non-fatal fallback if environment prevents redefining fetch
    console.warn('Unable to redefine global fetch with authenticated wrapper:', err);
  }

  if (typeof window !== 'undefined' && (window as unknown) !== (globalThis as unknown)) {
    try {
      Object.defineProperty(window, 'fetch', {
        value: authFetch,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      installed = true;
    } catch {
      // Non-fatal fallback
    }
  }
}
