import { scopedViewPath } from '../../shared/evidence/auditPresentation';

export interface WarehouseObjectIdentity { project: string; dataset: string; tableName: string }

/** A source name is navigable only when it supplies all three exact identifier parts. */
export function parseWarehouseSource(source: string | null | undefined): WarehouseObjectIdentity | null {
  if (!source || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(source)) return null;
  const [project, dataset, tableName] = source.split('.');
  return { project, dataset, tableName };
}

export function warehouseSchemaPath(source: string | null | undefined, clientId: string, analysisPath: string): string | null {
  const identity = parseWarehouseSource(source);
  if (!identity) return null;
  const params = new URLSearchParams({ clientId, tab: 'tables', project: identity.project, dataset: identity.dataset, table: identity.tableName });
  const back = warehouseAnalysisReturn(analysisPath);
  if (back) params.set('analysisReturn', back);
  return `/warehouse?${params}`;
}

/** Return navigation is presentation only, restricted to the originating analysis route. */
export function warehouseAnalysisReturn(value: string | null): string | null {
  if (!value || !value.startsWith('/data-integrity') || value.startsWith('//')) return null;
  const parsed = new URL(value, 'https://audit.invalid');
  if (parsed.origin !== 'https://audit.invalid' || parsed.pathname !== '/data-integrity') return null;
  return scopedViewPath(parsed.pathname, parsed.search);
}

export function matchesWarehouseObject(object: WarehouseObjectIdentity, target: WarehouseObjectIdentity): boolean {
  return object.project === target.project && object.dataset === target.dataset && object.tableName === target.tableName;
}
