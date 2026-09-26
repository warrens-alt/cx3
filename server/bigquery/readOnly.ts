import { RequestError } from './filters';

function positiveBudget(value: string | number): bigint {
  if (!/^\d+$/.test(String(value)) || BigInt(value) <= 0n || BigInt(value) > 9223372036854775807n) {
    throw new Error('BigQuery billed-byte budget must be a positive INT64');
  }
  return BigInt(value);
}

export function readOnlyQueryOptions(options: { query: string; params?: Record<string, any>; maximumBytesBilled?: string | number }, budget?: string) {
  const query = options.query || '';
  // Check for destructive SQL statements
  const destructiveRegex = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|MERGE|GRANT|REVOKE)\b/i;
  if (destructiveRegex.test(query)) {
    throw new RequestError('Read-only execution violation: destructive query detected', 403);
  }

  const result: any = {
    ...options,
    dryRun: false,
    useLegacySql: false,
  };

  // A caller may reduce the deployment ceiling but cannot remove or increase it.
  const ceilings = [positiveBudget(process.env.BIGQUERY_MAX_BYTES_BILLED || '1000000000')];
  if (budget !== undefined) ceilings.push(positiveBudget(budget));
  if (options.maximumBytesBilled !== undefined) ceilings.push(positiveBudget(options.maximumBytesBilled));
  result.maximumBytesBilled = ceilings.reduce((a, b) => a < b ? a : b).toString();

  return result;
}
