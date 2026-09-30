import { LEDGER_COLUMNS } from '../../../contracts/leadLedgerReplica';

/** Presentation groupings only. The source contract and CSV column order remain authoritative. */
const namedGroups: ReadonlyArray<{ label: string; fields: readonly string[] }> = [
  { label: 'Identity', fields: ['Lead ID', 'Consumer ID', 'Standardised IDNO', 'Standardised Mobile', 'Standardised Alt Phone', 'Standardised Email'] },
  { label: 'Acquisition', fields: ['Offershop Source', 'Fetched', 'OFFERNET MEDIUM'] },
  { label: 'Qualification / vetting', fields: ['Valid IDNO', 'Validate IDNO', 'Phone Valid', 'Validate Mobile', 'Hospital Applied', 'Hospital Applied Date', 'Offershop Color Vetting', 'Offershop Color Vetting Date', 'Offershop Grade', 'Offershop Grade Date', 'VALID LEAD'] },
  { label: 'Delivery', fields: ['Vendors', 'ROR AFFILIATE', 'ROR BIZVOIP', 'ROR BLC', 'ROR BMI LOANS AFRICAN BANK', 'ROR DEBTRESCUE', 'ROR DISCHEM', 'ROR GETSAVVI', 'ROR MONDO', 'ROR MTN', 'ROR NAGA', 'ROR ONEPLAN MEDICAL', 'ROR ONEPLAN PET', 'ROR REALPROMOTIONS', 'ROR REWARDSCO', 'ROR URBANREWARDS', 'HLC Vendor', 'HLC Transaction ID', 'HLC Attempted to Deliver', 'HLC Delivered'] },
  { label: 'Contact', fields: ['HLC Expected First Dial', 'HLC New Dialer Lead', 'HLC First Call Date', 'HLC Last Call Date', 'HLC Last Dialer Status', 'HLC Last Call Length in Sec', 'HLC Total Calls Length in Sec', 'HLC Total Calls', 'HLC RPC'] },
  { label: 'Outcomes', fields: ['HLC Status', 'HLC Sale', 'HLC Activated'] },
  { label: 'Commercial', fields: ['Total Revenue', 'HLC Revenue Generated', 'HLC CURRENCY'] },
];

const assignedFields = new Set(namedGroups.flatMap(group => group.fields));

export const LEDGER_RAW_FIELD_GROUPS = [
  ...namedGroups.map(group => ({
    label: group.label,
    columns: LEDGER_COLUMNS.filter(column => group.fields.includes(column.label)),
  })),
  { label: 'Remaining source fields', columns: LEDGER_COLUMNS.filter(column => !assignedFields.has(column.label)) },
];
