/** Presentation-only source evidence. Connectivity never certifies a business metric. */
export interface SourceEvidence {
  key: string;
  label: string;
  status: string;
  latestRecordAt: string | null;
  rowCount: number | null;
  missingTimestampRows: number | null;
}
export interface WorkspaceEvidence {
  clientId: string;
  checkedAt: string;
  sources: SourceEvidence[];
}
export type EvidenceTone = 'neutral' | 'warning' | 'error' | 'observed';
export interface EvidencePresentation { label: string; tone: EvidenceTone; explanation: string }

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown, max = 160): string | null =>
  typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null;
const timestamp = (value: unknown): string | null => {
  const str = text(value, 100);
  return str && /^\d{4}-\d{2}-\d{2}T/.test(str) && Number.isFinite(Date.parse(str)) ? str : null;
};
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

export function parseWorkspaceEvidence(input: unknown, expectedClient: string): WorkspaceEvidence {
  const envelope = record(input), data = record(envelope?.data), metadata = record(envelope?.metadata);
  const clientId = text(data?.clientId) || text(metadata?.clientId);
  if (envelope?.success !== true || !data || !expectedClient || clientId !== expectedClient ||
      (data.clientId != null && data.clientId !== expectedClient) ||
      (metadata?.clientId != null && metadata.clientId !== expectedClient) || !Array.isArray(data.sources)) {
    throw new Error('Source evidence could not be validated for this workspace. Retry the check.');
  }
  const checkedAt = timestamp(data.generatedAt);
  if (!checkedAt || data.sources.length > 50) throw new Error('Source evidence is missing a valid check timestamp or source list.');
  const keys = new Set<string>();
  const sources = data.sources.map((raw): SourceEvidence => {
    const row = record(raw), key = text(row?.key), label = text(row?.label), status = text(row?.status, 80);
    if (!key || !label || !status || keys.has(key)) throw new Error('Source evidence contains an invalid or repeated source.');
    keys.add(key);
    // Explicit allowlist: never forward table names, raw errors, credentials or source records.
    return { key, label, status, latestRecordAt: timestamp(row?.latestRecordAt), rowCount: count(row?.rowCount), missingTimestampRows: count(row?.missingTimestampRows) };
  });
  return { clientId, checkedAt, sources };
}

export function sourcePresentation(status: string): EvidencePresentation {
  switch (status.toUpperCase()) {
    case 'OBSERVED': case 'AVAILABLE': case 'CONNECTED':
      return { label: 'Source readable', tone: 'observed', explanation: 'Source observations are available. This does not certify completeness, metric definitions or financial reconciliation.' };
    case 'EMPTY':
      return { label: 'Source empty', tone: 'neutral', explanation: 'The source check succeeded with no rows. This is a workspace-wide source check, not the selected report population.' };
    case 'UNCONFIGURED': case 'NOT_CONFIGURED':
      return { label: 'Not configured', tone: 'neutral', explanation: 'A required source or integration is not configured. Existing supported analytics remain available.' };
    case 'MAPPING_REQUIRED':
      return { label: 'Mapping required', tone: 'warning', explanation: 'An approved ownership or field mapping is required. A credential alone cannot establish it.' };
    case 'FIELDS_MISSING': case 'SCHEMA_MISMATCH': case 'TIMESTAMP_UNAVAILABLE': case 'PARTIAL':
      return { label: 'Incomplete evidence', tone: 'warning', explanation: 'Required fields or usable timestamps are missing. Inspect the source diagnostics before interpreting the affected metrics.' };
    case 'ACCESS_DENIED': case 'PERMISSION_DENIED': case 'FORBIDDEN':
      return { label: 'Access denied', tone: 'error', explanation: 'The deployed identity cannot read this source. An administrator must review its approved access.' };
    case 'UNAUTHENTICATED': case 'AUTHENTICATION_REQUIRED':
      return { label: 'Authentication required', tone: 'error', explanation: 'The source authentication check did not succeed. No zero-valued result has been substituted.' };
    case 'VALIDATION_REQUIRED': case 'OBSERVED_UNVERIFIED': case 'NOT_VERIFIED':
      return { label: 'Validation required', tone: 'warning', explanation: 'Some evidence exists, but source semantics or record links still need validation.' };
    case 'ERROR': case 'QUERY_FAILED': case 'SOURCE_UNAVAILABLE': case 'UNAVAILABLE': case 'TIMEOUT':
      return { label: 'Evidence unavailable', tone: 'error', explanation: 'No usable source evidence was returned. This is not evidence of zero activity.' };
    default:
      return { label: 'Not verified', tone: 'neutral', explanation: 'This source state has not been mapped to a verified capability. Consult the detailed diagnostics.' };
  }
}

export function sourcePurpose(key: string): string {
  const purposes: Record<string, string> = {
    leads: 'Lead intake, delivery, qualification and recorded outcomes.',
    calls: 'Historical contact, agent activity and caller-ID analysis where the required fields are available.',
    marketing: 'Acquisition reporting. Cost ratios separately require observed spend and approved matching keys.',
    activations: 'Partner outcome evidence. Contract linkage and lifecycle meaning require separate validation.',
    diallerRealtime: 'Live agent and queue states require their own feed; historical calls are not live operations.',
    blcLifecycle: 'Post-sale status history requires approved identities and event definitions.',
  };
  return purposes[key] || 'Additional source evidence; availability does not establish business-metric readiness.';
}

export function observedTimestamp(value: string | null, checkedAt: string): string {
  if (!value) return 'No usable event timestamp';
  if (Date.parse(value) > Date.parse(checkedAt)) return 'Future event timestamp — investigate';
  return `${new Date(value).toISOString()} (UTC)`;
}

export function servicePresentation(status: unknown): EvidencePresentation {
  if (status === 'Connected') return { label: 'Check succeeded', tone: 'observed', explanation: 'The latest service check succeeded; this is not financial or data reconciliation.' };
  if (status === 'Not Configured') return { label: 'Not configured', tone: 'neutral', explanation: 'The optional service has not been configured.' };
  if (status === 'Error') return { label: 'Check failed', tone: 'error', explanation: 'The service did not pass its last check. Review server-side configuration and permissions.' };
  return { label: 'Not checked', tone: 'neutral', explanation: 'No current service check is available.' };
}

export function diagnosticLatency(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? `${value} ms` : 'Unavailable';
}

