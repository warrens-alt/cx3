/** Versioned raw-source contract. This is deliberately independent of enriched analytics. */
export const LEDGER_REPLICA_VERSION = 'lead-ledger-63/v1';
export type LedgerCell = string | number | boolean | null;
export type LedgerRow = Record<string, LedgerCell>;
export interface LedgerColumn { label: string; field: string; scope: 'lead' | 'hlc' | 'derived' }
export const LEDGER_COLUMNS: readonly LedgerColumn[] = [
  {"label": "Vendors", "field": "vendors", "scope": "derived"},
  {"label": "Lead ID", "field": "lead_id", "scope": "lead"},
  {"label": "Total Revenue", "field": "total_revenue", "scope": "derived"},
  {"label": "Consumer ID", "field": "consumer_id", "scope": "lead"},
  {"label": "Offershop Source", "field": "offershop_source", "scope": "lead"},
  {"label": "Fetched", "field": "fetched", "scope": "lead"},
  {"label": "Standardised IDNO", "field": "standardised_idno", "scope": "lead"},
  {"label": "Standardised Mobile", "field": "standardised_mobile", "scope": "lead"},
  {"label": "Standardised Alt Phone", "field": "standardised_alt_phone", "scope": "lead"},
  {"label": "Standardised Email", "field": "standardised_email", "scope": "lead"},
  {"label": "Valid IDNO", "field": "valid_idno", "scope": "lead"},
  {"label": "Validate IDNO", "field": "validate_idno", "scope": "lead"},
  {"label": "Phone Valid", "field": "phone_valid", "scope": "lead"},
  {"label": "Validate Mobile", "field": "validate_mobile", "scope": "lead"},
  {"label": "Hospital Applied", "field": "hospital_applied", "scope": "lead"},
  {"label": "Hospital Applied Date", "field": "hospital_applied_date", "scope": "lead"},
  {"label": "Offershop Color Vetting", "field": "offershop_color_vetting", "scope": "lead"},
  {"label": "Offershop Color Vetting Date", "field": "offershop_color_vetting_date", "scope": "lead"},
  {"label": "Offershop Grade", "field": "offershop_grade", "scope": "lead"},
  {"label": "Offershop Grade Date", "field": "offershop_grade_date", "scope": "lead"},
  {"label": "DEBT CONSOLIDATION", "field": "debt_consolidation", "scope": "lead"},
  {"label": "FUNERAL INSURANCE", "field": "funeral_insurance", "scope": "lead"},
  {"label": "INCOME", "field": "income", "scope": "lead"},
  {"label": "MEDICAL INSURANCE QUOTE", "field": "medical_insurance_quote", "scope": "lead"},
  {"label": "MOTOR WARRANTY", "field": "motor_warranty", "scope": "lead"},
  {"label": "OFFERNET MEDIUM", "field": "offernet_medium", "scope": "lead"},
  {"label": "ONLINE TRADING", "field": "online_trading", "scope": "lead"},
  {"label": "OWN VEHICLE", "field": "own_vehicle", "scope": "lead"},
  {"label": "PERSONAL LOAN", "field": "personal_loan", "scope": "lead"},
  {"label": "VALID LEAD", "field": "valid_lead", "scope": "lead"},
  {"label": "ROR AFFILIATE", "field": "ror_affiliate", "scope": "lead"},
  {"label": "ROR BIZVOIP", "field": "ror_bizvoip", "scope": "lead"},
  {"label": "ROR BLC", "field": "ror_blc", "scope": "lead"},
  {"label": "ROR BMI LOANS AFRICAN BANK", "field": "ror_bmi_loans_african_bank", "scope": "lead"},
  {"label": "ROR DEBTRESCUE", "field": "ror_debtrescue", "scope": "lead"},
  {"label": "ROR DISCHEM", "field": "ror_dischem", "scope": "lead"},
  {"label": "ROR GETSAVVI", "field": "ror_getsavvi", "scope": "lead"},
  {"label": "ROR MONDO", "field": "ror_mondo", "scope": "lead"},
  {"label": "ROR MTN", "field": "ror_mtn", "scope": "lead"},
  {"label": "ROR NAGA", "field": "ror_naga", "scope": "lead"},
  {"label": "ROR ONEPLAN MEDICAL", "field": "ror_oneplan_medical", "scope": "lead"},
  {"label": "ROR ONEPLAN PET", "field": "ror_oneplan_pet", "scope": "lead"},
  {"label": "ROR REALPROMOTIONS", "field": "ror_realpromotions", "scope": "lead"},
  {"label": "ROR REWARDSCO", "field": "ror_rewardsco", "scope": "lead"},
  {"label": "ROR URBANREWARDS", "field": "ror_urbanrewards", "scope": "lead"},
  {"label": "HLC Vendor", "field": "vendor", "scope": "hlc"},
  {"label": "HLC Transaction ID", "field": "transaction_id", "scope": "hlc"},
  {"label": "HLC Status", "field": "status", "scope": "hlc"},
  {"label": "HLC Revenue Generated", "field": "revenue_generated", "scope": "hlc"},
  {"label": "HLC Attempted to Deliver", "field": "attempted_to_deliver", "scope": "hlc"},
  {"label": "HLC Delivered", "field": "delivered", "scope": "hlc"},
  {"label": "HLC Expected First Dial", "field": "expected_first_dial", "scope": "hlc"},
  {"label": "HLC New Dialer Lead", "field": "new_dialer_lead", "scope": "hlc"},
  {"label": "HLC First Call Date", "field": "first_call_date", "scope": "hlc"},
  {"label": "HLC Last Call Date", "field": "last_call_date", "scope": "hlc"},
  {"label": "HLC Last Dialer Status", "field": "last_dialer_status", "scope": "hlc"},
  {"label": "HLC Last Call Length in Sec", "field": "last_call_length_in_sec", "scope": "hlc"},
  {"label": "HLC Total Calls Length in Sec", "field": "total_calls_length_in_sec", "scope": "hlc"},
  {"label": "HLC Total Calls", "field": "total_calls", "scope": "hlc"},
  {"label": "HLC RPC", "field": "rpc", "scope": "hlc"},
  {"label": "HLC Sale", "field": "sale", "scope": "hlc"},
  {"label": "HLC Activated", "field": "activated", "scope": "hlc"},
  {"label": "HLC CURRENCY", "field": "currency", "scope": "hlc"},
];
export const LEDGER_HEADERS = LEDGER_COLUMNS.map(column => column.label);
export const PROCESS_TIMESTAMPS = new Set(['standardised_idno', 'standardised_mobile', 'standardised_alt_phone', 'standardised_email']);
export const LEDGER_TIMESTAMP_FIELDS = new Set([
  'fetched', ...PROCESS_TIMESTAMPS, 'validate_idno', 'validate_mobile', 'hospital_applied_date',
  'offershop_color_vetting_date', 'offershop_grade_date',
  ...LEDGER_COLUMNS.filter(c => c.field.startsWith('ror_')).map(c => c.field),
  'attempted_to_deliver', 'delivered', 'expected_first_dial', 'first_call_date', 'last_call_date', 'sale', 'activated',
]);

