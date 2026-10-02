import { RequestError } from '../../bigquery/filters';
import type { OffernetQueryParams } from '../common/types';
import { DRIVER_FIRST_DIAL_AGES } from '../../../contracts/investigation';

/** Shared predicates keep queue counts and administrator record drills at identical lead grain. */
export const EXCEPTION_DEFINITIONS = [
  { id: 'awaiting-first-dial', title: 'Awaiting first dial', severity: 'medium', detail: 'Qualified delivered leads without a chronologically qualified first dial; recorded invalid dials remain visible.' },
  { id: 'waiting-over-hour', title: 'Waiting longer than one hour', severity: 'high', detail: 'Qualified delivered leads without a qualified first dial more than 60 minutes after delivery.' },
  { id: 'sla-breach', title: '15-minute first-dial breach', severity: 'high', detail: 'Qualified delivery-to-first-dial exceeds 15 minutes, or delivery age without a qualified dial exceeds 15 minutes.' },
  { id: 'missing-disposition', title: 'Missing disposition', severity: 'medium', detail: 'Dialled leads without a recorded dialler disposition.' },
  { id: 'zero-call-leads', title: 'Zero recorded calls', severity: 'medium', detail: 'Recorded cumulative call counter equals zero. Missing counters are excluded.' },
  { id: 'one-call-only', title: 'One-call-only leads', severity: 'low', detail: 'Dialled leads with exactly one recorded cumulative call.' },
  { id: 'high-attempt-no-rpc', title: '5+ calls without RPC', severity: 'medium', detail: 'At least five recorded calls and an explicitly false RPC outcome.' },
  { id: 'sales-awaiting-activation', title: 'Sales awaiting activation', severity: 'medium', detail: 'Recorded sale timestamp without a recorded activation timestamp.' },
  { id: 'unactivated-sales', title: 'Sales awaiting activation over 14 days', severity: 'high', detail: 'Unactivated sales recorded more than 14 days ago.' },
  { id: 'missing-source', title: 'Missing source', severity: 'low', detail: 'No nonblank source on the scoped lead.' },
  { id: 'missing-vendor', title: 'Missing vendor', severity: 'medium', detail: 'No nonblank vendor on the representative scoped lead.' },
  { id: 'missing-grade', title: 'Missing grade', severity: 'low', detail: 'No nonblank lead grade.' },
  { id: 'invalid-timestamps', title: 'Out-of-order lifecycle timestamps', severity: 'high', detail: 'Delivery before capture, dial before capture/delivery, sale before capture or activation before sale. Missing and sentinel capture dates cannot belong to a capture-date cohort.' },
] as const;

export function exceptionPredicate(id: string, alias = 'm', asOf = 'CURRENT_TIMESTAMP()'): string | undefined {
  const a = `${alias}.`;
  const wait = `TIMESTAMP_DIFF(${asOf}, ${a}delivered_ts, SECOND)`;
  const timing = `TIMESTAMP_DIFF(${a}first_call_ts, ${a}delivered_ts, SECOND)`;
  const predicates: Record<string, string> = {
    'awaiting-first-dial': `${a}is_delivered AND NOT ${a}is_dialled`,
    'waiting-over-hour': `${a}is_delivered AND NOT ${a}is_dialled AND ${wait} > 3600`,
    'sla-breach': `${a}is_delivered AND ((${a}is_dialled AND ${timing} > 900) OR (NOT ${a}is_dialled AND ${wait} > 900))`,
    'missing-disposition': `${a}is_dialled AND NOT ${a}has_disposition`,
    'zero-call-leads': `${a}recorded_call_count = 0`,
    'one-call-only': `${a}is_dialled AND ${a}recorded_call_count = 1`,
    'high-attempt-no-rpc': `${a}recorded_call_count >= 5 AND ${a}is_rpc IS FALSE`,
    'sales-awaiting-activation': `${a}is_sale AND NOT ${a}is_activated`,
    'unactivated-sales': `${a}is_sale AND NOT ${a}is_activated AND TIMESTAMP_DIFF(${asOf}, ${a}sale_ts, DAY) > 14`,
    'missing-source': `NULLIF(TRIM(${a}source), '') IS NULL`,
    'missing-vendor': `NULLIF(TRIM(${a}vendor), '') IS NULL OR ${a}vendor = 'Unknown'`,
    'missing-grade': `NULLIF(TRIM(${a}grade), '') IS NULL`,
    'invalid-timestamps': `${a}delivered_ts < ${a}fetched_ts OR ${a}first_call_ts < ${a}fetched_ts OR ${a}first_call_ts < ${a}delivered_ts OR ${a}sale_ts < ${a}fetched_ts OR ${a}activation_ts < ${a}sale_ts`,
  };
  return Object.hasOwn(predicates, id) ? predicates[id] : undefined;
}

