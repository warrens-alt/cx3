import { buildPreservedDestination, UNIVERSAL_SCOPE_PARAMS, SETTINGS_SCOPE_PARAMS, RELEASE_SCOPE_PARAMS } from '../app/navigation/ScopePreservingRedirect';
export type TableDensity = 'comfortable' | 'compact';
export const DENSITY_KEY = 'cx.presentation.density.v1';
export function safeDensity(value: unknown): TableDensity { return value === 'compact' ? 'compact' : 'comfortable'; }
export function isCurrentPage(pathname: string, path: string, currentSearch?: string): boolean {
  const [targetPath, targetQuery] = path.split('?');
  const matchesPath = pathname === targetPath || 
    (pathname === '/' && targetPath === '/overview') || 
    (pathname === '/overview' && targetPath === '/') || 
    (targetPath !== '/' && pathname.startsWith(targetPath + '/'));
  if (!matchesPath) return false;
  if (targetQuery) {
    if (!currentSearch) return false;
    const targetParams = new URLSearchParams(targetQuery);
    const currentParams = new URLSearchParams(currentSearch);
    for (const [k, v] of targetParams.entries()) {
      if (currentParams.get(k) !== v) return false;
    }
    return true;
  }
  return true;
}
/** Carry reporting scope according to the existing destination policy. Local view state belongs to its page. */
export function navigationTarget(target: string, currentPath: string, search: string) {
  const targetPath = target.split('?')[0];
  const current = new URLSearchParams(search);
  const sourceIsRelease = currentPath === '/reports' || currentPath === '/vendors';
  const targetIsRelease = targetPath === '/reports' || targetPath === '/vendors';
  const allowed = sourceIsRelease && !targetIsRelease ? SETTINGS_SCOPE_PARAMS
    : sourceIsRelease && targetIsRelease ? RELEASE_SCOPE_PARAMS
    : UNIVERSAL_SCOPE_PARAMS;
  // Keep repeated scope parameters intact; only explicit destination parameters replace them.
  const scope = new URLSearchParams();
  for (const [key, value] of current) if (allowed.has(key)) scope.append(key, value);
  const destination = buildPreservedDestination(target, scope.toString());
  const [pathname, query] = destination.split('?');
  return { pathname, search: query ? `?${query}` : '' };
}
export function utcDatePresets(now = new Date()) {
  const end = now.toISOString().slice(0,10);
  const previousMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return [
    { id:'last7', label:'Last 7 days (UTC)', start:new Date(Date.parse(end)-6*86400000).toISOString().slice(0,10), end },
    { id:'last30', label:'Last 30 days (UTC)', start:new Date(Date.parse(end)-29*86400000).toISOString().slice(0,10), end },
    { id:'month', label:'This month to date (UTC)', start:end.slice(0,7)+'-01', end },
    { id:'previous', label:'Previous calendar month (UTC)', start:previousMonthEnd.toISOString().slice(0,7)+'-01', end:previousMonthEnd.toISOString().slice(0,10) },
  ];
}
