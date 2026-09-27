import { open } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Read-only operator check. Never imports reports, changes IAM or writes storage. */
const MAX_FILE_BYTES = 48 * 1024;
export const HELP = `Usage: npx --no-install tsx scripts/check-cli-archive.ts [options]
  --file PATH              Validate one authorised CSV locally; no cloud access.
  --storage --client ID    Check configured private storage for one canonical client.
  --help                   Show help without initialising credentials.

Run storage checks in the API runtime's authorised environment. A successful read
is NOT proof of write permissions, a working deployed API, or a completed import.
No tokens, passwords, bucket names, caller IDs or report rows are printed.
Exit codes: 0 checks passed; 2 invalid input, configuration missing or check failed.`;

export interface Options { help: boolean; file?: string; storage: boolean; client?: string }
export interface FileCheck {
  status: 'VALIDATED'; rowCount: number; duplicateRows: number;
  startDate: string; endDate: string; anomalyCount: number;
}
export interface StorageCheck {
  status: 'READ_CHECK_PASSED' | 'NOT_CONFIGURED';
  archivePresent?: boolean; active?: boolean; rowCount?: number; importCount?: number;
  writeAccess: 'NOT_TESTED';
}
export interface CheckDependencies {
  readFile(path: string): Promise<Uint8Array>;
  validate(csv: string, filename: string): Promise<FileCheck>;
  storage(clientId: string): Promise<StorageCheck>;
}
class CheckError extends Error {
  constructor(readonly code: string) { super(code); }
}
export function parseOptions(args: string[]): Options {
  const options: Options = { help: false, storage: false };
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (!['--help', '--file', '--storage', '--client'].includes(flag) || seen.has(flag)) {
      throw new CheckError('INVALID_ARGUMENTS');
    }
    seen.add(flag);
    if (flag === '--help') options.help = true;
    else if (flag === '--storage') options.storage = true;
    else {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new CheckError('INVALID_ARGUMENTS');
      if (flag === '--file') options.file = value;
      else options.client = value;
    }
  }
  if (options.help && args.length === 1) return options;
  if (options.help || (!options.file && !options.storage)
    || (options.storage && !options.client) || (options.client && !options.storage)
    || (options.client && !/^[a-zA-Z0-9_-]{1,80}$/.test(options.client))) {
    throw new CheckError('INVALID_ARGUMENTS');
  }
  return options;
}
async function boundedFile(path: string): Promise<Uint8Array> {
  const handle = await open(path, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new CheckError('FILE_READ_FAILED');
    if (info.size > MAX_FILE_BYTES) throw new CheckError('CLI_UPLOAD_TOO_LARGE');
    const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > MAX_FILE_BYTES) throw new CheckError('CLI_UPLOAD_TOO_LARGE');
    return buffer.subarray(0, length);
  } finally { await handle.close(); }
}
const defaults: CheckDependencies = {
  readFile: boundedFile,
  async validate(csv, filename) {
    const { prepareCliImport, cliRowsToCsv } = await import('../server/cliImports/archive');
    const prepared = prepareCliImport(csv, filename);
    // Match the production boundary, including its existing analytical CSV validation.
    const { parseAndValidateCliCsv } = await import('../server/bigquery/cli_analytics');
    const parsed = parseAndValidateCliCsv(cliRowsToCsv(prepared.rows), prepared.filename);
    if (parsed.errors.length || parsed.records.length !== prepared.rows.length) {
      throw new CheckError('INVALID_CLI_CSV');
    }
    return { status: 'VALIDATED', rowCount: prepared.rows.length,
      duplicateRows: prepared.duplicateCount, startDate: prepared.startDate,
      endDate: prepared.endDate, anomalyCount: parsed.anomalies.length };
  },
  async storage(clientId) {
    const { getAllClients } = await import('../server/bigquery/config');
    const client = getAllClients().find(item => item.id === clientId);
    if (!client) throw new CheckError('INVALID_CLIENT');
    const { configuredCliArchive } = await import('../server/cliImports/gcs');
    const backend = configuredCliArchive();
    if (!backend) return { status: 'NOT_CONFIGURED', writeAccess: 'NOT_TESTED' };
    const { archive } = await backend.read(client.id);
    return { status: 'READ_CHECK_PASSED', archivePresent: archive !== null,
      active: archive?.active ?? false, rowCount: archive?.rows.length ?? 0,
      importCount: archive?.imports.length ?? 0, writeAccess: 'NOT_TESTED' };
  },
};
const safeMessages: Record<string, string> = {
  INVALID_ARGUMENTS: 'Use --file PATH and/or --storage --client CANONICAL_ID. See --help.',
  INVALID_CLIENT: 'Choose a configured canonical client ID; no storage read was attempted.',
  FILE_READ_FAILED: 'The local report could not be read as a regular file.',
  INVALID_UTF8: 'The report is not valid UTF-8 CSV.',
  CLI_UPLOAD_TOO_LARGE: 'The report exceeds the 48 KiB upload limit.',
  INVALID_CLI_CSV: 'The CSV failed the existing production import validators. Nothing was imported.',
  CLI_ROW_CONFLICT: 'The CSV contains conflicting rows. Nothing was imported.',
  CLI_STORAGE_CONFIGURATION: 'The server-only storage configuration is invalid.',
  CLI_STORAGE_UNAVAILABLE: 'Storage could not be reached or authenticated.',
  CLI_STORAGE_ACCESS: 'Storage access was denied or failed; it is not an empty archive.',
  CLI_STORAGE_NOT_PRIVATE: 'Storage lacks the required uniform access or explicitly enforced public-access prevention.',
  CLI_STORAGE_GENERATION: 'The archive response lacks a valid object generation.',
  CLI_STORAGE_RESPONSE: 'Storage returned an invalid response.',
  CLI_ARCHIVE_INVALID: 'The saved archive failed integrity validation.',
  CLI_ARCHIVE_TOO_LARGE: 'The saved archive exceeds the safe read limit.',
};
export interface CheckOutput {
  exitCode: number; help?: string;
  result?: { status: string; file?: FileCheck; storage?: StorageCheck;
    error?: { code: string; message: string };
    liveImport: 'NOT_PERFORMED'; deployment: 'NOT_VERIFIED' };
}
export async function checkCliArchive(args: string[], dependencies: CheckDependencies = defaults): Promise<CheckOutput> {
  let file: FileCheck | undefined;
  try {
    const options = parseOptions(args);
    if (options.help) return { exitCode: 0, help: HELP };
    if (options.file) {
      let bytes: Uint8Array;
      try { bytes = await dependencies.readFile(options.file); }
      catch (error) { if (error instanceof CheckError) throw error; throw new CheckError('FILE_READ_FAILED'); }
      if (bytes.byteLength > MAX_FILE_BYTES) throw new CheckError('CLI_UPLOAD_TOO_LARGE');
      let csv: string;
      try { csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { throw new CheckError('INVALID_UTF8'); }
      file = await dependencies.validate(csv, basename(options.file));
    }
    const storage = options.storage ? await dependencies.storage(options.client!) : undefined;
    const blocked = storage?.status === 'NOT_CONFIGURED';
    return { exitCode: blocked ? 2 : 0, result: {
      status: blocked ? 'BLOCKED' : 'CHECKS_PASSED', file, storage,
      liveImport: 'NOT_PERFORMED', deployment: 'NOT_VERIFIED',
    } };
  } catch (error) {
    const candidate = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    const code = Object.hasOwn(safeMessages, candidate) ? candidate : 'CHECK_FAILED';
    return { exitCode: 2, result: { status: 'BLOCKED', file,
      error: { code, message: safeMessages[code] || 'The check failed. Inspect authorised server diagnostics; no data was changed.' },
      liveImport: 'NOT_PERFORMED', deployment: 'NOT_VERIFIED',
    } };
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await checkCliArchive(process.argv.slice(2));
  console.log(result.help || JSON.stringify(result.result, null, 2));
  process.exitCode = result.exitCode;
}
