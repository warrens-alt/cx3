import type { Request } from 'express';
import { getClientConfig } from './bigquery/config';
import { RequestError, scalarString } from './bigquery/filters';

/** A tenant selector never grants access. The router still checks the principal. */
export function analyticsRequestTenant(req: Request): string {
  const selectors: unknown[] = [req.query.clientId, req.get('X-Client-Id')];
  if (!['GET', 'DELETE'].includes(req.method)) selectors.push(req.body?.clientId);
  const tenants = selectors.flatMap(value => {
    const text = scalarString(value, 'clientId', 80);
    if (text === undefined) return [];
    if (!/^[a-zA-Z0-9_-]+$/.test(text)) throw new RequestError('Invalid clientId');
    return [getClientConfig(text).id];
  });
  if (new Set(tenants).size > 1) throw new RequestError('Conflicting clientId selectors in query, body or X-Client-Id header');
  return tenants[0] || 'default_tenant';
}
