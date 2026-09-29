import { pathToFileURL } from 'node:url';

/** Read-only fetch checks, not browser navigations (which may intentionally use SPA fallback).
 * No token, login, customer records or cloud permissions are requested. */
export async function checkDeployment(input, fetcher = globalThis.fetch) {
  const origin = new URL(input);
  if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
    throw new Error('Provide the exact application origin only, without credentials, a path or query.');
  }
  const results = [];
  for (const path of ['/api/health', '/api/analytics/clients']) {
    const response = await fetcher(new URL(path, origin), { method: 'GET', headers: { Accept: 'application/json' }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000) });
    const contentType = response.headers.get('content-type') || '';
    let body;
    try { body = await response.json(); } catch { /* Do not log HTML or sensitive bodies. */ }
    const json = contentType.toLowerCase().includes('json') && body && typeof body === 'object' && !Array.isArray(body);
    const passed = Boolean(json && (path === '/api/health'
      ? response.status === 200 && body.status === 'ok' && body.service === 'ConversionX'
      : [401, 403].includes(response.status)));
    results.push({ path, status: response.status, contentType, passed,
      meaning: passed ? path === '/api/health' ? 'API liveness only; warehouse not checked.' : 'Anonymous analytical access rejected.'
        : 'Unexpected API response. Check backend deployment, API routing and authentication; no source data was tested.' });
  }
  return { origin: origin.origin, passed: results.every(r => r.passed), warehouseVerified: false, results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node scripts/check-deployment.mjs https://your-exact-app-host');
    const result = await checkDeployment(process.argv[2]);
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
