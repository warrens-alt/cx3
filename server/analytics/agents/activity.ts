import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig, tenantVendorScopeValues } from '../../bigquery/config';
import { configuredSourceTable } from '../common/warehouse';
import { RequestError } from '../../bigquery/filters';
import { formatDuration } from '../common/types';
import type { OffernetQueryParams } from '../common/types';

export async function getAgentPerformanceAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const clientConfig = getClientConfig(params.clientId);

  if (params.source || params.medium || params.grade || params.campaign) {
    throw new RequestError('Agent performance supports date, tenant and vendor scope only until cross-source call joins are validated.', 422);
  }

  const conditions = ["user IS NOT NULL AND user != ''"];
  const queryParams: Record<string, any> = {};

  if (params.startDate) {
    conditions.push('DATE(SAFE_CAST(call_start_date AS TIMESTAMP)) >= @startDate');
    queryParams.startDate = params.startDate;
  }
  if (params.endDate) {
    conditions.push('DATE(SAFE_CAST(call_start_date AS TIMESTAMP)) <= @endDate');
    queryParams.endDate = params.endDate;
  }

  if (clientConfig.id !== 'default_tenant') {
    const tenantVendors = tenantVendorScopeValues(clientConfig);
    if (!tenantVendors.length) throw new RequestError('No approved call-vendor mapping exists for this tenant', 422);
    conditions.push('LOWER(vendor) IN UNNEST(@tenantVendors)');
    queryParams.tenantVendors = tenantVendors;
  }

  const cleanVendor = params.vendor && !['all', 'all vendors', 'undefined', 'null'].includes(params.vendor.trim().toLowerCase())
    ? params.vendor.trim()
    : undefined;
  if (cleanVendor) {
    conditions.push('LOWER(vendor) = LOWER(@vendor)');
    queryParams.vendor = cleanVendor;
  }

  const query = `
    SELECT
      user AS agent_id,
      vendor,
      COUNT(*) AS total_calls,
      COUNT(DISTINCT dialer_lead_id) AS unique_leads,
      COUNTIF(is_rpc = true) AS rpc_count,
      COUNTIF(is_sale = true) AS sale_count,
      SUM(length_in_sec) AS total_talk_time_sec,
      ROUND(AVG(length_in_sec), 1) AS avg_duration_sec,
      COUNTIF(is_callback = true) AS callbacks_booked
    FROM ${configuredSourceTable(params.clientId, 'calls')}
    WHERE ${conditions.join(' AND ')}
    GROUP BY user, vendor
    ORDER BY total_calls DESC
    LIMIT 100
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const agents = rows.map((r: any) => {
    const calls = Number(r.total_calls || 0);
    const uniqueLeads = Number(r.unique_leads || 0);
    const rpcs = Number(r.rpc_count || 0);
    const sales = Number(r.sale_count || 0);
    const talkSec = Number(r.total_talk_time_sec || 0);

    return {
      agentId: r.agent_id,
      vendor: r.vendor,
      totalCalls: calls,
      uniqueLeads,
      contactCount: rpcs,
      contactRate: calls > 0 ? Number(((rpcs / calls) * 100).toFixed(1)) : 0,
      salesCount: sales,
      saleRate: rpcs > 0 ? Number(((sales / rpcs) * 100).toFixed(2)) : 0,
      totalTalkTime: formatDuration(talkSec),
      avgHandleTime: `${Math.round(Number(r.avg_duration_sec || 0))}s`,
      callbacksBooked: Number(r.callbacks_booked || 0),
      performanceTier: null
    };
  });

  return {
    agents,
    rankingStatus: 'UNAVAILABLE',
    rankingReason: 'Performance tiers are withheld until an approved agent-performance scoring contract exists.'
  };
}
