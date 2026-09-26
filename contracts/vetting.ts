/** Vetting classifications are separate evidence axes, not a credit or billability decision. */
export const VETTING_VERSION = 'cx.vetting.1.0.0';
export const COLOURS = ['Green', 'Blue', 'Orange', 'Charcoal', 'Purple', 'Red'] as const;
export const MISSING_CLASS = '[No class recorded]';
export const MISSING_COLOUR = '[No colour result]';
export const UNMAPPED_COLOUR = '[Result without recognised colour]';
export const MULTIPLE_COLOURS = '[Multiple named colours]';
export type VettingInterval = 'day' | 'week' | 'month';
export const VETTING_SECTIONS = ['class', 'colour', 'matrix', 'sourceClass', 'sourceColour', 'rawClass', 'rawColour', 'trend', 'trendClass', 'trendColour', 'vendorClass', 'vendorColour'] as const;
export type VettingSection = typeof VETTING_SECTIONS[number];
export const VETTING_METRICS = {
  leads: 'Included Leads', classRecorded: 'Leads with a Class Result', recognisedClass: 'Leads with A–F / U Class',
  colourRecorded: 'Leads with a Colour-Vetting Result', namedColour: 'Leads with One Recognised Colour',
  bothRecorded: 'Leads with Class and Named Colour', withHlc: 'Leads with Selected HLC Records',
  valid: 'Leads with Recorded Validity: Yes', invalid: 'Leads with Recorded Validity: No', unknownValidity: 'Leads with Unknown Validity',
  delivered: 'Leads with HLC Delivery Timestamp', called: 'Leads with HLC First-Dial Timestamp',
  rpc: 'Leads with HLC RPC Flag', sales: 'Leads with HLC Sale Timestamp', activations: 'Leads with HLC Activation Timestamp',
  classTimed: 'Leads with Usable Class Timing', colourTimed: 'Leads with Usable Colour Timing',
  classBeforeCapture: 'Class Timestamps before Capture', colourBeforeCapture: 'Colour Timestamps before Capture',
  classInvalidTime: 'Invalid / Sentinel Class Timestamps', colourInvalidTime: 'Invalid / Sentinel Colour Timestamps',
  classFutureTime: 'Class Timestamps after Query Time', colourFutureTime: 'Colour Timestamps after Query Time',
} as const;
export type VettingMetric = keyof typeof VETTING_METRICS;
export const COUNT_KEYS = Object.keys(VETTING_METRICS) as VettingMetric[];
export interface VettingCounts extends Record<VettingMetric, string | null> {
  classMeanSeconds: string | null; colourMeanSeconds: string | null;
}
export interface VettingGroup extends VettingCounts {
  section: VettingSection; period: 'current' | 'previous'; key: string; series: string;
}
export interface VettingReport {
  current: VettingCounts; previous: VettingCounts; groups: VettingGroup[];
  diagnostics: { period: string; sourceRows: string; missingIdRows: string; conflictingLeads: string; conflictingRows: string; duplicateRowsCollapsed: string; eligibleUniqueLeads: string }[];
  timing: {kind: string; sample: string; meanSeconds: string | null; medianSeconds: string | null; p90Seconds: string | null}[];
  fields: Record<string, {sourceField: string; available: boolean}>;
  scope: {clientId: string; startDate: string; endDate: string; previousStart: string; previousEnd: string; days: number; interval: VettingInterval; classValue: string | null; colourValue: string | null; filters: unknown};
  evidence: { version: string; table: string; jobId: string | null; referencedTables: string[]; bytesProcessed: string | null; generatedAt: string; snapshotPinned: false; validationStatus: 'SOURCE_QUERY_NOT_INDEPENDENTLY_RECONCILED' };
  notes: string[];
}
export function classLabel(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return MISSING_CLASS;
  const text = raw.trim();
  const match = /^(?:class[\s_-]*)?([A-FU])$/i.exec(text);
  return match ? match[1].toUpperCase() : text;
}
export function colourLabel(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return MISSING_COLOUR;
  const tokens = raw.split(',').map(t => t.trim().toLowerCase());
  const named = COLOURS.filter(c => tokens.includes(c.toLowerCase()));
  if (named.length > 1) return MULTIPLE_COLOURS;
  // A colour in free text or a later status token is not a verified colour assignment.
  return COLOURS.find(c => c.toLowerCase() === tokens[0]) || UNMAPPED_COLOUR;
}
/** Exact integer ratios, rounded once to the requested decimal places. Null is not zero. */
export function countRatio(numerator: string | null, denominator: string | null, places = 2): string | null {
  if (numerator === null || denominator === null || !/^-?\d+$/.test(numerator) || !/^\d+$/.test(denominator) || BigInt(denominator) === 0n) return null;
  const n = BigInt(numerator), d = BigInt(denominator), scale = 10n ** BigInt(places);
  const magnitude = ((n < 0n ? -n : n) * 100n * scale * 2n + d) / (2n * d);
  const digits = magnitude.toString().padStart(places + 1, '0');
  return `${n < 0n && magnitude ? '-' : ''}${digits.slice(0, -places)}.${digits.slice(-places)}`;
}
export function periodChange(current: string | null, previous: string | null) {
  if (current === null || previous === null) return {delta: null, percent: null};
  const delta = (BigInt(current) - BigInt(previous)).toString();
  return {delta, percent: countRatio(delta, previous)};
}
export function meanMinutes(seconds: string | null): string | null {
  return seconds === null ? null : (Number(seconds) / 60).toFixed(2);
}
