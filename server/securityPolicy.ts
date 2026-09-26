import { RequestError } from './bigquery/filters';
export interface AccessGrant { tenants: string[]; role: 'viewer' | 'admin'; }
export interface Principal extends AccessGrant { subject: string; email: string; }
export interface IdentityClaims { sub?: string; email?: string; hd?: string; }
/** Policies contain identity/permission configuration, never credentials. No wildcard tenant grants. */
export function resolvePrincipal(claims: IdentityClaims | undefined, policyText: string | undefined): Principal {
  if (!policyText) throw new RequestError('Access policy is not configured', 503);
  let policy: Record<string, AccessGrant>;
  try { policy = JSON.parse(policyText); } catch { throw new RequestError('Access policy is invalid', 503); }
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new RequestError('Access policy is invalid', 503);
  if (!claims?.sub || !claims.email || !/^[^@\s]+@[^@\s]+$/.test(claims.email)) throw new RequestError('Verified identity is required', 401);
  const email = claims.email.toLowerCase();
  const domain = email.split('@')[1];
  // Domain grants require Google's hosted-domain claim, not just an email suffix.
  const domainKey = claims.hd?.toLowerCase() === domain ? `@${domain}` : '';
  const grant = Object.hasOwn(policy, email) ? policy[email] : (domainKey && Object.hasOwn(policy, domainKey) ? policy[domainKey] : undefined);
  if (!grant) throw new RequestError('This account is not authorised', 403);
  if (!['viewer', 'admin'].includes(grant.role) || !Array.isArray(grant.tenants) || !grant.tenants.length || grant.tenants.some(t => typeof t !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(t))) throw new RequestError('Access policy is invalid', 503);
  return { subject: claims.sub, email, tenants: [...grant.tenants], role: grant.role };
}
export function requireTenant(principal: Principal, tenantId: string): void {
  if (!principal.tenants.includes(tenantId)) throw new RequestError('Tenant access denied', 403);
}
