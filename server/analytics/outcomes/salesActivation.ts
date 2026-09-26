import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { formatDuration } from '../common/types';
import { configuredSourceTable } from '../common/warehouse';
import { buildFilterClause } from '../common/scope';

// 7. SALES & ACTIVATION INTELLIGENCE
export async function getSalesActivationAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    WITH sales_data AS (
      SELECT 
        l.lead_id,
        hlc.vendor,
        hlc.transaction_id,
        SAFE_CAST(l.fetched AS TIMESTAMP) as fetched_ts,
        SAFE_CAST(hlc.first_call_date AS TIMESTAMP) as dial_ts,
        SAFE_CAST(hlc.sale AS TIMESTAMP) as sale_ts,
        SAFE_CAST(hlc.activated AS TIMESTAMP) as activation_ts,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' as is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' as is_activated,
        COALESCE(hlc.revenue_generated, 0) as revenue
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    summary AS (
      SELECT 
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as total_sales,
        COUNT(DISTINCT CASE WHEN is_sale AND revenue > 0 THEN lead_id END) as billable_sales,
        COUNT(DISTINCT CASE WHEN is_sale AND (revenue = 0 OR revenue IS NULL) THEN lead_id END) as unbilled_sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as total_activations,
        SUM(revenue) as realized_revenue,
        AVG(CASE WHEN is_sale THEN TIMESTAMP_DIFF(sale_ts, fetched_ts, SECOND) END) as avg_time_to_sale_sec,
        AVG(CASE WHEN is_activated THEN TIMESTAMP_DIFF(activation_ts, sale_ts, SECOND) END) as avg_time_to_activation_sec
      FROM sales_data
    ),
    by_vendor AS (
      SELECT 
        vendor,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations,
        ROUND(SUM(revenue), 2) as revenue
      FROM sales_data
      WHERE vendor IS NOT NULL
      GROUP BY vendor
      ORDER BY sales DESC
      LIMIT 10
    )
    SELECT 
      summary.*,
      ARRAY(SELECT AS STRUCT * FROM by_vendor) as vendors
    FROM summary
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const data = rows[0] || {};

  const totalSales = Number(data.total_sales || 0);
  const billable = Number(data.billable_sales || 0);
  const activations = Number(data.total_activations || 0);

  // A maturation curve requires a separately validated activation-event model.
  // Do not substitute a static benchmark for observed cohort evidence.
  const maturationCurve: Array<{ day: string; activationSharePct: number; cumulativePct: number }> = [];

  return {
    reconciliation: {
      totalSales,
      billableSales: billable,
      unbilledSales: Number(data.unbilled_sales || 0),
      totalActivations: activations,
      activationRate: totalSales > 0 ? Number(((activations / totalSales) * 100).toFixed(1)) : 0,
      realizedRevenue: Number(data.realized_revenue || 0),
      avgTimeToSale: formatDuration(data.avg_time_to_sale_sec),
      avgTimeToActivation: formatDuration(data.avg_time_to_activation_sec)
    },
    maturationCurve,
    maturationStatus: 'UNAVAILABLE',
    maturationReason: 'Activation maturation is withheld until event-level activation joins are independently validated.',
    byVendor: data.vendors || []
  };
}
