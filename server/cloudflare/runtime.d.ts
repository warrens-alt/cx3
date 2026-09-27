/** Narrow runtime declarations for the two Cloudflare built-ins used by this entry point.
 * Wrangler also validates these imports when bundling the Worker.
 */
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}
declare module 'cloudflare:node' {
  export function httpServerHandler(options: { port: number }): {
    fetch(request: Request): Promise<Response>;
  };
}
