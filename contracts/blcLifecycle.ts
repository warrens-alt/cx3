/** Source diagnostics do not approve lifecycle semantics or cross-system identity. */
export const BLC_LIFECYCLE_VERSION = '2026-09-28.1';
export const BLC_LIFECYCLE_REQUIREMENTS = [
  { id: 'contractIdentity', label: 'Rubix contract identity', candidates: ['contract_id', 'contract_key'], types: ['STRING', 'INT64', 'INTEGER'], note: 'transaction_id is a source reference, not a verified Rubix contract join.' },
  { id: 'rubixStatus', label: 'Rubix status', candidates: ['rubix_status'], types: ['STRING', 'INT64', 'INTEGER'], note: 'Status values and transitions require an owner-approved mapping.' },
  { id: 'activationStatus', label: 'Activation status', candidates: ['activation_status'], types: ['STRING', 'INT64', 'INTEGER'], note: 'An activation-register row alone does not establish the current activation status.' },
  { id: 'activationTimestamp', label: 'Activation timestamp', candidates: ['activation_date', 'activation_timestamp'], types: ['STRING', 'DATE', 'DATETIME', 'TIMESTAMP'], note: 'date_created is not substituted for activation time; event meaning and timezone require validation.' },
  { id: 'dealColour', label: 'Deal / colour meaning', candidates: ['color'], types: ['STRING'], note: 'Colour presence does not certify the activated deal, qualification meaning or billability.' },
] as const;

export interface BlcLifecycleFieldCheck {
  id: string;
  label: string;
  candidates: string[];
  observed: Array<{ name: string; type: string; repeated: boolean }>;
  status: 'NOT_CHECKED' | 'MISSING' | 'TYPE_UNSUPPORTED' | 'OBSERVED_UNVERIFIED';
  note: string;
}
export interface BlcLifecycleDiagnostics {
  version: string;
  applicable: boolean;
  sourceTable: string | null;
  checkedAt: string;
  metadataStatus: string;
  queryStatus: string;
  querySucceeded: boolean;
  lifecycleStatus: 'NOT_APPLICABLE' | 'SOURCE_UNAVAILABLE' | 'FIELDS_MISSING' | 'VALIDATION_REQUIRED';
  canonical: false;
  sourceRows: string | null;
  distinctTransactionReferences: string | null;
  missingTransactionReferences: string | null;
  repeatedTransactionReferenceRows: string | null;
  latestRegisterAt: string | null;
  missingRegisterTimestampRows: string | null;
  sourceRefreshedAt: null;
  freshnessStatus: 'NOT_VERIFIED';
  fieldChecks: BlcLifecycleFieldCheck[];
  message: string;
}
export interface LifecycleSourceCard {
  key: string;
  label: string;
  status: string;
  table: string | null;
  latestRecordAt: string | null;
  ageHours: number | null;
  rowCount: number | null;
  detail: string;
  missingTimestampRows?: number;
  lifecycle?: BlcLifecycleDiagnostics;
}
