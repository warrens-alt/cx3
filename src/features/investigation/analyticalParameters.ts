import { ledgerCalls, ledgerOutcome, ledgerValidation } from '../../lib/leadLedgerValues';
import { formatAuditValue } from '../../shared/evidence/auditVisualModel';

export type AnalyticalRow = Readonly<Record<string, unknown>>;
export const ANALYTICAL_PARAMETER_GROUPS = [
  { id: 'identity', label: 'Identity' }, { id: 'acquisition', label: 'Acquisition' },
  { id: 'qualification', label: 'Qualification' }, { id: 'delivery', label: 'Delivery / routing' },
  { id: 'contact', label: 'Contact' }, { id: 'outcomes', label: 'Outcomes' },
  { id: 'commercial', label: 'Commercial' }, { id: 'timing', label: 'Timing' },
  { id: 'investigation', label: 'Investigation' }, { id: 'audit', label: 'Audit / metadata' },
  { id: 'additional', label: 'Additional returned fields' },
] as const;
export type AnalyticalParameterGroup = typeof ANALYTICAL_PARAMETER_GROUPS[number]['id'];
type ParameterKind = 'text' | 'number' | 'calls' | 'outcome' | 'validation' | 'revenue' | 'reason';
export interface AnalyticalParameter {
  key: string; label: string; group: AnalyticalParameterGroup; kind: ParameterKind; numeric: boolean;
}
const definitions: Array<[AnalyticalParameterGroup, Array<[string, string, ParameterKind?]>]> = [
  ['identity', [['lead_id', 'Lead ID'], ['consumer_id', 'Consumer ID'], ['transaction_id', 'Transaction ID'], ['agent_id', 'Agent ID'], ['agentId', 'Agent ID']]],
  ['acquisition', [['source', 'Source'], ['offershop_source', 'Offershop source'], ['medium', 'Medium'], ['offernet_medium', 'Offernet medium'], ['campaign', 'Campaign'], ['campaign_id', 'Campaign ID'], ['channel', 'Channel'], ['fetched', 'Fetched']]],
  ['qualification', [['grade', 'Grade'], ['offershop_grade', 'Offershop grade'], ['vetting', 'Vetting'], ['offershop_color_vetting', 'Offershop colour vetting'], ['valid_lead', 'Lead validity'], ['valid_idno', 'ID valid', 'validation'], ['phone_valid', 'Phone valid', 'validation']]],
  ['delivery', [['vendor', 'Vendor'], ['status', 'Delivery status'], ['delivered_time', 'Delivered'], ['qualified_delivery', 'Qualified delivery'], ['recorded_delivery', 'Recorded delivery'], ['routing_status', 'Routing status']]],
  ['contact', [['dialled', 'Dialled', 'outcome'], ['total_calls', 'Calls', 'calls'], ['first_call_time', 'First dial'], ['last_call_time', 'Last call'], ['last_dialer_status', 'Last disposition'], ['disposition', 'Disposition'], ['cli', 'CLI'], ['contacted', 'RPC', 'outcome'], ['qualified_rpc', 'Qualified RPC'], ['recorded_first_dial', 'Recorded first dial']]],
  ['outcomes', [['sale', 'Sale', 'outcome'], ['activated', 'Activation', 'outcome'], ['qualified_sale', 'Qualified sale'], ['qualified_activation', 'Qualified activation'], ['recorded_sale', 'Recorded sale'], ['recorded_activation', 'Recorded activation']]],
  ['commercial', [['revenue', 'Source-recorded revenue', 'revenue'], ['currency', 'Currency'], ['cost', 'Returned cost', 'number']]],
  ['timing', [['sale_time', 'Sale timestamp'], ['activation_time', 'Activation timestamp'], ['fetched_ts', 'Fetched timestamp'], ['delivery_to_dial_seconds', 'Delivery → dial seconds', 'number'], ['first_dial_delay_seconds', 'First-dial delay seconds', 'number']]],
  ['investigation', [['investigationReason', 'Why included', 'reason'], ['segmentVendor', 'Vendor segment'], ['segmentSource', 'Source segment'], ['segmentGrade', 'Grade segment'], ['segmentLeadAge', 'Lead-age segment']]],
  ['audit', [['delivery_before_capture', 'Delivery before capture'], ['first_dial_before_capture', 'First dial before capture'], ['first_dial_before_delivery', 'First dial before delivery'], ['sale_before_capture', 'Sale before capture'], ['activation_before_sale', 'Activation before sale'], ['validationStatus', 'Validation state'], ['validation_status', 'Validation state'], ['definitionVersion', 'Definition version'], ['metricId', 'Metric ID'], ['dateBasis', 'Date basis'], ['countingGrain', 'Counting grain'], ['generatedAt', 'Generated at'], ['sourceCutoff', 'Source cutoff'], ['provenance', 'Provenance'], ['metadata', 'Returned metadata']]],
];
const known = new Map<string, AnalyticalParameter>();
for (const [group, fields] of definitions) for (const [key, label, kind = 'text'] of fields) known.set(key, { key, label, group, kind, numeric: ['number', 'calls', 'revenue'].includes(kind) });

