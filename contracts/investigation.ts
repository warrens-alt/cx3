/** Public investigation display metadata. Qualification stays in the shared server predicate builder. */
export interface InvestigationReason {
  code: string;
  label: string;
  detail?: string;
}

export interface InvestigationNarrowing {
  segmentVendor?: string;
  segmentSource?: string;
  segmentGrade?: string;
  /** Delivery→first dial buckets used by the existing descriptive driver decomposition. */
  segmentLeadAge?: string;
}

export const DRIVER_FIRST_DIAL_AGES = ['Not delivered', 'Undialled', 'Invalid timing', '0–5m', '5–15m', '15–30m', '30–60m', '1–6h', '6–24h', '24h+'] as const;

export const INVESTIGATION_LABELS: Record<string, string> = {
  'awaiting-first-dial': 'Awaiting first dial', 'waiting-over-hour': 'Waiting longer than one hour',
  'sla-breach': '15-minute first-dial breach', 'missing-disposition': 'Missing disposition',
  'zero-call-leads': 'Zero recorded calls', 'one-call-only': 'One-call-only leads',
  'high-attempt-no-rpc': '5+ calls without RPC', 'sales-awaiting-activation': 'Sales awaiting activation',
  'unactivated-sales': 'Sales awaiting activation over 14 days', 'missing-source': 'Missing source',
  'missing-vendor': 'Missing vendor', 'missing-grade': 'Missing grade', 'invalid-timestamps': 'Out-of-order lifecycle timestamps',
  'backlog-age': 'Undialled delivery age', 'funnel-stage': 'Funnel stage', 'funnel-loss': 'Funnel transition loss',
  'lead-age': 'Capture to first dial', 'delivery-age': 'Delivery to first dial', 'call-effort': 'Recorded call effort',
  'lifecycle-segment': 'Lifecycle segment', 'lifecycle-vendor': 'Vendor segment', 'lifecycle-source': 'Source segment', 'lifecycle-grade': 'Grade segment',
};

const exceptionReasons: Record<string, InvestigationReason> = {
  'awaiting-first-dial': { code: 'AWAITING_FIRST_DIAL', label: 'Delivered · no recorded first dial' },
  'waiting-over-hour': { code: 'WAITING_OVER_HOUR', label: 'Delivered over 1h ago · no recorded first dial' },
  'sla-breach': { code: 'SLA_BREACH', label: 'Delivery → first dial exceeds 15m, or undialled for over 15m', detail: 'The shared 15-minute rule includes recorded late first dials and currently undialled deliveries.' },
  'missing-disposition': { code: 'MISSING_DISPOSITION', label: 'Dial evidence present · disposition unavailable' },
  'zero-call-leads': { code: 'ZERO_CALL_LEADS', label: 'Exactly 0 recorded calls', detail: 'A recorded zero counter qualifies. Missing call counters do not.' },
  'one-call-only': { code: 'ONE_CALL_ONLY', label: 'Exactly 1 recorded call · first dial recorded' },
  'high-attempt-no-rpc': { code: 'HIGH_ATTEMPT_NO_RPC', label: '5+ recorded calls · RPC explicitly false', detail: 'Missing RPC evidence is excluded from this predicate.' },
  'sales-awaiting-activation': { code: 'SALES_AWAITING_ACTIVATION', label: 'Sale recorded · activation not recorded' },
  'unactivated-sales': { code: 'UNACTIVATED_SALES', label: 'Sale recorded over 14 days ago · activation not recorded' },
  'missing-source': { code: 'MISSING_SOURCE', label: 'Source unavailable or blank' },
  'missing-vendor': { code: 'MISSING_VENDOR', label: 'Representative vendor unavailable or Unknown' },
  'missing-grade': { code: 'MISSING_GRADE', label: 'Grade unavailable or blank' },
  'invalid-timestamps': { code: 'INVALID_TIMESTAMPS', label: 'Recorded timestamp order is inconsistent', detail: 'The shared lifecycle rule checks delivery, first dial, sale and activation against their applicable predecessor timestamps.' },
};

const stages: Record<string, string> = { fetched: 'Capture recorded in the selected cohort', delivered: 'Delivery recorded', dialled: 'First dial recorded', rpc: 'RPC recorded', sales: 'Sale recorded', activated: 'Activation recorded' };
const losses: Record<string, string> = {
  'fetched-to-delivered': 'Captured → delivered · no recorded delivery',
  'delivered-to-dialled': 'Delivered → dialled · no recorded first dial',
  'dialled-to-rpc': 'Dialled → RPC · RPC false or unavailable',
  'rpc-to-sales': 'RPC → sale · no recorded sale',
  'sales-to-activated': 'Sale → activation · no recorded activation',
};
const backlogAges = ['0–15m', '15–30m', '30–60m', '1–6h', '6–12h', '12–24h', '24h+'];
const timingAges = ['Invalid timing', '0–5m', '0–15m', '5–15m', '15–30m', '30–60m', '1–3h', '3–6h', '6–12h', '12–24h', '1–6h', '6–24h', '24h+'];
const callBuckets = ['0 calls', '1 call', '2 calls', '3 calls', '4 calls', '5+ calls', 'Unrecorded'];

