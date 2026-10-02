import { compareExactDecimal, exactDecimal, subtractExactDecimals } from '../../../contracts/exactDecimal';

/** These describe independent evidence dimensions, never an aggregate quality score. */
export type AuditState = 'observed' | 'mapped' | 'scoped' | 'reproduced' | 'reconciled' | 'business_verified' | 'partial' | 'mismatch' | 'not_verified' | 'unavailable' | 'formula_checked' | 'api_consistent' | 'presentation_consistent';
export type AuditValue = number | string | null;
export interface AuditDimension { key: string; label: string; state: AuditState; detail?: string }
/** Both flags must be explicitly true; only the caller knows drill semantics and access. */
export interface AuditAction { label: string; onClick: () => void; supported: true; authorized: true }
export interface AuditPopulation { key: string; label: string; value: AuditValue; state?: AuditState; detail?: string }
export type EvidenceTraceNodeType = 'source' | 'field' | 'normalization' | 'qualification' | 'metric' | 'api' | 'display' | 'reconciliation' | 'business';
export interface EvidenceTraceNode { key: string; type: EvidenceTraceNodeType; label: string; value?: AuditValue; state: AuditState; detail?: string; action?: AuditAction }
export interface MetricAnatomyModel {
  kind: 'count' | 'ratio' | 'independent_ratio' | 'financial' | 'value';
  label: string; value?: AuditValue; unit?: string;
  numerator?: AuditPopulation; denominator?: AuditPopulation;
  scaling?: 'percentage_value' | 'ratio_fraction' | 'per_thousand';
  formula?: string; detail?: string; completeness?: AuditDimension; secondary?: AuditPopulation[];
}
export interface EvidenceCoverageModel {
  label: string; categories: AuditPopulation[];
  /** Composition is opt-in and requires disjoint populations in the same grain/scope. */
  composition?: 'mutually-exclusive' | 'separate'; populationLabel?: string; detail?: string;
}
export interface AuditExclusion extends AuditPopulation { action?: AuditAction }
export interface EvidenceExclusionsModel {
  label: string; recorded?: AuditPopulation; qualified?: AuditPopulation; excluded?: AuditPopulation;
  reasons: AuditExclusion[]; detail?: string;
}
export type AuditReconciliationKind = 'source_reconciliation' | 'delivery_consistency' | 'immutable_reproduction' | 'formula_check' | 'business_verification';
export interface AuditComparison { key: string; label: string; observed: AuditValue; expected: AuditValue; detail?: string }
export interface AuditReconciliationModel {
  label: string; kind: AuditReconciliationKind; state: AuditState; values: AuditPopulation[];
  comparisons?: AuditComparison[]; scopeDescription?: string; detail?: string;
}
export interface AuditDependency extends AuditPopulation { required?: boolean; available?: boolean; dependencies?: string[]; action?: AuditAction }
export interface AuditDependencyModel { label: string; inputs: AuditDependency[]; outputs?: AuditDependency[]; detail?: string }

export const AUDIT_STATE_LABELS: Record<AuditState, string> = {
  observed: 'Observed', mapped: 'Mapping defined', scoped: 'Scope applied', reconciled: 'Reconciled for scope',
  business_verified: 'Business verified', partial: 'Partial evidence', mismatch: 'Mismatch',
  not_verified: 'Not verified', unavailable: 'Unavailable', formula_checked: 'Formula checked',
  api_consistent: 'API consistent', presentation_consistent: 'Presentation consistent',
  reproduced: 'Reproduced for scope',
};
export const TRACE_NODE_LABELS: Record<EvidenceTraceNodeType, string> = {
  source: 'Source', field: 'Field', normalization: 'Normalisation', qualification: 'Qualification',
  metric: 'Metric', api: 'API result', display: 'Display', reconciliation: 'Reconciliation', business: 'Business verification',
};
export const RECONCILIATION_KIND_LABELS: Record<AuditReconciliationKind, string> = {
  source_reconciliation: 'Independent source reconciliation', delivery_consistency: 'Delivery consistency check',
  formula_check: 'Formula check', business_verification: 'Business meaning verification',
  immutable_reproduction: 'Immutable result reproducibility',
};
export function auditStateLabel(state: AuditState): string { return AUDIT_STATE_LABELS[state]; }
export function formatAuditValue(value: AuditValue | undefined): string {
  if (!isAvailableAuditValue(value)) return 'Unavailable';
  // Decimal strings preserve warehouse precision; number values preserve returned precision.
  if (typeof value !== 'number') return value!;
  const localized = value.toLocaleString('en-US', { maximumFractionDigits: 20 });
  // Locale formatting must not turn a tiny nonzero value into zero or round supplied precision.
  return Number(localized.replaceAll(',', '')) === value ? localized : String(value);
}
export function isAvailableAuditValue(value: AuditValue | undefined): boolean {
  return value != null && (typeof value === 'number' ? Number.isFinite(value) : value.trim().length > 0 && !/^(?:—(?:\s|$)|(?:Unavailable|Timestamp unavailable)(?:\s|%|$)|Not (?:recorded|supplied|measured|calculable)$)/i.test(value.trim()));
}
/** Coordinates are approximate. Exact supplied values always remain visible beside a bar. */
export function auditMagnitude(value: AuditValue | undefined): number | null {
  if (value == null || (typeof value === 'string' && exactDecimal(value) === null)) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}
export function canComposeCoverage(model: EvidenceCoverageModel): boolean {
  return model.composition === 'mutually-exclusive' && model.categories.length > 0 && model.categories.every(category => auditMagnitude(category.value) !== null);
}
export function canUseAuditAction(action?: AuditAction): action is AuditAction {
  return Boolean(action && action.supported === true && action.authorized === true && typeof action.onClick === 'function');
}
function decimalForDelta(value: AuditValue): string | null {
  if (typeof value !== 'number') return exactDecimal(value);
  if (!Number.isFinite(value)) return null;
  // Unsafe integer numbers have already lost precision and cannot establish an exact delta.
  if (Number.isInteger(value) && !Number.isSafeInteger(value)) return null;
  const supplied = String(value);
  const exponent = supplied.match(/^(-?)(\d+)(?:\.(\d+))?e([+-]?\d+)$/i);
  if (!exponent) return exactDecimal(supplied);
  // Expand lexical notation only; do not round or reconstruct additional precision.
  const [, sign, whole, fraction = '', power] = exponent;
  const digits = whole + fraction;
  const point = whole.length + Number(power);
  const plain = point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? digits + '0'.repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return exactDecimal(sign + plain);
}
/** Supplied observed minus supplied expected. No status or verification is inferred. */
export function exactAuditDelta(observed: AuditValue, expected: AuditValue): string | null {
  const actual = decimalForDelta(observed), reference = decimalForDelta(expected);
  if (actual === null || reference === null) return null;
  const delta = subtractExactDecimals(actual, reference);
  return compareExactDecimal(delta, '0') > 0 ? `+${delta}` : delta;
}
/** This count is literal required-input availability, not confidence or financial completeness. */
export function requiredInputAvailability(inputs: AuditDependency[]): { available: number; total: number } | null {
  const required = inputs.filter(input => input.required === true);
  if (!required.length || required.some(input => typeof input.available !== 'boolean')) return null;
  return { available: required.filter(input => input.available === true).length, total: required.length };
}