export interface LedgerEvent { label: string; raw: string; timestamp: string | null; state: 'observed' | 'missing' | 'invalid' | 'future' }
export interface LedgerRecord { raw: LedgerRow; events: LedgerEvent[]; issues: string[] }
export interface LedgerLead { key: string; leadId: string; records: LedgerRecord[]; issues: string[] }
export interface LedgerCoverage {
  source: string; available: string[]; missing: string[]; compatible: boolean; richViewEnabled: boolean;
}
export interface LedgerReplicaReport {
  leads: LedgerLead[];
  summary: { leads: number; rows: number; leadOnlyRows: number; duplicateKeyRows: number; revenue: { currency: string; amount: string | null; missingAmounts: number }[] };
  vendors: { vendor: string; leads: number; rows: number }[];
  metadata: {
    version: string; coverage: LedgerCoverage; clientId: string; startDate: string; endDate: string;
    filters: unknown; search: string; generatedAt: string; queryJobId: string | null;
    offset: number; pageSize: number; hasMore: boolean; validationStatus: 'NOT_VERIFIED';
    dateBasis: 'fetched_cohort'; timestampInterpretation: string; pagination: string;
  };
}

/** Do not repair ambiguous dates or use placeholders as observed events. */
export function ledgerTimestamp(value: LedgerCell | undefined, now = Date.now()): { timestamp: string | null; state: LedgerEvent['state'] } {
  const raw = value == null ? '' : String(value).trim();
  if (!raw || /^(1900|1970)-/.test(raw)) return { timestamp: null, state: 'missing' };
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?$/.exec(raw);
  if (!match) return { timestamp: null, state: 'invalid' };
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return { timestamp: null, state: 'invalid' };
  const instant = Date.parse(raw.replace(' ', 'T') + (/(?:Z|[+-]\d{2}:?\d{2})$/.test(raw) ? '' : 'Z'));
  if (!Number.isFinite(instant)) return { timestamp: null, state: 'invalid' };
  if (instant > now) return { timestamp: null, state: 'future' };
  return { timestamp: new Date(instant).toISOString(), state: 'observed' };
}

