/**
 * Official Vendor Dispositions Data Contract & Taxonomy
 *
 * Defines the contract for:
 * 1. Mode A: Recorded lead status (Current recorded status for the selected capture cohort)
 * 2. Mode B: Call dispositions (Outcomes recorded on calls made during the selected period)
 *
 * Grounded in:
 * - Lead Ledger: dashboards-422710.lead_ledger.clustered_lead_ledger (hlc_details)
 * - Dialler Records: dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights
 * - Physical source taxonomy: contracts/physicalSources.ts
 * - Call evidence: contracts/callEvidence.ts
 */

export const DISPOSITION_REPORT_VERSION = 'cx.dispositions.1.1.0';

export type DispositionReportingMode = 'lead_status' | 'call_records';

/**
 * Approved comparable disposition groups.
 * Candidate display groups for cross-vendor comparison; not an assumption of identical vendor semantics.
 */
export type ApprovedDispositionGroup =
  | 'CONTACTED_RPC'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'VOICEMAIL'
  | 'CALLBACK_REQUESTED'
  | 'NOT_INTERESTED'
  | 'INVALID_WRONG_NUMBER'
  | 'REPORTED_SALE'
  | 'DO_NOT_CONTACT'
  | 'TECHNICAL_FAILURE'
  | 'OTHER'
  | 'UNMAPPED'
  | 'MISSING_DISPOSITION'
  | 'ZERO_CALLS'
  | 'UNRECORDED_ACTIVITY'
  | 'CONFLICTING_EVIDENCE';

export interface DispositionGroupConfig {
  code: ApprovedDispositionGroup;
  label: string;
  description: string;
  isTerminal: boolean;
  color: string;
}

export const APPROVED_DISPOSITION_GROUPS: Record<ApprovedDispositionGroup, DispositionGroupConfig> = {
  CONTACTED_RPC: {
    code: 'CONTACTED_RPC',
    label: 'Contacted / RPC',
    description: 'Verified human conversation with the right party.',
    isTerminal: false,
    color: '#0284c7', // Sky-600
  },
  REPORTED_SALE: {
    code: 'REPORTED_SALE',
    label: 'Reported Sale',
    description: 'Sale recorded on disposition. Note: sale does not automatically prove RPC.',
    isTerminal: true,
    color: '#16a34a', // Emerald-600
  },
  CALLBACK_REQUESTED: {
    code: 'CALLBACK_REQUESTED',
    label: 'Callback Requested',
    description: 'Consumer or agent requested a future callback.',
    isTerminal: false,
    color: '#8b5cf6', // Violet-500
  },
  NOT_INTERESTED: {
    code: 'NOT_INTERESTED',
    label: 'Not Interested',
    description: 'Contacted consumer declined offer or product.',
    isTerminal: true,
    color: '#f97316', // Orange-500
  },
  NO_ANSWER: {
    code: 'NO_ANSWER',
    label: 'No Answer / Ringing',
    description: 'Ringing without pick-up or response.',
    isTerminal: false,
    color: '#eab308', // Yellow-500
  },
  BUSY: {
    code: 'BUSY',
    label: 'Busy / Engaged',
    description: 'Line busy signal returned.',
    isTerminal: false,
    color: '#d97706', // Amber-600
  },
  VOICEMAIL: {
    code: 'VOICEMAIL',
    label: 'Voicemail / Answering Machine',
    description: 'Automated machine or answering service detected.',
    isTerminal: false,
    color: '#a855f7', // Purple-500
  },
  INVALID_WRONG_NUMBER: {
    code: 'INVALID_WRONG_NUMBER',
    label: 'Invalid / Wrong Number',
    description: 'Number unobtainable, disconnected, or wrong party reached.',
    isTerminal: true,
    color: '#ef4444', // Red-500
  },
  DO_NOT_CONTACT: {
    code: 'DO_NOT_CONTACT',
    label: 'Do Not Contact / DNC',
    description: 'Consumer requested opt-out or DNC listing.',
    isTerminal: true,
    color: '#991b1b', // Red-800
  },
  TECHNICAL_FAILURE: {
    code: 'TECHNICAL_FAILURE',
    label: 'Technical Failure / Drop',
    description: 'Congestion, telco drop, circuit error, or dialler failure.',
    isTerminal: false,
    color: '#64748b', // Slate-500
  },
  OTHER: {
    code: 'OTHER',
    label: 'Other',
    description: 'Known operational code outside standard comparison buckets.',
    isTerminal: false,
    color: '#94a3b8', // Slate-400
  },
  UNMAPPED: {
    code: 'UNMAPPED',
    label: 'Unmapped Disposition',
    description: 'Nonblank raw code recorded by vendor but not yet semantically classified in versioned mapping.',
    isTerminal: false,
    color: '#cbd5e1', // Slate-300
  },
  MISSING_DISPOSITION: {
    code: 'MISSING_DISPOSITION',
    label: 'Missing Disposition',
    description: 'Lead or call record is dialled, but disposition code is blank or null.',
    isTerminal: false,
    color: '#f87171', // Red-400
  },
  ZERO_CALLS: {
    code: 'ZERO_CALLS',
    label: 'Explicit Zero Calls',
    description: 'Lead-status activity state: explicitly recorded 0 calls on ledger.',
    isTerminal: false,
    color: '#e2e8f0', // Slate-200
  },
  UNRECORDED_ACTIVITY: {
    code: 'UNRECORDED_ACTIVITY',
    label: 'Call Activity Unrecorded',
    description: 'Lead-status state: call count and first dial timestamps are absent/indeterminate.',
    isTerminal: false,
    color: '#f1f5f9', // Slate-100
  },
  CONFLICTING_EVIDENCE: {
    code: 'CONFLICTING_EVIDENCE',
    label: 'Conflicting Evidence',
    description: 'Multiple contradictory statuses without deterministic recency ordering.',
    isTerminal: false,
    color: '#fbbf24', // Amber-400
  },
};