export const evidenceText = (value: unknown) => value == null || value === '' ? 'Unavailable' : String(value);
export const outcomeText = (value: unknown) => ledgerOutcome(value) === 'TRUE' ? 'Recorded' : ledgerOutcome(value) === 'FALSE' ? 'Not recorded' : 'Unavailable';
export function recordedRevenue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? `R ${formatAuditValue(value)}` : 'Unavailable';
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return 'Unavailable';
  return `R ${value}`;
}
export function analyticalParameter(key: string): AnalyticalParameter {
  return known.get(key) || { key, label: key, group: 'additional', kind: 'text', numeric: false };
}

/** The union of own keys in the loaded rows, never a speculative warehouse schema. */
export function discoverAnalyticalParameters(rows: ReadonlyArray<AnalyticalRow>): AnalyticalParameter[] {
  const returned = new Set(rows.flatMap(row => Object.keys(row)));
  return [...known.keys()].filter(key => returned.has(key)).concat([...returned].filter(key => !known.has(key)).sort()).map(key => {
    const field = analyticalParameter(key);
    const values = known.has(key) ? [] : rows.filter(row => Object.hasOwn(row, key) && row[key] != null).map(row => row[key]);
    return values.length && values.every(value => typeof value === 'number' && Number.isFinite(value)) ? { ...field, numeric: true } : field;
  });
}
export function groupAnalyticalParameters(fields: ReadonlyArray<AnalyticalParameter>) {
  return ANALYTICAL_PARAMETER_GROUPS.map(group => ({ ...group, fields: fields.filter(field => field.group === group.id) })).filter(group => group.fields.length > 0);
}
export function matchesAnalyticalParameter(field: AnalyticalParameter, query: string) {
  const group = ANALYTICAL_PARAMETER_GROUPS.find(item => item.id === field.group)?.label || '';
  return `${field.key} ${field.label} ${group}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}
/** JSON is secondary evidence. Preserve strings and safely handle unexpected values. */
export function analyticalParameterJson(value: unknown): string {
  const ancestors: object[] = [];
  try {
    return JSON.stringify(value, function (_key, item) {
      if (typeof item === 'bigint') return String(item);
      if (typeof item === 'function' || typeof item === 'symbol') return `[Unsupported ${typeof item}]`;
      if (item === undefined) return '[Not supplied]';
      if (!item || typeof item !== 'object') return item;
      while (ancestors.length && ancestors.at(-1) !== this) ancestors.pop();
      if (ancestors.includes(item)) return '[Circular value]';
      ancestors.push(item);
      return item;
    }, 2) ?? 'Not supplied';
  } catch { return 'Unsupported returned value'; }
}
export function analyticalParameterText(row: AnalyticalRow, field: AnalyticalParameter): string {
  if (!Object.hasOwn(row, field.key)) return 'Not supplied';
  const value = row[field.key];
  if (value == null || value === '') return 'Unavailable';
  if (typeof value === 'object') {
    if (field.kind === 'reason' && !Array.isArray(value) && typeof (value as Record<string, unknown>).label === 'string') return String((value as Record<string, unknown>).label);
    return Array.isArray(value) ? `${value.length} returned ${value.length === 1 ? 'item' : 'items'}` : `${Object.keys(value).length} returned ${Object.keys(value).length === 1 ? 'field' : 'fields'}`;
  }
  if (field.kind === 'outcome') return outcomeText(value);
  if (field.kind === 'validation') return ledgerValidation(value);
  if (field.kind === 'calls') return String(ledgerCalls(value));
  if (field.kind === 'revenue') {
    const amount = typeof value === 'number' && Number.isFinite(value) ? String(value)
      : typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()) ? value : null;
    if (amount === null) return 'Unavailable';
    return typeof row.currency === 'string' && row.currency.trim() ? `${amount} ${row.currency}` : amount;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return 'Unavailable';
  if (typeof value === 'function' || typeof value === 'symbol') return `Unsupported ${typeof value}`;
  return String(value);
}
/** A complete raw projection for consumers needing all returned parameters.
 * Existing audited exports keep their own established format and scope metadata. */
export function analyticalParameterExport(rows: ReadonlyArray<AnalyticalRow>) {
  const fields = discoverAnalyticalParameters(rows);
  return { fields, headers: fields.map(field => field.key), rows: rows.map(row => fields.map(field => {
    if (!Object.hasOwn(row, field.key)) return 'Not supplied';
    const value = row[field.key];
    return value == null ? 'Unavailable' : typeof value === 'object' ? analyticalParameterJson(value) : String(value);
  })) };
}
