import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { formatDuration } from '../common/types';
import { configuredSourceTable } from '../common/warehouse';
import { buildFilterClause } from '../common/scope';

// 2. FUNNEL INTELLIGENCE
export async function getFunnelIntelligence(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    WITH base AS (
      SELECT 
        l.lead_id,
        SAFE_CAST(l.fetched AS TIMESTAMP) as fetched_ts,
        SAFE_CAST(hlc.delivered AS TIMESTAMP) as delivered_ts,
        SAFE_CAST(hlc.first_call_date AS TIMESTAMP) as first_dial_ts,
        COALESCE(hlc.vendor, 'Unknown') as vendor,
        COALESCE(l.offershop_source, 'Unknown') as source,
        COALESCE(l.offershop_grade, 'Standard') as grade,
        SAFE_CAST(hlc.sale AS TIMESTAMP) as sale_ts,
        SAFE_CAST(hlc.activated AS TIMESTAMP) as activation_ts,
        SAFE_CAST(hlc.rpc AS INT64) > 0 as is_rpc,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' as is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' as is_activated,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.delivered AS TIMESTAMP), SAFE_CAST(l.fetched AS TIMESTAMP), SECOND) as fetch_to_delivery_sec,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.first_call_date AS TIMESTAMP), SAFE_CAST(hlc.delivered AS TIMESTAMP), SECOND) as delivery_to_first_dial_sec,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.sale AS TIMESTAMP), SAFE_CAST(hlc.first_call_date AS TIMESTAMP), SECOND) as dial_to_sale_sec,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.activated AS TIMESTAMP), SAFE_CAST(hlc.sale AS TIMESTAMP), SECOND) as sale_to_act_sec
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    velocity AS (
      SELECT 
        AVG(CASE WHEN fetch_to_delivery_sec BETWEEN 0 AND 86400 THEN fetch_to_delivery_sec END) as avg_fetch_delivery_sec,
        AVG(CASE WHEN delivery_to_first_dial_sec BETWEEN 0 AND 604800 THEN delivery_to_first_dial_sec END) as avg_deliv_dial_sec,
        AVG(CASE WHEN dial_to_sale_sec BETWEEN 0 AND 2592000 THEN dial_to_sale_sec END) as avg_dial_to_sale_sec,
        AVG(CASE WHEN sale_to_act_sec BETWEEN 0 AND 2592000 THEN sale_to_act_sec END) as avg_sale_to_act_sec
      FROM base
    ),
    by_vendor AS (
      SELECT 
        vendor,
        COUNT(DISTINCT lead_id) as leads,
        COUNT(DISTINCT CASE WHEN delivered_ts IS NOT NULL THEN lead_id END) as delivered,
        COUNT(DISTINCT CASE WHEN first_dial_ts IS NOT NULL THEN lead_id END) as dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations
      FROM base
      GROUP BY vendor
      ORDER BY leads DESC
      LIMIT 12
    ),
    by_source AS (
      SELECT 
        source,
        COUNT(DISTINCT lead_id) as leads,
        COUNT(DISTINCT CASE WHEN delivered_ts IS NOT NULL THEN lead_id END) as delivered,
        COUNT(DISTINCT CASE WHEN first_dial_ts IS NOT NULL THEN lead_id END) as dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations
      FROM base
      GROUP BY source
      ORDER BY leads DESC
      LIMIT 10
    ),
    by_grade AS (
      SELECT 
        grade,
        COUNT(DISTINCT lead_id) as leads,
        COUNT(DISTINCT CASE WHEN delivered_ts IS NOT NULL THEN lead_id END) as delivered,
        COUNT(DISTINCT CASE WHEN first_dial_ts IS NOT NULL THEN lead_id END) as dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations
      FROM base
      GROUP BY grade
      ORDER BY leads DESC
      LIMIT 8
    )
    SELECT 
      (SELECT AS STRUCT * FROM velocity) as velocity,
      ARRAY(SELECT AS STRUCT * FROM by_vendor) as vendors,
      ARRAY(SELECT AS STRUCT * FROM by_source) as sources,
      ARRAY(SELECT AS STRUCT * FROM by_grade) as grades
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const data = rows[0] || { velocity: {}, vendors: [], sources: [], grades: [] };

  return {
    velocity: {
      fetchToDelivery: formatDuration(data.velocity?.avg_fetch_delivery_sec),
      deliveryToFirstDial: formatDuration(data.velocity?.avg_deliv_dial_sec),
      firstDialToContact: 'Unavailable',
      contactToSale: formatDuration(data.velocity?.avg_dial_to_sale_sec),
      saleToActivation: formatDuration(data.velocity?.avg_sale_to_act_sec)
    },
    byVendor: data.vendors || [],
    bySource: data.sources || [],
    byGrade: data.grades || []
  };
}