/**
 * Versioned vendor disposition mapping table.
 * Keyed by: vendor + source_system + raw_disposition.
 */
export interface RawDispositionMapping {
  vendor: string;
  sourceSystem: string;
  rawCode: string;
  rawDescription?: string;
  approvedGroup: ApprovedDispositionGroup;
  mappingNotes?: string;
}

export const KNOWN_DISPOSITION_MAPPINGS: RawDispositionMapping[] = [
  // BLC / ONtact (Vicidial)
  { vendor: 'BLC', sourceSystem: 'vicidial', rawCode: 'SALE', rawDescription: 'Sale Made', approvedGroup: 'REPORTED_SALE' },
  { vendor: 'BLC', sourceSystem: 'vicidial', rawCode: 'CALLBK', rawDescription: 'Call Back', approvedGroup: 'CALLBACK_REQUESTED' },
  { vendor: 'BLC', sourceSystem: 'vicidial', rawCode: 'NA', rawDescription: 'No Answer', approvedGroup: 'NO_ANSWER' },
  { vendor: 'BLC', sourceSystem: 'vicidial', rawCode: 'B', rawDescription: 'Busy', approvedGroup: 'BUSY' },
  { vendor: 'BLC', sourceSystem: 'vicidial', rawCode: 'A', rawDescription: 'Answering Machine', approvedGroup: 'VOICEMAIL' },
  { vendor: 'BLC', sourceSystem: 'vicidial', rawCode: 'NI', rawDescription: 'Not Interested', approvedGroup: 'NOT_INTERESTED' },
  { vendor: 'BLC', sourceSystem: 'vicidial', rawCode: 'WN', rawDescription: 'Wrong Number', approvedGroup: 'INVALID_WRONG_NUMBER' },
  { vendor: 'BLC', sourceSystem: 'vicidial', rawCode: 'DC', rawDescription: 'Disconnected Number', approvedGroup: 'INVALID_WRONG_NUMBER' },
  { vendor: 'BLC', sourceSystem: 'vicidial', rawCode: 'DNC', rawDescription: 'Do Not Call', approvedGroup: 'DO_NOT_CONTACT' },
  { vendor: 'BLC', sourceSystem: 'vicidial', rawCode: 'DROP', rawDescription: 'Agent Drop', approvedGroup: 'TECHNICAL_FAILURE' },
  { vendor: 'BLC', sourceSystem: 'vicidial', rawCode: 'INCALL', rawDescription: 'Lead Being In-Call', approvedGroup: 'OTHER' },
  { vendor: 'BLC', sourceSystem: 'vicidial', rawCode: 'XFER', rawDescription: 'Transferred', approvedGroup: 'OTHER' },

  // Mondo
  { vendor: 'Mondo', sourceSystem: 'vicidial', rawCode: 'SALE', rawDescription: 'Approved Deal', approvedGroup: 'REPORTED_SALE' },
  { vendor: 'Mondo', sourceSystem: 'vicidial', rawCode: 'CALLBK', rawDescription: 'Customer Callback', approvedGroup: 'CALLBACK_REQUESTED' },
  { vendor: 'Mondo', sourceSystem: 'vicidial', rawCode: 'NA', rawDescription: 'No Answer', approvedGroup: 'NO_ANSWER' },
  { vendor: 'Mondo', sourceSystem: 'vicidial', rawCode: 'B', rawDescription: 'Line Busy', approvedGroup: 'BUSY' },
  { vendor: 'Mondo', sourceSystem: 'vicidial', rawCode: 'VM', rawDescription: 'Voicemail', approvedGroup: 'VOICEMAIL' },
  { vendor: 'Mondo', sourceSystem: 'vicidial', rawCode: 'NI', rawDescription: 'Not Interested', approvedGroup: 'NOT_INTERESTED' },
  { vendor: 'Mondo', sourceSystem: 'vicidial', rawCode: 'DEC', rawDescription: 'Network Declined', approvedGroup: 'NOT_INTERESTED' },
  { vendor: 'Mondo', sourceSystem: 'vicidial', rawCode: 'WN', rawDescription: 'Wrong Number', approvedGroup: 'INVALID_WRONG_NUMBER' },
  { vendor: 'Mondo', sourceSystem: 'vicidial', rawCode: 'DNC', rawDescription: 'Do Not Contact', approvedGroup: 'DO_NOT_CONTACT' },
  { vendor: 'Mondo', sourceSystem: 'vicidial', rawCode: 'CONG', rawDescription: 'Congestion', approvedGroup: 'TECHNICAL_FAILURE' },

  // MTN
  { vendor: 'MTN', sourceSystem: 'vicidial', rawCode: 'SALE', rawDescription: 'Contract Accepted', approvedGroup: 'REPORTED_SALE' },
  { vendor: 'MTN', sourceSystem: 'vicidial', rawCode: 'CALLBK', rawDescription: 'Callback', approvedGroup: 'CALLBACK_REQUESTED' },
  { vendor: 'MTN', sourceSystem: 'vicidial', rawCode: 'NA', rawDescription: 'No Answer', approvedGroup: 'NO_ANSWER' },
  { vendor: 'MTN', sourceSystem: 'vicidial', rawCode: 'B', rawDescription: 'Busy', approvedGroup: 'BUSY' },
  { vendor: 'MTN', sourceSystem: 'vicidial', rawCode: 'AM', rawDescription: 'Answering Machine', approvedGroup: 'VOICEMAIL' },
  { vendor: 'MTN', sourceSystem: 'vicidial', rawCode: 'NI', rawDescription: 'Not Interested', approvedGroup: 'NOT_INTERESTED' },
  { vendor: 'MTN', sourceSystem: 'vicidial', rawCode: 'INV', rawDescription: 'Invalid Number', approvedGroup: 'INVALID_WRONG_NUMBER' },
  { vendor: 'MTN', sourceSystem: 'vicidial', rawCode: 'DNC', rawDescription: 'Do Not Call', approvedGroup: 'DO_NOT_CONTACT' },

  // Real Promotions
  { vendor: 'Real Promotions', sourceSystem: 'vicidial', rawCode: 'SALE', rawDescription: 'Promotional Sale', approvedGroup: 'REPORTED_SALE' },
  { vendor: 'Real Promotions', sourceSystem: 'vicidial', rawCode: 'CALLBK', rawDescription: 'Follow Up', approvedGroup: 'CALLBACK_REQUESTED' },
  { vendor: 'Real Promotions', sourceSystem: 'vicidial', rawCode: 'NA', rawDescription: 'No Answer', approvedGroup: 'NO_ANSWER' },
  { vendor: 'Real Promotions', sourceSystem: 'vicidial', rawCode: 'B', rawDescription: 'Busy Signal', approvedGroup: 'BUSY' },
  { vendor: 'Real Promotions', sourceSystem: 'vicidial', rawCode: 'NI', rawDescription: 'Declined Offer', approvedGroup: 'NOT_INTERESTED' },
  { vendor: 'Real Promotions', sourceSystem: 'vicidial', rawCode: 'WN', rawDescription: 'Wrong Contact', approvedGroup: 'INVALID_WRONG_NUMBER' },

  // BizVoIP
  { vendor: 'BizVoIP', sourceSystem: 'vicidial', rawCode: 'SALE', rawDescription: 'PBX / VoIP Sale', approvedGroup: 'REPORTED_SALE' },
  { vendor: 'BizVoIP', sourceSystem: 'vicidial', rawCode: 'CALLBK', rawDescription: 'Schedule Demo', approvedGroup: 'CALLBACK_REQUESTED' },
  { vendor: 'BizVoIP', sourceSystem: 'vicidial', rawCode: 'NA', rawDescription: 'No Answer', approvedGroup: 'NO_ANSWER' },
  { vendor: 'BizVoIP', sourceSystem: 'vicidial', rawCode: 'B', rawDescription: 'Busy', approvedGroup: 'BUSY' },
  { vendor: 'BizVoIP', sourceSystem: 'vicidial', rawCode: 'NI', rawDescription: 'Not Interested', approvedGroup: 'NOT_INTERESTED' },
  { vendor: 'BizVoIP', sourceSystem: 'vicidial', rawCode: 'RES', rawDescription: 'Residential Only', approvedGroup: 'NOT_INTERESTED' },
  { vendor: 'BizVoIP', sourceSystem: 'vicidial', rawCode: 'WN', rawDescription: 'Wrong Number', approvedGroup: 'INVALID_WRONG_NUMBER' },

  // RewardsCo
  { vendor: 'RewardsCo', sourceSystem: 'vicidial', rawCode: 'SALE', rawDescription: 'Converted Sale', approvedGroup: 'REPORTED_SALE' },
  { vendor: 'RewardsCo', sourceSystem: 'vicidial', rawCode: 'CALLBK', rawDescription: 'Callback', approvedGroup: 'CALLBACK_REQUESTED' },
  { vendor: 'RewardsCo', sourceSystem: 'vicidial', rawCode: 'NA', rawDescription: 'No Answer', approvedGroup: 'NO_ANSWER' },
  { vendor: 'RewardsCo', sourceSystem: 'vicidial', rawCode: 'NI', rawDescription: 'Not Interested', approvedGroup: 'NOT_INTERESTED' },
];

