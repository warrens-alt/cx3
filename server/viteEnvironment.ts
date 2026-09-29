/** Copy only documented server settings from Vite's env-file loader. Hosting
 * platform variables take priority. Never return this object from Vite config,
 * assign it to `define`, or widen the browser's default VITE_ prefix.
 */
const SERVER_KEYS = new Set([
  'BIGQUERY_CREDENTIALS', 'BIGQUERY_MAX_BYTES_BILLED', 'GOOGLE_APPLICATION_CREDENTIALS',
  'GEMINI_API_KEY', 'IAP_AUDIENCE',
]);
export function applyServerEnvironment(
  loaded: Record<string, string>, target: NodeJS.ProcessEnv = process.env,
): void {
  for (const [key, value] of Object.entries(loaded)) {
    if ((SERVER_KEYS.has(key) || key.startsWith('CX_') || key.startsWith('RUBIX_POWERBI_'))
        && target[key] === undefined) target[key] = value;
  }
}
