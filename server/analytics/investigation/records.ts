import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import { configuredSourceTable } from '../common/warehouse';
import { RequestError } from '../../bigquery/filters';
import { buildFilterClause } from '../common/scope';
import type { OffernetQueryParams } from '../common/types';

export async function getRawLeads(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const limit = Math.min(Math.max(Number(params.limit) || 50, 10), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const { whereSql, queryParams } = buildFilterClause(params);

  let searchCondition = '';
  if (params.search) {
    searchCondition = `AND (
      LOWER(l.lead_id) LIKE LOWER(@search)
      OR CAST(l.consumer_id AS STRING) LIKE @search
      OR LOWER(hlc.vendor) LIKE LOWER(@search)
      OR LOWER(l.offershop_source) LIKE LOWER(@search)
      OR LOWER(hlc.last_dialer_status) LIKE LOWER(@search)
    )`;
    queryParams.search = `%${params.search}%`;
  }

  const validDelivered = "(h.delivered IS NOT NULL AND h.delivered NOT LIKE '1900%' AND h.delivered NOT LIKE '1970%')";
  const validDialled = "(h.first_call_date IS NOT NULL AND h.first_call_date NOT LIKE '1900%' AND h.first_call_date NOT LIKE '1970%')";
  const validSale = "(h.sale IS NOT NULL AND h.sale != '' AND h.sale NOT LIKE '1900%' AND h.sale NOT LIKE '1970%')";
  const validActivation = "(h.activated IS NOT NULL AND h.activated != '' AND h.activated NOT LIKE '1900%' AND h.activated NOT LIKE '1970%')";
  let drillCondition = '';

  if (params.drill) {
    const drill = params.drill;
    const value = params.drillValue || '';
    if (drill === 'awaiting-first-dial') {
      drillCondition = `AND EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered})
        AND NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDialled})`;
    } else if (drill === 'missing-disposition') {
      drillCondition = `AND EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE ${validDialled} AND (h.last_dialer_status IS NULL OR TRIM(h.last_dialer_status) = '')
      )`;
    } else if (drill === 'unactivated-sales') {
      drillCondition = `AND EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE ${validSale}
          AND NOT ${validActivation}
          AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.sale AS TIMESTAMP), DAY) >= 14
      )`;
    } else if (drill === 'high-attempt-no-rpc') {
      drillCondition = `AND EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE COALESCE(SAFE_CAST(h.total_calls AS INT64), 0) >= 5
      )
      AND NOT EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE SAFE_CAST(h.rpc AS INT64) > 0
      )`;
    } else if (drill === 'one-call-only') {
      drillCondition = `AND EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE COALESCE(SAFE_CAST(h.total_calls AS INT64), 0) = 1
      )
      AND NOT EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE COALESCE(SAFE_CAST(h.total_calls AS INT64), 0) > 1
      )`;
    } else if (drill === 'sla-breach') {
      drillCondition = `AND EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE ${validDelivered}
          AND (
            (${validDialled} AND TIMESTAMP_DIFF(SAFE_CAST(h.first_call_date AS TIMESTAMP), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) > 900)
            OR (NOT ${validDialled} AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) > 900)
          )
      )`;
    } else if (drill === 'backlog-age') {
      const bucketSql: Record<string, string> = {
        '0–15m': 'BETWEEN 0 AND 900',
        '15–30m': '> 900 AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) <= 1800',
        '30–60m': '> 1800 AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) <= 3600',
        '1–6h': '> 3600 AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) <= 21600',
        '6–12h': '> 21600 AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) <= 43200',
        '12–24h': '> 43200 AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) <= 86400',
        '24h+': '> 86400',
      };
      const suffix = bucketSql[value];
      if (!suffix) throw new RequestError('Unsupported backlog drill bucket', 422);
      drillCondition = `AND EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE ${validDelivered}
          AND NOT ${validDialled}
          AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) ${suffix}
      )`;
    } else if (drill === 'funnel-stage') {
      const conditions: Record<string, string> = {
        'fetched': 'TRUE',
        'delivered': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered})`,
        'dialled': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDialled})`,
        'rpc': 'EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE SAFE_CAST(h.rpc AS INT64) > 0)',
        'sales': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validSale})`,
        'activated': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validActivation})`,
      };
      const condition = conditions[value];
      if (!condition) throw new RequestError('Unsupported funnel-stage drill', 422);
      drillCondition = `AND ${condition}`;
    } else if (drill === 'lead-age') {
      const timing = "TIMESTAMP_DIFF(SAFE_CAST(h.first_call_date AS TIMESTAMP), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND)";
      const conditions: Record<string, string> = {
        'Not delivered': `NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered})`,
        'Undialled': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered}) AND NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDialled})`,
        'Invalid timing': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} < 0)`,
        '0–5m': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} BETWEEN 0 AND 300)`,
        '5–15m': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} > 300 AND ${timing} <= 900)`,
        '15–30m': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} > 900 AND ${timing} <= 1800)`,
        '30–60m': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} > 1800 AND ${timing} <= 3600)`,
        '1–6h': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} > 3600 AND ${timing} <= 21600)`,
        '6–24h': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} > 21600 AND ${timing} <= 86400)`,
        '24h+': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} > 86400)`,
      };
      const condition = conditions[value];
      if (!condition) throw new RequestError('Unsupported lead-age drill bucket', 422);
      drillCondition = `AND ${condition}`;
    } else if (drill === 'funnel-loss') {
      const conditions: Record<string, string> = {
        'fetched-to-delivered': `NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered})`,
        'delivered-to-dialled': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered}) AND NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDialled})`,
        'dialled-to-rpc': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDialled}) AND NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE SAFE_CAST(h.rpc AS INT64) > 0)`,
        'rpc-to-sales': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE SAFE_CAST(h.rpc AS INT64) > 0) AND NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validSale})`,
        'sales-to-activated': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validSale}) AND NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validActivation})`,
      };
      const condition = conditions[value];
      if (!condition) throw new RequestError('Unsupported funnel-loss drill', 422);
      drillCondition = `AND ${condition}`;
    } else {
      throw new RequestError('Unsupported drill-down population', 422);
    }
  }

  const query = `
    SELECT
      l.lead_id,
      l.consumer_id,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', SAFE_CAST(l.fetched AS TIMESTAMP)) as fetched,
      COALESCE(l.offershop_source, 'Unknown') as source,
      COALESCE(l.offernet_medium, 'Unknown') as medium,
      COALESCE(l.offershop_grade, 'Standard') as grade,
      COALESCE(l.offershop_color_vetting, 'Unvetted') as vetting,
      l.valid_lead,
      l.valid_idno,
      l.phone_valid,
      hlc.vendor,
      hlc.transaction_id,
      hlc.status,
      hlc.last_dialer_status,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', SAFE_CAST(hlc.delivered AS TIMESTAMP)) as delivered_time,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', SAFE_CAST(hlc.first_call_date AS TIMESTAMP)) as first_call_time,
      COALESCE(hlc.total_calls, 0) as total_calls,
      hlc.first_call_date IS NOT NULL AND hlc.first_call_date NOT LIKE '1900%' AND hlc.first_call_date NOT LIKE '1970%' as dialled,
      SAFE_CAST(hlc.rpc AS INT64) > 0 as contacted,
      hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' as sale,
      hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' as activated,
      COALESCE(hlc.revenue_generated, 0) as revenue
    FROM ${configuredSourceTable(params.clientId, 'leads')} l
    LEFT JOIN UNNEST(l.hlc_details) hlc
    ${whereSql}
    ${searchCondition}
    ${drillCondition}
    QUALIFY ROW_NUMBER() OVER (
      PARTITION BY l.lead_id
      ORDER BY SAFE_CAST(hlc.delivered AS TIMESTAMP) DESC NULLS LAST
    ) = 1
    ORDER BY SAFE_CAST(l.fetched AS TIMESTAMP) DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const [rows] = await client.query({ query, params: queryParams });
  return {
    rows,
    limit,
    offset,
    drill: params.drill || null,
    drillValue: params.drillValue || null,
  };
}
