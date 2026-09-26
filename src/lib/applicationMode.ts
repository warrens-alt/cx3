export const DEMO_ENTRY_URL = '/?mode=demo';

export function applicationMode(search: string = ''): 'live' | 'demo' {
  if (typeof search !== 'string') return 'live';
  const query = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  const mode = params.get('mode');
  const demo = params.get('demo');
  if (mode === 'demo' || demo === 'true' || demo === '1') {
    return 'demo';
  }
  return 'live';
}
