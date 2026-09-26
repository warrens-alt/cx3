import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { formatDuration } from '../common/types';
import { buildFilterClause } from '../common/scope';
import { operationalLeadCtes, metricPercent } from '../common/leadMetrics';

// 7. SALES & ACTIVATION INTELLIGENCE
export async function getSalesActivationAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const { queryParams } = buildFilterClause(params);

  const query = `
    WITH ${operationalLeadCtes(params)},
    sales_data AS (SELECT * FROM operational_leads),
    summary AS (
      SELECT 
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as total_sales,
        COUNT(DISTINCT CASE WHEN is_sale AND revenue > 0 THEN lead_id END) as billable_sales,
        COUNT(DISTINCT CASE WHEN is_sale AND revenue = 0 THEN lead_id END) as unbilled_sales,
        COUNTIF(is_sale AND revenue IS NULL) AS unrecorded_revenue_sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as total_activations,
        CASE WHEN COUNTIF(revenue IS NULL) > 0 THEN NULL ELSE SUM(revenue) END as realized_revenue,
        AVG(CASE WHEN is_sale AND sale_ts >= fetched_ts THEN TIMESTAMP_DIFF(sale_ts, fetched_ts, SECOND) END) as avg_time_to_sale_sec,
        AVG(CASE WHEN is_activated AND activation_ts >= sale_ts THEN TIMESTAMP_DIFF(activation_ts, sale_ts, SECOND) END) as avg_time_to_activation_sec
      FROM sales_data
    ),
    by_vendor AS (
      SELECT 
        vendor,
        COUNT(DISTINCT CASE WHEN sale_ts IS NOT NULL THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN activation_ts IS NOT NULL THEN lead_id END) as activations,
        ROUND(SUM(revenue), 2) as revenue
      FROM operational_raw
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
      unrecordedRevenueSales: Number(data.unrecorded_revenue_sales || 0),
      totalActivations: activations,
      activationRate: metricPercent(activations, totalSales),
      realizedRevenue: data.realized_revenue == null ? null : Number(data.realized_revenue),
      avgTimeToSale: formatDuration(data.avg_time_to_sale_sec),
      avgTimeToActivation: formatDuration(data.avg_time_to_activation_sec)
    },
    maturationCurve,
    maturationStatus: 'UNAVAILABLE',
    maturationReason: 'Activation maturation is withheld until event-level activation joins are independently validated.',
    byVendor: data.vendors || []
  };
}
