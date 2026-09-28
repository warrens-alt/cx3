import { invalidateOffernetCache } from './offernet/cache';

export interface AnalyticalAccessIdentity {
  uid: string | null;
  role: string | null;
  status: string | null;
  allowedTenants: string[];
  isAdmin: boolean;
  isActive: boolean;
}

export interface SessionChangeListener {
  (newSessionKey: string, oldSessionKey: string, generation: number): void;
}

// React Query client reference registered on bootstrap
let registeredQueryClient: { cancelQueries: () => Promise<void>; clear: () => void } | null = null;

export function registerQueryClientForSessionIsolation(client: { cancelQueries: () => Promise<void>; clear: () => void }) {
  registeredQueryClient = client;
}

export function computeAnalyticalSessionKey(access: AnalyticalAccessIdentity | null | undefined): string {
  if (!access || !access.uid || !access.isActive) {
    return 'unauthenticated';
  }
  const role = access.isAdmin ? 'admin' : (access.role || 'viewer');
  const tenants = [...access.allowedTenants].sort().join(',');
  const adminFlag = access.isAdmin ? '1' : '0';
  return `u:${access.uid}:r:${role}:t:${tenants}:a:${adminFlag}`;
}

let activeSessionKey = 'unauthenticated';
let activeSessionGeneration = 0;
const listeners = new Set<SessionChangeListener>();

export function getAnalyticalSessionKey(): string {
  return activeSessionKey;
}

export function getAnalyticalSessionGeneration(): number {
  return activeSessionGeneration;
}

export function subscribeToAnalyticalSession(listener: SessionChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Updates the analytical session boundary.
 *
 * If effective access has materially changed (e.g. user switch, logout, role change,
 * status change, or tenant entitlement change):
 * 1. Cancels all outstanding React Query analytical requests.
 * 2. Clears all React Query analytical cache entries.
 * 3. Invalidates Offernet cache and aborts in-flight shared requests.
 * 4. Bumps session generation to prevent any late-resolving requests from writing to cache.
 * 5. Notifies subscribers.
 *
 * Routine updates (like lastLoginAt or token refresh) that do not change effective access
 * do not bump generation or clear caches.
 */
export function updateAnalyticalSession(access: AnalyticalAccessIdentity | null | undefined): boolean {
  const newKey = computeAnalyticalSessionKey(access);
  if (newKey === activeSessionKey) {
    return false;
  }

  const oldKey = activeSessionKey;
  activeSessionKey = newKey;
  activeSessionGeneration++;

  // 1. Invalidate Offernet cache and abort in-flight requests
  try {
    invalidateOffernetCache();
  } catch (err) {
    console.warn('Failed to invalidate offernet cache on session change:', err);
  }

  // 2. Cancel and clear React Query client
  if (registeredQueryClient) {
    try {
      void registeredQueryClient.cancelQueries();
      registeredQueryClient.clear();
    } catch (err) {
      console.warn('Failed to clear query client on session change:', err);
    }
  }

  // 3. Notify listeners
  for (const listener of listeners) {
    try {
      listener(newKey, oldKey, activeSessionGeneration);
    } catch (err) {
      console.warn('Error in analytical session listener:', err);
    }
  }

  return true;
}

/** Reset session state (primarily for test environments). */
export function _resetAnalyticalSessionForTesting() {
  activeSessionKey = 'unauthenticated';
  activeSessionGeneration = 0;
  listeners.clear();
}