/**
 * Deterministically resolve an approved comparison group for a raw code.
 */
export function resolveApprovedGroup(
  vendor: string,
  rawStatus: string | null | undefined,
  sourceSystem = 'vicidial'
): { group: ApprovedDispositionGroup; description: string; isUnmapped: boolean } {
  if (rawStatus === null || rawStatus === undefined || rawStatus.trim() === '') {
    return {
      group: 'MISSING_DISPOSITION',
      description: 'Missing or blank disposition code',
      isUnmapped: false,
    };
  }

  const cleanRaw = rawStatus.trim().toUpperCase();
  const cleanVendor = vendor.trim();

  // 1. Direct vendor match
  const exact = KNOWN_DISPOSITION_MAPPINGS.find(
    m => m.vendor.toLowerCase() === cleanVendor.toLowerCase() && m.rawCode.toUpperCase() === cleanRaw
  );
  if (exact) {
    return {
      group: exact.approvedGroup,
      description: exact.rawDescription || exact.rawCode,
      isUnmapped: false,
    };
  }

  // 2. Generic vicidial match across any vendor
  const generic = KNOWN_DISPOSITION_MAPPINGS.find(m => m.rawCode.toUpperCase() === cleanRaw);
  if (generic) {
    return {
      group: generic.approvedGroup,
      description: generic.rawDescription || cleanRaw,
      isUnmapped: false,
    };
  }

  // 3. Fallback based on well-known standard keywords if present in description
  if (/^SALE\b/i.test(cleanRaw)) return { group: 'REPORTED_SALE', description: cleanRaw, isUnmapped: false };
  if (/^CALLBK\b|^CALLBACK/i.test(cleanRaw)) return { group: 'CALLBACK_REQUESTED', description: cleanRaw, isUnmapped: false };
  if (/^NA\b|^NO.?ANS/i.test(cleanRaw)) return { group: 'NO_ANSWER', description: cleanRaw, isUnmapped: false };
  if (/^BUSY\b|^B\b/i.test(cleanRaw)) return { group: 'BUSY', description: cleanRaw, isUnmapped: false };
  if (/^VM\b|^VOICEMAIL\b|^ANS/i.test(cleanRaw)) return { group: 'VOICEMAIL', description: cleanRaw, isUnmapped: false };
  if (/^DNC\b|^DO.?NOT/i.test(cleanRaw)) return { group: 'DO_NOT_CONTACT', description: cleanRaw, isUnmapped: false };
  if (/^NI\b|^NOT.?INT/i.test(cleanRaw)) return { group: 'NOT_INTERESTED', description: cleanRaw, isUnmapped: false };
  if (/^WN\b|^WRONG\b|^INV/i.test(cleanRaw)) return { group: 'INVALID_WRONG_NUMBER', description: cleanRaw, isUnmapped: false };
  if (/^DROP\b|^CONG/i.test(cleanRaw)) return { group: 'TECHNICAL_FAILURE', description: cleanRaw, isUnmapped: false };

  // 4. Truly unmapped nonblank code
  return {
    group: 'UNMAPPED',
    description: `Raw code '${rawStatus}' not yet classified`,
    isUnmapped: true,
  };
}

