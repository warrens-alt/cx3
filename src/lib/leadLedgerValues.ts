/** Read-only presentation of recorded Ledger values; no inference from missing evidence. */
export function ledgerValidation(value: unknown): 'Valid (1)' | 'Invalid (2)' | 'Unavailable' {
  // Source validation codes are 1/2. Preserve the legacy explicit Boolean representation.
  if (value === 1 || value === '1' || value === true) return 'Valid (1)';
  if (value === 2 || value === '2' || value === false) return 'Invalid (2)';
  return 'Unavailable';
}

export function ledgerOutcome(value: unknown): 'TRUE' | 'FALSE' | 'Unavailable' {
  // Outcome flags are not the separate 1=valid / 2=invalid validation-code domain.
  if (value === true || value === 1 || value === '1' || value === 'true') return 'TRUE';
  if (value === false || value === 0 || value === '0' || value === 'false') return 'FALSE';
  return 'Unavailable';
}

export function ledgerCalls(value: unknown): string | number {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  // Preserve exact warehouse integer strings without passing them through Number().
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  return 'Unavailable';
}

export const LEAD_LEDGER_COLUMNS = [
  'Lead ID', 'Consumer ID', 'Fetched Date', 'Offershop Source', 'Vendor', 'Medium',
  'Grade', 'Vetting', 'Valid ID', 'Valid Phone', 'Dialled', 'Contacted (RPC)',
  'Total Calls', 'Last Disposition', 'Sale', 'Activated', 'Revenue',
] as const;

/** Keep the existing 17 analytical columns in order; serialize only after audit context is attached. */
export function buildLeadLedgerDataRows(rows: ReadonlyArray<Record<string, any>>): Array<Array<string | number>> {
  return rows.map(row => [
    row.lead_id ?? '', row.consumer_id ?? '', row.fetched ?? '',
    row.source || row.offershop_source || '', row.vendor || '',
    row.medium || row.offernet_medium || '', row.grade || row.offershop_grade || '',
    row.vetting || row.offershop_color_vetting || '',
    ledgerValidation(row.valid_idno), ledgerValidation(row.phone_valid),
    ledgerOutcome(row.dialled), ledgerOutcome(row.contacted), ledgerCalls(row.total_calls),
    row.last_dialer_status || '', ledgerOutcome(row.sale), ledgerOutcome(row.activated),
    row.revenue == null ? '' : String(row.revenue),
  ]);
}
