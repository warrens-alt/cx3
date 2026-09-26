/** Read-only warehouse source inventory + date-bound aggregate checks. Never publishes a reporting release. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SOURCE_ROLES } from '../contracts/sourceCoverage';
import { sourceCatalogue } from '../server/bigquery/sourceCatalog';
import { getSourceMetrics } from '../server/bigquery/sourceMetrics';
import { getClientConfig } from '../server/bigquery/config';
import { validateScope, type QueryScope } from '../server/bigquery/filters';
import { safeSourceError, sourceAccess, type SourceAccess } from '../server/bigquery/sourceAccess';

export const SOURCE_CHECK_USAGE = `Usage: npm run sources:check -- --start YYYY-MM-DD --end YYYY-MM-DD [--tenant default_tenant] [--out result.json]

Read-only, date-bound source checks (maximum 366 inclusive days).
Requires network access, query-capable credentials and read permission on configured sources.
--help, -h  Show this help without contacting the warehouse.
The result is source evidence, not a reconciled or published reporting release.`;

class UsageError extends Error {}
interface SourceCheckOptions { scope: QueryScope; out?: string }

export function parseSourceCheckArgs(args: string[]): SourceCheckOptions | null {
  if (args.includes('--help') || args.includes('-h')) return null;
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!['--start', '--end', '--tenant', '--out'].includes(key)) throw new UsageError('Unknown source-check option. Use --help for supported arguments.');
    if (values.has(key)) throw new UsageError(`Specify ${key} only once.`);
    const value = args[index + 1];
    if (!value || value.startsWith('--') || value === '-h') throw new UsageError(`Missing value for ${key}.`);
    values.set(key, value);
  }
  if (!values.has('--start') || !values.has('--end')) throw new UsageError('Both --start and --end are required. Use --help for usage.');
  let scope: QueryScope;
  try {
    scope = validateScope({ clientId: values.get('--tenant') || 'default_tenant', startDate: values.get('--start'), endDate: values.get('--end') });
    scope.clientId = getClientConfig(scope.clientId).id;
  } catch {
    throw new UsageError('Invalid tenant or date range. Use a configured tenant and ordered YYYY-MM-DD dates.');
  }
  if (Date.parse(scope.endDate!) - Date.parse(scope.startDate!) > 365 * 86_400_000) throw new UsageError('Select at most 366 inclusive days.');
  return { scope, ...(values.has('--out') ? { out: path.resolve(values.get('--out')!) } : {}) };
}

export async function runSourceCheck(options: SourceCheckOptions, access: SourceAccess = sourceAccess(options.scope.clientId)) {
  const { scope } = options;
  const catalogue = await sourceCatalogue(scope.clientId, access);
  const checks = [];
  // Sequential bounded aggregates only: no raw-row dumps or business approvals.
  for (const role of SOURCE_ROLES) {
    try { checks.push({ role, status: 'QUERIED', data: await getSourceMetrics(role, scope, access) }); }
    catch (error) { checks.push({ role, ...safeSourceError(error) }); }
  }
  return { catalogue, checks, sourceDataReconciled: false };
}

async function main() {
  const options = parseSourceCheckArgs(process.argv.slice(2));
  if (!options) { console.info(SOURCE_CHECK_USAGE); return; }
  const result = await runSourceCheck(options);
  if (options.out) {
    fs.writeFileSync(options.out, JSON.stringify(result, null, 2));
    console.info(`Source evidence written to ${options.out}`);
  } else console.info(JSON.stringify(result, null, 2));
  if (result.checks.some(check => check.status !== 'QUERIED') || !result.catalogue.inventoryComplete) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error instanceof UsageError ? error.message : safeSourceError(error).error);
    process.exitCode = 1;
  });
}
