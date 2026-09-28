import { LEDGER_HEADERS, ledgerCsvCell } from '../../../contracts/leadLedgerReplica';

/** Incremental CSV completeness check; quoted multiline cells do not count as extra rows. */
export class LedgerCsvVerifier {
  private quoted = false;
  private lines = 0;
  private prefix = '';
  private expectedHeader = '\uFEFF' + LEDGER_HEADERS.map(ledgerCsvCell).join(',') + '\r\n';
  push(text: string) {
    if (this.prefix.length < this.expectedHeader.length) this.prefix += text.slice(0, this.expectedHeader.length - this.prefix.length);
    for (const char of text) {
      if (char === '"') this.quoted = !this.quoted;
      else if (char === '\n' && !this.quoted) this.lines++;
    }
  }
  finish(expectedRows: number) {
    // TextDecoder normally strips the BOM; accept that equivalent transport representation.
    const expected = this.prefix.startsWith('\uFEFF') ? this.expectedHeader : this.expectedHeader.slice(1);
    if (!this.prefix.startsWith(expected) || this.quoted || this.lines !== expectedRows + 1) {
      throw new Error('The download failed its 63-column/row-count integrity check. No file was saved.');
    }
  }
}
export async function receiveLedgerCsv(response: Response, signal: AbortSignal, progress: (bytes: number) => void, maxBytes = 256 * 1024 * 1024) {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.error === 'string' ? body.error : `Export failed (${response.status}).`);
  }
  const count = response.headers.get('X-Export-Row-Count') || '';
  if (!response.headers.get('Content-Type')?.includes('text/csv') || response.headers.get('X-Export-Truncated') !== 'false' || !/^\d+$/.test(count) || !Number.isSafeInteger(Number(count)) || !response.body) {
    throw new Error('The export did not provide a complete CSV response. No file was saved.');
  }
  const reader = response.body.getReader(), decoder = new TextDecoder(), verifier = new LedgerCsvVerifier();
  const chunks: BlobPart[] = [];
  let received = 0;
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) throw new Error('The CSV exceeds this browser’s 256 MiB download ceiling. Narrow the fetched-date range. No partial file was saved.');
      // Copy into an ArrayBuffer-backed value for DOM Blob typing on TS 5.8+.
      chunks.push(new Uint8Array(value).buffer);
      verifier.push(decoder.decode(value, { stream: true }));
      progress(received);
    }
    if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
    verifier.push(decoder.decode()); verifier.finish(Number(count));
    const filename = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'LeadLedger.csv';
    return { blob: new Blob(chunks, { type: 'text/csv;charset=utf-8' }), filename, rows: Number(count), jobId: response.headers.get('X-Export-Query-Job') };
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  finally { signal.removeEventListener('abort', abort); reader.releaseLock(); }
}