/** A label describes a supported qualification; it never evaluates or invents record evidence. */
export function investigationReasonFor(drill?: string | null, value?: string | null): InvestigationReason | undefined {
  if (!drill) return undefined;
  if (Object.hasOwn(exceptionReasons, drill)) return { ...exceptionReasons[drill] };
  const selected = value || '';
  if (drill === 'funnel-stage' && Object.hasOwn(stages, selected)) return { code: 'FUNNEL_STAGE', label: stages[selected] };
  if (drill === 'funnel-loss' && Object.hasOwn(losses, selected)) return { code: 'FUNNEL_LOSS', label: losses[selected] };
  if (drill === 'backlog-age' && backlogAges.includes(selected)) return { code: 'BACKLOG_AGE', label: `Delivered · no recorded first dial · delivery age ${selected}` };
  if (drill === 'call-effort' && callBuckets.includes(selected)) return { code: 'CALL_EFFORT', label: selected === 'Unrecorded' ? 'Cumulative call counter unavailable' : `${selected} recorded` };
  if (drill === 'lead-age' || drill === 'delivery-age') {
    if (selected === 'Not delivered') return { code: 'TIMING_NO_DELIVERY', label: 'Delivery not recorded' };
    if (selected === 'Undialled') return { code: 'TIMING_NO_FIRST_DIAL', label: drill === 'delivery-age' ? 'Delivered · no recorded first dial' : 'No recorded first dial' };
    if (timingAges.includes(selected)) return { code: 'FIRST_DIAL_AGE', label: `${drill === 'lead-age' ? 'Capture' : 'Delivery'} → first dial · ${selected}` };
  }
  const colon = selected.indexOf(':');
  const dimension = drill === 'lifecycle-segment' && colon >= 0 ? selected.slice(0, colon).trim().toLowerCase() : drill.replace('lifecycle-', '');
  const segment = drill === 'lifecycle-segment' ? selected.slice(colon + 1).trim() : selected.trim();
  if (drill.startsWith('lifecycle-') && ['vendor', 'source', 'grade'].includes(dimension) && segment) {
    return { code: 'LIFECYCLE_SEGMENT', label: `${dimension[0].toUpperCase()}${dimension.slice(1)} = ${segment}` };
  }
  return undefined;
}

/** Additive narrowing is part of record inclusion even when no exception predicate is active. */
export function investigationScopeReason(scope: InvestigationNarrowing & { drill?: string | null; drillValue?: string | null }): InvestigationReason | undefined {
  const reason = investigationReasonFor(scope.drill, scope.drillValue);
  const segments = [
    scope.segmentVendor ? `Vendor = ${scope.segmentVendor}` : null,
    scope.segmentSource ? `Source = ${scope.segmentSource}` : null,
    scope.segmentGrade ? `Grade = ${scope.segmentGrade}` : null,
    scope.segmentLeadAge ? `Delivery → first-dial age = ${scope.segmentLeadAge}` : null,
  ].filter(Boolean).join(' · ');
  // An unsupported predicate never receives a plausible substitute reason.
  if (scope.drill && !reason) return undefined;
  if (reason) return segments ? { ...reason, detail: [reason.detail, `Investigation narrowing: ${segments}.`].filter(Boolean).join(' ') } : reason;
  return segments ? { code: 'INVESTIGATION_SEGMENT', label: segments } : undefined;
}

/** Investigation URL state is scalar. Repeated values must never be reduced with URLSearchParams.get(). */
export const INVESTIGATION_URL_QUERY_KEYS = ['drill', 'drillValue', 'investigationMetric', 'segmentVendor', 'segmentSource', 'segmentGrade', 'segmentLeadAge', 'search'] as const;
const SINGLE_VALUE_SCOPE_QUERY_KEYS = [
  ...INVESTIGATION_URL_QUERY_KEYS,
  'clientId', 'startDate', 'endDate', 'filters',
  'source', 'vendor', 'medium', 'grade', 'cli', 'campaign', 'channel', 'adset', 'agent',
] as const;

export function duplicateInvestigationScopeKeys(params: URLSearchParams): string[] {
  return SINGLE_VALUE_SCOPE_QUERY_KEYS.filter(key => params.getAll(key).length > 1);
}

/** Includes scalar reporting identity/bounds because frontend contexts would otherwise discard duplicates. */
export function validateInvestigationUrlScope(params: URLSearchParams): void {
  const repeated = duplicateInvestigationScopeKeys(params);
  if (!repeated.length) return;
  const workspaceAction = repeated.includes('clientId') ? ' Choose one workspace explicitly using the workspace selector.' : '';
  throw new Error(`The URL contains repeated scope parameters: ${repeated.join(', ')}. Each must appear once; no value has been chosen.${workspaceAction}`);
}

/** A deliberate reset removes ambiguous scope; it never selects a first/last duplicate or a default workspace. */
export function resetAmbiguousInvestigationUrlScope(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  const repeated = duplicateInvestigationScopeKeys(params);
  const investigationKeys: ReadonlySet<string> = new Set(INVESTIGATION_URL_QUERY_KEYS);
  if (repeated.some(key => investigationKeys.has(key))) {
    // The predicate and its value form one population definition. Clear the complete investigation together.
    for (const key of INVESTIGATION_URL_QUERY_KEYS) next.delete(key);
    next.delete('page'); next.delete('leadId');
  }
  if (repeated.includes('startDate') || repeated.includes('endDate')) {
    next.delete('startDate'); next.delete('endDate');
  }
  for (const key of repeated) {
    // An ambiguous tenant must be corrected by an explicit authorised workspace selection.
    if (key !== 'clientId') next.delete(key);
  }
  return next;
}
