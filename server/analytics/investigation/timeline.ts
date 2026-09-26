import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig, tenantVendorScopeValues } from '../../bigquery/config';
import { configuredSourceTable } from '../common/warehouse';
import { RequestError } from '../../bigquery/filters';
import type { OffernetQueryParams } from '../common/types';

export async function getLeadTimeline(leadId: string, params: Pick<OffernetQueryParams, 'clientId' | 'vendor'>) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const clientConfig = getClientConfig(params.clientId);
  const conditions = ['l.lead_id = @leadId'];
  const queryParams: Record<string, any> = { leadId };
  const callConditions = ['CAST(dialer_lead_id AS STRING) = @leadId'];

  if (clientConfig.id !== 'default_tenant') {
    const tenantVendors = tenantVendorScopeValues(clientConfig);
    if (!tenantVendors.length) throw new RequestError('No approved vendor mapping exists for this tenant', 422);
    if (clientConfig.dataSourceMode === 'shared') conditions.push('LOWER(hlc.vendor) IN UNNEST(@tenantVendors)');
    callConditions.push('LOWER(vendor) IN UNNEST(@tenantVendors)');
    queryParams.tenantVendors = tenantVendors;
  }

  const cleanVendor = params.vendor && !['all', 'all vendors', 'undefined', 'null'].includes(params.vendor.trim().toLowerCase())
    ? params.vendor.trim()
    : undefined;
  if (cleanVendor) {
    conditions.push('LOWER(hlc.vendor) = LOWER(@vendor)');
    callConditions.push('LOWER(vendor) = LOWER(@vendor)');
    queryParams.vendor = cleanVendor;
  }

  const query = `
    SELECT
      l.lead_id,
      l.consumer_id,
      l.fetched,
      l.offershop_source,
      l.offernet_medium,
      l.offershop_grade,
      l.offershop_color_vetting,
      l.valid_idno,
      l.phone_valid,
      hlc.*
    FROM ${configuredSourceTable(params.clientId, 'leads')} l
    LEFT JOIN UNNEST(l.hlc_details) hlc
    WHERE ${conditions.join(' AND ')}
    ORDER BY SAFE_CAST(hlc.delivered AS TIMESTAMP) DESC
    LIMIT 1
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const row = rows[0];
  if (!row) return null;

  let vicidialCalls: any[] = [];
  try {
    const [callRows] = await client.query({
      query: `
        SELECT
          call_start_date,
          call_end_date,
          length_in_sec,
          user,
          status_name,
          is_rpc,
          is_sale,
          is_callback,
          called_count
        FROM ${configuredSourceTable(params.clientId, 'calls')}
        WHERE ${callConditions.join(' AND ')}
        ORDER BY SAFE_CAST(call_start_date AS TIMESTAMP) ASC
        LIMIT 500
      `,
      params: queryParams
    });
    vicidialCalls = callRows;
  } catch {
    vicidialCalls = [];
  }

  const events: any[] = [];

  if (row.fetched && !String(row.fetched).startsWith('1900') && !String(row.fetched).startsWith('1970')) {
    events.push({
      stage: 'Captured',
      title: 'Lead Captured & Ingested',
      timestamp: row.fetched,
      status: 'SUCCESS',
      details: `Source: ${row.offershop_source || 'Unknown'} | Medium: ${row.offernet_medium || 'Unknown'} | Grade: ${row.offershop_grade || 'Unknown'}`
    });
  }

  if (row.delivered && !String(row.delivered).startsWith('1900') && !String(row.delivered).startsWith('1970')) {
    events.push({
      stage: 'Delivered',
      title: `Delivery recorded for ${row.vendor || 'Unknown'}`,
      timestamp: row.delivered,
      status: 'SUCCESS',
      details: `Transaction ID: ${row.transaction_id || 'N/A'}`
    });
  }

  if (vicidialCalls.length > 0) {
    vicidialCalls.forEach((call, index) => {
      events.push({
        stage: `Attempt ${call.called_count || index + 1}`,
        title: `Dial attempt ${call.called_count || index + 1} (${call.status_name || 'Disposition recorded'})`,
        timestamp: call.call_start_date,
        status: call.is_rpc ? 'SUCCESS' : 'INFO',
        details: `Agent: ${call.user || 'Unknown'} | Duration: ${call.length_in_sec || 0}s | RPC: ${call.is_rpc ? 'Yes' : 'No'} | Sale flag: ${call.is_sale ? 'Yes' : 'No'}`
      });
    });
  } else if (row.first_call_date && !String(row.first_call_date).startsWith('1900') && !String(row.first_call_date).startsWith('1970')) {
    events.push({
      stage: 'Dialled',
      title: `First dial timestamp recorded (${row.last_dialer_status || 'No disposition'})`,
      timestamp: row.first_call_date,
      status: 'INFO',
      details: `Cumulative call counter: ${row.total_calls ?? 'Unknown'}`
    });
  }

  if (Number(row.rpc || 0) > 0 || vicidialCalls.some(call => call.is_rpc)) {
    events.push({
      stage: 'Contacted',
      title: 'Right Party Contact flag recorded',
      timestamp: row.first_call_date || row.delivered,
      status: 'INFO',
      details: 'RPC evidence is shown as recorded by the source system; no additional customer-verification claim is inferred.'
    });
  }

  if (row.sale && !String(row.sale).startsWith('1900') && !String(row.sale).startsWith('1970')) {
    events.push({
      stage: 'Sale',
      title: 'Sale timestamp recorded',
      timestamp: row.sale,
      status: 'INFO',
      details: `Recorded revenue field: ZAR ${Number(row.revenue_generated || 0).toLocaleString()}`
    });
  }

  if (row.activated && !String(row.activated).startsWith('1900') && !String(row.activated).startsWith('1970')) {
    events.push({
      stage: 'Activated',
      title: 'Activation timestamp recorded',
      timestamp: row.activated,
      status: 'INFO',
      details: 'Activation is reported exactly as represented in the source row; provisioning or collection is not inferred.'
    });
  }

  return {
    leadId: row.lead_id,
    consumerId: row.consumer_id,
    vendor: row.vendor,
    source: row.offershop_source,
    grade: row.offershop_grade,
    events: events.sort((a, b) => Date.parse(a.timestamp || '') - Date.parse(b.timestamp || ''))
  };
}
