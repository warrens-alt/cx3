import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig, tenantVendorScopeValues } from '../../bigquery/config';
import { configuredSourceTable } from '../common/warehouse';
import { RequestError } from '../../bigquery/filters';
import { validTimestampSql } from '../../bigquery/integrity';
import type { OffernetQueryParams } from '../common/types';

export async function getLeadTimeline(leadId: string, params: Pick<OffernetQueryParams, 'clientId' | 'vendor'>) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const clientConfig = getClientConfig(params.clientId);
  const conditions = ['l.lead_id = @leadId'];
  const queryParams: Record<string, any> = { leadId };

  if (clientConfig.id !== 'default_tenant') {
    const tenantVendors = tenantVendorScopeValues(clientConfig);
    if (!tenantVendors.length) throw new RequestError('No approved vendor mapping exists for this tenant', 422);
    if (clientConfig.dataSourceMode === 'shared') conditions.push('LOWER(hlc.vendor) IN UNNEST(@tenantVendors)');
    queryParams.tenantVendors = tenantVendors;
  }

  const cleanVendor = params.vendor && !['all', 'all vendors', 'undefined', 'null'].includes(params.vendor.trim().toLowerCase())
    ? params.vendor.trim()
    : undefined;
  if (cleanVendor) {
    conditions.push('LOWER(hlc.vendor) = LOWER(@vendor)');
    queryParams.vendor = cleanVendor;
  }

  const query = `
    SELECT
      l.lead_id,
      l.consumer_id,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', ${validTimestampSql('l.fetched')}) AS fetched,
      l.offershop_source,
      l.offernet_medium,
      l.offershop_grade,
      l.offershop_color_vetting,
      l.valid_idno,
      l.phone_valid,
      hlc.* REPLACE (
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', ${validTimestampSql('hlc.delivered')}) AS delivered,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', ${validTimestampSql('hlc.first_call_date')}) AS first_call_date,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', ${validTimestampSql('hlc.sale')}) AS sale,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', ${validTimestampSql('hlc.activated')}) AS activated
      )
    FROM ${configuredSourceTable(params.clientId, 'leads')} l
    LEFT JOIN UNNEST(l.hlc_details) hlc
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${validTimestampSql('hlc.delivered')} DESC NULLS LAST, hlc.vendor, hlc.transaction_id
    LIMIT 201
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const row = rows[0];
  if (!row) return null;

  // The deployed source contract does not establish that ledger lead_id equals dialer_lead_id.
  // Do not invent a record association from similarly named IDs.
  const events = rows.slice(0, 200).flatMap((record: Record<string, any>, index: number) =>
    buildFactualTimeline(record, []).filter(event => index === 0 || event.stage !== 'Captured').map(event => ({
      ...event, details: event.stage === 'Captured' ? event.details : `Vendor: ${record.vendor || 'Unknown'} | Transaction: ${record.transaction_id || 'Unavailable'} | ${event.details}`,
    })));
  const vendors = [...new Set(rows.slice(0, 200).map((record: Record<string, any>) => record.vendor).filter(Boolean))];
  return {
    leadId: row.lead_id,
    consumerId: row.consumer_id,
    vendor: vendors.length > 1 ? vendors.join(', ') : row.vendor,
    source: row.offershop_source,
    grade: row.offershop_grade,
    callEvidence: { status: 'CONTRACT_REQUIRED', rowLimit: 0, displayedCalls: 0,
      reason: `Per-call history is withheld: no approved unique ledger-to-dialler lead mapping exists. Ledger capture, delivery, first dial, RPC flags, sale and activation evidence remain available. ${rows.length > 200 ? 'The latest 200 ledger vendor records are shown; this history is truncated.' : `All ${rows.length} matching ledger vendor records are included.`} Warehouse-normalized timestamps are shown in UTC.` },
    events: events.sort((a, b) => (a.timestamp ? Date.parse(a.timestamp) : Infinity) - (b.timestamp ? Date.parse(b.timestamp) : Infinity)),
  };
}

export function timelineTimestamp(value: unknown): string | null {
  const raw = value && typeof value === 'object' && 'value' in value ? (value as { value: unknown }).value : value;
  if (typeof raw !== 'string' || /^(1900|1970)(-|$)/.test(raw.trim())) return null;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function observedFlag(value: unknown): string {
  return value === true || value === 1 || value === 'true' || value === '1' ? 'Yes'
    : value === false || value === 0 || value === 'false' || value === '0' ? 'No' : 'Unavailable';
}

export function buildFactualTimeline(row: Record<string, any>, calls: Array<Record<string, any>>) {
  const events: Array<{ stage: string; title: string; timestamp: string | null; status: 'SUCCESS' | 'INFO' | 'WARNING'; details: string }> = [];
  const add = (stage: string, title: string, value: unknown, details: string) => {
    const timestamp = timelineTimestamp(value);
    if (timestamp) events.push({ stage, title, timestamp, status: 'INFO', details });
  };
  add('Captured', 'Capture timestamp recorded', row.fetched, `Source: ${row.offershop_source || 'Unknown'} | Medium: ${row.offernet_medium || 'Unknown'} | Grade: ${row.offershop_grade || 'Unknown'}`);
  add('Delivered', `Delivery recorded for ${row.vendor || 'Unknown'}`, row.delivered, `Transaction ID: ${row.transaction_id || 'Unavailable'}`);
  for (const [index, call] of calls.entries()) {
    const duration = call.length_in_sec == null || call.length_in_sec === '' ? null : Number(call.length_in_sec);
    const durationText = duration !== null && Number.isFinite(duration) && duration >= 0 ? `${duration}s` : 'Unavailable';
    events.push({ stage: `Call row ${index + 1}`, title: `Recorded call (${call.status_name || 'Disposition unavailable'})`,
      timestamp: timelineTimestamp(call.call_start_date), status: 'INFO',
      details: `Agent: ${call.user || 'Unknown'} | Duration: ${durationText} | RPC: ${observedFlag(call.is_rpc)} | Sale flag: ${observedFlag(call.is_sale)}` });
    if (observedFlag(call.is_rpc) === 'Yes') {
      events.push({ stage: 'RPC', title: 'RPC flag on recorded call', timestamp: timelineTimestamp(call.call_start_date), status: 'INFO',
        details: 'Timestamp is the recorded RPC call start, not a separately observed moment of contact.' });
    }
  }
  if (!calls.length) add('Dialled', 'First dial timestamp recorded', row.first_call_date, `Cumulative call counter: ${row.total_calls ?? 'Unavailable'} | Disposition: ${row.last_dialer_status || 'Unavailable'}`);
  if (Number(row.rpc) > 0 && !calls.some(call => observedFlag(call.is_rpc) === 'Yes')) {
    events.push({ stage: 'RPC', title: 'Ledger RPC evidence, timestamp unavailable', timestamp: null, status: 'WARNING',
      details: 'The ledger records RPC without a contact event timestamp. Capture, delivery and first dial are not substituted.' });
  }
  const revenue = row.revenue_generated == null || row.revenue_generated === '' ? null : Number(row.revenue_generated);
  add('Sale', 'Sale timestamp recorded', row.sale, `Recorded revenue: ${revenue !== null && Number.isFinite(revenue) ? `ZAR ${revenue.toLocaleString()}` : 'Unavailable'}`);
  add('Activated', 'Activation timestamp recorded', row.activated, 'Source activation timestamp; provisioning or collection is not inferred.');
  return events.sort((a, b) => (a.timestamp ? Date.parse(a.timestamp) : Infinity) - (b.timestamp ? Date.parse(b.timestamp) : Infinity));
}