export interface VendorDispositionSummaryItem {
  vendor: string;
  totalPopulation: number;
  dialledCount: number;
  zeroCallCount?: number;
  unrecordedActivityCount?: number;
  recordedDispositionCount: number;
  missingDispositionCount: number;
  unmappedDispositionCount: number;
  dispositionCoveragePct: number | null;
  mappingCoveragePct: number | null;
  rpcCount: number;
  saleCount: number;
  callbackCount: number;
  sourceTable: string;
  dateBasis: string;
  latestObservedFeedback: string | null;
  coverageLimitations: string[];
}

export interface DetailedDispositionRow {
  vendor: string;
  rawDisposition: string;
  rawDescription: string;
  approvedGroup: ApprovedDispositionGroup;
  approvedGroupLabel: string;
  count: number;
  percentOfBase: number | null;
  distinctLeadVendorPairs: number | null;
  rpcCount: number;
  saleCount: number;
  callbackCount: number;
  avgDurationSec: number | null;
  validDurationCount: number | null;
  latestObservation: string | null;
}

export interface DispositionMatrixCell {
  vendor: string;
  group: ApprovedDispositionGroup;
  groupLabel: string;
  count: number;
  percentOfVendor: number | null;
}

export interface DispositionTrendItem {
  periodDate: string;
  vendor: string;
  group: ApprovedDispositionGroup;
  count: number;
}

export interface ContactDispositionsData {
  reportVersion: string;
  mode: DispositionReportingMode;
  modeHeading: string;
  modeDescription: string;
  dateBasis: string;
  countingGrain: string;
  summary: {
    totalEntities: number;
    dialledEntities: number;
    recordedDispositions: number;
    missingDispositions: number;
    unmappedDispositions: number;
    dispositionCoveragePct: number | null;
    rpcCount: number;
    saleCount: number;
    callbackCount: number;
  };
  vendorSummaries: VendorDispositionSummaryItem[];
  breakdown: DetailedDispositionRow[];
  matrix: DispositionMatrixCell[];
  trends: DispositionTrendItem[];
  comparableGroups: Array<{ code: ApprovedDispositionGroup; label: string; color: string }>;
  capabilities: {
    leadStatusSupported: boolean;
    callRecordsSupported: boolean;
    supportedFilters: string[];
    unsupportedFilters: string[];
  };
  methodology: string;
  evaluatedAt: string;
}
