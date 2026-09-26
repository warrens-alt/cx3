/** Shared predicates keep queue counts and administrator record drills at identical lead grain. */
export const EXCEPTION_DEFINITIONS = [
  { id: 'awaiting-first-dial', title: 'Awaiting first dial', severity: 'medium', detail: 'Delivered leads without a recorded first dial.' },
  { id: 'waiting-over-hour', title: 'Waiting longer than one hour', severity: 'high', detail: 'Delivered leads without a first dial more than 60 minutes after delivery.' },
  { id: 'sla-breach', title: '15-minute first-dial breach', severity: 'high', detail: 'Delivery-to-first-dial exceeds 15 minutes, or undialled delivery age exceeds 15 minutes.' },
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
  return ({
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
  } as Record<string, string>)[id];
}
