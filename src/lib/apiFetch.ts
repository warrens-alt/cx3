import { auth } from './firebase';
import { createApiTransport, localApiUrl, type FetchLike } from './apiTransport';
type TokenProvider = () => Promise<string | null>;

export function authenticatedApiFetch(baseFetch: FetchLike, tokenProvider: TokenProvider): FetchLike {
  const transport = createApiTransport(baseFetch);
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!localApiUrl(input)) return baseFetch(input, init);
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    if (!headers.has('Authorization')) {
      const token = await tokenProvider().catch(() => null);
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }
    return transport(input, { ...init, headers });
  }) as FetchLike;
}
let installed = false;
export function _resetInstalledForTesting() { installed = false; }

/** Only same-origin APIs receive credentials. Identity mode remains server-selected.
 * Requests share in-flight work only after their full Authorization header is known.
 */
export function installAuthenticatedApiFetch() {
  if (installed || typeof globalThis.fetch !== 'function') return;
  const baseFetch = globalThis.fetch.bind(globalThis) as FetchLike;
  const authFetch = authenticatedApiFetch(baseFetch, async () => {
    const user = auth.currentUser;
    return user ? await user.getIdToken() : null;
  });
  try { globalThis.fetch = authFetch; installed = true; return; } catch { /* getter-only host */ }
  try {
    Object.defineProperty(globalThis, 'fetch', { value: authFetch, writable: true, configurable: true, enumerable: true });
    installed = true; return;
  } catch { console.warn('Authenticated API transport could not be installed on this host.'); }
  if (typeof window !== 'undefined' && (window as unknown) !== (globalThis as unknown)) {
    try {
      Object.defineProperty(window, 'fetch', { value: authFetch, writable: true, configurable: true, enumerable: true });
      installed = true;
    } catch { /* Backend still rejects unauthenticated requests. */ }
  }
}
