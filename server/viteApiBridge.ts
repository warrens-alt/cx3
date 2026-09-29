import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

type Next = (error?: unknown) => void;
type ApiHandler = (req: IncomingMessage, res: ServerResponse, next: Next) => void;
type ApiFactory = () => Promise<ApiHandler>;

export function isApiRequest(url: string | undefined): boolean {
  return /^\/api(?:\/|\?|$)/i.test(url || '');
}

async function createApi(): Promise<ApiHandler> {
  const [{ default: express }, { mountApi }] = await Promise.all([
    import('express'), import('./apiApp'),
  ]);
  const app = express();
  await mountApi(app);
  return app as ApiHandler;
}

/** One API instance per host preserves shared guards across concurrent requests.
 * Initialisation failures never fall through to Vite's HTML error overlay/SPA.
 * Rejected initialisation stays failed until the host restarts: no retry storm.
 */
export function createApiBridge(factory: ApiFactory = createApi): ApiHandler {
  let pending: Promise<ApiHandler> | undefined;
  return (req, res, next) => {
    if (!isApiRequest(req.url)) { next(); return; }
    pending ??= Promise.resolve().then(factory);
    void pending.then(handler => {
      if (!res.destroyed && !res.writableEnded) handler(req, res, error => {
        if (error) { unavailable(); return; }
        if (!res.headersSent && !res.writableEnded) {
          res.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' });
          res.end(JSON.stringify({ success: false, error: 'Unknown API endpoint' }));
        }
      });
    }).catch(unavailable);

    function unavailable() {
      if (res.destroyed || res.writableEnded) return;
      if (res.headersSent) { res.destroy(); return; }
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' });
      res.end(JSON.stringify({ success: false, code: 'API_INITIALISATION_FAILED',
        error: 'The CX3 server API could not initialise. Check server configuration and restart the AI Studio runtime. No warehouse query was completed.' }));
    }
  };
}

/** Vite development and Vite preview are distinct hooks. Neither is a substitute
 * for the compiled Node entry point used for a published Cloud Run service.
 */
export function previewApiPlugin(): Plugin {
  return {
    name: 'conversionx-preview-api',
    configureServer(server) {
      server.middlewares.use(createApiBridge());
    },
    configurePreviewServer(server) {
      // A built preview must never activate a development identity from .env.
      process.env.NODE_ENV = 'production';
      server.middlewares.use(createApiBridge());
    },
  };
}
