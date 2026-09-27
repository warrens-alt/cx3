import { createHash } from 'node:crypto';

/** A bounded, provider-independent archive. No dialler, mailbox or warehouse credentials. */
export const MAX_CLI_UPLOAD_BYTES = 48 * 1024;
export const MAX_CLI_ARCHIVE_BYTES = 8 * 1024 * 1024;
export const MAX_CLI_ARCHIVE_ROWS = 20000;
export const MAX_CLI_ARCHIVE_IMPORTS = 2000;
export const CLI_ARCHIVE_HEADERS = [
  'report_date', 'cli_number', 'campaign_code', 'total_calls', 'asr_count', 'asr_pct',
  'answered_count', 'answered_pct', 'contact_count', 'contact_pct', 'sale_count', 'sale_pct',
  'duration_ge_1m_count', 'duration_ge_1m_pct', 'duration_ge_5m_count', 'duration_ge_5m_pct',
  'duration_ge_15m_count', 'duration_ge_15m_pct', 'avg_lead_age_days', 'vendor',
  'distinct_leads', 'avg_duration_sec', 'activations', 'revenue',
] as const;
const required = ['report_date', 'cli_number', 'campaign_code', 'total_calls', 'contact_count', 'sale_count'];
const textFields = new Set(['report_date', 'cli_number', 'campaign_code', 'vendor']);
const countFields = new Set(['total_calls', 'asr_count', 'answered_count', 'contact_count', 'sale_count',
  'duration_ge_1m_count', 'duration_ge_5m_count', 'duration_ge_15m_count', 'distinct_leads', 'activations']);
