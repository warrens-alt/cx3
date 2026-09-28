import { buildLeadEvidenceExport, LEAD_EVIDENCE_COLUMNS, serializeCsv } from './analysisExport';
import { buildLeadLedgerDataRows, LEAD_LEDGER_COLUMNS } from './leadLedgerValues';

/** Reuse the evidence validator and audit columns; do not accept live UI scope as fallback. */
export function buildLeadLedgerExport(result: Parameters<typeof buildLeadEvidenceExport>[0]) {
  const evidence = buildLeadEvidenceExport(result);
  if (evidence.metadata.countingGrain !== 'lead') {
    throw new Error('Cannot export Ledger: the result must contain one row per scoped lead.');
  }
  const ids = result.rows.map(row => row.lead_id == null ? '' : String(row.lead_id));
  if (ids.some(id => !id.trim()) || new Set(ids).size !== ids.length) {
    throw new Error('Cannot export Ledger: lead identities must be present and unique on the page.');
  }
  const auditOffset = LEAD_EVIDENCE_COLUMNS.length;
  const headers = [...LEAD_LEDGER_COLUMNS, ...evidence.headers.slice(auditOffset)];
  const dataRows = buildLeadLedgerDataRows(result.rows);
  const rows = [headers, ...dataRows.map((row, i) => [...row, ...evidence.rows[i + 1].slice(auditOffset)])];
  const { clientId, startDate, endDate } = evidence.metadata;
  return {
    ...evidence,
    filename: `cx-lead-ledger-${clientId}-${startDate ?? 'all'}-${endDate ?? 'all'}-page${evidence.page + 1}.csv`,
    headers,
    dataRows,
    rawRows: [Array.from(LEAD_LEDGER_COLUMNS), ...dataRows],
    rows,
    csv: serializeCsv(rows),
  };
}
