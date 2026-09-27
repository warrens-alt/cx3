import firebaseConfig from '../firebase-applet-config.json';
import { RequestError } from './bigquery/filters';
import { getAllClients } from './bigquery/config';
import type { Principal } from './securityPolicy';

interface FirebaseClaims {
  sub?: string;
  user_id?: string;
  email?: string;
  email_verified?: boolean;
  exp?: number;
}

interface FirestoreValue {
  stringValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
}

interface FirestoreDocument {
  fields?: Record<string, FirestoreValue>;
}

function decodeClaims(token: string): FirebaseClaims {
  const parts = token.split('.');
  if (parts.length !== 3 || token.length > 16000) throw new RequestError('Invalid Firebase identity', 401);
  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as FirebaseClaims;
    const uid = claims.sub || claims.user_id;
    if (!uid || uid.length > 128 || !claims.email || claims.email_verified !== true) {
      throw new Error('required claims missing');
    }
    if (typeof claims.exp === 'number' && Number.isFinite(claims.exp) && claims.exp * 1000 <= Date.now()) {
      throw new RequestError('Firebase identity token has expired', 401);
    }
    return claims;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError('Invalid Firebase identity', 401);
  }
}

async function readFirestoreDocument(path: string, token: string): Promise<FirestoreDocument | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/${encodeURIComponent(firebaseConfig.firestoreDatabaseId)}/documents/${path}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new RequestError(response.status === 401 || response.status === 403
      ? 'Firebase identity could not be verified'
      : 'Firebase access profile could not be loaded', response.status === 401 || response.status === 403 ? 401 : 503);
  }
  return await response.json() as FirestoreDocument;
}

const stringField = (doc: FirestoreDocument, name: string) => doc.fields?.[name]?.stringValue || '';
const stringArrayField = (doc: FirestoreDocument, name: string) =>
  (doc.fields?.[name]?.arrayValue?.values || []).map(value => value.stringValue || '').filter(Boolean);

const MAX_PRINCIPAL_CACHE_SIZE = 500;
const PRINCIPAL_CACHE_TTL_MS = 10_000;
const principalCache = new Map<string, { principal: Principal; expiresAt: number }>();
const inFlightPrincipals = new Map<string, Promise<Principal>>();

function prunePrincipalCache(now = Date.now()) {
  for (const [key, entry] of principalCache.entries()) {
    if (now >= entry.expiresAt) {
      principalCache.delete(key);
    }
  }
  while (principalCache.size >= MAX_PRINCIPAL_CACHE_SIZE) {
    const oldestKey = principalCache.keys().next().value;
    if (oldestKey !== undefined) {
      principalCache.delete(oldestKey);
    } else {
      break;
    }
  }
}

/**
 * Resolve a Firebase-authenticated analytical principal.
 *
 * The decoded JWT payload is used only to select the caller's own Firestore profile
 * path. Firestore independently validates the bearer token and applies the deployed
 * security rules before returning that profile. A decoded claim alone never grants
 * analytical access.
 */
export async function resolveFirebasePrincipal(token: string): Promise<Principal> {
  const now = Date.now();
  const cached = principalCache.get(token);
  if (cached) {
    if (now < cached.expiresAt) {
      return cached.principal;
    }
    principalCache.delete(token);
  }
  const inFlight = inFlightPrincipals.get(token);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      const claims = decodeClaims(token);
      const uid = claims.sub || claims.user_id!;
      const email = claims.email!.toLowerCase();

      const profile = await readFirestoreDocument(`users/${encodeURIComponent(uid)}`, token);
      if (!profile) throw new RequestError('No Firebase access profile exists for this account', 403);

      const profileUid = stringField(profile, 'uid');
      const profileEmail = stringField(profile, 'email').toLowerCase();
      const status = stringField(profile, 'status');
      const profileRole = stringField(profile, 'role');
      if (profileUid !== uid || profileEmail !== email || status !== 'active') {
        throw new RequestError('This Firebase account is not active for workspace access', 403);
      }

      const allTenantIds = getAllClients().map(client => client.id);
      let role: 'viewer' | 'admin' = 'viewer';
      let tenants: string[];

      if (profileRole === 'admin') {
        const marker = await readFirestoreDocument(`admins/${encodeURIComponent(uid)}`, token);
        if (!marker || stringField(marker, 'uid') !== uid || stringField(marker, 'email').toLowerCase() !== email) {
          throw new RequestError('Administrator authority marker is missing', 403);
        }
        role = 'admin';
        tenants = allTenantIds;
      } else if (profileRole === 'analyst' || profileRole === 'viewer') {
        const allowed = new Set(stringArrayField(profile, 'allowedTenants'));
        tenants = allTenantIds.filter(id => allowed.has(id));
      } else {
        throw new RequestError('Unsupported Firebase workspace role', 403);
      }

      if (!tenants.length) throw new RequestError('This account has no authorised workspaces', 403);
      const principal: Principal = { subject: uid, email, tenants, role };
      const tokenExpMs = typeof claims.exp === 'number' && Number.isFinite(claims.exp) ? claims.exp * 1000 : Infinity;
      const expiresAt = Math.min(Date.now() + PRINCIPAL_CACHE_TTL_MS, tokenExpMs);
      if (expiresAt > Date.now()) {
        prunePrincipalCache();
        principalCache.set(token, { principal, expiresAt });
      }
      return principal;
    } finally {
      inFlightPrincipals.delete(token);
    }
  })();

  inFlightPrincipals.set(token, promise);
  return promise;
}

export function _resetPrincipalCacheForTesting() {
  principalCache.clear();
  inFlightPrincipals.clear();
}

export function _getPrincipalCacheSizeForTesting(): number {
  return principalCache.size;
}

/** Backwards-compatible name retained for Preview tests and older imports. */
export const resolveFirebasePreviewPrincipal = resolveFirebasePrincipal;
