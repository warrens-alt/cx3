import { LEDGER_HEADERS, ledgerCsvCell, ledgerCsvRow, type LedgerRow } from '../../contracts/leadLedgerReplica';
import { LedgerError } from './query';

export interface LedgerQueryJob {
  id?: string;
  getQueryResults(options: { autoPaginate: false; maxResults: number; pageToken?: string }): Promise<[Record<string, unknown>[], unknown, unknown]>;
  cancel?: () => Promise<unknown>;
}
export interface PreparedLedgerExport { expectedRows: number; csv: AsyncGenerator<string>; jobId: string | null }

/** One job owns every page. Never re-run the source query at increasing offsets. */
export async function prepareLedgerExport(job: LedgerQueryJob, maxRows = 1000000, signal?: AbortSignal): Promise<PreparedLedgerExport> {
  const options = { autoPaginate: false as const, maxResults: 1000 };
  const cancelled = () => { if (signal?.aborted) throw new LedgerError('Export cancelled.', 499); };
  const cancel = () => { void job.cancel?.().catch(() => undefined); };
  signal?.addEventListener('abort', cancel, { once: true });
  let first: Awaited<ReturnType<LedgerQueryJob['getQueryResults']>>;
  try {
    cancelled();
    first = await job.getQueryResults(options);
    cancelled();
  } catch (error) {
    signal?.removeEventListener('abort', cancel); cancel(); throw error;
  }
  const info = first[2] as { totalRows?: string | number; jobComplete?: boolean } | undefined;
  const total = String(info?.totalRows ?? '');
  if (info?.jobComplete === false || !/^\d+$/.test(total) || !Number.isSafeInteger(Number(total))) {
    signal?.removeEventListener('abort', cancel); cancel();
    throw new LedgerError('The export job did not provide a completed, verifiable row count.', 503);
  }
  const expectedRows = Number(total);
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || expectedRows > maxRows) {
    signal?.removeEventListener('abort', cancel); cancel();
    throw new LedgerError(`This export contains ${expectedRows.toLocaleString('en-ZA')} rows. The configured complete-export ceiling is ${maxRows.toLocaleString('en-ZA')}; narrow the fetched-date window. No partial export was returned.`, 413);
  }
  async function* csv(): AsyncGenerator<string> {
    let page = first, emitted = 0;
    const tokens = new Set<string>();
    try {
      cancelled();
      yield '\uFEFF' + LEDGER_HEADERS.map(ledgerCsvCell).join(',') + '\r\n';
      while (true) {
        cancelled();
        const rows = page[0];
        if (!Array.isArray(rows)) throw new LedgerError('Invalid export page.', 502);
        if (emitted + rows.length > expectedRows) throw new LedgerError('Export row count exceeded the query snapshot.', 502);
        for (const row of rows) {
          if (!LEDGER_HEADERS.every(header => Object.prototype.hasOwnProperty.call(row, header))) throw new LedgerError('The export page does not match the 63-column contract.', 502);
        }
        if (rows.length) yield rows.map(row => ledgerCsvRow(row as LedgerRow)).join('');
        emitted += rows.length;
        const next = page[1] as { pageToken?: string } | null | undefined;
        if (!next?.pageToken) break;
        if (tokens.has(next.pageToken)) throw new LedgerError('Repeated export page token; refusing an incomplete download.', 502);
        tokens.add(next.pageToken);
        page = await job.getQueryResults({ ...options, pageToken: next.pageToken });
      }
      cancelled();
      if (emitted !== expectedRows) throw new LedgerError(`Incomplete export: expected ${expectedRows} rows, received ${emitted}.`, 502);
    } finally {
      signal?.removeEventListener('abort', cancel);
      if (emitted !== expectedRows || signal?.aborted) cancel();
    }
  }
  return { expectedRows, csv: csv(), jobId: job.id || null };
}
