import { RequestError } from './filters';

export function readOnlyQueryOptions(options: { query: string; params?: Record<string, any> }, budget?: string) {
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

  if (budget) {
    result.maximumBytesBilled = budget;
  }

  return result;
}