export function analyseLedgerLead(key: string, rows: LedgerRow[], now = Date.now()): LedgerLead {
  const keys = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    if (row['HLC Vendor'] && row['HLC Transaction ID']) {
      const id = JSON.stringify([row['Lead ID'], row['HLC Vendor'], row['HLC Transaction ID']]);
      const group = keys.get(id);
      if (group) group.push(row); else keys.set(id, [row]);
    }
  }
  const duplicateIssues = new Map<string, string>();
  const hlcColumns = LEDGER_COLUMNS.filter(c => c.scope === 'hlc');
  for (const [id, group] of keys) {
    if (group.length > 1) duplicateIssues.set(id, new Set(group.map(row => JSON.stringify(hlcColumns.map(c => row[c.label])))).size > 1 ? 'CONFLICTING_TRANSACTION_KEY' : 'DUPLICATE_TRANSACTION_KEY');
  }
  const records = rows.map(raw => {
    const issues: string[] = [];
    const events = LEDGER_COLUMNS.filter(c => LEDGER_TIMESTAMP_FIELDS.has(c.field)).map(c => {
      const value = raw[c.label];
      const event = { label: c.label, raw: value == null ? '' : String(value), ...ledgerTimestamp(value, now) };
      if (event.state === 'invalid' || event.state === 'future') issues.push(`${event.state.toUpperCase()}_TIMESTAMP: ${c.label}`);
      return event;
    });
    const stamp = (label: string) => events.find(event => event.label === label)?.timestamp;
    const first = stamp('HLC First Call Date'), delivered = stamp('HLC Delivered');
    if (first && delivered && first < delivered) issues.push('FIRST_CALL_BEFORE_DELIVERY');
    const calls = raw['HLC Total Calls'];
    if ((first || (calls != null && String(calls).trim() !== '' && Number(calls) > 0)) && !String(raw['HLC Last Dialer Status'] ?? '').trim()) issues.push('MISSING_DISPOSITION_WITH_CALL_EVIDENCE');
    if (!raw['Lead ID']) issues.push('UNRESOLVED_LEAD_ID');
    if (!raw['Consumer ID'] || String(raw['Consumer ID']) === '0') issues.push('UNRESOLVED_CONSUMER_ID');
    if (raw['HLC Vendor'] && raw['HLC Transaction ID']) {
      const issue = duplicateIssues.get(JSON.stringify([raw['Lead ID'], raw['HLC Vendor'], raw['HLC Transaction ID']]));
      if (issue) issues.push(issue);
    }
    return { raw, events, issues };
  });
  const parentConflict = LEDGER_COLUMNS.filter(c => c.scope === 'lead').some(c => new Set(rows.map(row => JSON.stringify(row[c.label] ?? null))).size > 1);
  const issues = [...new Set(records.flatMap(record => record.issues))];
  if (parentConflict) issues.push('CONFLICTING_LEAD_FIELDS');
  return { key, leadId: String(rows[0]?.['Lead ID'] ?? ''), records, issues };
}

/** CSV quoting plus spreadsheet formula protection; numeric negatives remain numeric text. */
export function ledgerCsvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (/^[\s]*[=+@-]/.test(text) && !/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text)) text = "'" + text;
  if (/^[\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function ledgerCsvRow(row: LedgerRow): string {
  return LEDGER_HEADERS.map(header => ledgerCsvCell(row[header])).join(',') + '\r\n';
}