const LIFECYCLE_SEGMENT_DIMENSIONS = ['vendor', 'source', 'grade'] as const;
type LifecycleSegmentDimension = typeof LIFECYCLE_SEGMENT_DIMENSIONS[number];

function isLifecycleSegmentDimension(dimension: string): dimension is LifecycleSegmentDimension {
  return (LIFECYCLE_SEGMENT_DIMENSIONS as readonly string[]).includes(dimension);
}

function lifecycleSegmentPredicate(dimension: LifecycleSegmentDimension): string {
  return `COALESCE(NULLIF(TRIM(m.${dimension}), ''), 'Unrecorded') = @lifecycleSegmentValue`;
}

/** One predicate builder for record qualification, scoped synthesis and descriptive drivers. */
export function buildInvestigationPredicate(params: OffernetQueryParams, queryParams: Record<string, any>, alias = 'm', asOf = 'CURRENT_TIMESTAMP()'): string {
  if (params.drillValue && !params.drill) throw new RequestError('Investigation drillValue requires a supported drill predicate', 422);
  // These predicates share the exact lead grain and normalized timestamps used by the widgets.
  const wait = `TIMESTAMP_DIFF(${asOf}, ${alias}.delivered_ts, SECOND)`;
  let drillCondition = '';
  if (params.drill) {
    const value = params.drillValue || '';
    let condition: string | undefined = exceptionPredicate(params.drill, alias, asOf);
    if (!condition) switch (params.drill) {
      case 'backlog-age': {
        const buckets: Record<string, string> = {
          '0–15m': `${wait} BETWEEN 0 AND 900`,
          '15–30m': `${wait} > 900 AND ${wait} <= 1800`,
          '30–60m': `${wait} > 1800 AND ${wait} <= 3600`,
          '1–6h': `${wait} > 3600 AND ${wait} <= 21600`,
          '6–12h': `${wait} > 21600 AND ${wait} <= 43200`,
          '12–24h': `${wait} > 43200 AND ${wait} <= 86400`,
          '24h+': `${wait} > 86400`,
        };
        if (!Object.hasOwn(buckets, value)) throw new RequestError('Unsupported backlog drill bucket', 422);
        condition = `m.is_delivered AND NOT m.is_dialled AND ${buckets[value]}`;
        break;
      }
      case 'funnel-stage': condition = ({ fetched: 'TRUE', delivered: 'm.is_delivered', dialled: 'm.is_dialled', rpc: 'm.is_qualified_rpc', sales: 'm.is_sale', activated: 'm.is_activated' } as Record<string, string>)[value]; break;
      case 'delivery-age':
      case 'lead-age': {
        const timing = params.drill === 'lead-age' ? 'TIMESTAMP_DIFF(m.first_call_ts, m.fetched_ts, SECOND)' : `TIMESTAMP_DIFF(${alias}.first_call_ts, ${alias}.delivered_ts, SECOND)`;
        const buckets: Record<string, string> = {
          'Invalid timing': params.drill === 'delivery-age'
            ? '(m.has_recorded_delivery AND NOT m.is_delivered) OR (m.is_delivered AND m.has_recorded_first_dial AND NOT m.is_dialled)'
            : 'm.has_recorded_first_dial AND NOT m.is_dialled',
          '0–5m': `${timing} BETWEEN 0 AND 300`,
          '0–15m': `${timing} BETWEEN 0 AND 900`,
          '5–15m': `${timing} > 300 AND ${timing} <= 900`,
          '15–30m': `${timing} > 900 AND ${timing} <= 1800`,
          '30–60m': `${timing} > 1800 AND ${timing} <= 3600`,
          '1–3h': `${timing} > 3600 AND ${timing} <= 10800`,
          '3–6h': `${timing} > 10800 AND ${timing} <= 21600`,
          '6–12h': `${timing} > 21600 AND ${timing} <= 43200`,
          '12–24h': `${timing} > 43200 AND ${timing} <= 86400`,
          '1–6h': `${timing} > 3600 AND ${timing} <= 21600`,
          '6–24h': `${timing} > 21600 AND ${timing} <= 86400`,
          '24h+': `${timing} > 86400`,
        };
        condition = value === 'Not delivered' ? 'NOT m.has_recorded_delivery' : value === 'Undialled' ? (params.drill === 'lead-age' ? 'NOT m.has_recorded_first_dial' : 'm.is_delivered AND NOT m.has_recorded_first_dial') : Object.hasOwn(buckets, value) ? (value === 'Invalid timing' ? buckets[value] : `m.is_dialled AND ${buckets[value]}`) : undefined;
        break;
      }
      case 'funnel-loss': condition = ({
        'fetched-to-delivered': 'NOT m.is_delivered',
        'delivered-to-dialled': 'm.is_delivered AND NOT m.is_dialled',
        'dialled-to-rpc': 'm.is_dialled AND (m.is_rpc IS FALSE OR m.is_rpc IS NULL)',
        'rpc-to-sales': 'm.is_qualified_rpc AND NOT m.has_qualified_rpc_sale',
        'sales-to-activated': 'm.is_sale AND NOT m.is_qualified_activation',
      } as Record<string, string>)[value]; break;
      case 'call-effort': {
        const buckets: Record<string, string> = {
          '0 calls': 'm.recorded_call_count = 0',
          '1 call': 'm.recorded_call_count = 1',
          '2 calls': 'm.recorded_call_count = 2',
          '3 calls': 'm.recorded_call_count = 3',
          '4 calls': 'm.recorded_call_count = 4',
          '5+ calls': 'm.recorded_call_count >= 5',
          'Unrecorded': 'm.recorded_call_count IS NULL',
        };
        const bucketCondition = Object.hasOwn(buckets, value) ? buckets[value] : undefined;
        if (!bucketCondition) throw new RequestError(`Unsupported call effort bucket: ${value}`, 422);
        condition = bucketCondition;
        break;
      }
      case 'lifecycle-segment': {
        const colonIndex = value.indexOf(':');
        if (colonIndex === -1) throw new RequestError('Invalid lifecycle segment drill value format', 422);
        const dimension = value.slice(0, colonIndex).trim().toLowerCase();
        const segmentValue = value.slice(colonIndex + 1).trim();
        if (!isLifecycleSegmentDimension(dimension)) {
          throw new RequestError(`Unsupported lifecycle segment dimension: ${dimension}`, 422);
        }
        if (!segmentValue) throw new RequestError('Missing lifecycle segment value', 422);
        queryParams.lifecycleSegmentValue = segmentValue;
        condition = lifecycleSegmentPredicate(dimension);
        break;
      }
      case 'lifecycle-vendor':
      case 'lifecycle-source':
      case 'lifecycle-grade': {
        const dimension = params.drill.replace('lifecycle-', '');
        const segmentValue = value.trim();
        if (!isLifecycleSegmentDimension(dimension)) {
          throw new RequestError(`Unsupported lifecycle segment dimension: ${dimension}`, 422);
        }
        if (!segmentValue) throw new RequestError('Missing lifecycle segment value', 422);
        queryParams.lifecycleSegmentValue = segmentValue;
        condition = lifecycleSegmentPredicate(dimension);
        break;
      }
      default: throw new RequestError('Unsupported drill-down population', 422);
    }
    if (typeof condition !== 'string' || !condition) throw new RequestError(`Unsupported ${params.drill} drill`, 422);
    drillCondition = condition;
  }

  const conditions = drillCondition ? [drillCondition] : [];
  for (const [key, dimension] of [['segmentVendor', 'vendor'], ['segmentSource', 'source'], ['segmentGrade', 'grade']] as const) {
    const value = params[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !value.trim()) throw new RequestError(`Missing ${dimension} investigation segment`, 422);
    queryParams[key] = value.trim();
    conditions.push(`COALESCE(NULLIF(TRIM(m.${dimension}), ''), 'Unrecorded') = @${key}`);
  }
  if (params.segmentLeadAge !== undefined) {
    if (!DRIVER_FIRST_DIAL_AGES.includes(params.segmentLeadAge as typeof DRIVER_FIRST_DIAL_AGES[number])) {
      throw new RequestError('Unsupported investigation first-dial age segment', 422);
    }
    queryParams.segmentLeadAge = params.segmentLeadAge;
    // The driver's first-dial age is delivery→first dial, with missing delivery checked first.
    conditions.push(`(${driverFirstDialAgeSql('m')}) = @segmentLeadAge`);
  }
  return (conditions.length > 1 ? conditions.map(condition => `(${condition})`).join(' AND ') : conditions[0] || '').replace(/\bm\./g, `${alias}.`);
}

export function driverFirstDialAgeSql(alias = 'm'): string {
  const timing = `TIMESTAMP_DIFF(${alias}.first_call_ts, ${alias}.delivered_ts, SECOND)`;
  return `CASE
    WHEN ${alias}.delivered_ts IS NULL THEN 'Not delivered'
    WHEN ${alias}.first_call_ts IS NULL THEN 'Undialled'
    WHEN NOT ${alias}.is_dialled THEN 'Invalid timing'
    WHEN ${timing} <= 300 THEN '0–5m'
    WHEN ${timing} <= 900 THEN '5–15m'
    WHEN ${timing} <= 1800 THEN '15–30m'
    WHEN ${timing} <= 3600 THEN '30–60m'
    WHEN ${timing} <= 21600 THEN '1–6h'
    WHEN ${timing} <= 86400 THEN '6–24h'
    ELSE '24h+' END`;
}
