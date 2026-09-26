import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import { mountApi } from '../server/apiApp';

/**
 * Cloudflare Workers entrypoint.
 *
 * Static React assets are served by the Workers Assets binding configured in
 * wrangler.jsonc. Only /api/* is routed through this Express server.
 */
const app = express();
await mountApi(app);

// Cloudflare's Node compatibility layer bridges the Worker Fetch API to this
// local HTTP listener through httpServerHandler.
app.listen(3000);

export default httpServerHandler({ port: 3000 });
