import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig, tenantVendorScopeValues } from '../../bigquery/config';
import { configuredSourceTable } from '../common/warehouse';
import { RequestError } from '../../bigquery/filters';
import { validTimestampSql } from '../../bigquery/integrity';
import { formatDuration } from '../common/types';
import type { OffernetQueryParams } from '../common/types';

function measuredNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function completeCount(value: unknown, observed: number | null, population: number): number | null {
  const count = measuredNumber(value);
  return population > 0 && observed === population && count !== null && count <= population ? count : null;
}

export async function getAgentPerformanceAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const clientConfig = getClientConfig(params.clientId);

  if (params.source || params.medium || params.grade || params.campaign || params.cli || params.channel || params.adset) {
    throw new RequestError('Agent performance supports date, tenant and vendor scope only until cross-source call joins are validated.', 422);
  }

  const conditions = ["user IS NOT NULL AND user != ''"];
  const queryParams: Record<string, any> = { agentTimezone: clientConfig.timezone };
  if (params.agent) { conditions.push('CAST(user AS STRING) = @agent'); queryParams.agent = params.agent; }

  if (params.startDate) {
    conditions.push(`DATE(${validTimestampSql('call_start_date')}, @agentTimezone) >= @startDate`);
    queryParams.startDate = params.startDate;
  }
  if (params.endDate) {
    conditions.push(`DATE(${validTimestampSql('call_start_date')}, @agentTimezone) <= @endDate`);
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
    WITH scoped_calls AS (
      SELECT user AS agent_id, vendor, dialer_lead_id,
        ${validTimestampSql('call_start_date')} AS call_ts,
        SAFE_CAST(is_rpc AS BOOL) AS rpc_flag,
        SAFE_CAST(is_sale AS BOOL) AS sale_flag,
        SAFE_CAST(is_callback AS BOOL) AS callback_flag,
        SAFE_CAST(length_in_sec AS FLOAT64) AS raw_duration
      FROM ${configuredSourceTable(params.clientId, 'calls')}
      WHERE ${conditions.join(' AND ')}
    ), normalized_calls AS (
      SELECT * EXCEPT(raw_duration),
        CASE WHEN raw_duration >= 0 AND NOT IS_INF(raw_duration) AND NOT IS_NAN(raw_duration)
          THEN raw_duration END AS duration_sec
      FROM scoped_calls
    )
    SELECT
      d.dimension, d.bucket,
      agent_id,
      vendor,
      COUNT(*) AS total_calls,
      COUNT(DISTINCT dialer_lead_id) AS unique_leads,
      COUNTIF(rpc_flag IS NOT NULL) AS rpc_observed_calls,
      COUNTIF(rpc_flag) AS rpc_count,
      COUNTIF(sale_flag IS NOT NULL) AS sale_observed_calls,
      COUNTIF(sale_flag) AS sale_count,
      COUNTIF(rpc_flag AND sale_flag IS NOT NULL) AS rpc_sale_observed_calls,
      COUNTIF(rpc_flag AND sale_flag) AS rpc_sale_count,
      COUNTIF(duration_sec IS NOT NULL) AS duration_observed_calls,
      SUM(duration_sec) AS total_talk_time_sec,
      ROUND(AVG(duration_sec), 1) AS avg_duration_sec,
      COUNTIF(callback_flag IS NOT NULL) AS callback_observed_calls,
      COUNTIF(callback_flag) AS callbacks_booked
    FROM normalized_calls
    CROSS JOIN UNNEST([
      STRUCT('roster' AS dimension, 'All calls' AS bucket),
      STRUCT('day' AS dimension, CAST(DATE(call_ts, @agentTimezone) AS STRING) AS bucket),
      STRUCT('hour' AS dimension, CAST(EXTRACT(HOUR FROM DATETIME(call_ts, @agentTimezone)) AS STRING) AS bucket)
    ]) d
    GROUP BY d.dimension, d.bucket, agent_id, vendor
    QUALIFY ROW_NUMBER() OVER (PARTITION BY d.dimension ORDER BY total_calls DESC, agent_id, vendor, d.bucket) <= 101
    ORDER BY total_calls DESC, agent_id, vendor, d.bucket
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const mapped = rows.map((r: any) => {
    const calls = Number(r.total_calls || 0);
    const uniqueLeads = Number(r.unique_leads || 0);
    const rpcObserved = measuredNumber(r.rpc_observed_calls);
    const saleObserved = measuredNumber(r.sale_observed_calls);
    const callbackObserved = measuredNumber(r.callback_observed_calls);
    const durationObserved = measuredNumber(r.duration_observed_calls);
    const rpcSaleObserved = measuredNumber(r.rpc_sale_observed_calls);
    const rpcs = completeCount(r.rpc_count, rpcObserved, calls);
    const sales = completeCount(r.sale_count, saleObserved, calls);
    // Conversion must count sales and contacts in the same call population.
    // Missing sales flags on non-RPC calls do not hide known RPC conversion.
    const rpcSales = rpcs === null ? null : rpcs === 0 ? 0 : completeCount(r.rpc_sale_count, rpcSaleObserved, rpcs);
    const talkSec = durationObserved === calls && calls > 0 ? measuredNumber(r.total_talk_time_sec) : null;
    const averageSec = durationObserved === calls && calls > 0 ? measuredNumber(r.avg_duration_sec) : null;

    return {
      dimension: r.dimension || 'roster',
      bucket: r.bucket || 'All calls',
      agentId: r.agent_id,
      vendor: r.vendor,
      totalCalls: calls,
      uniqueLeads,
      contactCount: rpcs,
      contactRate: calls > 0 && rpcs !== null ? Number(((rpcs / calls) * 100).toFixed(1)) : null,
      salesCount: sales,
      rpcSalesCount: rpcSales,
      saleRate: rpcs !== null && rpcs > 0 && rpcSales !== null ? Number(((rpcSales / rpcs) * 100).toFixed(2)) : null,
      totalTalkTime: talkSec === null ? null : formatDuration(talkSec),
      avgHandleTime: averageSec === null ? null : `${Math.round(averageSec)}s`,
      callbacksBooked: completeCount(r.callbacks_booked, callbackObserved, calls),
      fieldCoverage: {
        rpc: { observedCalls: rpcObserved, totalCalls: calls },
        sale: { observedCalls: saleObserved, totalCalls: calls },
        callback: { observedCalls: callbackObserved, totalCalls: calls },
        duration: { observedCalls: durationObserved, totalCalls: calls },
        saleAmongRpc: { observedCalls: rpcSaleObserved, totalCalls: rpcs },
      },
      performanceTier: null
    };
  });

  const agents = mapped.filter(row => row.dimension === 'roster').slice(0, 100);
  return {
    agents,
    breakdowns: {
      day: mapped.filter(row => row.dimension === 'day').slice(0, 100),
      hour: mapped.filter(row => row.dimension === 'hour').slice(0, 100),
    },
    scope: { timezone: clientConfig.timezone, dateBasis: 'call_start_date', rowLimitPerDimension: 100,
      truncated: ['roster', 'day', 'hour'].some(dimension => mapped.filter(row => row.dimension === dimension).length > 100),
      campaignStatus: 'UNAVAILABLE', campaignReason: 'Campaign grouping requires an approved call-campaign field contract.' },
    metricAvailabilityReason: 'Outcome counts and durations require recorded values for every call in their population. Missing or invalid observations remain unavailable; measured zeroes remain zero. Sales conversion counts sold RPC call rows divided by RPC call rows and requires complete RPC flags and sales flags on those RPC calls.',
    rankingStatus: 'UNAVAILABLE',
    rankingReason: 'Performance tiers are withheld until an approved agent-performance scoring contract exists.'
  };
}
