import express from 'express';
import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import { mountApi } from '../apiApp';
import { configuredR2CliArchive, type CliR2Environment } from '../cliImports/r2';
import { configuredR2SavedInvestigationBackend, type SavedInvestigationR2Environment } from '../savedAnalyses/r2';
import { routeCloudflareRequest, type AssetBinding } from './routing';

interface CloudflareEnvironment extends CliR2Environment, SavedInvestigationR2Environment { ASSETS?: AssetBinding }
const bindings = env as CloudflareEnvironment;
const app = express();
// Preserve the existing auth, tenant gates, rate/concurrency controls, analytics and exports.
// Do not import server.ts: Vite and filesystem-based static serving are not Worker entry points.
await mountApi(app, {
  cliArchiveBackend: () => configuredR2CliArchive(bindings),
  savedAnalysisBackend: () => configuredR2SavedInvestigationBackend(bindings),
});
app.listen(8080);
const api = httpServerHandler({ port: 8080 });

export default {
  fetch(request: Request): Promise<Response> {
    return routeCloudflareRequest(request, input => api.fetch(input), bindings.ASSETS);
  },
};
