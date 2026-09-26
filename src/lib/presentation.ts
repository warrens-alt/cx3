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
/** Preserve legacy report filters when moving between legacy pages; evidence scope remains separate. */
export function navigationTarget(target: string, currentPath: string, search: string) {
  const [targetPath, targetQuery] = target.split('?');
  const targetParams = new URLSearchParams(targetQuery || '');

  if (targetPath !== '/reports' && currentPath !== '/reports') {
    if (targetQuery !== undefined) {
      return { pathname: targetPath, search: targetParams.toString() ? '?' + targetParams.toString() : '' };
    }
    return { pathname: targetPath, search: search || '' };
  }

  const workspace = new URLSearchParams();
  const currentParams = new URLSearchParams(search);
  const clientId = currentParams.get('clientId');
  if (clientId) workspace.set('clientId', clientId);
  // Preserve repeated invalid values so navigation does not silently broaden their scope.
  for (const id of currentParams.getAll('workspace')) workspace.append('workspace', id);
  for (const [k, v] of targetParams.entries()) {
    workspace.set(k, v);
  }
  return { pathname: targetPath, search: workspace.size ? '?' + workspace.toString() : '' };
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
