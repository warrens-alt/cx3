export interface AssetBinding { fetch(request: Request): Promise<Response> }
/** Every /api request reaches Express, never the SPA fallback or an R2 object URL. */
export async function routeCloudflareRequest(
  request: Request, api: (request: Request) => Promise<Response>, assets?: AssetBinding,
): Promise<Response> {
  let path: string;
  try { path = decodeURIComponent(new URL(request.url).pathname); }
  catch { return new Response('Invalid request path', { status: 400 }); }
  if (/^\/api(?:\/|$)/i.test(path)) return api(request);
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  if (!assets) return new Response('Frontend assets are not configured', { status: 503 });
  return assets.fetch(request);
}
