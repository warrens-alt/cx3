import { RequestError } from './filters';

function positiveBudget(value: string | number): bigint {
  if (!/^\d+$/.test(String(value)) || BigInt(value) <= 0n || BigInt(value) > 9223372036854775807n) {
    throw new Error('BigQuery billed-byte budget must be a positive INT64');
  }
  return BigInt(value);
}

export function readOnlyQueryOptions(options: { query: string; params?: Record<string, any>; maximumBytesBilled?: string | number }, budget?: string) {
  const query = options.query || '';
  const tokens = queryTokens(query);
  const forbidden = new Set(['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'MERGE', 'GRANT', 'REVOKE', 'EXPORT', 'CALL', 'EXECUTE', 'BEGIN', 'DECLARE', 'COMMIT', 'ROLLBACK']);
  if (!['SELECT', 'WITH'].includes(tokens[0]) || tokens.some(token => forbidden.has(token))
    || tokens.slice(0, -1).includes(';')) {
    throw new RequestError('Read-only execution requires a single SELECT query', 403);
  }
  // A SELECT with a destination can still overwrite a permanent table.
  for (const name of ['destination', 'destinationTable', 'writeDisposition', 'createDisposition'] as const) {
    if ((options as Record<string, unknown>)[name] !== undefined) {
      throw new RequestError(`Read-only execution does not allow ${name}`, 403);
    }
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

export function readOnlyDryRunQueryOptions(options: { query: string; params?: Record<string, any>; maximumBytesBilled?: string | number }, budget?: string) {
  const result = readOnlyQueryOptions(options, budget);
  result.dryRun = true;
  return result;
}

/** Ignore quoted text/identifiers and comments when checking statement keywords.
 * This is a query boundary for application-generated SQL, not a replacement for IAM. */
function queryTokens(sql: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < sql.length) {
    if (sql.startsWith('--', i) || sql[i] === '#') {
      const end = sql.indexOf('\n', i);
      i = end < 0 ? sql.length : end + 1;
    } else if (sql.startsWith('/*', i)) {
      const end = sql.indexOf('*/', i + 2);
      if (end < 0) throw new RequestError('Unterminated SQL comment', 403);
      i = end + 2;
    } else if (["'", '"', '`'].includes(sql[i])) {
      const quote = sql[i];
      const delimiter = quote !== '`' && sql.startsWith(quote.repeat(3), i) ? quote.repeat(3) : quote;
      i += delimiter.length;
      let closed = false;
      while (i < sql.length) {
        if (sql[i] === '\\') { i += 2; continue; }
        if (sql.startsWith(delimiter, i)) {
          if (delimiter.length === 1 && sql[i + 1] === quote) { i += 2; continue; }
          i += delimiter.length;
          closed = true;
          break;
        }
        i++;
      }
      if (!closed) throw new RequestError('Unterminated SQL literal or identifier', 403);
    } else if (sql[i] === ';') {
      tokens.push(';'); i++;
    } else if (/[A-Za-z_]/.test(sql[i])) {
      const start = i++;
      while (i < sql.length && /[A-Za-z0-9_]/.test(sql[i])) i++;
      tokens.push(sql.slice(start, i).toUpperCase());
    } else i++;
  }
  return tokens;
}