const allowed = new Set<string>(CLI_ARCHIVE_HEADERS);
export class CliArchiveError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message); this.name = 'CliArchiveError'; this.code = code; this.status = status;
  }
}
export interface ArchivedCliRow { key: string; values: string[]; importId: string }
export interface CliImportReceipt {
  id: string; rawSha256: string; filename: string; importedAt: string; importedBy: string;
  rowCount: number; insertedCount: number; duplicateCount: number; startDate: string; endDate: string;
}
export interface CliArchive {
  version: 1; tenantId: string; active: boolean; updatedAt: string;
  lastAction: { kind: 'IMPORT' | 'PAUSE'; at: string; by: string };
  rows: ArchivedCliRow[]; imports: CliImportReceipt[];
}
export interface CliArchiveBackend {
  read(tenantId: string): Promise<{ archive: CliArchive | null; generation: string }>;
  compareAndSwap(tenantId: string, generation: string, archive: CliArchive): Promise<boolean>;
}
export interface PreparedCliImport {
  id: string; rawSha256: string; filename: string; rows: ArchivedCliRow[];
  duplicateCount: number; startDate: string; endDate: string;
}
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export function cliTenantObjectName(tenantId: string): string {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(tenantId)) throw new CliArchiveError('INVALID_TENANT', 'Invalid archive tenant.');
  return `cli-reports/v1/${hash(tenantId)}/archive.json`;
}
function fail(message: string): never { throw new CliArchiveError('INVALID_CLI_CSV', message); }
function parseRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false, closed = false;
  const field = () => { row.push(value.trim()); value = ''; closed = false; };
  const finish = () => { field(); if (row.some(Boolean)) rows.push(row); row = []; };
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"') { if (input[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } }
      else value += char;
    } else if (char === ',') field();
    else if (char === '\n' || char === '\r') { finish(); if (char === '\r' && input[i + 1] === '\n') i++; }
    else if (closed) { if (!/[ \t]/.test(char)) fail('Unexpected text after a quoted CSV field.'); }
    else if (char === '"') { if (value.trim()) fail('Unexpected quote in CSV field.'); value = ''; quoted = true; }
    else value += char;
  }
  if (quoted) fail('Unclosed CSV quote.');
  finish();
  return rows;
}
function decimal(value: string): string {
  const [whole, fractional = ''] = value.split('.');
  const normalizedWhole = (whole || '0').replace(/^0+(?=\d)/, '');
  const normalizedFraction = fractional.replace(/0+$/, '');
  return normalizedWhole + (normalizedFraction ? `.${normalizedFraction}` : '');
}
function keyFor(values: string[]): string {
  return JSON.stringify([values[0], values[1], values[2], values[19]]);
}
function populationFor(values: string[]): string { return JSON.stringify(values.slice(0, 3)); }
export function cliRowsToCsv(rows: ArchivedCliRow[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [CLI_ARCHIVE_HEADERS.join(','), ...rows.map(row => row.values.map(escape).join(','))].join('\n');
}
export function prepareCliImport(csv: string, filename: string): PreparedCliImport {
  if (typeof csv !== 'string' || !csv.trim()) fail('A non-empty CSV report is required.');
  if (Buffer.byteLength(csv, 'utf8') > MAX_CLI_UPLOAD_BYTES) throw new CliArchiveError('CLI_UPLOAD_TOO_LARGE', 'CSV limit is 48 KiB. Split a historical export into smaller files.', 413);
  const parsed = parseRows(csv.replace(/^\uFEFF/, ''));
  if (parsed.length < 2) fail('CSV needs a header and at least one data row.');
  const headers = parsed[0].map(value => value.toLowerCase());
  if (new Set(headers).size !== headers.length || headers.some(value => !value)) fail('CSV headers must be non-empty and unique.');
  if (headers.some(value => !allowed.has(value) && value !== 'index')) fail('Unexpected CSV columns. Import an aggregate CLI report, not customer-level data.');
  for (const column of required) if (!headers.includes(column)) fail(`Missing required column: ${column}.`);
  const result = new Map<string, ArchivedCliRow>();
  let duplicateCount = 0;
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].length !== headers.length) fail(`CSV row ${i + 1} has the wrong number of fields.`);
    const values = CLI_ARCHIVE_HEADERS.map(column => {
      const index = headers.indexOf(column);
      const value = index < 0 ? '' : parsed[i][index];
      if (!value) { if (required.includes(column)) fail(`CSV row ${i + 1}: ${column} is required.`); return ''; }
      if (textFields.has(column)) {
        if (value.length > 120 || /[\x00-\x1f\x7f]/.test(value)) fail(`CSV row ${i + 1}: invalid ${column}.`);
        if (column === 'report_date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value)
          || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))
          || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)) fail(`CSV row ${i + 1}: invalid report_date.`);
        if (column === 'cli_number' && !/^\+?\d{6,20}$/.test(value)) fail(`CSV row ${i + 1}: cli_number must be an explicit outbound number, not phone_number or alt_dial.`);
        if (['campaign_code', 'vendor'].includes(column) && /^[=+@-]/.test(value)) fail(`CSV row ${i + 1}: invalid ${column}.`);
        return value;
      }
      if (countFields.has(column)) {
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) fail(`CSV row ${i + 1}: ${column} must be a nonnegative safe integer.`);
        return BigInt(value).toString();
      }
      if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value))) fail(`CSV row ${i + 1}: ${column} must be a nonnegative decimal.`);
      // Preserve supplied percentage notation: the legacy parser distinguishes 1 from 1.0.
      return column.endsWith('_pct') ? value : decimal(value);
    });
    const key = keyFor(values), existing = result.get(key);
    if (existing && JSON.stringify(existing.values) !== JSON.stringify(values)) throw new CliArchiveError('CLI_ROW_CONFLICT', `Conflicting values for the same date, CLI, campaign and vendor within row ${i + 1}. Nothing was imported.`, 409);
    if (existing) duplicateCount++;
    else result.set(key, { key, values, importId: '' });
  }
  const rows = [...result.values()].sort((a, b) => a.key.localeCompare(b.key));
  const id = hash(JSON.stringify(rows.map(row => row.values)));
  rows.forEach(row => { row.importId = id; });
  const dates = rows.map(row => row.values[0]).sort();
  const safeName = (typeof filename === 'string' ? filename : 'cli_report.csv').split(/[\\/]/).pop()!.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || 'cli_report.csv';
  return { id, rawSha256: hash(csv), filename: safeName, rows, duplicateCount, startDate: dates[0], endDate: dates[dates.length - 1] };
}
export function validateCliArchive(value: unknown, tenantId: string): CliArchive {
  cliTenantObjectName(tenantId);
  const state = value as CliArchive;
  const invalid = () => { throw new CliArchiveError('CLI_ARCHIVE_INVALID', 'The saved CLI archive failed integrity checks. No data was changed.', 503); };
  if (!state || state.version !== 1 || state.tenantId !== tenantId || typeof state.active !== 'boolean'
    || !Number.isFinite(Date.parse(state.updatedAt)) || !Array.isArray(state.rows) || !Array.isArray(state.imports)
    || state.rows.length > MAX_CLI_ARCHIVE_ROWS || state.imports.length > MAX_CLI_ARCHIVE_IMPORTS
    || !state.lastAction || !['IMPORT', 'PAUSE'].includes(state.lastAction.kind)
    || typeof state.lastAction.by !== 'string' || !Number.isFinite(Date.parse(state.lastAction.at))) invalid();
  const keys = new Set<string>();
  for (const row of state.rows) {
    if (!row || !Array.isArray(row.values) || row.values.length !== CLI_ARCHIVE_HEADERS.length
      || row.values.some(cell => typeof cell !== 'string' || cell.length > 120)
      || typeof row.importId !== 'string' || !/^[a-f0-9]{64}$/.test(row.importId)
      || row.key !== keyFor(row.values) || keys.has(row.key)) invalid();
    keys.add(row.key);
  }
  const ids = new Set<string>();
  for (const receipt of state.imports) {
    if (!receipt || !/^[a-f0-9]{64}$/.test(receipt.id) || !/^[a-f0-9]{64}$/.test(receipt.rawSha256)
      || typeof receipt.filename !== 'string' || receipt.filename.length > 120
      || typeof receipt.importedBy !== 'string' || receipt.importedBy.length > 200
      || !Number.isFinite(Date.parse(receipt.importedAt))
      || !/^\d{4}-\d{2}-\d{2}$/.test(receipt.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(receipt.endDate)
      || [receipt.rowCount, receipt.insertedCount, receipt.duplicateCount].some(n => !Number.isSafeInteger(n) || n < 0)
      || ids.has(receipt.id)) invalid();
    ids.add(receipt.id);
  }
  if (state.rows.some(row => !ids.has(row.importId))) invalid();
  if (Buffer.byteLength(JSON.stringify(state)) > MAX_CLI_ARCHIVE_BYTES) invalid();
  return state;
}
export async function importCliArchive(
  backend: CliArchiveBackend, tenantId: string, prepared: PreparedCliImport, actor: string,
  now = new Date().toISOString(),
): Promise<{ archive: CliArchive; insertedCount: number; duplicateCount: number; duplicate: boolean }> {
  cliTenantObjectName(tenantId);
  if (!actor || actor.length > 200) throw new CliArchiveError('CLI_ACTOR_REQUIRED', 'Authenticated importer identity is required.', 403);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { archive: raw, generation } = await backend.read(tenantId);
    const old = raw ? validateCliArchive(raw, tenantId) : null;
    const map = new Map((old?.rows || []).map(row => [row.key, row]));
    const populations = new Map<string, Set<boolean>>();
    for (const row of map.values()) {
      const key = populationFor(row.values), modes = populations.get(key) || new Set<boolean>();
      modes.add(Boolean(row.values[19])); populations.set(key, modes);
    }
    let insertedCount = 0, duplicateCount = prepared.duplicateCount;
    for (const row of prepared.rows) {
      const existing = map.get(row.key);
      const modes = populations.get(populationFor(row.values)) || new Set<boolean>();
      if ((existing && JSON.stringify(existing.values) !== JSON.stringify(row.values))
        || [...modes].some(mode => mode !== Boolean(row.values[19]))) {
        throw new CliArchiveError('CLI_ROW_CONFLICT', 'This report overlaps saved rows with different values or a different vendor grain. Nothing was imported; review the corrected report before replacing history.', 409);
      }
      if (existing) duplicateCount++;
      else { map.set(row.key, row); insertedCount++; modes.add(Boolean(row.values[19])); populations.set(populationFor(row.values), modes); }
    }
    // Identical rows in a renamed/reordered file never count twice or create redundant history.
    if (!insertedCount && old?.active) return { archive: old, insertedCount, duplicateCount, duplicate: true };
    const imports = [...(old?.imports || [])];
    if (insertedCount) imports.push({ id: prepared.id, rawSha256: prepared.rawSha256, filename: prepared.filename,
      importedAt: now, importedBy: actor, rowCount: prepared.rows.length, insertedCount, duplicateCount,
      startDate: prepared.startDate, endDate: prepared.endDate });
    if (map.size > MAX_CLI_ARCHIVE_ROWS || imports.length > MAX_CLI_ARCHIVE_IMPORTS) throw new CliArchiveError('CLI_ARCHIVE_FULL', 'The archive has reached its bounded capacity. Arrange a reviewed archive rollover; existing history was not truncated.', 413);
    const next: CliArchive = { version: 1, tenantId, active: true, updatedAt: now,
      lastAction: { kind: 'IMPORT', at: now, by: actor }, rows: [...map.values()].sort((a, b) => a.key.localeCompare(b.key)), imports };
    if (Buffer.byteLength(JSON.stringify(next)) > MAX_CLI_ARCHIVE_BYTES) throw new CliArchiveError('CLI_ARCHIVE_FULL', 'The archive size limit was reached. Existing history was not truncated.', 413);
    if (await backend.compareAndSwap(tenantId, generation, next)) return { archive: next, insertedCount, duplicateCount, duplicate: insertedCount === 0 };
  }
  throw new CliArchiveError('CLI_ARCHIVE_BUSY', 'Another upload changed this archive. Retry the same file; duplicates will not be counted twice.', 409);
}
export async function pauseCliArchive(backend: CliArchiveBackend, tenantId: string, actor: string): Promise<void> {
  cliTenantObjectName(tenantId);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { archive: raw, generation } = await backend.read(tenantId);
    if (!raw) return;
    const archive = validateCliArchive(raw, tenantId);
    if (!archive.active) return;
    const at = new Date().toISOString();
    if (await backend.compareAndSwap(tenantId, generation, { ...archive, active: false, updatedAt: at, lastAction: { kind: 'PAUSE', at, by: actor } })) return;
  }
  throw new CliArchiveError('CLI_ARCHIVE_BUSY', 'Another upload changed this archive. Retry the action.', 409);
}
export function cliArchiveStatus(archive: CliArchive | null) {
  const dates = [...new Set((archive?.rows || []).map(row => row.values[0]))].sort();
  return { configured: true, active: archive?.active ?? false, provenance: 'IMPORTED_REPORT',
    rowCount: archive?.rows.length ?? 0, reportCount: archive?.imports.length ?? 0, dates,
    earliestReportDate: dates[0] || null, latestReportDate: dates[dates.length - 1] || null,
    updatedAt: archive?.updatedAt || null, imports: [...(archive?.imports || [])].reverse().slice(0, 20),
    historyTruncated: (archive?.imports.length || 0) > 20, maxUploadBytes: MAX_CLI_UPLOAD_BYTES };
}
