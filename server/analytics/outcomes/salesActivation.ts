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
        COUNTIF(is_sale AND revenue IS NOT NULL) AS revenue_present_sales,
        COUNT(DISTINCT CASE WHEN is_sale AND revenue = 0 THEN lead_id END) as unbilled_sales,
        COUNTIF(is_sale AND revenue IS NULL) AS unrecorded_revenue_sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as total_activations,
        SUM(revenue) as realized_revenue,
        AVG(CASE WHEN is_sale AND sale_ts >= fetched_ts THEN TIMESTAMP_DIFF(sale_ts, fetched_ts, SECOND) END) as avg_time_to_sale_sec,
        AVG(CASE WHEN is_activated AND activation_ts >= sale_ts THEN TIMESTAMP_DIFF(activation_ts, sale_ts, SECOND) END) as avg_time_to_activation_sec,
        APPROX_QUANTILES(CASE WHEN is_sale AND sale_ts >= fetched_ts THEN TIMESTAMP_DIFF(sale_ts, fetched_ts, SECOND) END, 100)[OFFSET(50)] AS median_time_to_sale_sec,
        APPROX_QUANTILES(CASE WHEN is_activated AND activation_ts >= sale_ts THEN TIMESTAMP_DIFF(activation_ts, sale_ts, SECOND) END, 100)[OFFSET(50)] AS median_time_to_activation_sec
      FROM sales_data
    ),
    by_segment AS (
      SELECT dimension, segment,
        COUNTIF(is_sale) AS sales, COUNTIF(is_activated) AS activations,
        ROUND(SUM(revenue), 2) AS revenue,
        COUNTIF(is_sale AND revenue IS NULL) AS unrecorded_revenue_sales
      FROM sales_data CROSS JOIN UNNEST([
        STRUCT('vendor' AS dimension, COALESCE(NULLIF(vendor, ''), 'Unrecorded') AS segment),
        STRUCT('source', COALESCE(NULLIF(source, ''), 'Unrecorded')),
        STRUCT('grade', COALESCE(NULLIF(grade, ''), 'Unrecorded'))])
      GROUP BY dimension, segment
    ), activation_ageing AS (
      SELECT CASE WHEN sale_ts > CURRENT_TIMESTAMP() THEN 'Invalid future sale'
        WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) <= 3 THEN '0–3d'
        WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) <= 7 THEN '4–7d'
        WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) <= 14 THEN '8–14d'
        WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) <= 30 THEN '15–30d'
        ELSE '30d+' END AS bucket, COUNT(*) AS sales
      FROM sales_data WHERE is_sale AND NOT is_activated GROUP BY bucket
    )
    SELECT summary.*,
      ARRAY(SELECT AS STRUCT * FROM by_segment ORDER BY dimension, sales DESC) AS segments,
      ARRAY(SELECT AS STRUCT * FROM activation_ageing) AS activation_ageing
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
      salesWithRecordedRevenue: Number(data.revenue_present_sales || 0),
      unbilledSales: Number(data.unbilled_sales || 0),
      unrecordedRevenueSales: Number(data.unrecorded_revenue_sales || 0),
      totalActivations: activations,
      activationRate: metricPercent(activations, totalSales),
      realizedRevenue: data.realized_revenue == null ? null : Number(data.realized_revenue),
      avgTimeToSale: formatDuration(data.avg_time_to_sale_sec),
      avgTimeToActivation: formatDuration(data.avg_time_to_activation_sec),
      medianTimeToSale: formatDuration(data.median_time_to_sale_sec), medianTimeToActivation: formatDuration(data.median_time_to_activation_sec)
    },
    maturationCurve,
    maturationStatus: 'UNAVAILABLE',
    maturationReason: 'Activation maturation is withheld until event-level activation joins are independently validated.',
    byVendor: (data.segments || []).filter((r: any) => r.dimension === 'vendor').map((r: any) => ({ ...r, vendor: r.segment })),
    bySource: (data.segments || []).filter((r: any) => r.dimension === 'source'),
    byGrade: (data.segments || []).filter((r: any) => r.dimension === 'grade'),
    activationAgeing: ['0–3d','4–7d','8–14d','15–30d','30d+','Invalid future sale'].map(bucket => ({ bucket, sales: Number((data.activation_ageing || []).find((r: any) => r.bucket === bucket)?.sales || 0) })),
    revenueEvidence: 'Recorded revenue is the sum of available source values, including real zero. Sales with missing revenue are reported separately; recorded revenue is not a complete revenue estimate.',
    segmentMethodology: 'One lead per segment. Vendor uses earliest recorded delivery vendor. Revenue per sale is recorded segment revenue / recorded segment sales; null revenue and empty denominators remain unavailable. Campaign requires an approved operational mapping.'
  };
}
